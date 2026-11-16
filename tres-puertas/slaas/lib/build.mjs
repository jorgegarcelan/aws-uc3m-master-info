// Assemble the deck into one HTML page from slaas.json, slides/, theme/ and this runtime.
// Hidden slides stay in the page (the grid can open them) but navigation skips them.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { annotate } from "./html-edit.mjs";
import { loadConfig, saveConfig, slideOrder, deckId, themeMeta, SLIDES_DIR } from "./config.mjs";

const VENDOR = ["gsap", "SplitText", "DrawSVGPlugin", "MotionPathPlugin", "CustomEase"];
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Problems a person would not see until presenting: ids that do not match, duplicated ids, missing builders. */
export function lint(root, order) {
  const warnings = [], ids = new Map();
  for (const { file } of order) {
    const src = readFileSync(join(root, SLIDES_DIR, file), "utf8");
    const sections = [...src.matchAll(/<section\b[^>]*>/g)].map((m) => m[0]);
    if (sections.length !== 1) { warnings.push(`${file}: expected exactly one <section>, found ${sections.length}`); continue; }
    const sec = sections[0];
    if (!/\bclass="[^"]*\bslide\b/.test(sec)) warnings.push(`${file}: the <section> needs class="slide"`);
    const id = (sec.match(/\bid="([^"]+)"/) || [])[1];
    if (!id) { warnings.push(`${file}: the <section> has no id`); continue; }
    if (ids.has(id)) warnings.push(`${file}: id "${id}" is also used by ${ids.get(id)}`);
    ids.set(id, file);
    const builders = [...src.matchAll(/Deck\.slide\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
    for (const b of builders) if (b !== id) warnings.push(`${file}: Deck.slide("${b}") does not match the section id "${id}" — its animation will never run`);
    if (!builders.length) warnings.push(`${file}: no Deck.slide("${id}", …) — the slide appears with no animation`);
  }
  return warnings;
}

/**
 * Build the deck. Options:
 *   out      output file (default index.html)
 *   only     list of file-name prefixes to include
 *   novideo  drop video sources (thumbnails show the poster instead)
 * Returns { out, count, hidden, warnings }.
 */
export function build(root, { out = "index.html", only = null, novideo = false } = {}) {
  const cfg = loadConfig(root);
  const order = slideOrder(root, cfg);
  if (!cfg.slides) { cfg.slides = order; saveConfig(root, cfg); }
  const theme = themeMeta(root);
  let slides = order;
  if (only) slides = slides.filter((s) => only.some((p) => s.file.startsWith(p)));

  let body = slides
    .map(({ file, hidden }) => `<!-- ${file}${hidden ? " (hidden)" : ""} -->\n` +
      annotate(readFileSync(join(root, SLIDES_DIR, file), "utf8"), file).replace(/<section /, `<section data-file="${file}"${hidden ? ' data-hidden="1"' : ""} `))
    .join("\n");
  if (novideo) body = body.replace(/(<(?:video|source)\b[^>]*?) src="/g, '$1 data-nosrc="');

  const runtime = {
    id: deckId(root, cfg),
    title: cfg.title || "",
    lang: cfg.lang || "en",
    sections: cfg.sections || [],
    accent: cfg.accent || theme.accent || "#333333",
    appendix: cfg.appendix || null,
    number: cfg.number || null,
    strings: cfg.strings || null,
  };

  const stageHtml = existsSync(join(root, "theme", "stage.html")) ? readFileSync(join(root, "theme", "stage.html"), "utf8").trim() : "";
  const f = cfg.footer;
  const footerHtml = f === false ? "" : `  <footer id="footer">
    <div class="dots"></div>
    <div class="fsec"></div>
    <div class="ftitle">${(f && f.title) || esc(cfg.title || "")}${f && f.subtitle ? `<span>${f.subtitle}</span>` : ""}</div>
    <div class="flogos">${((f && f.logos) || []).map((l) => `<img src="${esc(l.src)}" alt="${esc(l.alt || "")}"${l.style ? ` style="${esc(l.style)}"` : ""} />`).join("")}</div>
    <div class="fnum"></div>
  </footer>`;

  const V = Date.now();
  const html = `<!doctype html>
<html lang="${esc(runtime.lang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" href="${cfg.favicon ? esc(cfg.favicon) : "data:,"}" />
<title>${esc(cfg.title || "slaas")}</title>
<link rel="stylesheet" href="slaas/engine.css?v=${V}" />
<link rel="stylesheet" href="slaas/components.css?v=${V}" />
<link rel="stylesheet" href="theme/theme.css?v=${V}" />
${(cfg.styles || []).map((s) => `<link rel="stylesheet" href="${esc(s)}?v=${V}" />\n`).join("")}${VENDOR.map((v) => `<script src="slaas/vendor/${v}.min.js"></script>`).join("\n")}
<script>window.SLAAS_CONFIG = ${JSON.stringify(runtime).replace(/</g, "\\u003c")};</script>
<script src="slaas/engine.js?v=${V}"></script>
<script src="slaas/components.js?v=${V}"></script>
${existsSync(join(root, "theme", "theme.js")) ? `<script src="theme/theme.js?v=${V}"></script>\n` : ""}${(cfg.scripts || []).map((s) => `<script src="${esc(s)}"></script>\n`).join("")}</head>
<body>
<div id="viewport"><div id="stage">
  ${stageHtml}
${body}
  <div id="progress"></div>
${footerHtml}
</div></div>
<script>Deck.boot();</script>
</body>
</html>
`;
  writeFileSync(join(root, out), html);
  return { out, count: slides.length, hidden: slides.filter((s) => s.hidden).length, warnings: lint(root, slides) };
}
