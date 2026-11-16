/* ============================================================
   slaas components — loaded right after engine.js.
   Each one is markup in the slide (its texts stay editable in the browser) plus a helper that
   adds its choreography to the slide's timeline, so it seeks, reverses, prints and passes verify.

     h.terminal(".term", { at, speed })   commands typed, output line by line; data-step on a line = a step
     h.diagram(".dg", { at, gap })        nodes appear in order, connectors draw between them
     h.qr(".qr", { at, dur })             a QR code assembles (it is drawn at boot from data-text)

   Markup and options: skills/slaas-slides/references/components.md
   ============================================================ */
(function () {
  "use strict";
  var Deck = window.Deck;
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function all(h, sel) { return h.qa(sel); }

  /* ================= terminal =================
     <div class="term" data-title="~/talk — zsh">
       <div class="t-cmd">npx slaas import talk.pptx</div>
       <div class="t-out"><span class="t-ok">✓</span> 15 slides</div>
       <div class="t-cmd" data-step>node slaas/cli.mjs verify</div>      ← a step before it
       <div class="t-out">0 problem(s)</div>
     </div>
     Commands are typed (monospace, one character per tick, revealed with a clip so the text node is untouched),
     a caret follows them, output lines appear one by one. A terminal with a fixed height scrolls like a real one. */
  Deck.helper("terminal", function (h) {
    return function (sel, o) {
      o = o || {};
      var speed = o.speed || 32, gap = o.gap == null ? 0.22 : o.gap;
      all(h, sel).forEach(function (term) {
        var t = o.at == null ? h.tl.duration() : o.at;
        var lines = Array.prototype.slice.call(term.querySelectorAll(".t-cmd, .t-out"));
        if (!lines.length) return;
        // lines go into a scroller (moved, not copied: edits in the browser still map to them); the caret lives there too
        var scroller = term.querySelector(".t-scroll");
        if (!scroller) { scroller = document.createElement("div"); scroller.className = "t-scroll"; lines[0].before(scroller); lines.forEach(function (l) { scroller.appendChild(l); }); }
        var caret = scroller.querySelector(".t-caret") || scroller.appendChild(Object.assign(document.createElement("i"), { className: "t-caret" }));
        var cs = getComputedStyle(term), view = term.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
        var scrolls = view > 0 && scroller.offsetHeight > view + 2, y = 0;
        h.tl.set(lines, { opacity: 0 }, 0);
        h.tl.set(caret, { opacity: 0 }, 0);
        lines.forEach(function (line, i) {
          if (line.hasAttribute("data-step") && i > 0) t = h.step(t);
          var bottom = line.offsetTop + line.offsetHeight;
          if (scrolls && bottom + y > view) { var ny = view - bottom; h.tl.fromTo(scroller, { y: y }, { y: ny, duration: 0.18, ease: "power2.out", immediateRender: false }, t); y = ny; }
          if (line.classList.contains("t-cmd")) {
            var n = line.textContent.replace(/\s+/g, " ").trim().length, dur = n / speed;
            h.tl.set(line, { opacity: 1, "--tc": 0 }, t);
            h.tl.set(caret, { opacity: 1, "--tc": 0, "--lx": line.offsetLeft + "px", "--ly": line.offsetTop + "px" }, t);
            h.tl.fromTo([line, caret], { "--tc": 0 }, { "--tc": n, duration: dur, ease: "steps(" + Math.max(1, n) + ")", immediateRender: false }, t + 0.12);
            h.tl.set(caret, { opacity: 0 }, t + 0.12 + dur + 0.18);
            t += 0.12 + dur + 0.28;
          } else {
            h.tl.fromTo(line, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none", immediateRender: false }, t);
            t += 0.06;
            var nx = lines[i + 1]; if (nx && nx.classList.contains("t-cmd")) t += gap;
          }
        });
      });
      return h;
    };
  });

  /* ================= diagram =================
     <div class="dg" data-edges="art>agent, agent>skill, skill>agent dashed, agent>out accent">
       <div class="dg-col"><div class="dg-n" data-id="art">Artículo</div></div>
       <div class="dg-col"><div class="dg-n accent" data-id="agent">Agente <small>por variable</small></div></div>
       <div class="dg-col"><div class="dg-n" data-id="skill" data-step>Skill</div><div class="dg-n" data-id="out">Veredicto</div></div>
       <span class="dg-l" data-for="agent>skill">carga</span>
     </div>
     Columns left → right (class "down": rows top → bottom). Edges: "from>to" plus options dashed, accent,
     straight, curve. Connectors are measured and drawn when the slide is first built; nodes appear in document
     order, each after the connectors that reach it. */
  function edgesOf(dg) {
    return (dg.getAttribute("data-edges") || "").split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
      var m = /^([\w-]+)\s*>\s*([\w-]+)\s*(.*)$/.exec(s); if (!m) return null;
      var opts = m[3].split(/\s+/);
      return { from: m[1], to: m[2], key: m[1] + ">" + m[2], dashed: opts.indexOf("dashed") > -1, accent: opts.indexOf("accent") > -1, shape: opts.indexOf("straight") > -1 ? "straight" : opts.indexOf("curve") > -1 ? "curve" : "elbow" };
    }).filter(Boolean);
  }
  // a path between two boxes (layout px inside the diagram). It leaves by the side that faces the other box; when
  // that line would run over another node (or the edge goes back against the flow) it takes a lane above or below
  // the nodes in between (left or right of them, in a diagram that flows down): the first route that is clear.
  function route(a, b, e, down, others) {
    var ax = (a.x0 + a.x1) / 2, ay = (a.y0 + a.y1) / 2, bx = (b.x0 + b.x1) / 2, by = (b.y0 + b.y1) / 2;
    var right = b.x0 >= a.x1 - 2, left = b.x1 <= a.x0 + 2, below = b.y0 >= a.y1 - 2, above = b.y1 <= a.y0 + 2;
    var cands = [], p0, p1, horiz = null;
    if (!down && right) { p0 = [a.x1, ay]; p1 = [b.x0, by]; horiz = true; }
    else if (!down && below && !left) { p0 = [ax, a.y1]; p1 = [bx, b.y0]; horiz = false; }
    else if (!down && above && !left) { p0 = [ax, a.y0]; p1 = [bx, b.y1]; horiz = false; }
    else if (down && below) { p0 = [ax, a.y1]; p1 = [bx, b.y0]; horiz = false; }
    else if (down && right && !above) { p0 = [a.x1, ay]; p1 = [b.x0, by]; horiz = true; }
    else if (down && left && !above) { p0 = [a.x0, ay]; p1 = [b.x1, by]; horiz = true; }
    if (horiz !== null) {
      var aligned = horiz ? Math.abs(p1[1] - p0[1]) < 2 : Math.abs(p1[0] - p0[0]) < 2;
      if (e.shape === "straight" || aligned) cands.push({ pts: [p0, p1], straight: true });
      else {
        var m1 = horiz ? [(p0[0] + p1[0]) / 2, p0[1]] : [p0[0], (p0[1] + p1[1]) / 2], m2 = horiz ? [(p0[0] + p1[0]) / 2, p1[1]] : [p1[0], (p0[1] + p1[1]) / 2];
        cands.push({ pts: [p0, m1, m2, p1], curve: e.shape === "curve" });
      }
    }
    // lanes around the nodes that lie between the two ends
    var span = others.concat([a, b]);
    if (!down) {
      var x0 = Math.min(a.x0, b.x0), x1 = Math.max(a.x1, b.x1), between = span.filter(function (r) { return r.x1 > x0 && r.x0 < x1; });
      var top = Math.min.apply(null, between.map(function (r) { return r.y0; })) - 34, bot = Math.max.apply(null, between.map(function (r) { return r.y1; })) + 34;
      cands.push({ pts: [[ax, a.y0], [ax, top], [bx, top], [bx, b.y0]] }, { pts: [[ax, a.y1], [ax, bot], [bx, bot], [bx, b.y1]] });
    } else {
      var y0 = Math.min(a.y0, b.y0), y1 = Math.max(a.y1, b.y1), betweenV = span.filter(function (r) { return r.y1 > y0 && r.y0 < y1; });
      var lft = Math.min.apply(null, betweenV.map(function (r) { return r.x0; })) - 34, rgt = Math.max.apply(null, betweenV.map(function (r) { return r.x1; })) + 34;
      cands.push({ pts: [[a.x1, ay], [rgt, ay], [rgt, by], [b.x1, by]] }, { pts: [[a.x0, ay], [lft, ay], [lft, by], [b.x0, by]] });
    }
    var hit = function (pts) {
      for (var i = 1; i < pts.length; i++) for (var j = 0; j < others.length; j++) {
        var r = others[j], p = pts[i - 1], q = pts[i], g = 6;
        var sx0 = Math.min(p[0], q[0]), sx1 = Math.max(p[0], q[0]), sy0 = Math.min(p[1], q[1]), sy1 = Math.max(p[1], q[1]);
        if (sx1 > r.x0 - g && sx0 < r.x1 + g && sy1 > r.y0 - g && sy0 < r.y1 + g) return true;
      }
      return false;
    };
    var c = cands.filter(function (k) { return !hit(k.pts); })[0] || cands[0], P = c.pts, n = P.length;
    if (c.straight) return { d: "M" + r1(P[0][0]) + " " + r1(P[0][1]) + "L" + r1(P[1][0]) + " " + r1(P[1][1]), end: P[1], dir: dirOf(P[0], P[1]) };
    if (c.curve) return { d: "M" + r1(P[0][0]) + " " + r1(P[0][1]) + "C" + [P[1], P[2], P[3]].map(function (q) { return r1(q[0]) + " " + r1(q[1]); }).join(" "), end: P[3], dir: dirOf(P[2], P[3]) };
    return { d: poly(P, 14), end: P[n - 1], dir: dirOf(P[n - 2], P[n - 1]) };
  }
  function dirOf(p, q) { var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; }
  // polyline with rounded corners
  function poly(pts, R) {
    var d = "M" + r1(pts[0][0]) + " " + r1(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var p = pts[i], a = pts[i - 1], b = pts[i + 1];
      var la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), r = Math.min(R, la / 2, lb / 2);
      var u = dirOf(a, p), v = dirOf(p, b);
      d += "L" + r1(p[0] - u[0] * r) + " " + r1(p[1] - u[1] * r) + "Q" + r1(p[0]) + " " + r1(p[1]) + " " + r1(p[0] + v[0] * r) + " " + r1(p[1] + v[1] * r);
    }
    var z = pts[pts.length - 1];
    return d + "L" + r1(z[0]) + " " + r1(z[1]);
  }
  Deck.helper("diagram", function (h) {
    return function (sel, o) {
      o = o || {};
      var gap = o.gap == null ? 0.32 : o.gap;
      all(h, sel).forEach(function (dg, di) {
        var t = o.at == null ? h.tl.duration() : o.at;
        var nodes = Array.prototype.slice.call(dg.querySelectorAll(".dg-n[data-id]")), byId = {};
        nodes.forEach(function (n) { byId[n.getAttribute("data-id")] = n; });
        var edges = edgesOf(dg).filter(function (e) { if (byId[e.from] && byId[e.to]) return true; console.warn("diagram: unknown node in " + e.key); return false; });
        var labels = {}; dg.querySelectorAll(".dg-l[data-for]").forEach(function (l) { labels[l.getAttribute("data-for").replace(/\s+/g, "")] = l; });
        // measured in layout px (offsets: transforms and the stage scale do not count); a diagram that is not laid out
        // (the presenter window) only gets its steps
        var drawn = {};
        if (dg.offsetWidth > 0) {
          var old = dg.querySelector(":scope > svg.dg-svg"); if (old) old.remove();
          var svg = svgEl("svg", { "class": "dg-svg", width: dg.offsetWidth, height: dg.offsetHeight, viewBox: "0 0 " + dg.offsetWidth + " " + dg.offsetHeight, "aria-hidden": "true" });
          dg.insertBefore(svg, dg.firstChild);
          var defs = svgEl("defs", {}, svg), rect = function (n) {
            var x = 0, y = 0, e = n; while (e && e !== dg) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
            return { x0: x, y0: y, x1: x + n.offsetWidth, y1: y + n.offsetHeight };
          };
          var down = dg.classList.contains("down");
          edges.forEach(function (e, ei) {
            var others = nodes.filter(function (n) { return n !== byId[e.from] && n !== byId[e.to]; }).map(rect);
            var rt = route(rect(byId[e.from]), rect(byId[e.to]), e, down, others);
            var g = svgEl("g", { "class": "dg-e" + (e.accent ? " accent" : "") + (e.dashed ? " dashed" : "") }, svg);
            // the visible line (dashes intact) is revealed through a mask whose stroke is drawn
            var id = "dgm-" + (h.el.id || "s") + "-" + di + "-" + ei, mask = svgEl("mask", { id: id, maskUnits: "userSpaceOnUse", x: -50, y: -50, width: dg.offsetWidth + 100, height: dg.offsetHeight + 100 }, defs);
            var mp = svgEl("path", { d: rt.d, fill: "none", stroke: "#fff", "stroke-width": 12, "stroke-linecap": "round" }, mask);
            svgEl("path", { d: rt.d, "class": "dg-line", mask: "url(#" + id + ")" }, g);
            var x = rt.end[0], y = rt.end[1], u = rt.dir, s = 9, w = 6;
            var head = svgEl("path", { "class": "dg-head", d: "M" + r1(x) + " " + r1(y) + "L" + r1(x - u[0] * s - u[1] * w) + " " + r1(y - u[1] * s + u[0] * w) + "L" + r1(x - u[0] * s + u[1] * w) + " " + r1(y - u[1] * s - u[0] * w) + "Z" }, g);
            var lab = labels[e.key];
            if (lab) { var len = mp.getTotalLength(), pt = mp.getPointAtLength(len / 2); lab.style.left = r1(pt.x) + "px"; lab.style.top = r1(pt.y) + "px"; }
            drawn[e.key] = { mask: mp, head: head, label: lab };
          });
        }
        // choreography: nodes in document order; the connectors that reach a node draw just before it
        var shown = {}, first = true;
        nodes.forEach(function (n) {
          var nid = n.getAttribute("data-id");
          if (n.hasAttribute("data-step") && !first) t = h.step(t);
          var incoming = edges.filter(function (e) { return (e.to === nid && shown[e.from]) || (e.from === nid && shown[e.to]); });
          incoming.forEach(function (e, j) {
            var d = drawn[e.key]; if (!d) return;
            h.tl.fromTo(d.mask, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.42, ease: "power2.inOut" }, t + j * 0.05);
            h.tl.fromTo(d.head, { opacity: 0 }, { opacity: 1, duration: 0.12 }, t + j * 0.05 + 0.34);
            if (d.label) h.tl.fromTo(d.label, { opacity: 0 }, { opacity: 1, duration: 0.3 }, t + j * 0.05 + 0.3);
          });
          var at = t + (incoming.length ? 0.3 : 0);
          h.tl.fromTo(n, { opacity: 0, y: 14, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "deck" }, at);
          shown[nid] = true; first = false;
          t = at + gap;
        });
      });
      return h;
    };
  });

  /* ================= QR code =================
     <div class="qr" data-text="https://github.com/you/talk"></div>   (optional data-ec="L|M|Q|H", default M)
     Drawn at boot as an SVG (byte mode, versions 1–10: up to ~210 characters at M, ~270 at L), dark on white
     so every phone can read it. h.qr(".qr") makes it assemble: finder squares first, then a diagonal sweep. */
  var QR = (function () {
    var ECC = { L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24], H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28] };
    var BLOCKS = { L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4], M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5], Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8], H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8] };
    var FORMAT = { L: 1, M: 0, Q: 3, H: 2 };
    function rawModules(v) { var r = (16 * v + 128) * v + 64; if (v >= 2) { var na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; } return r; }
    function dataCodewords(v, ec) { return Math.floor(rawModules(v) / 8) - ECC[ec][v] * BLOCKS[ec][v]; }
    function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; }
    function rsDivisor(deg) { var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1); var root = 1; for (i = 0; i < deg; i++) { for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; }
    function rsRemainder(data, div) { var r = div.map(function () { return 0; }); data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); div.forEach(function (c, i) { r[i] ^= mul(c, f); }); }); return r; }
    function alignPositions(v) { if (v === 1) return []; var n = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, out = [6]; for (var p = v * 4 + 10; out.length < n; p -= step) out.splice(1, 0, p); return out; }

    function encode(text, ec) {
      var bytes = Array.prototype.slice.call(new TextEncoder().encode(text)), v;
      var levels = ec ? [ec] : ["M", "L"];
      for (var li = 0; li < levels.length; li++) {
        ec = levels[li];
        for (v = 1; v <= 10; v++) if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(v, ec) * 8) break;
        if (v <= 10) break;
      }
      if (v > 10) throw new Error("QR: the text is too long (" + bytes.length + " bytes; up to about 270)");
      // data bits: byte mode, count, bytes, terminator, padding
      var bits = [], push = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      push(4, 4); push(bytes.length, v < 10 ? 8 : 16); bytes.forEach(function (b) { push(b, 8); });
      var cap = dataCodewords(v, ec) * 8;
      push(0, Math.min(4, cap - bits.length)); push(0, (8 - bits.length % 8) % 8);
      for (var pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
      var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
      // error correction, blocks interleaved
      var nb = BLOCKS[ec][v], eccLen = ECC[ec][v], raw = Math.floor(rawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(eccLen), blocks = [];
      for (var k = 0, i = 0; i < nb; i++) { var dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length; var e = rsRemainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(e)); }
      var cw = []; for (i = 0; i < blocks[0].length; i++) for (j = 0; j < nb; j++) if (i !== shortLen - eccLen || j >= nShort) cw.push(blocks[j][i]);
      // matrix with function patterns
      var size = v * 4 + 17, M = [], F = [];
      for (i = 0; i < size; i++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
      var set = function (x, y, dark) { M[y][x] = dark; F[y][x] = true; };
      for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
      [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var x = c[0] + dx, y = c[1] + dy; if (x >= 0 && x < size && y >= 0 && y < size) { var dist = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, dist !== 2 && dist !== 4); } } });
      var ap = alignPositions(v), na = ap.length;
      for (i = 0; i < na; i++) for (j = 0; j < na; j++) { if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue; for (var ay = -2; ay <= 2; ay++) for (var ax = -2; ax <= 2; ax++) set(ap[i] + ax, ap[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1); }
      var format = function (mask) {
        var d = (FORMAT[ec] << 3) | mask, rem = d; for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        var fb = ((d << 10) | rem) ^ 0x5412, bit = function (n) { return ((fb >>> n) & 1) !== 0; };
        for (q = 0; q <= 5; q++) set(8, q, bit(q));
        set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
        for (q = 9; q < 15; q++) set(14 - q, 8, bit(q));
        for (q = 0; q < 8; q++) set(size - 1 - q, 8, bit(q));
        for (q = 8; q < 15; q++) set(8, size - 15 + q, bit(q));
        set(8, size - 8, true);
      };
      format(0);
      if (v >= 7) { var rem = v; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25); var vb = (v << 12) | rem; for (i = 0; i < 18; i++) { var bit = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); } }
      // data, zigzag from the bottom-right corner
      var bi = 0, total = cw.length * 8;
      for (var right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
          var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
          if (!F[y][x] && bi < total) { M[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
        }
      }
      // the mask with the lowest penalty
      var MASKS = [function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
        function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return (x * y) % 2 + (x * y) % 3 === 0; },
        function (x, y) { return ((x * y) % 2 + (x * y) % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + (x * y) % 3) % 2 === 0; }];
      var apply = function (m) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
      var best = 0, bestScore = Infinity;
      for (var m = 0; m < 8; m++) { apply(m); format(m); var sc = penalty(M, size); if (sc < bestScore) { bestScore = sc; best = m; } apply(m); }
      apply(best); format(best);
      return { size: size, modules: M, version: v, ec: ec, mask: best };
    }
    function penalty(M, size) {
      var score = 0, dark = 0, line = function (get) {
        var run = 1, s = 0;
        for (var i = 1; i < size; i++) { if (get(i) === get(i - 1)) run++; else { if (run >= 5) s += run - 2; run = 1; } }
        if (run >= 5) s += run - 2;
        for (i = 0; i + 10 < size; i++) {
          var w = []; for (var j = 0; j < 11; j++) w.push(get(i + j) ? 1 : 0); w = w.join("");
          if (w === "10111010000" || w === "00001011101") s += 40;
        }
        return s;
      };
      for (var y = 0; y < size; y++) { (function (yy) { score += line(function (i) { return M[yy][i]; }); score += line(function (i) { return M[i][yy]; }); })(y); }
      for (y = 0; y < size - 1; y++) for (var x = 0; x < size - 1; x++) { var c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) score += 3; }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (M[y][x]) dark++;
      var tot = size * size; return score + (Math.ceil(Math.abs(dark * 20 - tot * 10) / tot) - 1) * 10;
    }
    return { encode: encode };
  })();
  Deck.qr = QR;

  // QR codes are drawn once, at boot (so thumbnails, the PDF and verify see them), grouped for the animation:
  // the three finder squares, then the other dark modules in diagonal bands
  function drawQr(el) {
    var text = el.getAttribute("data-text"); if (!text) return;
    var q; try { q = QR.encode(text, el.getAttribute("data-ec") || null); } catch (e) { console.error(e.message); el.textContent = "QR: " + e.message; return; }
    var n = q.size, quiet = 2, bands = 10, finder = function (x, y) { return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7); };
    var fd = ["", "", ""], bd = []; for (var b = 0; b < bands; b++) bd.push("");
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if (!q.modules[y][x]) continue;
      var sq = "M" + x + " " + y + "h1v1h-1z";
      if (finder(x, y)) fd[x < 7 && y < 7 ? 0 : x >= n - 7 ? 1 : 2] += sq;
      else bd[Math.min(bands - 1, Math.floor(((x + y) / (2 * n - 1)) * bands))] += sq;
    }
    var svg = svgEl("svg", { viewBox: (-quiet) + " " + (-quiet) + " " + (n + 2 * quiet) + " " + (n + 2 * quiet), "shape-rendering": "crispEdges", role: "img", "aria-label": "QR: " + text, "data-version": q.version });
    svgEl("rect", { x: -quiet, y: -quiet, width: n + 2 * quiet, height: n + 2 * quiet, "class": "qr-bg" }, svg);
    var origins = [[3.5, 3.5], [n - 3.5, 3.5], [3.5, n - 3.5]];
    fd.forEach(function (d, i) { svgEl("path", { d: d, "class": "qr-f", "data-ox": origins[i][0], "data-oy": origins[i][1] }, svg); });
    bd.forEach(function (d) { if (d) svgEl("path", { d: d, "class": "qr-d" }, svg); });
    var old = el.querySelector(":scope > svg"); if (old) old.remove();
    el.appendChild(svg);
  }
  Deck.prepare(function (root) { root.querySelectorAll(".qr[data-text]").forEach(drawQr); });
  Deck.helper("qr", function (h) {
    return function (sel, o) {
      o = o || {};
      all(h, sel).forEach(function (el) {
        var at = o.at == null ? h.tl.duration() : o.at, dur = o.dur || 0.9;
        var f = el.querySelectorAll(".qr-f"), d = el.querySelectorAll(".qr-d");
        f.forEach(function (p, i) { h.tl.fromTo(p, { scale: 0, svgOrigin: p.getAttribute("data-ox") + " " + p.getAttribute("data-oy") }, { scale: 1, svgOrigin: p.getAttribute("data-ox") + " " + p.getAttribute("data-oy"), duration: 0.45, ease: "back.out(1.8)" }, at + i * 0.08); });
        if (d.length) h.tl.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: "none", stagger: (dur - 0.18) / d.length }, at + 0.25);
      });
      return h;
    };
  });
})();
