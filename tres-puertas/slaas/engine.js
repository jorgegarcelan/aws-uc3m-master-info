/* ============================================================
   slaas — deck engine
   One paused GSAP timeline per slide (seekable, deterministic).
   Entering a slide PLAYS its choreography; h.step() adds hold-points
   (fragments) that advance with → / Space / clicker.
   Config comes from window.SLAAS_CONFIG (the build writes it from slaas.json).
   The theme (theme/theme.js, loaded right after this file) sets the palette,
   its eases and, if it wants, its own section-opener choreography.
   Modes:  (default) audience deck
           ?presenter        presenter view (notes, timer, current + next)
           ?follow           deck that only follows the presenter channel
           ?static=N|file    slide frozen at its final state (thumbnails / QA)
           ?shot=N|file&t=S  slide seeked to time S (QA)
           ?verify[&speed=k] audience deck for `slaas verify`: no loops, no autoplay, CSS animations frozen,
                             GSAP k× faster
           ?motion=reduced|full  override the system's reduced-motion setting (slaas.json "motion" too)
           ?edit             open in edit mode
   URL: #12 = slide 12 (plays its entrance) · #12.3 = slide 12 at state 3, shown at once.
   A slide's states are its holds (h.step) and its end: state 0 is where the entrance stops,
   state k is after k presses of →.
   ============================================================ */
