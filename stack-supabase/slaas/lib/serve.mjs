// Local server for presenting AND editing a deck.
// - Serves the deck folder (with HTTP Range support, so videos seek properly).
// - POST /api/save  {file, edits:[{n, html}], notes?} writes text edits back into slides/<file> and rebuilds.
// - POST /api/order {slides:[{file, hidden}]} saves order and visibility into slaas.json and rebuilds.
// - GET  /api/events  server-sent events: "reload" after a rebuild caused by files changing on disk
//   (live reload while someone, or Claude, edits slides/, theme/ or slaas.json).
import { createServer } from "node:http";
import { readFileSync, writeFileSync, statSync, createReadStream, existsSync, copyFileSync, mkdirSync, watch } from "node:fs";
import { join, extname, normalize, sep, relative } from "node:path";
import { applyEdits, setNotes } from "./html-edit.mjs";
import { build } from "./build.mjs";
import { slideOrder, writeOrder, stamp, SLIDES_DIR } from "./config.mjs";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".vtt": "text/vtt",
  ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2", ".pdf": "application/pdf", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};

export function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
export async function readJson(req) { let raw = ""; for await (const chunk of req) raw += chunk; return JSON.parse(raw); }

/**
 * Only this machine's own pages may use the server: the Host must be localhost (no DNS rebinding) and requests
 * that change something must carry X-Slaas and, if the browser says where they come from, come from this
 * server (another website open in the browser cannot post to it). Returns false after answering 403.
 */
