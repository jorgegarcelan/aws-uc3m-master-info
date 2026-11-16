#!/usr/bin/env node
// slaas deck CLI — run inside a deck folder:  node slaas/cli.mjs <command>
import { readFileSync, cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { spawn } from "node:child_process";
import { findDeckRoot, slideOrder, loadConfig, slug } from "./lib/config.mjs";
import { build } from "./lib/build.mjs";
import { startServer } from "./lib/serve.mjs";
import { thumbs, shots, check, pdf, resolveSlides } from "./lib/capture.mjs";
import { verify } from "./lib/verify.mjs";

const HELP = `slaas ${readFileSync(new URL("./VERSION", import.meta.url), "utf8").trim()} — deck commands (run inside the deck folder)

  dev [port] [--open] [--no-live]   present + edit server (default port 8765), live reload on file changes
  build [--out f] [--only 03,04] [--novideo] [--list]
                                    assemble index.html from slaas.json, slides/, theme/
  check [slides…] [--json]          render every slide headless: JS errors, missing files, text off the stage,
                                    under the footer, clipped or overlapping; build warnings (ids, builders)
  verify [slides…] [--json] [--no-reload] [--no-reduced] [--speed 6]
                                    walk every step of every slide like a presenter: each state (#12.3) must look
                                    the same reached with →, with ←, with the browser's Back, reloading its URL
                                    and with reduced motion; contact sheet of all states → .slaas/verify/
  shot <slides…> [--t 0.5,1.2] [--scale 0.5] [--out dir]
                                    PNG of each slide at its final state (or at those times) → .slaas/shots/
  thumbs [slides…]                  grid thumbnails → assets/thumbs/
  pdf [--out file.pdf]              one page per visible slide
  dist [--out dist]                 static folder ready to deploy (Vercel, Netlify, GitHub Pages…)

Slides can be given as a file name, a unique prefix (03) or a position in the running order.
Needs Node ≥ 22; check / shot / thumbs / pdf also need Google Chrome (or CHROME_PATH).`;

const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);
const flag = (k) => rest.includes(k);
const opt = (k) => { const i = rest.indexOf(k); return i > -1 ? rest[i + 1] : null; };
const VALUE_FLAGS = ["--out", "--only", "--t", "--scale", "--speed"];
const positional = () => rest.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(rest[i - 1]));

function openBrowser(url) {
  const c = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  spawn(c[0], c[1], { stdio: "ignore", detached: true }).unref();
}
function printBuild(r) {
  console.log(`${r.out} ← ${r.count} slides (${r.hidden} hidden)`);
  r.warnings.forEach((w) => console.log("  ⚠ " + w));
}

