// Minimal headless Chrome driver over the DevTools protocol (Node ≥ 22 has WebSocket built in).
// No dependencies: it uses the Chrome / Chromium / Edge already installed (or CHROME_PATH).
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const mac = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"];
  const win = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean)
    .flatMap((b) => [join(b, "Google/Chrome/Application/chrome.exe"), join(b, "Microsoft/Edge/Application/msedge.exe")]);
  for (const p of process.platform === "darwin" ? mac : process.platform === "win32" ? win : []) if (existsSync(p)) return p;
  if (process.platform !== "win32") {
    for (const n of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]) {
      try { const p = execFileSync("which", [n], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); if (p) return p; } catch {}
    }
  }
  throw new Error("Chrome not found. Install Google Chrome (or Chromium / Edge) or set CHROME_PATH.");
}

export async function launch() {
  if (typeof WebSocket === "undefined") throw new Error("Node 22 or newer is needed (built-in WebSocket).");
  const dir = mkdtempSync(join(tmpdir(), "slaas-chrome-"));
  const proc = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--remote-debugging-port=0", `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  const portFile = join(dir, "DevToolsActivePort");
  let lines = [];
  for (let i = 0; i < 300 && !lines[1]; i++) { if (existsSync(portFile)) lines = readFileSync(portFile, "utf8").split("\n"); if (!lines[1]) await sleep(50); }
  if (!lines[1]) { proc.kill(); throw new Error("Chrome did not start (no DevTools port)."); }
  const ws = new WebSocket(`ws://127.0.0.1:${lines[0].trim()}${lines[1].trim()}`);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("Could not connect to Chrome DevTools.")); });

  let seq = 0;
  const pending = new Map(), listeners = new Set();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else listeners.forEach((f) => f(m));
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++seq; pending.set(id, { res, rej });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });

  async function newPage({ width = 1920, height = 1080 } = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    const errors = [];
    const onEvent = (m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === "Runtime.exceptionThrown") { const d = m.params.exceptionDetails; errors.push((d.exception && d.exception.description) || d.text); }
      else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
      else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push(m.params.entry.text + (m.params.entry.url ? " " + m.params.entry.url : ""));
    };
    listeners.add(onEvent);
    await s("Page.enable"); await s("Runtime.enable"); await s("Log.enable");
    await s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    const page = {
      errors,
      cdp: s,                                    // raw DevTools command on this page, for anything not wrapped here
      async goto(url) { errors.length = 0; await s("Page.navigate", { url }); },
      async eval(expression) {
        const r = await s("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
        return r.result.value;
      },
      /** Wait for the engine to be ready (data-ready), fonts and images loaded (lazy ones, like the grid's thumbnails, aside). */
      async waitReady(timeout = 20000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
          try {
            if (await page.eval(`document.documentElement.dataset.ready === "1" && document.fonts.status === "loaded" && Array.from(document.images).every((i) => i.complete || i.loading === "lazy")`)) {
              await page.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
              return true;
            }
          } catch {}
          await sleep(40);
        }
        return false;
      },
      async screenshot({ format = "png", quality, scale = 1 } = {}) {
        const r = await s("Page.captureScreenshot", { format, ...(quality ? { quality } : {}), clip: { x: 0, y: 0, width, height, scale } });
        return Buffer.from(r.data, "base64");
      },
      async close() { listeners.delete(onEvent); await send("Target.closeTarget", { targetId }).catch(() => {}); },
    };
    return page;
  }

  async function close() {
    try { await send("Browser.close"); } catch {}
    try { ws.close(); } catch {}
    proc.kill();
    await sleep(150);
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
  return { newPage, close };
}

/** Run `fn(page, item)` over items with a few pages in parallel. */
export async function withPages(items, fn, { parallel = 4 } = {}) {
  const browser = await launch();
  try {
    const queue = items.map((item, i) => [item, i]), results = new Array(items.length);
    const workers = Array.from({ length: Math.max(1, Math.min(parallel, items.length)) }, async () => {
      const page = await browser.newPage();
      try { while (queue.length) { const [item, i] = queue.shift(); results[i] = await fn(page, item); } }
      finally { await page.close(); }
    });
    await Promise.all(workers);
    return results;
  } finally { await browser.close(); }
}
