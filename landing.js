/* Bodyclimb landing: altimeter, the climb (sticky demo + elevation profile), the start quiz, how-it-works screens,
   direction tabs, and videos that only play while they are on screen. No cookies, no analytics, no dependencies. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const TIERS = [[0, "Foothills"], [1000, "Highlands"], [3000, "High Ridges"], [6000, "The Heights"], [8000, "Eight-thousanders"]];
  const tierOf = (m) => (m < 1 ? "Dawnhaven" : TIERS.filter(([f]) => m >= f).pop()[1]);
  const TOP = 8849;

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

  /* ---------- Videos: play only on screen ---------- */
  const vio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        if (v.preload === "none") v.preload = "auto";
        if (!reduce || v.dataset.stageVideo !== undefined || v.closest(".live-demo")) v.play().catch(() => {});
      } else v.pause();
    }
  }, { rootMargin: "200px 0px" });
  const watch = (v) => v && vio.observe(v);
  $$("video").forEach(watch);

  /* ---------- Scroll state: nav, hero sunrise, altimeter, CTAs ---------- */
  const nav = $("#nav"), hero = $(".hero"), alti = $(".alti");
  const altM = $(".alti-m"), altTier = $(".alti-tier");
  const dayStart = $(".how"), summit = $(".summit"), climbEl = $("#climb");
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
    const dayTop = dayStart.getBoundingClientRect().top, sumR = summit.getBoundingClientRect();
    const footTop = $(".foot").getBoundingClientRect().top;
    nav.classList.toggle("is-day", dayTop < 64 && footTop > 64 && !(sumR.top < 64 && sumR.bottom > 64 && sumR.top < -vh * 0.15));

    // Altitude belongs to the climb: 0 at Dawnhaven, then the active step's own altitude (atlas.json).
    const mid = vh * 0.5, cr = climbEl.getBoundingClientRect();
    targetAlt = cr.top < mid && active >= 0 ? line[active].altitude : 0;
    if (!raf) raf = requestAnimationFrame(paintAlt);

    const past = hr.bottom < vh * 0.4;
    alti.classList.toggle("is-on", rise > 0.12 && cr.top < vh * 0.85 && cr.bottom > mid);
    const atSummit = sumR.top < vh * 0.7;
    sticky && sticky.classList.toggle("is-on", past && !atSummit);
    qr && qr.classList.toggle("is-on", past && !atSummit);
  };

  /* ---------- The climb ---------- */
  const stepsEl = $("[data-steps]");
  const stage = {
    card: $(".stage-card"), alt: $("[data-stage-alt]"), tier: $("[data-stage-tier]"), name: $("[data-stage-name]"),
    std: $("[data-stage-std]"), video: $("[data-stage-video]"), svg: $(".profile"),
  };
  let line = [], starts = {}, active = -1, stageAlt = 0, stageRaf = 0, points = [];

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
  const tweenStageAlt = (to) => {
    cancelAnimationFrame(stageRaf);
    if (reduce) { stageAlt = to; stage.alt.textContent = fmt(to); return; }
    const from = stageAlt, t0 = performance.now(), dur = 700;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      stageAlt = from + (to - from) * e; stage.alt.textContent = fmt(stageAlt);
      if (k < 1) stageRaf = requestAnimationFrame(tick);
    };
    stageRaf = requestAnimationFrame(tick);
  };
  const setStep = (i) => {
    if (i === active || !line[i]) return;
    active = i;
    const s = line[i];
    $$(".step", stepsEl).forEach((li, k) => li.classList.toggle("is-on", k === i));
    tweenStageAlt(s.altitude);
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

  /* ---------- How it works: swap the real screen ---------- */
  const howImg = $("[data-how-img]");
  const beats = $$(".beat");
  const bio = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      beats.forEach((b) => b.classList.toggle("is-on", b === e.target));
      const src = `/screen-${e.target.dataset.shot}.webp`;
      if (!howImg.src.endsWith(src)) {
        howImg.classList.add("is-swap");
        setTimeout(() => { howImg.src = src; howImg.alt = e.target.dataset.altShot || ""; howImg.classList.remove("is-swap"); }, reduce ? 0 : 160);
      }
    }
  }, { rootMargin: "-40% 0px -50% 0px" });
  beats.forEach((b) => bio.observe(b));
  beats.forEach((b) => { const i = new Image(); i.src = `/screen-${b.dataset.shot}.webp`; });

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
  fetch("/climb.json").then((r) => r.json()).then((data) => {
    line = data.line; starts = data.starts || {};
    renderSteps(); buildProfile(); setStep(0); onScroll();
  }).catch(onScroll);

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
})();