async function main() {
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") return console.log(HELP);
  const root = findDeckRoot();

  if (cmd === "build") {
    if (flag("--list")) return console.log(JSON.stringify(slideOrder(root)));
    const only = opt("--only");
    return printBuild(build(root, { out: opt("--out") || "index.html", only: only ? only.split(",").map((s) => s.trim()) : null, novideo: flag("--novideo") }));
  }

  if (cmd === "dev") {
    printBuild(build(root));
    let srv;
    // grid thumbnails stay current in the background: missing ones at start, then whatever changes
    let running = false;
    const pending = new Set();
    const queueThumbs = (files) => {
      (files === "*" ? slideOrder(root).map((s) => s.file) : files).forEach((f) => pending.add(f));
      (async function run() {
        if (running || !pending.size || !srv) return;
        running = true;
        const batch = [...pending].filter((f) => existsSync(join(root, "slides", f))); pending.clear();
        try { await thumbs(root, batch, { base: srv.url }); } catch {}
        running = false; run();
      })();
    };
    srv = await startServer(root, { port: +(positional()[0] || 8765), live: !flag("--no-live"), onSaved: (f) => queueThumbs([f]), onChanged: queueThumbs });
    console.log(`\n  ${loadConfig(root).title || "slaas"}\n  ${srv.url}   E edit · G grid / organize · P presenter · H help\n  Leave this running while you present or edit (Ctrl+C to stop).\n`);
    if (flag("--open")) openBrowser(srv.url);
    queueThumbs(slideOrder(root).map((s) => s.file).filter((f) => !existsSync(join(root, "assets", "thumbs", f.replace(/\.html$/, ".jpg")))));
    return;
  }

  if (cmd === "thumbs") {
    const files = positional().length ? resolveSlides(root, positional()) : null;
    const res = await thumbs(root, files);
    res.forEach((r) => console.log(r.ok ? `✓ ${r.file}` : `✗ ${r.file}  ${r.error}`));
    if (res.some((r) => !r.ok)) process.exitCode = 1;
    return;
  }

  if (cmd === "shot") {
    const names = positional();
    if (!names.length) throw new Error("Which slides? e.g.  node slaas/cli.mjs shot 03 04-results.html");
    const times = (opt("--t") || "").split(",").filter(Boolean).map(Number);
    const res = await shots(root, resolveSlides(root, names), { times, scale: +(opt("--scale") || 0.5), outDir: opt("--out") ? join(root, opt("--out")) : undefined });
    res.forEach((r) => { console.log(r.path); r.errors.forEach((e) => console.log("  ✗ " + e)); });
    return;
  }

  if (cmd === "check") {
    const files = positional().length ? resolveSlides(root, positional()) : null;
    const r = await check(root, files);
    if (flag("--json")) return console.log(JSON.stringify(r, null, 2));
    r.warnings.forEach((w) => console.log("⚠ " + w));
    r.deckErrors.forEach((e) => console.log("✗ deck: " + e));
    let bad = r.deckErrors.length, warn = 0;
    for (const s of r.slides) {
      const head = `${s.file}${s.hidden ? " (hidden)" : ""} · ${s.steps ?? "?"} step(s) · ${s.duration ?? "?"}s${s.notes === false ? " · no notes" : ""}`;
      if (!s.errors.length && !s.issues.length) { console.log("✓ " + head); continue; }
      console.log((s.errors.length ? "✗ " : "△ ") + head);
      s.errors.forEach((e) => { bad++; console.log("    error    " + e); });
      s.issues.forEach((i) => { warn++; console.log(`    ${i.type.padEnd(8)} ${i.el}${i.with ? "  ×  " + i.with : ""}${i.bottom ? `  (bottom ${i.bottom} > ${i.limit})` : ""}${i.visible ? `  (${i.visible} visible)` : ""}${i.box ? `  [${i.box.join(", ")}]` : ""}`); });
    }
    console.log(`\n${r.slides.length} slides · ${bad} error(s) · ${warn} layout warning(s) · ${r.warnings.length} build warning(s)`);
    if (bad || r.warnings.length) process.exitCode = 1;
    return;
  }

  if (cmd === "verify") {
    const files = positional().length ? resolveSlides(root, positional()) : null;
    const t0 = Date.now();
    if (!flag("--json")) process.stdout.write("walking every step");
    const r = await verify(root, files, { speed: +(opt("--speed") || 6), reload: !flag("--no-reload"), reduced: !flag("--no-reduced"), onSlide: () => { if (!flag("--json")) process.stdout.write("."); } });
    if (flag("--json")) return console.log(JSON.stringify(r, null, 2));
    console.log("\n");
    let bad = 0, states = 0;
    for (const s of r.slides) {
      states += s.states;
      const names = Array.from({ length: s.states }, (_, k) => `#${s.slide}${k ? "." + k : ""}`);
      const head = `${s.file} · ${s.states} state(s) ${names.length > 4 ? names.slice(0, 2).join(" ") + " … " + names[names.length - 1] : names.join(" ")}`;
      if (!s.problems.length && !s.errors.length) { console.log("✓ " + head); continue; }
      console.log("✗ " + head);
      s.errors.forEach((e) => { bad++; console.log("    error    " + e); });
      s.problems.forEach((p) => { bad++; console.log(`    ${p.at.padEnd(7)} ${p.kind.padEnd(8)} ${p.msg}${p.image ? "\n" + " ".repeat(21) + "→ " + relative(root, p.image) : ""}`); });
    }
    console.log(`\n${r.slides.length} slides · ${states} states · ${bad} problem(s)${r.hidden ? ` · ${r.hidden} hidden slide(s) not walked` : ""} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    console.log(`every state: ${r.sheets.map((f) => relative(root, f)).join(", ")}`);
    if (bad) process.exitCode = 1;
    return;
  }

  if (cmd === "pdf") {
    const out = opt("--out") || slug(loadConfig(root).title || "deck") + ".pdf";
    const r = await pdf(root, join(root, out));
    return console.log(`${relative(process.cwd(), r.out) || r.out} ← ${r.pages} pages`);
  }

  if (cmd === "dist") {
    const out = join(root, opt("--out") || "dist");
    printBuild(build(root));
    rmSync(out, { recursive: true, force: true });
    mkdirSync(join(out, "slaas"), { recursive: true });
    cpSync(join(root, "index.html"), join(out, "index.html"));
    cpSync(join(root, "slaas", "engine.js"), join(out, "slaas", "engine.js"));
    cpSync(join(root, "slaas", "engine.css"), join(out, "slaas", "engine.css"));
    for (const f of ["components.js", "components.css"]) cpSync(join(root, "slaas", f), join(out, "slaas", f));
    cpSync(join(root, "slaas", "vendor"), join(out, "slaas", "vendor"), { recursive: true });
    cpSync(join(root, "theme"), join(out, "theme"), { recursive: true, filter: (s) => !/(DESIGN\.md|theme\.json)$/.test(s) });
    if (existsSync(join(root, "assets"))) cpSync(join(root, "assets"), join(out, "assets"), { recursive: true });
    return console.log(`${relative(root, out)}/ ready — e.g.  npx vercel deploy ${relative(root, out)} --prod`);
  }

  console.log(HELP);
  process.exitCode = 1;
}

main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