(function () {
  "use strict";
  gsap.registerPlugin(SplitText, DrawSVGPlugin, MotionPathPlugin, CustomEase);
  CustomEase.create("deck", "0.22,1,0.36,1");       // confident ease-out (engine UI)
  CustomEase.create("snap", "0.7,0,0.2,1");         // hard in-out for wipes

  var CFG = window.SLAAS_CONFIG || {};
  var Deck = (window.Deck = { builders: {}, config: CFG, slide: function (id, fn) { this.builders[id] = fn; } });
  /* extension points (components.js, themes, a deck's own scripts):
     Deck.helper(name, function (h, rec) { return function (sel, o) { … return h; }; })  → h.<name>(…) in every builder
     Deck.prepare(function (root) { … })  → runs once at boot, before any slide is built (static markup, e.g. QR codes) */
  Deck.ext = {}; Deck.preps = [];
  /* a theme's motion (theme.js sets these; slides that pass their own ease / dur keep them):
     Deck.ease     eases of the helpers: in (rise, slideIn), fade, pop, move (wipe, marker, underline), draw, grow
     Deck.tempo    1 = default speed; 1.2 = 20 % slower, 0.85 = brisker (default durations and staggers)
     Deck.transition(name, fn)  a slide transition of its own: fn(el, prevEl, done) animates and returns when the
                   next slide's timeline may start (seconds); call done() once the old slide is out
     Deck.enterDefault  transition for slides without data-enter (default "fade") */
  Deck.ease = { in: "deck", fade: "power1.out", pop: "back.out(2.2)", move: "power3.inOut", draw: "power2.inOut", grow: "power3.out" };
  Deck.tempo = 1;
  Deck.transitions = {};
  Deck.transition = function (name, fn) { Deck.transitions[name] = fn; };
  Deck.enterDefault = "fade";
  Deck.helper = function (name, factory) { Deck.ext[name] = factory; };
  Deck.prepare = function (fn) { Deck.preps.push(fn); };

  /* sections: data-section="n" (1-based) → { name, c: dots and tiles, accent: progress bar,
     dark: the color needs white text on top (footer dot, section opener get class "dark") } */
  var SECTIONS = {}, NSEC = (CFG.sections || []).length;
  (CFG.sections || []).forEach(function (s, i) { SECTIONS[i + 1] = { name: s.name, c: s.color, accent: s.accent || s.color, dark: !!s.dark }; });
  Deck.SECTIONS = SECTIONS;
  Deck.C = {};                                       // palette, set by the theme
  var ACCENT = CFG.accent || "#333333";
  var APPENDIX = (CFG.appendix && CFG.appendix.label) || null;

  /* ---------------- UI strings ---------------- */
  var LANG = String(CFG.lang || "en").slice(0, 2).toLowerCase();
  var STR = {
    en: {
      grid: "All slides (G)", home: "Start", studio: "Back to slaas Studio", appendix: "Appendix", prev: "Previous (←)", next: "Next (→)", video: "Video: play / pause (K)",
      edit: "Edit this slide (E)", presenter: "Presenter view (P)", fullscreen: "Fullscreen (F)", vplay: "Play / pause (K)", vmute: "Sound (M)",
      gridTitle: "All slides", orgTitle: "Organize slides", gridHint: "click to jump · G / Esc to close", orgHint: "drag to reorder · ◉ hide / show",
      organize: "✥ Organize", cancel: "Cancel", saveOrder: "Save order", hideShow: "Hide / show", hidden: "hidden",
      groupStart: "Start", groupEnd: "Closing", groupAppendix: "Appendix",
      noChanges: "no changes", unsaved: "unsaved changes · {n} hidden", saving: "saving…", savedReload: "saved ✓ · reloading", saveFailed: "could not save",
      readOnly: "⚠ read only: start the server (npm run dev) to save", discardOrder: "There are unsaved order changes. Discard them?",
      save: "Save", discard: "Discard", exit: "Exit", notes: "Speaker notes", notesHint: "(saved in the slide)",
      editedTexts: "{n} text(s) changed", plusNotes: " · notes", editingHidden: "Editing hidden slide", editingSlide: "Editing slide {n}",
      discardEdits: "There are unsaved changes. Exit and discard them?", saveFailedPrefix: "✗ could not save: ",
      shift: "Shift + ", space: "Space",
      nextUp: "NEXT", pause: "❚❚ pause", resume: "▶ resume", reset: "reset", timerTip: "Pause / resume (T)", resetTip: "Reset to zero",
      smaller: "Smaller text (−)", bigger: "Bigger text (+)",
      presHelp: "→ / Space / clicker: next<br>← : back<br>number + Enter: go to slide<br>T: pause / resume the timer<br>− / +: notes text size<br>B: black screen<br>Notes are editable (saved in this browser)",
      appendixCount: "appendix {n} / {m}", slideDone: "slide complete", stepOf: "step {n} of {m}",
      help: [["→ Space", "next (clicker friendly)"], ["←", "back"], ["12 ⏎", "go to slide 12"], ["G", "all slides · organize"], ["E", "edit the slide"], ["P", "presenter view"], ["F · F5", "fullscreen"], ["B", "black screen"], ["Esc", "close"]],
      keyTest: "Test your clicker · last key:",
      reducedOn: "Reduced motion is on (system setting): steps appear at once. Add ?motion=full to the address to animate.",
    },
    es: {
      grid: "Ver todas (G)", home: "Inicio", studio: "Volver a slaas Studio", appendix: "Anexos", prev: "Anterior (←)", next: "Siguiente (→)", video: "Vídeo: reproducir / pausar (K)",
      edit: "Editar esta slide (E)", presenter: "Modo presentador (P)", fullscreen: "Pantalla completa (F)", vplay: "Reproducir / pausar (K)", vmute: "Sonido (M)",
      gridTitle: "Todas las diapositivas", orgTitle: "Organizar diapositivas", gridHint: "clic para saltar · G / Esc para cerrar", orgHint: "arrastra para reordenar · ◉ ocultar / mostrar",
      organize: "✥ Organizar", cancel: "Cancelar", saveOrder: "Guardar orden", hideShow: "Ocultar / mostrar", hidden: "oculta",
      groupStart: "Inicio", groupEnd: "Cierre", groupAppendix: "Anexos",
      noChanges: "sin cambios", unsaved: "cambios sin guardar · {n} ocultas", saving: "guardando…", savedReload: "guardado ✓ · recargando", saveFailed: "no se pudo guardar",
      readOnly: "⚠ solo lectura: arranca el servidor (npm run dev) para guardar", discardOrder: "Hay cambios de orden sin guardar. ¿Descartarlos?",
      save: "Guardar", discard: "Descartar", exit: "Salir", notes: "Notas del orador", notesHint: "(se guardan en la slide)",
      editedTexts: "{n} texto(s) modificado(s)", plusNotes: " · notas", editingHidden: "Editando slide oculta", editingSlide: "Editando slide {n}",
      discardEdits: "Hay cambios sin guardar. ¿Salir y descartarlos?", saveFailedPrefix: "✗ no se pudo guardar: ",
      shift: "Mayús + ", space: "Espacio",
      nextUp: "SIGUIENTE", pause: "❚❚ pausar", resume: "▶ reanudar", reset: "reset", timerTip: "Pausar / reanudar (T)", resetTip: "Poner a cero",
      smaller: "Letra más pequeña (−)", bigger: "Letra más grande (+)",
      presHelp: "→ / Espacio / clicker: avanzar<br>← : retroceder<br>número + Enter: ir a slide<br>T: pausar / reanudar el tiempo<br>− / +: tamaño de letra de las notas<br>B: pantalla en negro<br>Las notas son editables (se guardan en este navegador)",
      appendixCount: "anexo {n} / {m}", slideDone: "slide completa", stepOf: "paso {n} de {m}",
      help: [["→ Espacio", "avanzar (clicker compatible)"], ["←", "retroceder"], ["12 ⏎", "ir a la slide 12"], ["G", "todas las slides · organizar"], ["E", "editar la slide"], ["P", "modo presentador"], ["F · F5", "pantalla completa"], ["B", "pantalla en negro"], ["Esc", "cerrar"]],
      keyTest: "Prueba tu puntero · última tecla:",
      reducedOn: "Movimiento reducido activado (ajuste del sistema): los pasos aparecen sin animación. Añade ?motion=full a la dirección para animar.",
    },
  };
  var T = Object.assign({}, STR.en, STR[LANG] || {}, CFG.strings || {});
  function tr(key, vars) { return String(T[key]).replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] != null ? vars[k] : ""; }); }
  Deck.t = tr;

  var params = new URLSearchParams(location.search);
  var MODE = params.has("presenter") ? "presenter" : params.has("static") ? "static" : params.has("shot") ? "shot" : params.has("follow") ? "follow" : "audience";
  var DECK_ID = CFG.id || "deck";
  var VERIFY = params.has("verify");
  // reduced motion: the system setting (prefers-reduced-motion) unless ?motion= or slaas.json "motion" says otherwise.
  // Steps and slides change at once (a short crossfade between slides), no ambient loops.
  var MOTION = params.get("motion") || CFG.motion || "auto";
  var REDUCED = MOTION === "reduced" || (MOTION === "auto" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var HISTORY = CFG.history !== false;               // every step is a browser-history entry (Back = ←); "history": false to turn off
  var RM = REDUCED ? 0 : 1;                          // duration factor for UI motion
  Deck.reducedMotion = REDUCED;
  if (REDUCED) document.documentElement.classList.add("reduced-motion");
  // verify: 2D transforms only (GSAP's 3D-during-tweens leaves a different rasterization behind than a seek would)
  if (VERIFY) { document.documentElement.classList.add("verify-mode", "static-mode"); gsap.globalTimeline.timeScale(+params.get("speed") || 1); gsap.config({ force3D: false }); }
  var channel = "BroadcastChannel" in window && !params.has("verify") ? new BroadcastChannel("slaas-" + DECK_ID) : null;   // verify pages walk alone
  var INSTANCE = Math.random().toString(36).slice(2);

  var stage, footer, progress, recs = [], allRecs = [], cur = -1;

  /* ---------------- number formatting (separators follow the deck language) ---------------- */
  var SEP = { es: [".", ","], de: [".", ","], it: [".", ","], pt: [".", ","], nl: [".", ","], ca: [".", ","], gl: [".", ","], eu: [".", ","], fr: [" ", ","] };
  var NUM = Object.assign({ thousands: (SEP[LANG] || [",", "."])[0], decimal: (SEP[LANG] || [",", "."])[1], minus: "−" }, CFG.number || {});
  function fmt(n, dec) {
    dec = dec || 0;
    var s = Math.abs(n).toFixed(dec).split(".");
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NUM.thousands);
    return (n < 0 ? NUM.minus : "") + s.join(NUM.decimal);
  }
  Deck.fmt = fmt;
  function hash(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ---------------- helpers given to every slide builder ---------------- */
  function helpers(rec) {
    var el = rec.el, tl = rec.tl;
    var q = function (s) { return typeof s === "string" ? el.querySelector(s) : s; };
    var qa = function (s) { return typeof s === "string" ? Array.prototype.slice.call(el.querySelectorAll(s)) : s; };
    var h = {
      el: el, tl: tl, q: q, qa: qa, C: Deck.C, fmt: fmt,
      /* hold-point: the deck stops here until the presenter advances (at the current end, or at time t) */
      step: function (t) { t = t == null ? tl.duration() : t; tl.addPause(t); rec.pauses.push(t); rec.pauses.sort(function (a, b) { return a - b; }); return t; },
      split: function (s, type, opts) { return new SplitText(q(s), Object.assign({ type: type || "chars,words", mask: type && type.indexOf("lines") > -1 ? "lines" : undefined }, opts || {})); },
      /* count-up with Spanish formatting */
      count: function (s, o) {
        var node = q(s), p = { v: o.from || 0 };
        node.textContent = (o.prefix || "") + fmt(o.from || 0, o.dec) + (o.suffix || "");
        tl.to(p, { v: o.to, duration: o.dur || 1.3 * Deck.tempo, ease: o.ease || "power3.out",
          onUpdate: function () { node.textContent = (o.prefix || "") + fmt(p.v, o.dec) + (o.suffix || ""); } }, o.at);
        return h;
      },
      /* deterministic glyph decode (text scramble that resolves) */
      decode: function (s, o) {
        var node = q(s), text = o && o.text != null ? o.text : node.textContent, glyphs = (o && o.glyphs) || "01#%&@$<>/\\{}[]=+*ΣΔκ", p = { v: 0 };
        // the final text is written by onUpdate itself (a tl.set of textContent would turn "02" into 2)
        tl.fromTo(p, { v: 0 }, { v: 1, duration: (o && o.dur) || 1 * Deck.tempo, ease: "none", immediateRender: false, onUpdate: function () {
          if (p.v >= 1) { node.textContent = text; return; }
          var f = Math.floor(tl.time() * 24), n = Math.floor(p.v * text.length), out = "";
          for (var i = 0; i < text.length; i++) out += i < n || text[i] === " " ? text[i] : glyphs[Math.floor(hash(i, f) * glyphs.length)];
          node.textContent = out;
        } }, o && o.at);
        return h;
      },
      marker: function (s, o) { o = o || {}; tl.fromTo(qa(s), { "--mk": 0 }, { "--mk": 1, duration: o.dur || 0.55 * Deck.tempo, ease: o.ease || Deck.ease.move, stagger: o.stagger || 0.18 * Deck.tempo }, o.at); return h; },
      underline: function (s, o) { o = o || {}; tl.fromTo(qa(s), { "--ul": 0 }, { "--ul": 1, duration: o.dur || 0.6 * Deck.tempo, ease: o.ease || Deck.ease.move, stagger: o.stagger || 0.15 * Deck.tempo }, o.at); return h; },
      draw: function (s, o) { o = o || {}; tl.fromTo(qa(s), { drawSVG: o.from || "0%" }, { drawSVG: "100%", duration: o.dur || 1 * Deck.tempo, ease: o.ease || Deck.ease.draw, stagger: o.stagger || 0 * Deck.tempo }, o.at); return h; },
      rise: function (s, o) { o = o || {}; tl.fromTo(qa(s), { opacity: 0, y: o.y == null ? 40 : o.y }, { opacity: 1, y: 0, duration: o.dur || 0.7 * Deck.tempo, ease: o.ease || Deck.ease.in, stagger: o.stagger || 0.08 * Deck.tempo }, o.at); return h; },
      fade: function (s, o) { o = o || {}; tl.fromTo(qa(s), { opacity: 0 }, { opacity: 1, duration: o.dur || 0.6 * Deck.tempo, ease: o.ease || Deck.ease.fade, stagger: o.stagger || 0.06 * Deck.tempo }, o.at); return h; },
      pop: function (s, o) { o = o || {}; tl.fromTo(qa(s), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: o.dur || 0.6 * Deck.tempo, ease: o.ease || Deck.ease.pop, stagger: o.stagger || 0.06 * Deck.tempo }, o.at); return h; },
      slideIn: function (s, o) { o = o || {}; tl.fromTo(qa(s), { opacity: 0, x: o.x == null ? -60 : o.x }, { opacity: 1, x: 0, duration: o.dur || 0.7 * Deck.tempo, ease: o.ease || Deck.ease.in, stagger: o.stagger || 0.08 * Deck.tempo }, o.at); return h; },
      /* clip-path wipe reveal: dir = right|left|up|down */
      wipe: function (s, o) {
        o = o || {}; var d = o.dir || "right";
        var from = { right: "inset(0% 100% 0% 0%)", left: "inset(0% 0% 0% 100%)", up: "inset(100% 0% 0% 0%)", down: "inset(0% 0% 100% 0%)" }[d];
        tl.fromTo(qa(s), { clipPath: from }, { clipPath: "inset(0% 0% 0% 0%)", duration: o.dur || 0.8 * Deck.tempo, ease: o.ease || Deck.ease.move, stagger: o.stagger || 0.1 * Deck.tempo }, o.at);
        return h;
      },
      /* bars: <i> fills scaled from 0 → value (0..1) */
      grow: function (s, o) { o = o || {}; tl.fromTo(qa(s), { scaleX: 0 }, { scaleX: function (i, t) { return t.dataset.v != null ? +t.dataset.v : 1; }, duration: o.dur || 1.1 * Deck.tempo, ease: o.ease || Deck.ease.grow, stagger: o.stagger || 0.08 * Deck.tempo }, o.at); return h; },
      growY: function (s, o) { o = o || {}; tl.fromTo(qa(s), { scaleY: 0 }, { scaleY: 1, duration: o.dur || 0.9 * Deck.tempo, ease: o.ease || Deck.ease.grow, stagger: o.stagger || 0.06 * Deck.tempo }, o.at); return h; },
      /* ambient loop that runs while the slide is on screen (not part of the timeline) */
      loop: function (factory) { rec.loops.push(factory); return h; },
      onEnter: function (fn) { rec.enter.push(fn); return h; },
      onLeave: function (fn) { rec.leave.push(fn); return h; },
    };
    Object.keys(Deck.ext).forEach(function (k) { h[k] = Deck.ext[k](h, rec); });
    return h;
  }

  function build(rec) {
    if (rec.built) return;
    rec.built = true;
    rec.tl = gsap.timeline({ paused: true });
    rec.pauses = []; rec.loops = []; rec.enter = []; rec.leave = []; rec.live = [];
    var fn = Deck.builders[rec.id];
    if (fn) { try { fn(rec.el, rec.tl, helpers(rec)); } catch (e) { console.error("slide " + rec.id, e); } }
    if (rec.tl.duration() === 0) rec.tl.to({}, { duration: 0.01 });
  }


  /* ---------------- shared section-opener choreography ----------------
     Markup: <section class="slide sep sN"> with .sep-num[data-n] .sep-title .sep-sub.
     A theme may replace Deck.separator with its own. */
  Deck.separator = function (el, tl, h) {
    var num = h.q(".sep-num"), target = num ? num.dataset.n || num.textContent.trim() : "";
    if (!num || !/^\d+$/.test(target)) {
      if (num) h.rise(num, { at: 0.1, y: 30 });
      if (h.q(".sep-title")) h.rise(".sep-title", { at: 0.3, y: 30 });
      if (h.q(".sep-sub")) h.rise(".sep-sub", { at: 0.6, y: 24 });
      return;
    }
    // slot-machine digits: each digit rolls through a column of numbers and lands on its value
    num.innerHTML = target.split("").map(function (d) {
      var col = ""; for (var k = 0; k <= 10 + +d; k++) col += "<div>" + (k % 10) + "</div>";
      return '<span style="display:inline-block;height:.85em;overflow:hidden;vertical-align:top"><span class="sep-roll" data-steps="' + (10 + +d) + '" style="display:block;line-height:.85">' + col + "</span></span>";
    }).join("");
    h.qa(".sep-roll").forEach(function (r, i) {
      tl.fromTo(r, { yPercent: 0 }, { yPercent: -100 * (+r.dataset.steps) / (+r.dataset.steps + 1), duration: 1.1 + i * 0.25, ease: "power4.inOut" }, 0.2);
    });
    var t = h.split(h.q(".sep-title"), "chars");
    tl.fromTo(t.chars, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: "power4.out", stagger: 0.025 }, 0.55);
    h.rise(".sep-sub", { at: 1.0, y: 24 });
  };

  /* ---------------- footer ---------------- */
  /* appendix = slides from the first one marked data-appendix (or labelled with config.appendix.label) on */
  function isAppendix(el) { return el.hasAttribute("data-appendix") || (APPENDIX != null && el.dataset.label === APPENDIX); }
  function renderFooter(rec) {
    var off = rec.el.dataset.footer === "off";
    if (footer) gsap.to(footer, { autoAlpha: off ? 0 : 1, duration: 0.35 * RM });
    gsap.to(progress, { autoAlpha: off ? 0 : 1, duration: 0.35 * RM });
    if (off) return;
    var s = +rec.el.dataset.section || 0;
    if (footer) {
      footer.querySelectorAll(".fd").forEach(function (d, i) {
        var n = i + 1, on = n === s, col = SECTIONS[n].c;
        d.classList.toggle("on", on);
        gsap.to(d, { backgroundColor: on ? col : "rgba(0,0,0,0)", scale: on ? 1.18 : 1, duration: 0.45 * RM, ease: on ? "back.out(3)" : "power2.out" });
      });
      var label = rec.el.dataset.label || (SECTIONS[s] ? SECTIONS[s].name : "");
      var fsec = footer.querySelector(".fsec");
      if (fsec && fsec.textContent !== label) {
        gsap.fromTo(fsec, { y: 14 * RM, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 * RM, ease: "deck" });
        fsec.textContent = label;
      }
      var fnum = footer.querySelector(".fnum");
      if (fnum) fnum.textContent = recs.indexOf(rec) > -1 ? recs.indexOf(rec) + 1 : "·";
    }
    if (recs.indexOf(rec) < 0) return; // a peeked hidden slide keeps the progress of where you were
    // the progress bar only measures the talk: everything from the appendix on counts as 100 %
    var anx = Deck._anxStart, lastMain = anx > 0 ? anx - 1 : recs.length - 1;
    gsap.to(progress, { scaleX: Math.min(1, recs.indexOf(rec) / Math.max(1, lastMain)), backgroundColor: SECTIONS[s] ? SECTIONS[s].accent : ACCENT, duration: 0.8 * RM, ease: "deck" });
  }

  /* ---------------- media + loops ---------------- */
  function startLive(rec) {
    rec.live = REDUCED || VERIFY ? [] : rec.loops.map(function (f) { return f(); });
    rec.enter.forEach(function (f) { f(); });
    if (!VERIFY) rec.el.querySelectorAll("video[data-autoplay]").forEach(function (v) { try { v.currentTime = +(v.dataset.from || 0); v.play().catch(function () {}); } catch (e) {} });
  }
  function stopLive(rec) {
    (rec.live || []).forEach(function (t) { if (t && t.kill) t.kill(); });
    rec.live = [];
    (rec.leave || []).forEach(function (f) { f(); });
    rec.el.querySelectorAll("video").forEach(function (v) { try { v.pause(); } catch (e) {} });
  }


  /* ---------------- video controls (play / pause / mute / scrub) ---------------- */
  var IC = {
    play: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="4.5" width="4.2" height="15" rx="1" fill="currentColor"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1" fill="currentColor"/></svg>',
    on: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    off: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  };
  function toggleVideo(v) { if (!v) return; if (v.paused) v.play().catch(function () {}); else v.pause(); flashVideo(v); }
  function flashVideo(v) {
    var big = v.__hfBig; if (!big) return;
    big.innerHTML = v.paused ? IC.pause : IC.play;
    gsap.fromTo(big, { opacity: 0.95, scale: 0.8 }, { opacity: 0, scale: 1.35, duration: 0.7, ease: "power2.out" });
  }
  function setupVideo(v) {
    if (v.__hfCtl) return; v.__hfCtl = true;
    var host = v.parentElement;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    var ui = document.createElement("div"); ui.className = "vctl"; ui.setAttribute("data-noclick", "");
    ui.innerHTML = '<button class="vb vplay" title="' + tr("vplay") + '"></button><button class="vb vmute" title="' + tr("vmute") + '"></button><div class="vbar"><i></i></div>';
    host.appendChild(ui);
    var big = document.createElement("div"); big.className = "vbig"; host.appendChild(big); v.__hfBig = big;
    var bp = ui.querySelector(".vplay"), bm = ui.querySelector(".vmute"), bar = ui.querySelector(".vbar"), fill = bar.querySelector("i");
    function sync() { bp.innerHTML = v.paused ? IC.play : IC.pause; bm.innerHTML = v.muted ? IC.off : IC.on; ui.classList.toggle("is-paused", v.paused); }
    ["play", "pause", "volumechange", "loadedmetadata"].forEach(function (ev) { v.addEventListener(ev, sync); });
    v.addEventListener("timeupdate", function () { if (v.duration) fill.style.transform = "scaleX(" + v.currentTime / v.duration + ")"; });
    bp.addEventListener("click", function (e) { e.stopPropagation(); toggleVideo(v); });
    bm.addEventListener("click", function (e) { e.stopPropagation(); v.muted = !v.muted; });
    bar.addEventListener("click", function (e) { e.stopPropagation(); var r = bar.getBoundingClientRect(); if (v.duration) v.currentTime = v.duration * Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); });
    v.style.cursor = "pointer";
    v.addEventListener("click", function (e) { e.stopPropagation(); toggleVideo(v); });
    sync();
  }
  function currentVideo() { var r = viewRec(); return r ? r.el.querySelector("video") : null; }


  /* ---------------- floating side rail + grid overview ---------------- */
  var rail, grid, gridOpen = false, idleT = null;
  function firstOf(pred) { for (var i = 0; i < recs.length; i++) if (pred(recs[i].el)) return i; return -1; }
  function jump(i) { if (i > -1) { closeGrid(); cmd("goto", i); } }
  function buildRail() {
    rail = document.createElement("nav");
    rail.id = "rail";
    // served by slaas Studio (/d/<id>/): the first button goes back to the deck's page in Studio
    var studio = /^\/d\/(\w+)\/$/.exec(location.pathname);
    var html = studio ? '<a class="rb" href="/#/d/' + studio[1] + '" title="' + tr("studio") + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></a><div class="rsep"></div>' : "";
    html += '<button class="rb" data-a="grid" title="' + tr("grid") + '"><svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" fill="currentColor"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" fill="currentColor"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" fill="currentColor"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" fill="currentColor"/></svg></button>';
    html += '<div class="rsep"></div><button class="rb rtxt" data-a="home" title="' + tr("home") + '">⌂</button>';
    for (var n = 1; n <= NSEC; n++) html += '<button class="rb rdot" data-a="sec" data-n="' + n + '" title="' + SECTIONS[n].name + '" style="--c:' + SECTIONS[n].c + '"><span>' + n + "</span></button>";
    if (Deck._anxStart > -1) html += '<button class="rb rtxt" data-a="anexos" title="' + tr("appendix") + '">A</button>';
    html += '<div class="rsep"></div>';
    html += '<button class="rb" data-a="prev" title="' + tr("prev") + '"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    html += '<div class="rcount"></div>';
    html += '<button class="rb" data-a="next" title="' + tr("next") + '"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    html += '<div class="rsep"></div><button class="rb rtxt" data-a="video" title="' + tr("video") + '">▶︎❚❚</button>';
    html += '<button class="rb" data-a="edit" title="' + tr("edit") + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg></button>';
    html += '<button class="rb" data-a="pres" title="' + tr("presenter") + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></button>';
    html += '<button class="rb" data-a="fs" title="' + tr("fullscreen") + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>';
    rail.innerHTML = html;
    document.body.appendChild(rail);
    var hot = document.createElement("div"); hot.id = "rail-hot"; document.body.appendChild(hot);
    rail.addEventListener("click", function (e) {
      var b = e.target.closest(".rb"); if (!b) return; var a = b.dataset.a;
      if (a === "grid") toggleGrid();
      else if (a === "home") jump(0);
      else if (a === "sec") jump(firstOf(function (el) { return +el.dataset.section === +b.dataset.n; }));
      else if (a === "anexos") jump(Deck._anxStart);
      else if (a === "prev") cmd("prev");
      else if (a === "next") cmd("next");
      else if (a === "video") toggleVideo(currentVideo());
      else if (a === "edit") enterEdit();
      else if (a === "pres") openPresenter();
      else if (a === "fs") { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {}); else document.exitFullscreen(); }
    });
    var show = function () { rail.classList.add("on"); clearTimeout(idleT); idleT = setTimeout(function () { if (!rail.matches(":hover")) rail.classList.remove("on"); }, 1800); };
    hot.addEventListener("mousemove", show); rail.addEventListener("mousemove", show);
    // hide the cursor when the mouse is idle (projection)
    var curT = null;
    document.addEventListener("mousemove", function (e) {
      document.body.classList.remove("idle"); clearTimeout(curT); curT = setTimeout(function () { document.body.classList.add("idle"); }, 2500);
      if (e.clientX > window.innerWidth - 70) show();
    });
  }
  function updateRail() {
    if (!rail) return;
    var el = viewRec().el, s = +el.dataset.section || 0, anx = isAppendix(el);
    rail.querySelector(".rcount").innerHTML = "<b>" + (cur + 1) + "</b><span>" + recs.length + "</span>";
    rail.querySelectorAll(".rdot").forEach(function (d) { d.classList.toggle("act", +d.dataset.n === s); });
    var ab = rail.querySelector('[data-a="anexos"]'); if (ab) ab.classList.toggle("act", anx);
    rail.querySelector('[data-a="video"]').style.display = currentVideo() ? "" : "none";
    if (gridOpen) markGrid();
  }
  /* grid: normal mode = jump; "Organizar" = drag to reorder, eye to hide/show, saved to deck.json via serve.mjs */
  var ORG = { on: false };
  function thumbOf(file) { return "assets/thumbs/" + String(file || "").replace(/\.html$/, "") + ".jpg"; }
  function colorOf(el) { var s = +el.dataset.section || 0; return SECTIONS[s] ? SECTIONS[s].c : isAppendix(el) ? "#9f9b93" : "#dad4c8"; }
  function tileHtml(r, num) {
    var el = r.el, vi = recs.indexOf(r), t = el.dataset.title || r.id;
    if (num === undefined) num = vi > -1 ? vi + 1 : "—";
    return '<div class="g-tile' + (r.hidden ? " is-hidden" : "") + '" data-file="' + el.dataset.file + '" data-i="' + vi + '">' +
      '<div class="g-img" style="--c:' + colorOf(el) + '"><img loading="lazy" src="' + thumbOf(el.dataset.file) + '" alt="" draggable="false" onerror="this.remove()"/><span class="g-ph">' + t + '</span>' +
      '<button class="g-eye" title="' + tr("hideShow") + '" data-noclick>' + (r.hidden ? "◌" : "◉") + '</button><span class="g-hid">' + tr("hidden") + "</span></div>" +
      '<div class="g-cap"><b>' + num + "</b>" + t + "</div></div>";
  }
  function renderGrid() {
    var html = '<div class="g-top"><div class="g-title">' + (ORG.on ? tr("orgTitle") : tr("gridTitle")) + '</div><div class="g-hint">' +
      (ORG.on ? tr("orgHint") : tr("gridHint")) + '</div><div class="g-acts">' +
      (ORG.on ? '<span class="g-st"></span><button data-g="cancel">' + tr("cancel") + '</button><button data-g="save" class="pri">' + tr("saveOrder") + "</button>" : '<button data-g="org">' + tr("organize") + "</button>") + "</div></div><div class=\"g-body\">";
    if (ORG.on) {
      var k = 0;
      html += '<div class="g-tiles g-flat">' + ORG.list.map(function (r) { return tileHtml(r, r.hidden ? "—" : ++k); }).join("") + "</div>";
    } else {
      // consecutive slides of the same section form a group; slides without one are grouped by their
      // data-label, or as "start" (before any section) / "closing" (after); the appendix is its own group
      var groups = [], last = null, seenSec = false, inAnx = false;
      allRecs.forEach(function (r) {
        var el = r.el, s = SECTIONS[+el.dataset.section] ? +el.dataset.section : 0, lab = el.dataset.label;
        inAnx = inAnx || isAppendix(el);
        if (s) seenSec = true;
        var key = inAnx ? "anx" : s ? "s" + s : lab && lab !== tr("groupEnd") ? "l:" + lab : seenSec ? "end" : "start";
        if (!last || last.key !== key) { last = { key: key, s: s, label: lab, items: [] }; groups.push(last); }
        last.items.push(r);
      });
      groups.forEach(function (g) {
        var col = g.s ? SECTIONS[g.s].c : g.key === "anx" ? "#9f9b93" : "#dad4c8";
        var name = g.s ? (g.s < 10 ? "0" : "") + g.s + " · " + SECTIONS[g.s].name : g.key === "anx" ? tr("groupAppendix") : g.key === "end" ? tr("groupEnd") : g.key === "start" ? tr("groupStart") : g.label;
        html += '<div class="g-sec"><div class="g-sh"><i style="background:' + col + '"></i>' + name + '</div><div class="g-tiles">' + g.items.map(function (r) { return tileHtml(r); }).join("") + "</div></div>";
      });
    }
    grid.innerHTML = html + "</div>";
    grid.classList.toggle("org", ORG.on);
    markGrid();
    if (ORG.on) wireDrag();
  }
  function buildGrid() {
    grid = document.createElement("div");
    grid.id = "grid";
    document.body.appendChild(grid);
    renderGrid();
    grid.addEventListener("click", function (e) {
      var g = e.target.closest("[data-g]");
      if (g) { if (g.dataset.g === "org") startOrganize(); else if (g.dataset.g === "cancel") { ORG.on = false; renderGrid(); } else saveOrder(); return; }
      var eye = e.target.closest(".g-eye");
      if (eye && ORG.on) { var r = recOfFile(eye.closest(".g-tile").dataset.file); r.hidden = !r.hidden; renderGridKeepScroll(); orgStatus(); return; }
      var t = e.target.closest(".g-tile");
      if (t && !ORG.on) { if (t.classList.contains("is-hidden")) { peek(recOfFile(t.dataset.file)); return; } jump(+t.dataset.i); }
      else if (e.target === grid) closeGrid();
    });
  }
  function recOfFile(f) { for (var i = 0; i < allRecs.length; i++) if (allRecs[i].el.dataset.file === f) return allRecs[i]; return null; }
  function renderGridKeepScroll() { var y = grid.scrollTop; renderGrid(); grid.scrollTop = y; }
  function startOrganize() {
    ORG.on = true; ORG.list = allRecs.slice(); ORG.orig = allRecs.map(function (r) { return r.el.dataset.file + (r.hidden ? "*" : ""); }).join(",");
    ORG.hidden0 = allRecs.map(function (r) { return r.hidden; });
    renderGrid(); orgStatus();
    fetch("api/ping", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { ORG.server = !!(j && j.edit); if (!ORG.server) throw 0; })
      .catch(function () { ORG.server = false; orgStatus(tr("readOnly")); });
  }
  function orgStatus(msg) {
    var st = grid.querySelector(".g-st"); if (!st) return;
    var now = ORG.list.map(function (r) { return r.el.dataset.file + (r.hidden ? "*" : ""); }).join(",");
    st.textContent = msg || (now === ORG.orig ? tr("noChanges") : tr("unsaved", { n: ORG.list.filter(function (r) { return r.hidden; }).length }));
  }
  function wireDrag() {
    var box = grid.querySelector(".g-flat"), dragging = null;
    box.querySelectorAll(".g-tile").forEach(function (t) {
      t.setAttribute("draggable", "true");
      t.addEventListener("dragstart", function (e) { dragging = t; t.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", t.dataset.file); } catch (x) {} });
      t.addEventListener("dragend", function () { t.classList.remove("dragging"); dragging = null; syncOrgFromDom(); });
    });
    box.addEventListener("dragover", function (e) {
      if (!dragging) return; e.preventDefault();
      var over = e.target.closest(".g-tile"); if (!over || over === dragging) return;
      var r = over.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
      box.insertBefore(dragging, after ? over.nextSibling : over);
    });
    box.addEventListener("drop", function (e) { e.preventDefault(); });
  }
  function syncOrgFromDom() {
    ORG.list = Array.prototype.map.call(grid.querySelectorAll(".g-flat .g-tile"), function (t) { return recOfFile(t.dataset.file); });
    var vi = 0;
    grid.querySelectorAll(".g-flat .g-tile").forEach(function (t, k) { var r = ORG.list[k]; t.querySelector(".g-cap b").textContent = r.hidden ? "—" : ++vi; });
    orgStatus();
  }
  function saveOrder() {
    var payload = { slides: ORG.list.map(function (r) { return { file: r.el.dataset.file, hidden: !!r.hidden }; }) };
    orgStatus(tr("saving"));
    var curFile = recs[cur] && recs[cur].el.dataset.file;
    fetch("api/order", { method: "POST", headers: { "Content-Type": "application/json", "X-Slaas": "1" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error);
        var vis = payload.slides.filter(function (s) { return !s.hidden; }).map(function (s) { return s.file; });
        var k = vis.indexOf(curFile);
        orgStatus(tr("savedReload"));
        setTimeout(function () { location.hash = k > -1 ? hashFor(k, stateOf(recs[cur])) : "#1"; location.reload(); }, 400);
      })
      .catch(function (e) { orgStatus("✗ " + (e && e.message ? e.message : tr("saveFailed"))); });
  }
  function markGrid() {
    var vf = viewRec() && viewRec().el.dataset.file;
    grid.querySelectorAll(".g-tile").forEach(function (t) { t.classList.toggle("cur", !ORG.on && t.dataset.file === vf); });
  }
  function toggleGrid() { if (gridOpen) closeGrid(); else openGrid(); }
  function openGrid() {
    gridOpen = true; if (ORG.on) { ORG.on = false; renderGrid(); } markGrid(); grid.style.display = "block";
    gsap.fromTo(grid, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(grid.querySelectorAll(".g-tile"), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power2.out", stagger: 0.006 });
    var c = grid.querySelector(".g-tile.cur"); if (c) c.scrollIntoView({ block: "center" });
  }
  function closeGrid() {
    if (!gridOpen) return;
    if (ORG.on) { var now = ORG.list.map(function (r) { return r.el.dataset.file + (r.hidden ? "*" : ""); }).join(","); if (now !== ORG.orig && !confirm(tr("discardOrder"))) return;
      allRecs.forEach(function (r, i) { r.hidden = ORG.hidden0[i]; }); ORG.on = false; renderGrid(); }
    gridOpen = false; gsap.to(grid, { opacity: 0, duration: 0.2, onComplete: function () { grid.style.display = "none"; } });
  }


  /* ---------------- edit mode (E): edit texts + notes, saved to src/slides via serve.mjs ---------------- */
  var EDIT = { on: false };
  function editClean(h) { return h.replace(/\s*contenteditable="[^"]*"/g, "").replace(/\s*spellcheck="[^"]*"/g, "").replace(/\s*style=""/g, "").replace(/(<br\s*\/?>)+$/, ""); }
  function editBar() {
    var bar = document.getElementById("editbar");
    if (!bar) {
      bar = document.createElement("div"); bar.id = "editbar";
      bar.innerHTML = '<span class="eb-dot"></span><span class="eb-t"></span><span class="eb-st"></span>' +
        '<button data-a="save">' + tr("save") + ' <kbd>⌘S</kbd></button><button data-a="discard">' + tr("discard") + '</button><button data-a="exit">' + tr("exit") + " <kbd>Esc</kbd></button>";
      document.body.appendChild(bar);
      bar.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; if (b.dataset.a === "save") saveEdit(); else if (b.dataset.a === "discard") exitEdit(true); else exitEdit(false); });
      var np = document.createElement("div"); np.id = "editnotes";
      np.innerHTML = "<label>" + tr("notes") + " <span>" + tr("notesHint") + '</span></label><textarea spellcheck="false"></textarea>';
      document.body.appendChild(np);
      np.querySelector("textarea").addEventListener("input", function () { editStatus(); });
    }
    return bar;
  }
  function editStatus(msg, kind) {
    var bar = editBar(), n = editChanges().edits.length, notesChanged = editNotesChanged();
    bar.querySelector(".eb-st").textContent = msg || (n || notesChanged ? tr("editedTexts", { n: n }) + (notesChanged ? tr("plusNotes") : "") : tr("noChanges"));
    bar.dataset.kind = kind || (n || notesChanged ? "dirty" : "");
  }
  function notesOf(rec) { var n = rec.el.querySelector("template.notes, .notes"); return n ? (n.content ? n.content.textContent : n.textContent).trim() : ""; }
  function editNotesChanged() { var ta = document.querySelector("#editnotes textarea"); return ta && EDIT.rec && ta.value !== notesOf(EDIT.rec); }
  function editChanges() {
    var edits = [];
    if (!EDIT.rec) return { edits: edits };
    EDIT.rec.el.querySelectorAll("[data-e]").forEach(function (n) {
      if (n.__src == null) return;
      var now = editClean(n.innerHTML);
      if (now !== editClean(n.__src)) edits.push({ n: +n.dataset.e.split("#")[1], html: now });
    });
    return { edits: edits };
  }
  function enterEdit() {
    if (MODE !== "audience" || EDIT.on) return;
    var rec = viewRec(); EDIT.on = true; EDIT.rec = rec;
    closeGrid(); rec.tl.pause(rec.tl.duration(), false); stopLive(rec);
    rec.el.querySelectorAll("[data-e]").forEach(function (n) {
      if (n.__src == null) return;
      n.innerHTML = n.__src;
      n.setAttribute("contenteditable", "true"); n.setAttribute("spellcheck", "false");
    });
    document.body.classList.add("editing");
    var bar = editBar();
    bar.querySelector(".eb-t").textContent = (PEEK ? tr("editingHidden") : tr("editingSlide", { n: cur + 1 })) + " · " + (rec.el.dataset.file || rec.id);
    document.querySelector("#editnotes textarea").value = notesOf(rec);
    editStatus();
    fetch("api/ping", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { EDIT.server = !!(j && j.edit); if (!EDIT.server) throw 0; })
      .catch(function () { EDIT.server = false; editStatus(tr("readOnly"), "warn"); });
  }
  function exitEdit(force) {
    if (!EDIT.on) return;
    var dirty = editChanges().edits.length || editNotesChanged();
    if (dirty && !force && !confirm(tr("discardEdits"))) return;
    location.reload();
  }
  function saveEdit() {
    if (!EDIT.on) return;
    var ch = editChanges(), body = { file: EDIT.rec.el.dataset.file, edits: ch.edits };
    if (editNotesChanged()) body.notes = document.querySelector("#editnotes textarea").value;
    if (!body.edits.length && body.notes == null) { editStatus(tr("noChanges")); return; }
    editStatus(tr("saving"), "busy");
    fetch("api/save?index=" + (cur + 1), { method: "POST", headers: { "Content-Type": "application/json", "X-Slaas": "1" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error); editStatus(tr("savedReload"), "ok"); setTimeout(function () { location.reload(); }, 450); })
      .catch(function (e) { editStatus(tr("saveFailedPrefix") + (e && e.message ? e.message : tr("readOnly")), "warn"); });
  }
  document.addEventListener("keydown", function (e) {
    if (!EDIT.on) return;
    if (e.key === "Escape") { e.preventDefault(); exitEdit(false); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveEdit(); }
    else if (e.key === "Enter" && e.target.isContentEditable) { e.preventDefault(); }
  }, true);
  document.addEventListener("paste", function (e) {
    if (!EDIT.on || !e.target.isContentEditable) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\s*\n\s*/g, " "));
  });
  document.addEventListener("input", function (e) { if (EDIT.on && e.target.isContentEditable) editStatus(); });

  /* ---------------- navigation core ---------------- */
  function stepCount(rec) { var t = rec.tl.time(); return rec.pauses.filter(function (p) { return p <= t + 1e-4; }).length; }

  /* peek: show a hidden slide on demand (from the grid). → runs its steps and then returns to
     the exact point you left; ← / Esc return too. The running order never includes it. */
  var PEEK = null;
  function viewRec() { return PEEK ? PEEK.rec : recs[cur]; }
  function peek(rec) {
    closeGrid();
    var from = viewRec();
    var origin = PEEK ? PEEK.origin : { idx: cur, time: recs[cur].tl.time() };
    if (from && from !== rec) { from.tl.pause(); stopLive(from); }
    PEEK = { rec: rec, origin: origin };
    build(rec); renderFooter(rec); updateRail();
    rec.tl.pause(0, false);
    var delay = transitionIn(rec, from === rec ? null : from, 1);
    if (REDUCED) rec.tl.pause(stops(rec)[0], false);
    else gsap.delayedCall(delay, function () { if (PEEK && PEEK.rec === rec) rec.tl.play(); });
    startLive(rec);
  }
  function endPeek() {
    if (!PEEK) return;
    var r = PEEK.rec, o = PEEK.origin; PEEK = null;
    r.tl.pause(); stopLive(r);
    var rec = recs[o.idx]; build(rec); cur = o.idx;
    renderFooter(rec); updateRail();
    rec.tl.pause(o.time, false);
    transitionIn(rec, r, -1);
    startLive(rec);
    syncUrl(false);
  }
  Deck.peek = function (file) { var r = recOfFile(file); if (r && r.hidden) peek(r); };

  function transitionIn(rec, prev, dir) {
    var el = rec.el, kind = dir > 0 ? (REDUCED ? "fade" : el.dataset.enter || Deck.enterDefault || "fade") : "cut";
    gsap.killTweensOf([el, prev && prev.el]);
    el.classList.add("is-active");
    gsap.set(el, { clearProps: "clipPath,transform", opacity: 1, visibility: "visible", zIndex: 5 });
    if (prev) {
      prev.el.classList.remove("is-active"); prev.el.classList.add("is-leaving");
      gsap.set(prev.el, { zIndex: 4 });
    }
    var done = function () { if (prev) { prev.el.classList.remove("is-leaving"); gsap.set(prev.el, { opacity: 0, visibility: "hidden", zIndex: 0 }); } };
    if (!prev || kind === "cut") { done(); return 0; }
    if (Deck.transitions[kind]) { try { return Deck.transitions[kind](el, prev.el, done) || 0; } catch (e) { console.error("transition " + kind, e); done(); return 0; } }
    if (kind === "circle" || kind === "wipe") {
      gsap.fromTo(el, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, ease: "snap", onComplete: function () { gsap.set(el, { clearProps: "clipPath" }); done(); } });
      gsap.to(prev.el, { xPercent: -12, duration: 0.9, ease: "snap", onComplete: function () { gsap.set(prev.el, { clearProps: "transform" }); } });
      return 0.2;
    }
    if (kind === "push") {
      gsap.fromTo(el, { xPercent: 100 }, { xPercent: 0, duration: 0.85, ease: "snap" });
      gsap.to(prev.el, { xPercent: -30, opacity: 0, duration: 0.85, ease: "snap", onComplete: function () { gsap.set(prev.el, { clearProps: "transform" }); done(); } });
      return 0.2;
    }
    if (kind === "rise") {
      gsap.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: "snap" });
      gsap.to(prev.el, { yPercent: -18, opacity: 0.2, duration: 0.9, ease: "snap", onComplete: function () { gsap.set(prev.el, { clearProps: "transform" }); done(); } });
      return 0.3;
    }
    if (kind === "zoom") {
      gsap.fromTo(el, { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: "deck" });
      gsap.to(prev.el, { scale: 0.94, opacity: 0, duration: 0.6, ease: "power2.in", onComplete: function () { gsap.set(prev.el, { clearProps: "transform" }); done(); } });
      return 0.1;
    }
    if (kind === "edge") {
      // the brand transition: the outgoing slide turns until it is seen edge-on (a slash), the new one turns in from edge-on
      gsap.set([el, prev.el], { transformPerspective: 2600 });
      gsap.to(prev.el, { rotationY: 88, rotationZ: 20, duration: 0.34, ease: "power3.in", onComplete: function () { gsap.set(prev.el, { clearProps: "transform" }); done(); } });
      gsap.fromTo(el, { rotationY: -88, rotationZ: -20 }, { rotationY: 0, rotationZ: 0, duration: 0.62, ease: "expo.out", delay: 0.3, onComplete: function () { gsap.set(el, { clearProps: "transform" }); } });
      return 0.55;
    }
    if (kind === "none") { done(); return 0; }
    /* default crossfade */
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power1.out" });
    gsap.to(prev.el, { opacity: 0, duration: 0.4, ease: "power1.in", onComplete: done });
    return 0.05;
  }

  /* ---------------- states and URL ---------------- */
  // the times a slide can rest at: its holds, then its end
  function stops(rec) {
    var d = rec.tl.duration(), out = [];
    rec.pauses.forEach(function (p) { if (p < d - 1e-4 && (!out.length || p > out[out.length - 1] + 1e-4)) out.push(p); });
    out.push(d);
    return out;
  }
  // the state shown (or being played towards)
  function stateOf(rec) {
    var t = rec.tl.time(), s = stops(rec), moving = !rec.tl.paused() && rec.tl.progress() < 1;
    for (var i = 0; i < s.length; i++) if (moving ? s[i] > t + 1e-4 : s[i] >= t - 1e-4) return i;
    return s.length - 1;
  }
  function hashFor(idx, state) { return "#" + (idx + 1) + (state > 0 ? "." + state : ""); }
  function parseHash(h) { var m = /^#?(\d+)(?:\.(\d+))?$/.exec(h || ""); return m ? { idx: Math.max(0, +m[1] - 1), state: m[2] != null ? +m[2] : null } : null; }
  function syncUrl(push) {
    if (MODE !== "audience" || PEEK || cur < 0) return;
    var h = hashFor(cur, stateOf(recs[cur]));
    if (location.hash === h) return;
    history[push && HISTORY ? "pushState" : "replaceState"](null, "", h);
  }

  function goTo(n, opts) {
    opts = opts || {};
    n = Math.max(0, Math.min(recs.length - 1, n));
    var prev = PEEK ? PEEK.rec : cur >= 0 ? recs[cur] : null, rec = recs[n];
    PEEK = null;
    if (prev && prev !== rec) { prev.tl.pause(); stopLive(prev); }
    build(rec);
    var dir = opts.dir != null ? opts.dir : n >= cur ? 1 : -1;
    cur = n;
    renderFooter(rec);
    updateRail();
    if (opts.at === "end") { rec.tl.pause(rec.tl.duration(), false); transitionIn(rec, prev === rec ? null : prev, -1); }
    else if (opts.steps != null) { var p = opts.steps > 0 ? rec.pauses[opts.steps - 1] : 0; rec.tl.pause(p == null ? rec.tl.duration() : p, false); transitionIn(rec, prev === rec ? null : prev, -1); }
    else if (opts.state != null) { var st = stops(rec); rec.tl.pause(st[Math.min(opts.state, st.length - 1)], false); transitionIn(rec, prev === rec ? null : prev, -1); }
    else if (REDUCED) { rec.tl.pause(stops(rec)[0], false); transitionIn(rec, prev === rec ? null : prev, dir); }
    else {
      rec.tl.pause(0, false);
      var delay = transitionIn(rec, prev === rec ? null : prev, dir);
      gsap.delayedCall(delay, function () { if (recs[cur] === rec) rec.tl.play(); });
    }
    startLive(rec);
  }

  function next() {
    var rec = viewRec(), tl = rec.tl, t = tl.time();
    var ahead = rec.pauses.filter(function (p) { return p > t + 1e-4; });
    if (!tl.paused() && tl.progress() < 1) { tl.pause(ahead.length ? ahead[0] : tl.duration(), false); return "finish"; }
    if (t < tl.duration() - 1e-4) { if (REDUCED) tl.pause(ahead.length ? ahead[0] : tl.duration(), false); else tl.play(); return "play"; }
    if (PEEK) { endPeek(); return "back"; }
    if (cur < recs.length - 1) { goTo(cur + 1, { dir: 1 }); return "next"; }
    return "none";
  }
  function prev() {
    var rec = viewRec(), t = rec.tl.time();
    var behind = rec.pauses.filter(function (p) { return p < t - 1e-4; });
    if (behind.length && t > rec.pauses[0] + 1e-4) { rec.tl.pause(behind[behind.length - 1], false); return; }
    if (PEEK) { endPeek(); return; }
    if (cur > 0) goTo(cur - 1, { at: "end" });
  }

  /* ---------------- presenter sync ---------------- */
  function broadcast(action) {
    if (!channel || MODE === "static" || MODE === "shot" || PEEK) return;
    var rec = recs[cur];
    channel.postMessage({ from: INSTANCE, action: action, idx: cur, steps: stepCount(rec), atEnd: rec.tl.progress() >= 0.999 });
  }
  function cmd(action, arg) {
    var before = cur;
    if (action === "next") next(); else if (action === "prev") prev(); else if (action === "goto") goTo(arg, { dir: arg >= before ? 1 : -1 });
    broadcast({ type: action, before: before, arg: arg });
    syncUrl(true);
  }
  function onRemote(m) {
    if (!m || m.from === INSTANCE || !m.action) return;
    var a = m.action;
    if (a.type === "sync-request") { broadcast({ type: "state" }); return; }
    if (MODE === "presenter") { presenterRefresh(); return; }
    if (a.type !== "state" && a.before === cur) {
      if (a.type === "next") next(); else if (a.type === "prev") prev(); else if (a.type === "goto") goTo(a.arg);
    } else if (m.idx !== cur || stepCount(recs[cur]) !== m.steps) {
      goTo(m.idx, m.atEnd ? { at: "end" } : { steps: m.steps });
    }
    syncUrl(true);
  }

  /* ---------------- input ---------------- */
  var jumpBuf = "";
  function onKey(e) {
    var lk = document.getElementById("lastkey");
    if (lk) lk.textContent = (e.shiftKey && e.key !== "Shift" ? tr("shift") : "") + (e.key === " " ? tr("space") : e.key);
    if (EDIT.on) return;
    if (e.key === "F5") { e.preventDefault(); if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {}); return; }
    var k = e.key, jump = document.getElementById("jump");
    if (/^[0-9]$/.test(k)) { jumpBuf += k; jump.textContent = "→ " + jumpBuf; jump.style.display = "block"; return; }
    if (k === "Enter" && jumpBuf) { cmd("goto", +jumpBuf - 1); jumpBuf = ""; jump.style.display = "none"; return; }
    if (k === "Escape") { if (!gridOpen && PEEK) endPeek(); closeGrid(); jumpBuf = ""; jump.style.display = "none"; document.getElementById("help").style.display = "none"; return; }
    if (["ArrowRight", "PageDown", " ", "Enter", "ArrowDown"].indexOf(k) > -1) { e.preventDefault(); cmd("next"); }
    else if (["ArrowLeft", "PageUp", "Backspace", "ArrowUp"].indexOf(k) > -1) { e.preventDefault(); cmd("prev"); }
    else if (k === "Home") cmd("goto", 0);
    else if (k === "End") cmd("goto", recs.length - 1);
    else if (k === "b" || k === "B" || k === ".") { var bo = document.getElementById("blackout"); bo.style.display = bo.style.display === "block" ? "none" : "block"; }
    else if (k === "f" || k === "F") { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {}); else document.exitFullscreen(); }
    else if ((k === "p" || k === "P") && MODE === "audience") openPresenter();
    else if (k === "k" || k === "K") toggleVideo(currentVideo());
    else if (k === "m" || k === "M") { var cv = currentVideo(); if (cv) cv.muted = !cv.muted; }
    else if (k === "g" || k === "G") toggleGrid();
    else if ((k === "e" || k === "E") && !e.metaKey && !e.ctrlKey) enterEdit();
    else if (k === "h" || k === "H" || k === "?") { var hp = document.getElementById("help"); hp.style.display = hp.style.display === "grid" ? "none" : "grid"; }
  }

  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "translate(" + (window.innerWidth - 1920 * s) / 2 + "px," + (window.innerHeight - 1080 * s) / 2 + "px) scale(" + s + ")";
  }

  /* ---------------- presenter view ---------------- */
  function openPresenter() { window.open(location.pathname + "?presenter#" + (cur + 1), "slaas-presenter-" + DECK_ID, "width=1500,height=900"); }
  var pres = {};
  function presenterInit() {
    document.body.innerHTML = "";
    document.body.style.cssText = "background:#0C0C0F;color:#F4F2EC;font-family:var(--ui-font);overflow:hidden";
    var M = "font-family:var(--ui-mono);", BTN = "border:0;border-radius:8px;background:#24242B;color:#F4F2EC;cursor:pointer;";
    var w = document.createElement("div");
    w.innerHTML =
      '<div style="position:fixed;inset:0;display:grid;grid-template-columns:62% 38%;grid-template-rows:auto 1fr;gap:18px;padding:18px;box-sizing:border-box">' +
      '<div id="p-cur-wrap" style="position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000"><iframe id="p-cur" style="position:absolute;inset:0;width:100%;height:100%;border:0" src="' + location.pathname + '?follow"></iframe></div>' +
      '<div style="display:flex;flex-direction:column;gap:14px"><div style="' + M + 'font-size:13px;letter-spacing:.14em;color:#9A9AA5">' + tr("nextUp") + "</div>" +
      '<div style="position:relative;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#000"><iframe id="p-next" style="position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none"></iframe></div>' +
      '<div style="display:flex;gap:26px;align-items:baseline;margin-top:6px"><div id="p-timer" style="' + M + 'font-size:54px;font-weight:700">00:00</div><div id="p-count" style="' + M + 'font-size:22px;color:var(--ui-accent-2)"></div><button id="p-pause" title="' + tr("timerTip") + '" style="margin-left:auto;' + BTN + "background:var(--ui-accent);color:var(--ui-accent-ink);padding:8px 14px;" + M + 'min-width:118px">' + tr("pause") + '</button><button id="p-reset" title="' + tr("resetTip") + '" style="' + BTN + "padding:8px 14px;" + M + '">' + tr("reset") + "</button></div>" +
      '<div id="p-step" style="' + M + 'font-size:14px;color:#9A9AA5"></div></div>' +
      '<div style="grid-column:1/3;display:grid;grid-template-columns:62% 38%;gap:18px;min-height:0"><div style="min-height:0;overflow:auto"><div style="display:flex;align-items:center;gap:14px;margin-bottom:10px"><div id="p-title" style="font-size:26px;font-weight:600;flex:1"></div><div style="display:flex;align-items:center;gap:6px;flex:none"><button id="p-fs-dn" title="' + tr("smaller") + '" style="width:40px;height:36px;' + BTN + 'font-family:var(--ui-font);font-size:15px;font-weight:600">A−</button><span id="p-fs-v" style="' + M + 'font-size:13px;color:#9A9AA5;min-width:38px;text-align:center">24</span><button id="p-fs-up" title="' + tr("bigger") + '" style="width:40px;height:36px;' + BTN + 'font-family:var(--ui-font);font-size:19px;font-weight:600">A+</button></div></div><div id="p-notes" contenteditable="true" style="font-size:24px;line-height:1.5;color:#F4F2EC;outline:none;white-space:pre-wrap"></div></div>' +
      '<div style="' + M + 'font-size:14px;line-height:2;color:#9A9AA5">' + tr("presHelp") + "</div></div></div>";
    document.body.appendChild(w);
    // timer: pausable (T or the button), elapsed time accumulates across pauses
    pres.elapsed = 0; pres.t0 = Date.now(); pres.running = true;
    var tEl = document.getElementById("p-timer"), pBtn = document.getElementById("p-pause");
    function tNow() { return pres.elapsed + (pres.running ? Date.now() - pres.t0 : 0); }
    function tDraw() {
      var s = Math.floor(tNow() / 1000);
      tEl.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      tEl.style.color = pres.running ? "#F4F2EC" : "#FFC93C";
      tEl.style.opacity = pres.running || Math.floor(Date.now() / 600) % 2 ? "1" : ".35";
    }
    pres.toggleTimer = function () {
      if (pres.running) { pres.elapsed = tNow(); pres.running = false; } else { pres.t0 = Date.now(); pres.running = true; }
      pBtn.textContent = pres.running ? tr("pause") : tr("resume");
      pBtn.style.background = pres.running ? "var(--ui-accent)" : "#3CC9FF";
      tDraw();
    };
    setInterval(tDraw, 250);
    pBtn.onclick = pres.toggleTimer;
    tEl.style.cursor = "pointer"; tEl.title = tr("timerTip"); tEl.onclick = pres.toggleTimer;
    document.getElementById("p-reset").onclick = function () { pres.elapsed = 0; pres.t0 = Date.now(); tDraw(); };
    // notes font size (A− / A+, or − / + keys), remembered in this browser
    pres.fs = 24; try { pres.fs = +localStorage.getItem("slaas-notes-fs") || 24; } catch (x) {}
    pres.setFs = function (v) {
      pres.fs = Math.max(14, Math.min(56, v));
      var n = document.getElementById("p-notes"); n.style.fontSize = pres.fs + "px"; n.style.lineHeight = pres.fs > 34 ? "1.4" : "1.5";
      document.getElementById("p-fs-v").textContent = pres.fs;
      try { localStorage.setItem("slaas-notes-fs", pres.fs); } catch (x) {}
    };
    document.getElementById("p-fs-dn").onclick = function () { pres.setFs(pres.fs - 2); };
    document.getElementById("p-fs-up").onclick = function () { pres.setFs(pres.fs + 2); };
    pres.setFs(pres.fs);
    document.getElementById("p-notes").addEventListener("input", function (e) { try { localStorage.setItem(NOTES_KEY + pres.idx, e.target.innerText); } catch (x) {} });
    window.addEventListener("keydown", function (e) {
      if (e.target && e.target.id === "p-notes") return;
      var k = e.key;
      if (["ArrowRight", "PageDown", " ", "ArrowDown"].indexOf(k) > -1) { e.preventDefault(); send("next"); }
      else if (["ArrowLeft", "PageUp", "Backspace", "ArrowUp"].indexOf(k) > -1) { e.preventDefault(); send("prev"); }
      else if (k === "t" || k === "T") { pres.toggleTimer(); }
      else if (k === "+" || k === "=") { pres.setFs(pres.fs + 2); }
      else if (k === "-" || k === "_") { pres.setFs(pres.fs - 2); }
      else if (/^[0-9]$/.test(k)) { pres.buf = (pres.buf || "") + k; }
      else if (k === "Enter" && pres.buf) { send("goto", +pres.buf - 1); pres.buf = ""; }
    });
    pres.idx = -1;
    setTimeout(function () { channel && channel.postMessage({ from: INSTANCE, action: { type: "sync-request" } }); }, 600);
  }
  function send(type, arg) {
    channel && channel.postMessage({ from: INSTANCE, action: { type: "remote-" + type, arg: arg } });
  }
  function presenterRefresh() {}
  var NOTES_KEY = "slaas-notes-" + DECK_ID + "-";   // presenter-side note edits, per deck and slide index
  Deck._presenterState = function (m) {
    pres.idx = m.idx;
    // count only the talk; appendix slides get their own counter
    var anx = Deck._anxStart, main = anx > -1 ? anx : Deck._titles.length;
    document.getElementById("p-count").textContent = m.idx < main ? (m.idx + 1) + " / " + main : tr("appendixCount", { n: m.idx - main + 1, m: Deck._titles.length - main });
    document.getElementById("p-title").textContent = Deck._titles[m.idx] || "";
    var saved = null; try { saved = localStorage.getItem(NOTES_KEY + m.idx); } catch (x) {}
    document.getElementById("p-notes").innerText = saved != null ? saved : Deck._notes[m.idx] || "";
    document.getElementById("p-step").textContent = m.atEnd ? tr("slideDone") : tr("stepOf", { n: m.steps, m: Deck._steps[m.idx] || 0 });
    var nx = document.getElementById("p-next"), want = location.pathname + "?static=" + encodeURIComponent(Deck._files[Math.min(m.idx + 1, Deck._files.length - 1)]);
    if (nx.dataset.src !== want) { nx.dataset.src = want; nx.src = want; }
  };

  /* ---------------- boot ---------------- */
  function boot() {
    stage = document.getElementById("stage");
    footer = document.getElementById("footer");
    progress = document.getElementById("progress");
    allRecs = Array.prototype.slice.call(document.querySelectorAll(".slide")).map(function (el) { return { el: el, id: el.id, built: false, hidden: el.dataset.hidden === "1" }; });
    recs = allRecs.filter(function (r) { return !r.hidden; });
    document.querySelectorAll(".slide [data-e]").forEach(function (n) { n.__src = n.innerHTML; });
    Deck.preps.forEach(function (fn) { try { fn(stage); } catch (e) { console.error(e); } });
    // section colors as CSS variables: --sec-N on the page, --sec / --sec-accent on each slide of a section
    for (var si = 1; si <= NSEC; si++) { document.documentElement.style.setProperty("--sec-" + si, SECTIONS[si].c); document.documentElement.style.setProperty("--sec-" + si + "-accent", SECTIONS[si].accent); }
    allRecs.forEach(function (r) {
      var sc = SECTIONS[+r.el.dataset.section]; if (!sc) return;
      r.el.style.setProperty("--sec", sc.c); r.el.style.setProperty("--sec-accent", sc.accent);
      if (sc.dark && r.el.classList.contains("sep")) r.el.classList.add("dark");
    });
    Deck._recs = recs;
    Deck._files = recs.map(function (r) { return r.el.dataset.file; });
    Deck._anxStart = -1; for (var ax = 0; ax < recs.length; ax++) if (isAppendix(recs[ax].el)) { Deck._anxStart = ax; break; }
    Deck.go = function (i) { cmd("goto", i); };
    Deck.indexOfSlide = function (el) { for (var i = 0; i < recs.length; i++) if (recs[i].el === el) return i; return -1; };
    Deck._titles = recs.map(function (r) { return r.el.dataset.title || r.id; });
    Deck._notes = recs.map(function (r) { var n = r.el.querySelector("template.notes, .notes"); return n ? (n.content ? n.content.textContent : n.textContent).trim() : ""; });

    if (MODE === "presenter") {
      Deck._steps = recs.map(function () { return 0; });
      // count steps by building each slide once (cheap) so the presenter can show "step x of y"
      recs.forEach(function (r) { build(r); Deck._steps[recs.indexOf(r)] = r.pauses.length; });
      presenterInit();
      if (channel) channel.onmessage = function (e) {
        var m = e.data; if (!m || !m.action) return;
        if (m.idx != null) Deck._presenterState(m);
      };
      return;
    }

    // footer dots, one per section
    var dots = footer && footer.querySelector(".dots");
    if (dots) for (var i = 1; i <= NSEC; i++) { var d = document.createElement("div"); d.className = "fd s" + i + (SECTIONS[i].dark ? " dark" : ""); d.textContent = i; d.style.borderColor = SECTIONS[i].c; dots.appendChild(d); }

    fit(); window.addEventListener("resize", fit); document.addEventListener("fullscreenchange", fit);
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(document.documentElement);
    setTimeout(fit, 300);

    if (MODE === "static" || MODE === "shot") {
      document.documentElement.classList.add("static-mode");
      var sp = params.get(MODE) || "1", rec = /^\d+$/.test(sp) ? recs[(+sp || 1) - 1] : recOfFile(sp);
      if (!rec) return;
      build(rec); cur = recs.indexOf(rec);
      rec.el.classList.add("is-active"); gsap.set(rec.el, { opacity: 1, visibility: "visible" });
      renderFooter(rec); gsap.globalTimeline.getChildren(false, true, false).forEach(function (t) { if (t !== rec.tl) t.progress(1); });
      rec.tl.pause(MODE === "shot" ? +(params.get("t") || 0) : rec.tl.duration(), false);
      Deck._slideInfo = { file: rec.el.dataset.file, id: rec.id, title: rec.el.dataset.title || "", hidden: !!rec.hidden, steps: rec.pauses.length, duration: +rec.tl.duration().toFixed(2), notes: !!notesOf(rec) };
      document.documentElement.dataset.ready = "1";
      return;
    }

    document.querySelectorAll(".slide video").forEach(setupVideo);
    buildHud(); buildRail(); buildGrid();
    window.addEventListener("keydown", onKey);
    stage.addEventListener("click", function (e) { if (EDIT.on) return; if (e.target.closest("video,a,button,[data-noclick]")) return; cmd("next"); });
    stage.addEventListener("contextmenu", function (e) { if (EDIT.on) return; e.preventDefault(); cmd("prev"); });

    if (channel) channel.onmessage = function (e) {
      var m = e.data; if (!m || m.from === INSTANCE || !m.action) return;
      var a = m.action;
      if (a.type === "sync-request") { broadcast({ type: "state" }); return; }
      if (a.type.indexOf("remote-") === 0) {           // commands from the presenter window
        if (MODE === "follow") return;                  // the main deck executes; followers mirror it
        cmd(a.type.slice(7), a.arg); return;
      }
      if (MODE === "follow" || MODE === "audience") onRemote(m);
    };

    if (!VERIFY) liveReload();
    var start = parseHash(location.hash) || { idx: 0, state: null };
    goTo(start.idx, start.state == null ? { dir: 1 } : { state: start.state });
    syncUrl(false);
    window.addEventListener("popstate", function () {
      var h = parseHash(location.hash); if (!h || MODE !== "audience" || EDIT.on) return;
      if (PEEK) endPeek();
      var idx = Math.min(h.idx, recs.length - 1), state = h.state || 0;
      if (idx !== cur || stateOf(recs[cur]) !== state) { goTo(idx, { state: state }); broadcast({ type: "state" }); }
      syncUrl(false);
    });
    Deck._state = function () { var r = recs[cur]; return { slide: cur + 1, file: r.el.dataset.file, state: stateOf(r), states: stops(r).length, stops: stops(r).map(function (x) { return +x.toFixed(2); }), hash: location.hash, peek: !!PEEK, reduced: REDUCED }; };
    document.documentElement.dataset.ready = "1";
    if (params.has("edit") && MODE === "audience") setTimeout(enterEdit, 300);   // ?edit: open in edit mode (slaas Studio)
    if (MODE === "follow") setTimeout(function () { channel && channel.postMessage({ from: INSTANCE, action: { type: "sync-request" } }); }, 400);
  }

  /* ---------------- live reload (slaas dev server): files changed on disk → reload on the same slide ---------------- */
  function liveReload() {
    if (!window.EventSource || location.protocol === "file:") return;
    fetch("api/ping", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.live) return;
      new EventSource("api/events").onmessage = function (e) { if (e.data === "reload" && !EDIT.on && !ORG.on) location.reload(); };
    }).catch(function () {});
  }

  /* ---------------- HUD: black screen, jump-to-number, help ---------------- */
  function buildHud() {
    var bo = document.createElement("div"); bo.id = "blackout"; document.body.appendChild(bo);
    var j = document.createElement("div"); j.id = "jump"; document.body.appendChild(j);
    var hp = document.createElement("div"); hp.id = "help";
    hp.innerHTML = '<div class="box">' + T.help.map(function (r) { return "<kbd>" + r[0] + "</kbd>" + r[1]; }).join("<br>") +
      '<div class="keytest">' + tr("keyTest") + ' <b id="lastkey">—</b></div>' + (REDUCED && MOTION === "auto" ? '<div class="keytest">' + tr("reducedOn") + "</div>" : "") + "</div>";
    document.body.appendChild(hp);
  }

  /* ---------------- QA (static mode): layout problems on the slide being shown ----------------
     Used by `slaas check`. Heuristics, so each item is a warning to look at, not proof of a bug.
     Skipped on purpose: decorative elements (opacity < 0.35, aria-hidden, data-qa="ignore" on them or an
     ancestor), rotated / skewed elements, and SplitText fragments (inline-block chars and words). */
  Deck._qa = function () {
    var rec = recs[cur] || allRecs.filter(function (r) { return r.el.classList.contains("is-active"); })[0];
    if (!rec) return [];
    var out = [], sr = stage.getBoundingClientRect(), k = sr.width / 1920;
    var footerOn = footer && rec.el.dataset.footer !== "off";
    var limitY = footerOn ? 1080 - footer.offsetHeight : 1080;
    function desc(n) {
      var c = typeof n.className === "string" && n.className.trim() ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      var t = (n.textContent || "").trim().replace(/\s+/g, " ");
      return n.tagName.toLowerCase() + c + (t ? ' "' + (t.length > 48 ? t.slice(0, 47) + "…" : t) + '"' : "");
    }
    function ownText(n) { for (var c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && /\S/.test(c.nodeValue)) return true; return false; }
    function box(n) { return toStage(n.getBoundingClientRect()); }
    function toStage(r) { return { x0: (r.left - sr.left) / k, y0: (r.top - sr.top) / k, x1: (r.right - sr.left) / k, y1: (r.bottom - sr.top) / k, w: r.width / k, h: r.height / k }; }
    // horizontal extent of the text itself (a wide centered block only occupies the middle), vertical extent of
    // the line boxes (big numbers with tight line-height have glyph boxes taller than the space they take)
    function tbox(n, b) {
      var rg = document.createRange(); rg.selectNodeContents(n); var r = rg.getBoundingClientRect();
      if (!r.width) return b; var t = toStage(r), x0 = Math.max(t.x0, b.x0), x1 = Math.min(t.x1, b.x1);
      return x1 > x0 ? { x0: x0, x1: x1, y0: b.y0, y1: b.y1, w: x1 - x0, h: b.h } : b;
    }
    // walk up to the slide: effective opacity, rotation, opt-outs
    function look(n) {
      var op = 1, rot = false;
      for (var p = n; p && p !== rec.el; p = p.parentElement) {
        var cs = getComputedStyle(p);
        if (cs.display === "none" || p.getAttribute("aria-hidden") === "true" || p.getAttribute("data-qa") === "ignore") return null;
        op *= +cs.opacity;
        var m = cs.transform; if (m && m !== "none") { var v = m.match(/matrix\(([^)]+)\)/); if (!v || Math.abs(+v[1].split(",")[1]) > 0.01 || Math.abs(+v[1].split(",")[2]) > 0.01) rot = true; }
      }
      if (getComputedStyle(n).visibility === "hidden" || op < 0.05) return null;
      return { op: op, rot: rot };
    }
    // the visible part of b after clipping by ancestors with overflow != visible
    function clipped(n, b) {
      for (var p = n.parentElement; p && p !== rec.el; p = p.parentElement) {
        var cs = getComputedStyle(p);
        if (cs.overflow !== "visible" || cs.clipPath !== "none") { var c = box(p); b = { x0: Math.max(b.x0, c.x0), y0: Math.max(b.y0, c.y0), x1: Math.min(b.x1, c.x1), y1: Math.min(b.y1, c.y1) }; }
      }
      return b;
    }
    var texts = [];
    rec.el.querySelectorAll("*").forEach(function (n) {
      if (n.closest("template,script,style,.vctl,.vbig") || (n.closest("svg") && n.tagName.toLowerCase() !== "svg")) return;
      if (!ownText(n) || n.textContent.trim().length < 3) return;   // single glyphs: split chars, rolling digits, icons
      var L = look(n); if (!L || L.op < 0.35) return;
      var b = box(n); if (b.w < 1 || b.h < 1) return;
      var v = clipped(n, b), vis = Math.max(0, v.x1 - v.x0) * Math.max(0, v.y1 - v.y0) / (b.w * b.h);
      if (vis < 0.02) return;                                   // fully masked: not on screen
      var d = desc(n), cs = getComputedStyle(n);
      if (!L.rot && (b.x0 < -2 || b.y0 < -2 || b.x1 > 1922 || b.y1 > 1082)) out.push({ type: "offstage", el: d, box: [b.x0, b.y0, b.x1, b.y1].map(Math.round) });
      else if (footerOn && !L.rot && b.y1 > limitY + 2) out.push({ type: "footer", el: d, bottom: Math.round(b.y1), limit: limitY });
      if (vis < 0.8) out.push({ type: "clipped", el: d, visible: Math.round(100 * vis) + "%" });
      if (cs.overflow !== "visible" && (n.scrollWidth > n.clientWidth + 2 || n.scrollHeight > n.clientHeight + 3)) out.push({ type: "overflow", el: d });
      if (!L.rot && !/^inline/.test(cs.display)) texts.push({ n: n, b: tbox(n, b), d: d });
    });
    var hits = new Map();
    for (var i = 0; i < texts.length; i++) for (var j = i + 1; j < texts.length; j++) {
      var A = texts[i], B = texts[j];
      if (A.n.contains(B.n) || B.n.contains(A.n)) continue;
      var w = Math.min(A.b.x1, B.b.x1) - Math.max(A.b.x0, B.b.x0), hh = Math.min(A.b.y1, B.b.y1) - Math.max(A.b.y0, B.b.y0);
      if (w > 4 && hh > 4 && w * hh > 0.2 * Math.min(A.b.w * A.b.h, B.b.w * B.b.h)) { if (!hits.has(A)) hits.set(A, []); hits.get(A).push(B.d); }
    }
    hits.forEach(function (list, A) { out.push({ type: "overlap", el: A.d, with: list[0] + (list.length > 1 ? " (+" + (list.length - 1) + " more)" : "") }); });
    return out;
  };

  /* ---------------- verify hook: is anything still moving? ----------------
     Top-level GSAP tweens, timelines and delayed calls that are running and will end. Infinite ones (ambient)
     are frozen at their start in verify mode so screenshots compare. */
  Deck._busy = function () {
    return gsap.globalTimeline.getChildren(false, true, true).some(function (t) {
      if (t.repeat() === -1) { if (VERIFY) t.pause(0); return false; }
      return !t.paused() && t.progress() < 1;
    });
  };

  Deck.boot = function () {
    // load every declared @font-face before measuring (SplitText needs the final metrics)
    var faces = [];
    if (document.fonts && document.fonts.forEach) document.fonts.forEach(function (f) { faces.push(f.load().catch(function () {})); });
    Promise.all(faces).then(function () { return document.fonts ? document.fonts.ready : null; }).then(boot);
  };
})();
