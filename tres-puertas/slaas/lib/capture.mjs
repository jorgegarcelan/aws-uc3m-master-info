// Everything that renders slides in headless Chrome: thumbnails, screenshots, QA checks, PDF.
// Rendering uses thumbs.html (the deck without video sources) in the engine's ?static / ?shot modes.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "./build.mjs";
import { slideOrder } from "./config.mjs";
import { startServer } from "./serve.mjs";
import { withPages } from "./chrome.mjs";
import { jpegsToPdf } from "./pdf.mjs";

const stem = (f) => f.replace(/\.html$/, "");

async function withServer(root, base, fn) {
  if (base) return fn(base);
  const srv = await startServer(root, { port: 0, edit: false, live: false, log: false });
  try { return await fn(srv.url); } finally { await srv.close(); }
}

/** Resolve user input (file name, file-name prefix, or the n-th visible slide) to slide files. */
export function resolveSlides(root, args) {
  const order = slideOrder(root), visible = order.filter((s) => !s.hidden);
  return args.map((a) => {
    const exact = order.find((s) => s.file === a || s.file === a + ".html");
    if (exact) return exact.file;
    const pre = order.filter((s) => s.file.startsWith(a));
    if (pre.length === 1) return pre[0].file;
    if (pre.length > 1) throw new Error(`"${a}" matches several slides: ${pre.map((s) => s.file).join(", ")}`);
    if (/^\d+$/.test(a) && visible[+a - 1]) return visible[+a - 1].file;
    throw new Error(`No slide matches "${a}"`);
  });
}

async function render(page, url, file, t) {
  await page.goto(url + "thumbs.html?" + (t == null ? "static=" + encodeURIComponent(file) : "shot=" + encodeURIComponent(file) + "&t=" + t));
  if (!(await page.waitReady())) throw new Error(`${file}: the slide did not finish rendering (JS error?) ${page.errors.join(" | ")}`);
}

/** Grid thumbnails → assets/thumbs/<slide>.jpg (640×360). */
export async function thumbs(root, files, { base } = {}) {
  build(root, { out: "thumbs.html", novideo: true });
  const list = files && files.length ? files : slideOrder(root).map((s) => s.file);
  mkdirSync(join(root, "assets", "thumbs"), { recursive: true });
  return withServer(root, base, (url) => withPages(list, async (page, file) => {
    try {
      await render(page, url, file);
      writeFileSync(join(root, "assets", "thumbs", stem(file) + ".jpg"), await page.screenshot({ format: "jpeg", quality: 72, scale: 1 / 3 }));
      return { file, ok: true };
    } catch (e) { return { file, ok: false, error: e.message }; }
  }));
}

/** PNG screenshots of slides at their final state, or at given times (seconds into the slide timeline). */
export async function shots(root, files, { times = [], scale = 0.5, outDir = join(root, ".slaas", "shots") } = {}) {
  build(root, { out: "thumbs.html", novideo: true });
  mkdirSync(outDir, { recursive: true });
  const jobs = files.flatMap((file) => (times.length ? times : [null]).map((t) => ({ file, t })));
  return withServer(root, null, (url) => withPages(jobs, async (page, { file, t }) => {
    await render(page, url, file, t);
    const path = join(outDir, stem(file) + (t == null ? "" : "@" + t + "s") + ".png");
    writeFileSync(path, await page.screenshot({ format: "png", scale }));
    return { file, t, path, errors: page.errors.slice() };
  }));
}

/** QA: JS errors, missing files, text off the stage / under the footer / clipped / overlapping, per slide. */
export async function check(root, files) {
  const b = build(root);
  build(root, { out: "thumbs.html", novideo: true });
  const order = slideOrder(root);
  const list = files && files.length ? files : order.map((s) => s.file);
  // every slide is in the page, so a missing file shows up on all of them: give it to the slide whose
  // source mentions it; what no slide mentions (footer logos, theme files) is reported once for the deck
  const ASSET = /Failed to load resource[^]*?(https?:\/\/\S+)/;
  const deck = new Set();
  const results = await withServer(root, null, (url) => withPages(list, async (page, file) => {
    try {
      await render(page, url, file);
      const r = await page.eval("({ info: Deck._slideInfo, issues: Deck._qa() })");
      const src = readFileSync(join(root, "slides", file), "utf8");
      const errors = page.errors.filter((e) => {
        const m = e.match(ASSET); if (!m) return true;
        const path = decodeURIComponent(new URL(m[1]).pathname.slice(1));
        if (src.includes(path)) return true;
        if (!order.some((s) => readFileSync(join(root, "slides", s.file), "utf8").includes(path))) deck.add("missing file: " + path);
        return false;
      });
      return { file, ...r.info, issues: r.issues, errors };
    } catch (e) { return { file, issues: [], errors: [e.message] }; }
  }));
  return { warnings: b.warnings, deckErrors: [...deck], slides: results };
}

/** One page per visible slide, final state, as a PDF of images. */
export async function pdf(root, out) {
  build(root, { out: "thumbs.html", novideo: true });
  const list = slideOrder(root).filter((s) => !s.hidden).map((s) => s.file);
  const jpegs = await withServer(root, null, (url) => withPages(list, async (page, file) => {
    await render(page, url, file);
    return page.screenshot({ format: "jpeg", quality: 90 });
  }));
  writeFileSync(out, jpegsToPdf(jpegs));
  return { out, pages: jpegs.length };
}
