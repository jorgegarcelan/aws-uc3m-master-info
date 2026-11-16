// slaas verify: walk every state of every slide the way a presenter does, and check that each state looks
// the same however you get to it — pressing →, coming back with ←, the browser's Back button, reloading its
// URL (#12.3) or with reduced motion — with no JS errors on the way, and that the slide's thumbnail / PDF page
// (its final state rendered on its own) shows what the audience sees at the end. Writes .slaas/verify/: a contact sheet of
// every state and, for each problem, an image with the two captures and their difference.
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "./build.mjs";
import { slideOrder } from "./config.mjs";
import { startServer } from "./serve.mjs";
import { launch } from "./chrome.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYS = { ArrowRight: 39, ArrowLeft: 37 };
const label = (i, k) => `#${i}${k > 0 ? "." + k : ""}`;

/** Compare two PNGs (base64) in a page: share of pixels that differ visibly, where, and a picture of it. */
const DIFF_FN = `window.__diff = async (a, b, picture) => {
  const load = (s) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = "data:image/png;base64," + s; });
  const [A, B] = await Promise.all([load(a), load(b)]);
  const w = A.width, h = A.height, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(A, 0, 0); const d1 = g.getImageData(0, 0, w, h).data; g.clearRect(0, 0, w, h); g.drawImage(B, 0, 0); const d2 = g.getImageData(0, 0, w, h).data;
  let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1; const mask = new Uint8Array(w * h);
  for (let p = 0, i = 0; i < d1.length; i += 4, p++) {
    const d = Math.max(Math.abs(d1[i] - d2[i]), Math.abs(d1[i + 1] - d2[i + 1]), Math.abs(d1[i + 2] - d2[i + 2]));
    if (d > 32) { n++; mask[p] = 1; const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const out = { ratio: n / (w * h), box: n ? [x0, y0, x1, y1].map((v) => Math.round(v * 1920 / w)) : null };
  if (picture && n) {
    // A | B | B with the differences in red
    const P = document.createElement("canvas"); P.width = w * 3 + 40; P.height = h + 44; const q = P.getContext("2d");
    q.fillStyle = "#0C0C0F"; q.fillRect(0, 0, P.width, P.height); q.font = "600 18px -apple-system, sans-serif"; q.fillStyle = "#F4F2EC";
    picture.forEach((t, k) => q.fillText(t, 8 + k * (w + 20), 26));
    q.drawImage(A, 0, 44); q.drawImage(B, w + 20, 44); q.drawImage(B, 2 * (w + 20), 44);
    const id = q.getImageData(2 * (w + 20), 44, w, h);
    for (let p = 0; p < w * h; p++) if (mask[p]) { id.data[p * 4] = 255; id.data[p * 4 + 1] = 40; id.data[p * 4 + 2] = 40; }
    q.putImageData(id, 2 * (w + 20), 44); q.strokeStyle = "#D4FF3A"; q.lineWidth = 3; q.strokeRect(2 * (w + 20) + x0 - 4, 44 + y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
    out.png = P.toDataURL("image/png").split(",")[1];
  }
  return out;
};`;

