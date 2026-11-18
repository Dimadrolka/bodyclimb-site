/* Bodyclimb web tests (decision 200): a self-timed hold. Start → countdown → count up → Stop → the result at once.
   The timer never starts by itself. No cookies, no storage, no network calls, no dependencies.
   The page's own words live in the HTML (data-* on #test); only the short timer words are here. */
(() => {
  "use strict";
  const root = document.getElementById("test");
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const TEST = root.dataset.test;                 // "hang" | "plank": the door path /test/<name>
  const NAME = root.dataset.name;                 // "Dead Hang Test"
  const MAX = 600;                                // the door carries r as whole seconds, 0–600
  const PAGE = `https://bodyclimb.app/test/${TEST}`;

  const clock = $("#t-clock"), phase = $("#t-phase"), go = $("#t-go"), note = $("#t-note"), live = $("#t-live");
  const manual = $("#t-manual"), manualOpen = $("#t-manual-open"), manualInput = $("#t-seconds"), manualAsk = $("#t-manual-ask");
  const manualError = $("#t-manual-error"), awake = $("#t-awake"), sound = $("#t-sound");
  const resultBox = $("#t-result"), num = $("#t-num"), unit = $("#t-unit"), line = $("#t-line"), cap = $("#t-cap");
  const openLink = $("#t-open"), shareBtn = $("#t-share"), againBtn = $("#t-again"), shot = $("#t-shot");

  const plural = (n) => `${n} ${n === 1 ? "second" : "seconds"}`;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const doorUrl = (r) => `${PAGE}?r=${r}&src=self`;
  // "Open in Bodyclimb" goes by the app's own scheme: a universal link to the page's own domain stays in Safari
  // (Apple opens the app only from another domain), and in-app browsers do not follow universal links on a tap.
  const appUrl = (r) => `bodyclimb://test/${TEST}?r=${r}&src=self`;
  /** "34" → 34; anything that is not a whole number of seconds from 0 to 600 → null. */
  const parseSeconds = (text) => {
    const t = String(text == null ? "" : text).trim();
    if (!/^\d{1,3}$/.test(t)) return null;
    const n = Number(t);
    return n <= MAX ? n : null;
  };

  let state = "idle";
  let lead = Number(root.dataset.lead) || 5;
  let leadEndAt = 0, startAt = 0, timer = 0, lastWall = 0, shown = -1;

  const setState = (s) => { state = s; root.dataset.state = s; };
  const say = (text) => { live.textContent = text; };
  const paint = (text, label) => { clock.textContent = text; clock.setAttribute("aria-label", label); };
  const goLabel = () => { go.textContent = `Start · ${lead} s ${root.dataset.leadLabel}`; };

  /* ---------- Sound: short tones from WebAudio, made only after a tap ---------- */
  let ctx = null;
  const audio = () => {
    if (!sound.checked) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = ctx || new AC();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (e) { return null; }
  };
  const tone = (freq, seconds) => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime, osc = c.createOscillator(), gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.03);
  };

  /* ---------- Screen stays awake while the countdown or the hold runs ---------- */
  let lock = null;
  const keepAwake = async () => {
    try { lock = navigator.wakeLock ? await navigator.wakeLock.request("screen") : null; } catch (e) { lock = null; }
    if (state !== "lead" && state !== "run") return letSleep();
    awake.hidden = !!lock;
  };
  const letSleep = () => {
    if (lock) lock.release().catch(() => {});
    lock = null;
  };

  /* ---------- Countdown → hold ---------- */
  const stopClock = () => { clearInterval(timer); timer = 0; letSleep(); };
  const elapsed = () => Math.max(0, Math.min(MAX, Math.floor((performance.now() - startAt) / 1000)));

  const toIdle = (message) => {
    stopClock();
    setState("idle");
    goLabel();
    phase.textContent = root.dataset.idle;
    paint("0:00", "0 seconds");
    note.textContent = message || "";
    awake.hidden = true;
    if (message) say(message);
  };

  const startLead = () => {
    audio();
    closeManual();
    note.textContent = "";
    leadEndAt = performance.now() + lead * 1000;
    lastWall = Date.now();
    shown = -1;
    setState("lead");
    go.textContent = "Cancel";
    phase.textContent = root.dataset.leadPhase;
    say(`Countdown: ${plural(lead)}.`);
    keepAwake();
    timer = setInterval(tick, 100);
    tick();
    go.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };

  const startRun = () => {
    startAt = leadEndAt;
    shown = -1;
    setState("run");
    go.textContent = "Stop";
    phase.textContent = root.dataset.runPhase;
    tone(988, 0.55);
    say("Go. The timer is running.");
    tick();
  };

  function tick() {
    // A gap between ticks means the page was frozen (screen lock, another app): the time can't be trusted.
    const wall = Date.now();
    if (wall - lastWall > 2000) return interrupted();
    lastWall = wall;
    if (state === "lead") {
      const left = Math.ceil((leadEndAt - performance.now()) / 1000);
      if (left <= 0) return startRun();
      if (left !== shown) {
        shown = left;
        paint(String(left), `${plural(left)} to the start`);
        if (left <= 3) tone(660, 0.13);
      }
    } else if (state === "run") {
      const s = elapsed();
      if (s >= MAX) return finish(MAX, true);
      if (s !== shown) {
        shown = s;
        paint(mmss(s), plural(s));
        if (s > 0 && s % 10 === 0) say(plural(s));
      }
    }
  }

  function interrupted() {
    if (state === "lead") return toIdle("The countdown was interrupted. Nothing starts until you tap Start.");
    if (state !== "run") return;
    const at = Math.max(0, shown);
    toIdle("");
    openManual(`The timer was interrupted at ${at} s. ${root.dataset.ask}`, at);
  }

  /* ---------- "I timed it myself" ---------- */
  function openManual(question, value) {
    manualAsk.textContent = question || root.dataset.ask;
    manualInput.value = value == null ? "" : String(value);
    manualError.textContent = "";
    manual.hidden = false;
    manualOpen.setAttribute("aria-expanded", "true");
    manualInput.focus();
  }
  function closeManual() {
    manual.hidden = true;
    manualError.textContent = "";
    manualOpen.setAttribute("aria-expanded", "false");
  }

  /* ---------- Result ---------- */
  let card = null;      // { blob, url } of the share card, drawn as soon as the result shows
  const dropCard = () => {
    if (card && card.url) URL.revokeObjectURL(card.url);
    card = null;
    shot.hidden = true;
  };

  function finish(seconds, capped) {
    stopClock();
    showResult(seconds, { capped: !!capped, fresh: true });
  }

  function showResult(seconds, opts) {
    closeManual();
    awake.hidden = true;
    note.textContent = "";
    num.textContent = String(seconds);
    unit.textContent = seconds === 1 ? "second" : "seconds";
    line.textContent = `${plural(seconds)}. ${root.dataset.line}`;
    cap.hidden = !opts.capped;
    // the button is on the page only once the app that takes a result is in the App Store (README.md)
    if (openLink) {
      openLink.href = appUrl(seconds);
      openLink.dataset.web = doorUrl(seconds);
    }
    resultBox.hidden = false;
    resultBox.classList.toggle("is-new", !!opts.fresh);
    setState("result");
    // The address keeps the result, so it is still here after a trip to the App Store or a reload.
    try { history.replaceState(null, "", `${location.pathname}?r=${seconds}&src=self`); } catch (e) { /* stays in memory */ }
    if (opts.fresh) {
      resultBox.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
    dropCard();
    const wanted = seconds;
    drawCard(seconds).then((made) => { if (state === "result" && num.textContent === String(wanted)) card = made; else if (made) URL.revokeObjectURL(made.url); })
      .catch(() => {});
  }

  function tryAgain() {
    dropCard();
    resultBox.hidden = true;
    try { history.replaceState(null, "", location.pathname); } catch (e) { /* nothing to clear */ }
    toIdle("");
    go.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* ---------- Share card: drawn on a canvas in the site's look, nothing fetched but the site's own icon ---------- */
  const loadIcon = () => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/icon.png";
  });

  async function drawCard(seconds) {
    const W = 1080, H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const x = canvas.getContext("2d");
    if (!x) return null;
    const display = '"Nunito", ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
    try { if (document.fonts && document.fonts.load) await document.fonts.load(`900 100px ${display}`); } catch (e) { /* system face */ }
    const icon = await loadIcon();

    // Night at the top, sunrise at the horizon: the landing's own sky.
    const sky = x.createLinearGradient(0, 0, 0, H);
    [[0, "#0E0B15"], [0.34, "#1A1522"], [0.56, "#322A3C"], [0.72, "#4A2E48"], [0.84, "#8C4A5E"], [0.93, "#F3A88C"], [1, "#F7C9A1"]]
      .forEach(([at, colour]) => sky.addColorStop(at, colour));
    x.fillStyle = sky;
    x.fillRect(0, 0, W, H);
    const sun = x.createRadialGradient(W * 0.5, H * 0.9, 0, W * 0.5, H * 0.9, W * 0.62);
    sun.addColorStop(0, "rgba(255, 196, 140, .75)");
    sun.addColorStop(0.4, "rgba(243, 168, 140, .28)");
    sun.addColorStop(1, "rgba(243, 168, 140, 0)");
    x.fillStyle = sun;
    x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(255, 255, 255, .8)";
    [[96, 150, 2.4], [250, 78, 1.8], [432, 214, 2.6], [610, 110, 1.8], [770, 262, 2.2], [905, 92, 1.8], [1000, 220, 2.8], [60, 372, 1.8],
     [356, 402, 1.8], [716, 440, 2.2], [948, 470, 1.8], [200, 520, 1.6]].forEach(([sx, sy, r]) => { x.beginPath(); x.arc(sx, sy, r, 0, 7); x.fill(); });
    // The island's ridge line: a far slope and the near one the words stand on.
    const ridge = (points, colour) => {
      x.beginPath();
      x.moveTo(0, H);
      points.forEach(([px, py]) => x.lineTo(px * W, py * H));
      x.lineTo(W, H);
      x.closePath();
      x.fillStyle = colour;
      x.fill();
    };
    ridge([[0, 0.845], [0.16, 0.8], [0.3, 0.83], [0.47, 0.735], [0.56, 0.775], [0.68, 0.79], [0.84, 0.835], [1, 0.81]], "rgba(74, 46, 72, .9)");
    ridge([[0, 0.9], [0.2, 0.868], [0.42, 0.89], [0.66, 0.862], [0.86, 0.892], [1, 0.874]], "#1A1522");

    const text = (value, px, py, font, colour, spacing) => {
      x.font = font;
      x.fillStyle = colour;
      try { x.letterSpacing = spacing || "0px"; } catch (e) { /* older engines */ }
      x.fillText(value, px, py);
    };
    x.textBaseline = "alphabetic";
    x.textAlign = "left";
    if (icon) {
      x.save();
      x.beginPath();
      if (x.roundRect) x.roundRect(84, 84, 76, 76, 19); else x.rect(84, 84, 76, 76);
      x.clip();
      x.drawImage(icon, 84, 84, 76, 76);
      x.restore();
    }
    text("Bodyclimb", icon ? 182 : 84, 140, `900 50px ${display}`, "#F8F1E9", "-0.5px");
    text(NAME.toUpperCase(), 84, 380, `800 46px ${display}`, "#FF7A4D", "3px");
    text(String(seconds), 72, 740, `900 440px ${display}`, "#F8F1E9", "-14px");
    text(seconds === 1 ? "second" : "seconds", 84, 836, `800 76px ${display}`, "#C4BACD", "0px");
    // "Self-timed": how the number was measured, on the card itself.
    x.font = `800 44px ${display}`;
    try { x.letterSpacing = "0px"; } catch (e) { /* older engines */ }
    const pillWidth = x.measureText("Self-timed").width + 64;
    x.fillStyle = "rgba(248, 241, 233, .14)";
    x.beginPath();
    if (x.roundRect) x.roundRect(84, 884, pillWidth, 84, 42); else x.rect(84, 884, pillWidth, 84);
    x.fill();
    text("Self-timed", 116, 941, `800 44px ${display}`, "#F8F1E9", "0px");
    text("bodyclimb.app", 84, H - 74, `900 52px ${display}`, "#F8F1E9", "0px");

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? { blob, url: URL.createObjectURL(blob), seconds } : null;
  }

  const showShot = () => {
    if (!card) return;
    const img = shot.querySelector("img"), link = shot.querySelector("a");
    img.src = card.url;
    img.alt = `Result card: ${NAME}, ${plural(card.seconds)}, self-timed, bodyclimb.app`;
    link.href = card.url;
    link.download = `bodyclimb-${TEST}-test-${card.seconds}s.png`;
    shot.hidden = false;
    link.focus({ preventScroll: true });
    shot.scrollIntoView({ block: "nearest" });
  };

  async function share() {
    if (!card) {
      try { card = await drawCard(Number(num.textContent)); } catch (e) { card = null; }
      if (!card) return;
    }
    const file = typeof File === "function" ? new File([card.blob], `bodyclimb-${TEST}-test-${card.seconds}s.png`, { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: NAME, text: `${NAME}: ${plural(card.seconds)}, self-timed. ${PAGE}` });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;      // the person closed the share sheet
      }
    }
    showShot();
  }

  /* ---------- Wiring ---------- */
  go.addEventListener("click", () => {
    if (state === "idle") startLead();
    else if (state === "lead") toIdle("");
    else if (state === "run") { const s = elapsed(); tone(440, 0.22); finish(s, false); }
  });
  root.querySelectorAll('input[name="lead"]').forEach((input) => {
    if (Number(input.value) === lead) input.checked = true;
    input.addEventListener("change", () => { lead = Number(input.value); if (state === "idle") goLabel(); });
  });
  manualOpen.addEventListener("click", () => { if (manual.hidden) openManual(); else closeManual(); });
  manual.addEventListener("submit", (event) => {
    event.preventDefault();
    const seconds = parseSeconds(manualInput.value);
    if (seconds == null) {
      manualError.textContent = `Enter whole seconds, from 0 to ${MAX}.`;
      manualInput.focus();
      return;
    }
    finish(seconds, false);
  });
  shareBtn.addEventListener("click", share);
  // The app did not open (it is not on this phone, or this browser blocks app links): say so instead of doing nothing.
  if (openLink) openLink.addEventListener("click", () => {
    const hint = $("#t-openhint");
    if (!hint) return;
    hint.hidden = true;
    setTimeout(() => { if (document.visibilityState === "visible") hint.hidden = false; }, 1600);
  });

  againBtn.addEventListener("click", tryAgain);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && state === "lead") toIdle(""); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && (state === "lead" || state === "run")) interrupted(); });
  window.addEventListener("pagehide", () => { stopClock(); });

  // A link that carries a result (the door's own address, opened where the app is not installed) shows that result.
  const query = new URLSearchParams(location.search);
  const selfTimed = !query.has("src") || query.get("src") === "self";      // this page can only vouch for "Self-timed"
  const carried = query.has("r") && selfTimed ? parseSeconds(query.get("r")) : null;
  toIdle("");
  if (carried != null) showResult(carried, { capped: false, fresh: false });
})();
