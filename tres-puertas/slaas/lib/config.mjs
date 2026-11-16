// Deck configuration (slaas.json) and slide order.
// A deck is a folder with slaas.json, slides/*.html, theme/ and slaas/ (this runtime).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";

export const CONFIG = "slaas.json";
export const SLIDES_DIR = "slides";

/** Walk up from `start` to the folder that holds slaas.json. */
export function findDeckRoot(start = process.cwd()) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, CONFIG))) return d;
    const up = dirname(d);
    if (up === d) throw new Error(`No ${CONFIG} found in ${start} or its parents. Run this inside a slaas deck.`);
    d = up;
  }
}

export function loadConfig(root) {
  const raw = readFileSync(join(root, CONFIG), "utf8");
  try { return JSON.parse(raw); } catch (e) { throw new Error(`${CONFIG} is not valid JSON: ${e.message}`); }
}

export function saveConfig(root, cfg, { backup = false } = {}) {
  const path = join(root, CONFIG);
  if (backup && existsSync(path)) {
    mkdirSync(join(root, ".backups"), { recursive: true });
    copyFileSync(path, join(root, ".backups", CONFIG + "." + stamp()));
  }
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
}

export function stamp() { return new Date().toISOString().replace(/[:.]/g, "-"); }

export function slug(s) {
  return String(s || "deck").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deck";
}

export function deckId(root, cfg) { return cfg.id || slug(basename(root)); }

export function themeMeta(root) {
  const p = join(root, "theme", "theme.json");
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}

/** Ordered [{file, hidden}] from slaas.json, reconciled with the files in slides/ (new files go last). */
export function slideOrder(root, cfg = loadConfig(root)) {
  const dir = join(root, SLIDES_DIR);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".html")).sort() : [];
  const seen = new Set();
  const order = (cfg.slides || [])
    .filter((s) => s && files.includes(s.file) && !seen.has(s.file) && seen.add(s.file))
    .map((s) => ({ file: s.file, hidden: !!s.hidden }));
  for (const f of files) if (!seen.has(f)) order.push({ file: f, hidden: false });
  return order;
}

export function writeOrder(root, order) {
  const cfg = loadConfig(root);
  cfg.slides = order.map((s) => ({ file: s.file, hidden: !!s.hidden }));
  saveConfig(root, cfg, { backup: true });
}