export async function verify(root, files, { speed = 6, reload = true, reduced = true, parallel = 3, scale = 0.5, tolerance = 0.0002, onSlide } = {}) {
  build(root, { out: "thumbs.html", novideo: true });
  const order = slideOrder(root).filter((s) => !s.hidden);
  const jobs = order.map((s, i) => ({ i: i + 1, file: s.file })).filter((j) => !files || files.includes(j.file));
  const outDir = join(root, ".slaas", "verify");
  rmSync(outDir, { recursive: true, force: true }); mkdirSync(join(outDir, "states"), { recursive: true });

  const srv = await startServer(root, { port: 0, edit: false, live: false, log: false });
  const browser = await launch();
  const shots = new Map();               // "i.k" → forward capture (base64 PNG)
  const cross = [];                      // captures to compare with another slide's state once it exists
  const results = [];
  try {
    const diffPage = await browser.newPage({ width: 400, height: 300 });
    await diffPage.goto("about:blank"); await diffPage.eval(DIFF_FN);
    let diffBusy = Promise.resolve();
    const diff = (a, b, picture) => (diffBusy = diffBusy.then(() => diffPage.eval(`__diff(${JSON.stringify(a)}, ${JSON.stringify(b)}, ${JSON.stringify(picture || null)})`)));

    const queue = jobs.slice();
    const worker = async () => {
      const page = await browser.newPage();
      const base = `${srv.url}thumbs.html?verify&speed=${speed}`;
      const state = () => page.eval("Deck._state()");
      const idle = async (timeout = 15000) => {
        const t0 = Date.now();
        await sleep(30);
        while (Date.now() - t0 < timeout) { if (!(await page.eval("Deck._busy()"))) { await page.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))"); return true; } await sleep(30); }
        return false;
      };
      const open = async (query, hash) => { await page.goto(`${base}${query}${hash}`); if (!(await page.waitReady())) throw new Error(`opening ${hash} never finished loading (see the JS error)`); await idle(); };
      const key = async (k) => {
        for (const type of ["keyDown", "keyUp"]) await page.cdp("Input.dispatchKeyEvent", { type, key: k, code: k, windowsVirtualKeyCode: KEYS[k], nativeVirtualKeyCode: KEYS[k] });
      };
      const snap = async () => (await page.screenshot({ format: "png", scale })).toString("base64");
      try {
        while (queue.length) {
          const { i, file } = queue.shift();
          const r = { slide: i, file, states: 0, stops: [], problems: [], errors: [] };
          const problem = (at, kind, msg, extra = {}) => r.problems.push({ at, kind, msg, ...extra });
          const same = async (at, kind, img, ref, how) => {
            if (!ref) return;
            const d = await diff(ref, img, [`${at} · forward (→)`, `${at} · ${how}`, "differences"]);
            if (d.ratio > tolerance) {
              const name = `${at.slice(1)}-${kind}.png`; writeFileSync(join(outDir, name), Buffer.from(d.png, "base64"));
              problem(at, kind, `${how} looks different from pressing →: ${(d.ratio * 100).toFixed(2)} % of the slide, around (${d.box.slice(0, 2).join(",")})–(${d.box.slice(2).join(",")})`, { image: join(outDir, name) });
            }
          };
          const expectHash = async (at, kind, want, how) => { const s = await state(); if (s.hash !== want) problem(at, kind, `${how}: the URL is ${s.hash || "(none)"}, expected ${want}`); return s; };
          // JS errors: the message without the stack (it points into the built page, not the slide file); page.goto
          // clears the page's list, so they are collected after every pass
          const collect = () => { for (const e of page.errors.splice(0)) { const m = String(e).split("\n")[0].trim(); if (!r.errors.includes(m)) r.errors.push(m); } };
          const pass = async (fn) => { try { await fn(); } catch (e) { collect(); if (!r.errors.includes(e.message)) r.errors.push(e.message); } collect(); };
          const mine = []; let K = -1;
          // 1 · forward: open the slide, then → through every state
          await pass(async () => {
            await open(`&r=${i}`, `#${i}`);
            let s = await state();
            if (s.slide !== i) throw new Error(`#${i} opened slide ${s.slide}`);
            r.states = s.states; r.stops = s.stops; K = s.states - 1;
            mine[0] = await snap(); shots.set(`${i}.0`, mine[0]);
            if (s.hash !== `#${i}`) problem(`#${i}`, "url", `the URL is ${s.hash}, expected #${i}`);
            writeFileSync(join(outDir, "states", `${i}.0.jpg`), await page.screenshot({ format: "jpeg", quality: 70, scale: 0.25 }));
            for (let k = 1; k <= K; k++) {
              await key("ArrowRight");
              await expectHash(label(i, k), "url", label(i, k), "right after →");
              if (!(await idle())) problem(label(i, k), "stuck", "the animation did not come to rest within 15 s");
              s = await state(); if (s.state !== k) problem(label(i, k), "state", `→ landed on state ${s.state} of slide ${s.slide}`);
              mine[k] = await snap(); shots.set(`${i}.${k}`, mine[k]);
              writeFileSync(join(outDir, "states", `${i}.${k}.jpg`), await page.screenshot({ format: "jpeg", quality: 70, scale: 0.25 }));
            }
            // → past the end goes to the next slide; the browser's Back button comes back to the last state
            if (i < order.length) {
              await key("ArrowRight"); await idle();
              await expectHash(`#${i + 1}`, "next", `#${i + 1}`, `→ at the end of ${label(i, K)}`);
              cross.push({ want: `${i + 1}.0`, img: await snap(), at: `#${i + 1}`, kind: "next", how: `→ from ${label(i, K)}`, r });
              await page.eval("history.back()"); await sleep(60); await idle();
              await expectHash(label(i, K), "history", label(i, K), "browser Back");
              await same(label(i, K), "history", await snap(), mine[K], "browser Back");
            }
          });
          if (mine.length === K + 1 && K >= 0) {
            // 2 · ← back down to state 0, then into the previous slide (at its end)
            await pass(async () => {
              for (let k = K - 1; k >= 0; k--) {
                await key("ArrowLeft"); await idle();
                await expectHash(label(i, k), "url", label(i, k), "after ←");
                await same(label(i, k), "back", await snap(), mine[k], "coming back with ←");
              }
              if (i > 1) {
                await key("ArrowLeft"); await idle();
                const s = await state();
                if (s.slide !== i - 1) problem(`#${i}`, "prev", `← at the start went to slide ${s.slide}`);
                else cross.push({ want: `${i - 1}.${s.states - 1}`, img: await snap(), at: label(i - 1, s.states - 1), kind: "prev", how: `← from #${i}`, r });
              }
            });
            // 3 · reload each state from its URL
            if (reload) for (let k = 0; k <= K; k++) await pass(async () => {
              await open(`&r=${i}.${k}`, `#${i}.${k}`);
              const s = await state(); if (s.slide !== i || s.state !== k) return problem(label(i, k), "reload", `opening ${label(i, k)} showed slide ${s.slide} state ${s.state}`);
              await same(label(i, k), "reload", await snap(), mine[k], `opening ${label(i, k)} directly`);
            });
            // 4 · the thumbnail / PDF page / presenter preview: the slide rendered alone at its end
            await pass(async () => {
              await page.goto(`${srv.url}thumbs.html?static=${encodeURIComponent(file)}`);
              if (!(await page.waitReady())) throw new Error("its thumbnail never finished rendering (see the JS error)");
              await same(label(i, K), "static", await snap(), mine[K], "its thumbnail / PDF page");
            });
            // 5 · reduced motion: the same states, reached at once
            if (reduced) await pass(async () => {
              await open(`&motion=reduced&r=${i}r`, `#${i}`);
              await same(label(i, 0), "reduced", await snap(), mine[0], "with reduced motion");
              for (let k = 1; k <= K; k++) {
                await key("ArrowRight");
                if (await page.eval("Deck._busy()")) { await idle(); problem(label(i, k), "reduced", "with reduced motion, → still animates"); }
                await same(label(i, k), "reduced", await snap(), mine[k], "with reduced motion");
              }
            });
          }
          results.push(r);
          if (onSlide) onSlide(r);
        }
      } finally { await page.close(); }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, jobs.length)) }, worker));

    // arriving from a neighbour (→ into the next slide, ← into the previous one) must match that state
    for (const c of cross) {
      const ref = shots.get(c.want); if (!ref) continue;
      const d = await diff(ref, c.img, [`${c.at} · forward`, `${c.at} · ${c.how}`, "differences"]);
      if (d.ratio > tolerance) {
        const name = `${c.at.slice(1)}-${c.kind}.png`; writeFileSync(join(outDir, name), Buffer.from(d.png, "base64"));
        c.r.problems.push({ at: c.at, kind: c.kind, msg: `${c.how} looks different: ${(d.ratio * 100).toFixed(2)} % of the slide`, image: join(outDir, name) });
      }
    }
    results.sort((a, b) => a.slide - b.slide);

    // contact sheet of every state, in order
    const states = results.flatMap((r) => Array.from({ length: r.states }, (_, k) => ({ i: r.slide, k, bad: r.problems.some((p) => p.at === label(r.slide, k)) })));
    const sheets = [];
    for (let s = 0, n = 1; s < states.length; s += 24, n++) {
      const chunk = states.slice(s, s + 24), file = join(outDir, `sheet-${n}.html`);
      writeFileSync(file, `<body style="margin:0;background:#0C0C0F;font:600 15px -apple-system,sans-serif;color:#F4F2EC;display:grid;grid-template-columns:repeat(4,480px);gap:12px;padding:14px">${chunk.map((c) =>
        `<figure style="margin:0"><img src="${pathToFileURL(join(outDir, "states", `${c.i}.${c.k}.jpg`)).href}" style="width:480px;display:block;outline:${c.bad ? "3px solid #FF6B3D" : "1px solid #2C2C34"}"><figcaption style="height:26px;line-height:26px;color:${c.bad ? "#FF6B3D" : "#F4F2EC"}">${label(c.i, c.k)}${c.bad ? " · problem" : ""}</figcaption></figure>`).join("")}</body>`);
      const pg = await browser.newPage({ width: 4 * 480 + 3 * 12 + 28, height: 28 + Math.ceil(chunk.length / 4) * (270 + 26 + 12) });
      try {
        await pg.goto(pathToFileURL(file).href); await pg.eval("Promise.all([...document.images].map((i) => i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))");
        const out = join(outDir, `sheet-${n}.png`); writeFileSync(out, await pg.screenshot({ format: "png", scale: 0.5 })); sheets.push(out);
      } finally { await pg.close(); rmSync(file, { force: true }); }
    }
    const out = { slides: results, sheets, hidden: slideOrder(root).filter((s) => s.hidden).length, outDir };
    // the same, with paths relative to .slaas/verify, for whoever shows it later (slaas Studio)
    const rel = (f) => f && f.slice(outDir.length + 1);
    writeFileSync(join(outDir, "report.json"), JSON.stringify({ at: new Date().toISOString(), hidden: out.hidden, sheets: sheets.map(rel),
      slides: results.map((r) => ({ ...r, problems: r.problems.map((p) => ({ ...p, image: rel(p.image) })) })) }, null, 2));
    return out;
  } finally { await browser.close(); await srv.close(); }
}
