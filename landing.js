/* Bodyclimb landing: the hero's ladder, the camera that counts, the coach's voice, the chat that changes the plan, the
   climb (sticky demo + elevation profile + altimeter), the start quiz and the direction tabs. Videos play only while
   they are on screen. No cookies, no analytics, no dependencies. */
(() => {
  "use strict";
  document.documentElement.classList.add("js");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const TIERS = [[0, "Foothills"], [1000, "Highlands"], [3000, "High Ridges"], [6000, "The Heights"], [8000, "Eight-thousanders"]];
  const tierOf = (m) => (m < 1 ? "Dawnhaven" : TIERS.filter(([f]) => m >= f).pop()[1]);
  const TOP = 8849;
  const seen = (el, cb, opts = { threshold: 0.35 }) => {
    if (!el) return;
    new IntersectionObserver((es) => es.forEach((e) => cb(e.isIntersecting)), opts).observe(el);
  };
  // a number that runs from a to b on the element (no run under reduced motion)
  const run = (el, a, b, dur = 700) => {
    if (reduce || a === b) { el.textContent = fmt(b); return; }
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(a + (b - a) * e);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // Notes the page adds to the atlas' own step data (atlas gives name, standard, altitude).
  const NOTES = {
    "VP-01": "Day one. Your feet stay on the floor and take as much of your weight as you need.",
    "VP-02": "Feet off. Thirty seconds here and the bar starts to feel like yours.",
    "VP-03": "Shoulders switch on. This is where pulling really begins.",
    "VP-04": "A small move with a big job: the first inch of every pull-up.",
    "VP-06": "Chin over the bar, held. You already own the top of the rep.",
    "VP-07": "Lowering slowly builds the strength to rise. Five seconds down.",
    "VP-08": "A little help from a band or your feet, and the full path of the rep.",
    "VP-09": "A small jump, then the bottom half on your own. Almost there.",
    "VP-10": "One strict rep, on two different days. The app asks for both, so it’s really yours.",
    "VP-13": "Eight in a row, then ten. Pull-ups stop being an event.",
    "VP-17": "Legs out front while you pull. Core and back as one.",
    "VP-18": "Most of the weight on one arm. The rare air begins.",
    "VP-19": "The one-arm pull-up. Same climb, one step at a time.",
  };

  /* ---------- Plain videos: play only on screen (the ladder, the camera and the climb drive their own) ---------- */
  const vio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        if (v.preload === "none") v.preload = "auto";
        if (!reduce || v.dataset.stageVideo !== undefined) v.play().catch(() => {});
      } else v.pause();
    }
  }, { rootMargin: "200px 0px" });
  const watch = (v) => v && vio.observe(v);
  $$("video").filter((v) => !v.closest("[data-ladder], [data-cam]")).forEach(watch);

  /* ---------- Hero ladder: from the first wall push-up to the front lever ---------- */
  const ladder = (() => {
    const root = $("[data-ladder]");
    if (!root) return { start() {} };
    const media = $(".ladder-media", root), altEl = $("[data-ladder-alt]", root), nameEl = $("[data-ladder-name]", root);
    const rail = $("[data-ladder-rail]", root);
    let steps = [], at = 0, cur = $("[data-ladder-video]", root), nxt = null, token = 0, onScreen = true;
    cur.loop = false;
    const mark = () => $$("button", rail).forEach((b, k) => {
      b.classList.toggle("is-on", k === at); b.classList.toggle("is-past", k < at);
      b.setAttribute("aria-current", k === at ? "step" : "false");
    });
    const go = (i) => {
      if (!steps[i]) return;
      const from = steps[at] ? steps[at].altitude : 0, s = steps[i], my = ++token;
      at = i; mark();
      nameEl.textContent = s.name; run(altEl, from, s.altitude);
      const src = `/clip-${s.clip}.mp4`;
      if (cur.src.endsWith(src)) { cur.currentTime = 0; cur.play().catch(() => {}); return; }
      if (!nxt) { nxt = document.createElement("video"); Object.assign(nxt, { muted: true, playsInline: true, preload: "auto" });
        nxt.setAttribute("aria-hidden", "true"); nxt.className = "is-out"; media.appendChild(nxt); nxt.addEventListener("ended", ended); }
      nxt.poster = `/clip-${s.clip}.jpg`; nxt.src = src; nxt.load();
      nxt.addEventListener("loadeddata", function swap() {
        nxt.removeEventListener("loadeddata", swap);
        if (my !== token) return;
        if (onScreen) nxt.play().catch(() => {});
        nxt.classList.remove("is-out"); cur.classList.add("is-out");
        const old = cur; cur = nxt; nxt = old;
        setTimeout(() => old.pause(), 520);
      });
    };
    function ended() { if (this === cur && !reduce) go((at + 1) % steps.length); }
    cur.addEventListener("ended", ended);
    const start = (data) => {
      steps = data || [];
      const top = Math.max(...steps.map((s) => s.altitude));
      rail.innerHTML = steps.map((s, k) => `<li><button type="button" style="--h:${(14 + (s.altitude / top) * 86).toFixed(1)}%"
        aria-label="${s.name}, ${fmt(s.altitude)} m"></button></li>`).join("");
      $$("button", rail).forEach((b, k) => b.addEventListener("click", () => go(k)));
      mark();
      if (reduce) cur.loop = true;
      else if (cur.ended) go(1);
    };
    seen(root, (on) => { onScreen = on; on ? cur.play().catch(() => {}) : cur.pause(); }, { threshold: 0.1 });
    return { start };
  })();

  /* ---------- The camera counts: rows, a raised hand, the set logged ---------- */
  const cam = (() => {
    const root = $("[data-cam]");
    if (!root) return { start() {} };
    const video = $("[data-cam-video]", root), svg = $("[data-cam-joints]", root), nEl = $("[data-cam-n]", root), say = $("[data-cam-say]", root);
    const NS = "http://www.w3.org/2000/svg";
    const REPS = [0.97, 2.93, 4.87];       // the tops of her rows in the clip, where the app's own rule counts them
    const TARGET = 8;
    const WORDS = ["", "One.", "Two.", "Three.", "Four.", "Five.", "Six.", "Seven!", "Eight!"];
    let pose = { rows: null, raise: null }, phase = "", count = 0, next = 0, onScreen = false, raf = 0, timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const lines = [], dots = [];
    const line = () => { const l = document.createElementNS(NS, "line"); svg.appendChild(l); lines.push(l); return l; };
    const dot = () => { const c = document.createElementNS(NS, "circle"); c.setAttribute("r", "9"); svg.appendChild(c); dots.push(c); return c; };
    for (let k = 0; k < 12; k++) line();
    for (let k = 0; k < 12; k++) dot();
    const hide = () => { lines.forEach((l) => l.setAttribute("opacity", 0)); dots.forEach((c) => c.setAttribute("opacity", 0)); };
    const put = (l, p, q, o) => { l.setAttribute("x1", p[0]); l.setAttribute("y1", p[1]); l.setAttribute("x2", q[0]); l.setAttribute("y2", q[1]); l.setAttribute("opacity", o); };
    const sayIt = (text, ms = 1300) => { say.textContent = text; say.classList.add("is-on"); clearTimeout(sayIt.t); sayIt.t = setTimeout(() => say.classList.remove("is-on"), ms); };

    // Rows: she is in profile, so the lines follow the side that faces the camera. Behind the bar's post the model
    // puts the wrist down the post, so the arm shows only while the wrist is on the bar (as in the promo film).
    const prepRows = (P) => {
      const J = Object.fromEntries(P.joints.map((n, i) => [n, i]));
      const len = (f, a, b) => Math.hypot(f[J[a]][0] - f[J[b]][0], f[J[a]][1] - f[J[b]][1]);
      const med = (v) => v.slice().sort((x, y) => x - y)[Math.floor(v.length / 2)];
      const first = P.frames.slice(0, 9);
      const grip = [med(first.map((f) => f[J.lwri][0])), med(first.map((f) => f[J.lwri][1]))];
      const UA = med(first.map((f) => len(f, "lsho", "lelb"))), FA = med(first.map((f) => len(f, "lelb", "lwri")));
      const on = P.frames.map((f) => {
        const ua = len(f, "lsho", "lelb"), fa = len(f, "lelb", "lwri");
        return Math.hypot(f[J.lwri][0] - grip[0], f[J.lwri][1] - grip[1]) < 70 && ua > 0.5 * UA && ua < 1.3 * UA && fa > 0.5 * FA && fa < 1.3 * FA ? 1 : 0;
      });
      P.arm = on.map((_, i) => { let s = 0, n = 0; for (let k = i - 2; k <= i + 2; k++) if (on[k] !== undefined) { s += on[k]; n++; } return s / n; });
      P.J = J;
      return P;
    };
    const drawRows = (P, i) => {
      const f = P.frames[i], J = P.J, a = P.arm[i];
      const body = [["lsho", "lhip"], ["lhip", "lkne"], ["lkne", "lank"]], arm = [["lsho", "lelb"], ["lelb", "lwri"]];
      body.forEach(([p, q], k) => put(lines[k], f[J[p]], f[J[q]], Math.min(f[J[p]][2], f[J[q]][2]) >= 0.3 ? 0.95 : 0));
      arm.forEach(([p, q], k) => put(lines[3 + k], f[J[p]], f[J[q]], 0.95 * a));
      ["lsho", "lhip", "lkne", "lank", "lelb", "lwri"].forEach((n, k) => {
        const p = f[J[n]];
        dots[k].setAttribute("cx", p[0]); dots[k].setAttribute("cy", p[1]);
        dots[k].setAttribute("opacity", k < 4 ? (p[2] >= 0.3 ? 1 : 0) : a);
      });
    };
    const BONES = [["lsho", "rsho"], ["lsho", "lelb"], ["lelb", "lwri"], ["rsho", "relb"], ["relb", "rwri"], ["lsho", "lhip"],
      ["rsho", "rhip"], ["lhip", "rhip"], ["lhip", "lkne"], ["lkne", "lank"], ["rhip", "rkne"], ["rkne", "rank"]];
    const DOTS = ["lsho", "rsho", "lelb", "relb", "lwri", "rwri", "lhip", "rhip", "lkne", "rkne", "lank", "rank"];
    const drawRaise = (P, i) => {
      const f = P.frames[i], J = P.J || (P.J = Object.fromEntries(P.joints.map((n, k) => [n, k])));
      BONES.forEach(([p, q], k) => put(lines[k], f[J[p]], f[J[q]], Math.min(f[J[p]][2], f[J[q]][2]) >= 0.3 ? 0.95 : 0));
      DOTS.forEach((n, k) => { const p = f[J[n]]; dots[k].setAttribute("cx", p[0]); dots[k].setAttribute("cy", p[1]); dots[k].setAttribute("opacity", p[2] >= 0.3 ? 1 : 0); });
      // the ring rides on her raised hand: a little beyond the wrist, along the forearm
      const w = f[J.rwri], e = f[J.relb];
      root.style.setProperty("--rx", ((w[0] + 0.38 * (w[0] - e[0])) / 10.8).toFixed(2) + "%");
      root.style.setProperty("--ry", ((w[1] + 0.38 * (w[1] - e[1])) / 19.2).toFixed(2) + "%");
      if (w[1] < f[J.nose][1] - 80 && !root.classList.contains("is-raise")) root.classList.add("is-raise");
    };
    const frame = () => {
      raf = 0;
      const P = pose[phase === "raise" ? "raise" : "rows"];
      if (P && phase !== "logged") {
        const i = Math.max(0, Math.min(P.frames.length - 1, Math.round(video.currentTime * P.fps)));
        phase === "raise" ? drawRaise(P, i) : drawRows(P, i);
      }
      if (phase === "rows") {
        while (next < REPS.length && video.currentTime >= REPS[next]) {
          next++;
          if (count < TARGET) {
            count++; nEl.textContent = count; sayIt(WORDS[count], 1200);
            if (!reduce) { nEl.classList.remove("is-tick"); void nEl.offsetWidth; nEl.classList.add("is-tick"); }
            if (count === TARGET) { root.classList.add("is-full"); later(toRaise, 900); }
          }
        }
      }
      if (onScreen && !video.paused) raf = requestAnimationFrame(frame);
    };
    const loop = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const toRows = () => {
      clear(); phase = "rows"; count = 0; next = 0; nEl.textContent = "0";
      root.classList.remove("is-full", "is-raise", "is-logged"); root.classList.add("is-found");
      video.loop = false; video.src = "/cam-rows.mp4"; video.load();
      if (onScreen) video.play().then(loop).catch(() => {});
    };
    const toRaise = () => {
      if (phase !== "rows") return;
      phase = "raise"; hide(); sayIt("Done? Hold one hand over your head.", 2000);
      video.src = "/cam-raise.mp4"; video.load();
      if (onScreen) video.play().then(loop).catch(() => {});
    };
    const toLogged = () => {
      phase = "logged"; hide(); root.classList.remove("is-raise"); root.classList.add("is-logged");
      sayIt("Rest. One minute fifteen.", 2400);
      later(toRows, 3600);
    };
    video.addEventListener("ended", () => {
      if (phase === "rows" && count < TARGET) { next = 0; video.currentTime = 0; video.play().then(loop).catch(() => {}); }
      else if (phase === "raise") toLogged();
    });
    video.addEventListener("play", loop);
    const start = () => {
      Promise.all([fetch("/cam-rows.json").then((r) => r.json()), fetch("/cam-raise.json").then((r) => r.json())])
        .then(([rows, raise]) => { pose.rows = prepRows(rows); pose.raise = raise; loop(); }).catch(() => {});
      seen(root, (on) => {
        onScreen = on;
        if (on) { if (!phase) toRows(); else if (phase !== "logged") video.play().then(loop).catch(() => {}); }
        else video.pause();
      }, { threshold: 0.25 });
    };
    return { start };
  })();

  /* ---------- The coach's voice: the app's own takes, with the app's subtitles ---------- */
  const voice = (() => {
    const root = $("[data-voice]");
    if (!root) return { start() {} };
    const audio = $("[data-voice-audio]", root), sub = $("[data-voice-sub]", root), bar = $("[data-voice-bar]", root);
    const video = $(".voice-card video", root);
    let cues = {}, who = null, shown = "";
    const btns = $$(".voice-btn", root);
    const stop = () => {
      audio.pause(); who = null; sub.classList.remove("is-on"); shown = ""; bar.style.width = "0";
      btns.forEach((b) => b.setAttribute("aria-pressed", "false"));
    };
    btns.forEach((b) => b.addEventListener("click", () => {
      const w = b.dataset.who;
      if (who === w) { stop(); return; }
      stop(); who = w; b.setAttribute("aria-pressed", "true");
      audio.src = `/voice-${w}.m4a`; audio.currentTime = 0;
      audio.play().catch(stop);
      video.play().catch(() => {});
    }));
    audio.addEventListener("timeupdate", () => {
      if (!who) return;
      const t = audio.currentTime, c = (cues[who] || []).find(([a, z]) => t >= a - 0.05 && t <= z + 0.45);
      const text = c ? c[2] : "";
      if (text !== shown) { shown = text; if (text) sub.textContent = text; sub.classList.toggle("is-on", !!text); }
      bar.style.width = audio.duration ? (100 * t / audio.duration).toFixed(1) + "%" : "0";
    });
    audio.addEventListener("ended", stop);
    seen(root, (on) => { if (!on && who) stop(); }, { threshold: 0 });
    return { start(data) { cues = data || {}; } };
  })();

  /* ---------- The chat that changes the plan ---------- */
  (() => {
    const chat = $("[data-chat]"), grid = $("[data-week-grid]");
    if (!chat || !grid) return;
    const BEFORE = [0, 3, 5, 8, 10, 12], AFTER = [0, 2, 4, 7, 9, 11];   // two weeks, Monday first; "Any day" → Mon, Wed, Fri
    grid.innerHTML = Array.from({ length: 14 }, (_, k) => `<li><span class="wk">${k + 1}</span>${k === 0 ? '<span class="wk-today">Today</span>' : ""}</li>`).join("");
    const cells = $$(".wk", grid);
    const paint = (days, moved) => cells.forEach((c, k) => {
      const on = days.includes(k), was = c.classList.contains("is-work");
      c.classList.toggle("is-work", on);
      if (moved && on && !was && !reduce) { c.classList.remove("is-moved"); void c.offsetWidth; c.classList.add("is-moved"); }
    });
    paint(BEFORE);
    let played = false, touched = false, auto = 0;
    const steps = $$("[data-step]", chat).sort((a, b) => a.dataset.step - b.dataset.step);
    const show = (el) => el && el.classList.add("is-in");
    const accept = (kind) => {
      const offer = $(`[data-offer="${kind}"]`, chat);
      if (!offer || offer.classList.contains("is-gone")) return;
      offer.classList.add("is-gone"); show($(`[data-done="${kind}"]`, chat));
      if (kind === "days") paint(AFTER, true);
      if (kind === "gear") show($("[data-gear] .is-new"));
    };
    chat.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      touched = true; clearTimeout(auto);
      if (b.dataset.do) accept(b.dataset.do);
      else if (b.hasAttribute("data-keep")) b.closest(".offer").classList.add("is-gone");
    });
    const play = () => {
      if (played) return;
      played = true;
      const at = reduce ? [0, 0, 0, 0, 0] : [250, 900, 2300, 3100, 3500];
      steps.forEach((el, k) => setTimeout(() => {
        if (el.matches(".bub-coach")) { const w = $(".chat-wait", chat); w && w.classList.remove("is-in"); }
        if (!(reduce && el.matches(".chat-wait"))) show(el);
      }, at[k]));
      // a visitor who only watches still sees the plan change: Do it presses itself after a while
      auto = setTimeout(() => { if (!touched) { accept("days"); auto = setTimeout(() => !touched && accept("gear"), 1600); } }, 9500);
    };
    seen(chat, (on) => on && play(), { threshold: 0.4 });
  })();

  /* ---------- Scroll state: nav tone, hero sunrise, altimeter, CTAs ---------- */
  const nav = $("#nav"), hero = $(".hero"), alti = $(".alti");
  const altM = $(".alti-m"), altTier = $(".alti-tier");
  const summit = $(".summit"), climbEl = $("#climb"), toned = $$("[data-tone]");
  const sticky = $(".sticky-cta"), qr = $(".qr-card");
  let shownAlt = 0, targetAlt = 0, raf = 0;
  const paintAlt = () => {
    shownAlt += (targetAlt - shownAlt) * (reduce ? 1 : 0.18);
    if (Math.abs(targetAlt - shownAlt) < 1) shownAlt = targetAlt;
    altM.textContent = fmt(shownAlt);
    altTier.textContent = tierOf(shownAlt);
    alti.style.setProperty("--alt-p", (shownAlt / TOP).toFixed(4));
    raf = shownAlt !== targetAlt ? requestAnimationFrame(paintAlt) : 0;
  };

  const onScroll = () => {
    const vh = innerHeight, y = scrollY;
    const hr = hero.getBoundingClientRect();
    const rise = Math.min(1, Math.max(0, -hr.top / (hr.height * 0.8)));
    hero.style.setProperty("--rise", rise.toFixed(3));

    nav.classList.toggle("is-solid", y > 30);
    const under = toned.find((s) => { const r = s.getBoundingClientRect(); return r.top <= 32 && r.bottom > 32; });
    nav.classList.toggle("is-day", !!under && under.dataset.tone === "light");

    // Altitude belongs to the climb: 0 at Dawnhaven, then the active step's own altitude (atlas.json).
    const mid = vh * 0.5, cr = climbEl.getBoundingClientRect();
    targetAlt = cr.top < mid && active >= 0 ? line[active].altitude : 0;
    if (!raf) raf = requestAnimationFrame(paintAlt);
    alti.classList.toggle("is-on", cr.top < vh * 0.6 && cr.bottom > mid);

    const past = hr.bottom < vh * 0.4, atSummit = summit.getBoundingClientRect().top < vh * 0.7;
    sticky && sticky.classList.toggle("is-on", past && !atSummit);
    qr && qr.classList.toggle("is-on", past && !atSummit);
  };

  /* ---------- The climb ---------- */
  const stepsEl = $("[data-steps]");
  const stage = {
    card: $(".stage-card"), alt: $("[data-stage-alt]"), tier: $("[data-stage-tier]"), name: $("[data-stage-name]"),
    std: $("[data-stage-std]"), video: $("[data-stage-video]"), svg: $(".profile"),
  };
  let line = [], starts = {}, active = -1, stageAlt = 0, points = [];

  const buildProfile = () => {
    const W = 400, H = 120, pad = 8, n = line.length;
    points = line.map((s, i) => [pad + (i * (W - 2 * pad)) / (n - 1), H - pad - (s.altitude / 7000) * (H - 2 * pad)]);
    const d = points.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    $(".profile-line", stage.svg).setAttribute("d", d);
    $(".profile-area", stage.svg).setAttribute("d", `${d} L${points[n - 1][0]} ${H} L${points[0][0]} ${H} Z`);
  };
  const paintProfile = (i) => {
    const pts = points.slice(0, i + 1);
    $(".profile-done", stage.svg).setAttribute("d", pts.map((p, k) => (k ? "L" : "M") + p[0] + " " + p[1]).join(" "));
    const dot = $(".profile-dot", stage.svg);
    dot.setAttribute("cx", points[i][0]); dot.setAttribute("cy", points[i][1]);
  };
  const setStep = (i) => {
    if (i === active || !line[i]) return;
    active = i;
    const s = line[i];
    $$(".step", stepsEl).forEach((li, k) => li.classList.toggle("is-on", k === i));
    run(stage.alt, stageAlt, s.altitude); stageAlt = s.altitude;
    onScroll();
    stage.tier.textContent = s.tier;
    stage.name.textContent = s.name;
    stage.std.textContent = s.standard;
    stage.card.classList.toggle("is-summit", s.id === "VP-10");
    paintProfile(i);
    const v = stage.video, src = `/clip-${s.clip}.mp4`;
    if (!v.src.endsWith(src)) {
      v.classList.add("is-swap");
      setTimeout(() => {
        v.poster = `/clip-${s.clip}.jpg`; v.src = src; v.load();
        v.play().catch(() => {});
        v.classList.remove("is-swap");
      }, reduce ? 0 : 180);
    }
  };
  const renderSteps = () => {
    stepsEl.innerHTML = line.map((s) => `
      <li class="step${s.id === "VP-10" ? " is-summit" : ""}" data-alt="${s.altitude}">
        <div class="step-alt num">${fmt(s.altitude)}<small>m</small></div>
        <h3 class="step-name">${s.name}</h3>
        <p class="step-std">${s.standard}</p>
        ${NOTES[s.id] ? `<p class="step-note">${NOTES[s.id]}</p>` : ""}
        <p class="step-tier">${s.tier}</p>
      </li>`).join("");
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setStep($$(".step", stepsEl).indexOf(e.target));
    }, { rootMargin: "-45% 0px -45% 0px" });
    $$(".step", stepsEl).forEach((li) => io.observe(li));
  };
  watch(stage.video);

  /* ---------- Quiz: the app's own placement table for Strong back ---------- */
  const quiz = $("[data-quiz]");
  const show = (key) => $$(".q", quiz).forEach((q) => q.classList.toggle("is-on", q.dataset.q === key));
  const result = (stepId) => {
    const s = starts[stepId] || line.find((x) => x.id === stepId);
    if (!s) return;
    $("[data-res-name]", quiz).textContent = s.name;
    $("[data-res-alt]", quiz).textContent = fmt(s.altitude);
    $("[data-res-std]", quiz).textContent = s.standard;
    const toGo = 2770 - s.altitude;
    $("[data-res-next]", quiz).textContent = toGo > 0
      ? `Your first pull-up is ${fmt(toGo)} m above you. Day one starts here, and it’s free.`
      : "You’re past the first pull-up. The line goes on to more reps, then weighted, archer and one-arm work.";
    const v = $("[data-res-video]", quiz);
    v.poster = `/clip-${s.clip}.jpg`; v.src = `/clip-${s.clip}.mp4`; v.load(); watch(v); v.play().catch(() => {});
    show("result");
  };
  quiz.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-restart")) { show("pullups"); $(".q.is-on button", quiz).focus(); return; }
    const q = b.closest(".q").dataset.q, a = +b.dataset.a;
    if (q === "pullups") {
      if (a === 0) show("fah");
      else result(a >= 12 ? "VP-14" : a >= 8 ? "VP-13" : a >= 4 ? "VP-12" : "VP-11");
    } else if (q === "fah") {
      if (a === 0) show("hang"); else result(a >= 20 ? "VP-07" : "VP-06");
    } else if (q === "hang") {
      result(a >= 30 ? "VP-04" : a >= 10 ? "VP-02" : "VP-01");
    }
    const on = $(".q.is-on button", quiz);
    on && on.focus({ preventScroll: true });
  });

  /* ---------- Direction tabs ---------- */
  const tabs = $("[data-dtabs]");
  if (tabs) {
    const btns = $$("[role=tab]", tabs);
    const pick = (btn) => {
      btns.forEach((b) => { b.setAttribute("aria-selected", b === btn); b.tabIndex = b === btn ? 0 : -1; });
      for (const end of ["from", "to"]) {
        const v = $(`[data-pair="${end}"]`, tabs), c = btn.dataset[end];
        v.poster = `/clip-${c}.jpg`; v.src = `/clip-${c}.mp4`; v.load(); v.play().catch(() => {});
        $(`[data-pairname="${end}"]`, tabs).textContent = btn.dataset[end + "name"];
      }
    };
    btns.forEach((b, i) => {
      b.tabIndex = i ? -1 : 0;
      b.addEventListener("click", () => pick(b));
      b.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { const n = btns[(i + d + btns.length) % btns.length]; n.focus(); pick(n); }
      });
    });
  }

  /* ---------- Boot ---------- */
  cam.start();
  fetch("/climb.json").then((r) => r.json()).then((data) => {
    line = data.line; starts = data.starts || {};
    ladder.start(data.ladder); voice.start(data.voice);
    renderSteps(); buildProfile(); setStep(0); onScroll();
  }).catch(onScroll);

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
})();