export function guard(req, res, port) {
  const host = String(req.headers.host || "");
  const local = (h) => new RegExp(`^(127\\.0\\.0\\.1|localhost|\\[::1\\])(:${port})?$`).test(h);
  if (!local(host)) { send(res, 403, { ok: false, error: "forbidden host" }); return false; }
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.origin;
    if (req.headers["x-slaas"] !== "1" || (origin && !local(origin.replace(/^https?:\/\//, "")))) { send(res, 403, { ok: false, error: "forbidden" }); return false; }
  }
  return true;
}

/**
 * The deck as an HTTP handler (static files with Range support, save / order APIs, live reload), to mount on a
 * server of its own (startServer) or under a path prefix (slaas Studio). Options as startServer's.
 * Returns { handle(req, res, pathname), rebuild(), close() }.
 */
export function createDeckHandler(root, { edit = true, live = true, log = true, onSaved, onChanged } = {}) {
  root = root.endsWith(sep) ? root : root + sep;
  const startedAt = stamp();
  const clients = new Set();
  let quietUntil = 0;                                  // ignore file events caused by our own writes
  const say = (...a) => { if (log) console.log(...a); };

  function rebuild() { const r = build(root); r.warnings.forEach((w) => say("  ⚠ " + w)); return r; }
  function broadcast(msg) { for (const res of clients) res.write(`data: ${msg}\n\n`); }

  async function handleSave(req, res) {
    try {
      const { file, edits = [], notes } = await readJson(req);
      if (!/^[\w.-]+\.html$/.test(file)) throw new Error("invalid file name");
      const path = join(root, SLIDES_DIR, file);
      if (!existsSync(path)) throw new Error("no such slide: " + file);
      let html = readFileSync(path, "utf8");
      const bdir = join(root, ".backups"); mkdirSync(bdir, { recursive: true });
      const bfile = join(bdir, file + "." + startedAt);   // one backup per file per server session
      if (!existsSync(bfile)) copyFileSync(path, bfile);
      if (edits.length) html = applyEdits(html, edits);
      if (typeof notes === "string") html = setNotes(html, notes);
      quietUntil = Date.now() + 1500;
      writeFileSync(path, html);
      const r = rebuild();
      say(`✎ ${file}: ${edits.length} text(s)${typeof notes === "string" ? " + notes" : ""} · ${r.count} slides`);
      send(res, 200, { ok: true, file, edits: edits.length });
      if (edits.length && onSaved) onSaved(file);
    } catch (e) { say("✗ save:", e.message); send(res, 400, { ok: false, error: e.message }); }
  }

  async function handleOrder(req, res) {
    try {
      const { slides } = await readJson(req);
      if (!Array.isArray(slides) || !slides.length) throw new Error("empty list");
      const onDisk = new Set(slideOrder(root).map((s) => s.file)), seen = new Set();
      for (const s of slides) { if (!onDisk.has(s.file)) throw new Error("no such slide: " + s.file); if (seen.has(s.file)) throw new Error("repeated: " + s.file); seen.add(s.file); }
      if (slides.every((s) => s.hidden)) throw new Error("cannot hide every slide");
      quietUntil = Date.now() + 1500;
      writeOrder(root, slides);
      const r = rebuild();
      say(`✥ order saved · ${slides.filter((s) => s.hidden).length} hidden · ${r.count} slides`);
      send(res, 200, { ok: true });
    } catch (e) { say("✗ order:", e.message); send(res, 400, { ok: false, error: e.message }); }
  }

  async function handle(req, res, pathname) {
    const url = { pathname };
    if (url.pathname === "/api/ping") return send(res, 200, { ok: true, edit, live });
    if (edit && url.pathname === "/api/save" && req.method === "POST") return handleSave(req, res);
    if (edit && url.pathname === "/api/order" && req.method === "POST") return handleOrder(req, res);
    if (live && url.pathname === "/api/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      res.write(": hello\n\n"); clients.add(res);
      const ka = setInterval(() => res.write(": ka\n\n"), 25000);
      req.on("close", () => { clearInterval(ka); clients.delete(res); });
      return;
    }
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { return send(res, 400, "bad path", "text/plain"); }
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(root, p));
    if (!file.startsWith(root) || relative(root, file).split(sep).some((s) => s.startsWith("."))) return send(res, 403, "forbidden", "text/plain");
    let st;
    try { st = statSync(file); } catch { return send(res, 404, "not found", "text/plain"); }
    if (st.isDirectory()) return send(res, 404, "not found", "text/plain");
    const type = TYPES[extname(file).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? +range[1] : 0, end = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
      res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-store" });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
    createReadStream(file).pipe(res);
  }

  // live reload: rebuild when sources change, plain reload when assets change
  const watchers = [];
  if (live) {
    let timer = null, needBuild = false, changed = new Set();
    const kick = (rebuildToo, what) => {
      if (Date.now() < quietUntil) return;
      needBuild = needBuild || rebuildToo;
      if (what) changed.add(what);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const files = [...changed]; changed = new Set();
        if (Date.now() < quietUntil) { needBuild = false; return; }
        try {
          if (needBuild) { const r = rebuild(); say(`↻ rebuilt · ${r.count} slides`); }
          broadcast("reload");
          if (needBuild && onChanged && files.length) onChanged(files.includes("*") ? "*" : files);
        } catch (e) { say("✗ rebuild:", e.message); }
        needBuild = false;
      }, 200);
    };
    const tryWatch = (dir, opts, fn) => { if (existsSync(dir)) try { watchers.push(watch(dir, opts, fn)); } catch {} };
    tryWatch(join(root, SLIDES_DIR), {}, (_e, f) => { if (f && f.endsWith(".html")) kick(true, String(f)); });
    tryWatch(join(root, "theme"), { recursive: true }, () => kick(true, "*"));
    tryWatch(root, {}, (_e, f) => { if (f === "slaas.json") kick(true, "*"); });
    tryWatch(join(root, "assets"), { recursive: true }, (_e, f) => { if (f && !String(f).startsWith("thumbs")) kick(false); });
  }

  return { handle, rebuild, close: () => { watchers.forEach((w) => w.close()); for (const c of clients) c.end(); } };
}

/**
 * Start a server for one deck. Options: port (0 = any free one; a busy port tries the next ones), host, edit (save
 * APIs), live (watch files + live reload), log (console output), onSaved(file) after a text edit is saved,
 * onChanged(files | "*") after a rebuild caused by slides (or theme / config: "*") changing on disk.
 * Resolves to { url, port, close() }.
 */
export function startServer(root, { port = 8765, host = "127.0.0.1", ...opts } = {}) {
  const app = createDeckHandler(root, opts);
  const server = createServer((req, res) => {
    if (!guard(req, res, server.address().port)) return;
    let pathname; try { pathname = new URL(req.url, "http://localhost").pathname; } catch { return send(res, 400, "bad url", "text/plain"); }
    app.handle(req, res, pathname);
  });
  return new Promise((resolve, reject) => {
    let tries = 0;
    const onError = (e) => {
      if (e.code === "EADDRINUSE" && port && tries++ < 20) { port++; server.listen(port, host); }
      else reject(e);
    };
    server.on("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      const real = server.address().port, url = `http://${host}:${real}/`;
      resolve({
        url, port: real,
        close: () => new Promise((r) => { app.close(); server.close(() => r()); server.closeAllConnections?.(); }),
      });
    });
  });
}
