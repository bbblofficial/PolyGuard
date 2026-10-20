/* Unicollect Guard: public site behaviour
   theme (same rule as the chat panel) · drawer · live links (api/links.json)
   · stamp demo + real check on the live service · API docs (tabs, copy, TOC
   search, console with copy-as-curl) · 404 helper · secret "muvixo" dialog. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var THEME_KEY = "unicollect_theme";
  var PLACEHOLDER = "https://YOUR-LINK.trycloudflare.com";

  function scriptBase() {
    var s = document.currentScript;
    if (!s) { var all = document.getElementsByTagName("script"); s = all[all.length - 1]; }
    return s && s.src ? s.src.replace(/[?#].*$/, "").replace(/[^/]*$/, "") : "";
  }
  var ASSETS = scriptBase();                       // .../assets/
  var ROOT = ASSETS.replace(/assets\/$/, "");      // site root (absolute)
  // served by the FastAPI service itself (/site/* or its HTML 404 page)
  var SERVED_BY_SERVICE = ROOT.indexOf(location.origin + "/site/") === 0;
  var ARROW = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';

  function fa(n) { return String(n).replace(/[0-9]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, REDUCED ? 0 : ms); }); }

  /* ---------- theme ---------- */
  function paintThemeColor() {
    var c = document.documentElement.classList.contains("dark") ? "#212121" : "#ffffff";
    $$('meta[name="theme-color"]').forEach(function (m) { m.setAttribute("content", c); });
  }
  // theme switch: a circle of the new theme grows out of the button
  // (View Transitions); older browsers get a short colour cross-fade.
  function applyTheme(dark) {
    document.documentElement.classList.toggle("dark", dark);
    paintThemeColor();
  }
  function switchTheme(btn, dark) {
    var root = document.documentElement;
    try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (e) {}
    btn.classList.remove("spin"); void btn.offsetWidth; btn.classList.add("spin");
    if (REDUCED) { applyTheme(dark); return; }
    if (document.startViewTransition) {
      var r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      var vt = document.startViewTransition(function () { applyTheme(dark); });
      vt.ready.then(function () {
        root.animate({ clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + far + "px at " + x + "px " + y + "px)"] },
          { duration: 560, easing: "cubic-bezier(.22, 1, .36, 1)", pseudoElement: "::view-transition-new(root)" });
      }).catch(function () {});
      return;
    }
    root.classList.add("theme-anim");
    applyTheme(dark);
    clearTimeout(switchTheme.t);
    switchTheme.t = setTimeout(function () { root.classList.remove("theme-anim"); }, 400);
  }
  $$("[data-theme-toggle]").forEach(function (b) {
    b.addEventListener("click", function () { switchTheme(b, !document.documentElement.classList.contains("dark")); });
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var onMq = function () {
      var saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
      if (!saved) { document.documentElement.classList.toggle("dark", !mq.matches); paintThemeColor(); }
    };
    if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
  }
  paintThemeColor();

  /* ---------- floating header: hide on scroll down, show on scroll up ---------- */
  var top = $("#top"), progress = $("[data-progress]"), lastY = window.scrollY, ticking = false, hidden = false, travel = 0;
  function setHidden(h) {
    if (h === hidden || !top) return;
    hidden = h;
    top.classList.toggle("hide", h);
    document.documentElement.classList.toggle("hdr-hidden", h);
  }
  function onScrollFrame() {
    ticking = false;
    if (!top) return;
    var y = Math.max(0, window.scrollY), dy = y - lastY; lastY = y;
    top.classList.toggle("scrolled", y > 8);
    // need a little travel in one direction before toggling (no flicker)
    travel = (dy > 0) === (travel > 0) ? travel + dy : dy;
    var pinned = y < 140 || top.contains(document.activeElement) || (drawer && drawer.classList.contains("open"));
    if (pinned || travel < -24) setHidden(false);
    else if (travel > 36) setHidden(true);
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var long = max > window.innerHeight * 1.2;
      progress.classList.toggle("on", long && y > 60);
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ")";
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  if (top) top.addEventListener("focusin", function () { setHidden(false); });
  // pointer near the top edge brings the header back
  document.addEventListener("mousemove", function (e) { if (hidden && e.clientY < 24) setHidden(false); }, { passive: true });

  /* ---------- nav: sliding ink pill ---------- */
  var nav = $("[data-nav]"), ink = nav && $(".nav-ink", nav);
  if (nav && ink) {
    var current = $('a[aria-current="page"]', nav);
    var moveInk = function (a, instant) {
      if (!a || !a.offsetWidth) { ink.style.opacity = "0"; return; }
      if (instant) ink.classList.add("still");
      ink.style.width = a.offsetWidth + "px";
      ink.style.transform = "translateX(" + a.offsetLeft + "px)";
      ink.style.opacity = "1";
      ink.classList.toggle("ghost", a !== current);
      if (instant) { void ink.offsetWidth; ink.classList.remove("still"); }
    };
    nav.classList.add("has-ink");
    $$("a", nav).forEach(function (a) {
      a.addEventListener("mouseenter", function () { moveInk(a); });
      a.addEventListener("focus", function () { moveInk(a); });
    });
    nav.addEventListener("mouseleave", function () { moveInk(current); });
    nav.addEventListener("focusout", function (e) { if (!nav.contains(e.relatedTarget)) moveInk(current); });
    var place = function () { moveInk(current, true); };
    place();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    window.addEventListener("resize", place);
  }

  /* ---------- brand mark: intro once, a wave on hover (never replays the intro) ---------- */
  $$(".brand").forEach(function (b) {
    var m = $(".pg-mark", b); if (!m) return;
    var intro = m.classList.contains("breathe");
    if (intro) setTimeout(function () { m.classList.remove("breathe"); }, 1100);
    b.addEventListener("mouseenter", function () {
      if (REDUCED || m.classList.contains("breathe") || m.classList.contains("wave")) return;
      m.classList.add("wave");
      setTimeout(function () { m.classList.remove("wave"); }, 1300);
    });
  });

  var drawer = $("#drawer"), opener = $("[data-menu-open]");
  if (drawer) $$(".sheet nav a", drawer).forEach(function (a, i) { a.style.setProperty("--i", i); });
  function setMenu(open) {
    if (!drawer || drawer.classList.contains("open") === open) return;
    drawer.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    if (opener) opener.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
    if (open) { var f = $(".sheet nav a", drawer); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 60); }
    else if (opener && drawer.contains(document.activeElement)) opener.focus({ preventScroll: true });
  }
  // keep Tab inside the open menu
  if (drawer) drawer.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !drawer.classList.contains("open")) return;
    var f = $$("a[href], button", $(".sheet", drawer)); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $$("[data-to-top]").forEach(function (b) {
    b.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }); });
  });
  if (opener) opener.addEventListener("click", function () { setMenu(true); });
  $$("[data-menu-close]").forEach(function (b) { b.addEventListener("click", function () { setMenu(false); }); });
  if (drawer) $$("a", drawer).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  window.addEventListener("resize", function () { if (window.innerWidth > 900) setMenu(false); });

  /* ---------- reveal on scroll ---------- */
  document.documentElement.classList.add("js");
  var reveals = $$(".reveal");
  // siblings that enter together cascade instead of popping at once
  reveals.forEach(function (el) {
    var sib = $$(":scope > .reveal", el.parentNode);
    var i = sib.indexOf(el);
    if (sib.length > 1 && i > 0 && el.tagName !== "DETAILS") el.style.setProperty("--rd", Math.min(i, 5));
  });
  var foot = $("[data-foot]");
  if (foot) reveals.push(foot);
  if ("IntersectionObserver" in window && !REDUCED) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add("in"); });

  /* ---------- toast + clipboard ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    var s = $("[data-toast-text]", t); if (s) s.textContent = msg || "کپی شد";
    t.classList.add("show"); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1500);
  }
  function copy(text) {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(function () { toast(); }, fallback); return; }
    fallback();
    function fallback() {
      var a = document.createElement("textarea"); a.value = text; a.setAttribute("readonly", "");
      a.style.cssText = "position:fixed;top:-1000px;opacity:0"; document.body.appendChild(a); a.select();
      try { document.execCommand("copy"); } catch (e) {} a.remove(); toast();
    }
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy-code]");
    if (!b) return;
    var box = b.closest(".code");
    var panel = box && ($(".panel:not([hidden]) pre", box) || $("pre", box));
    if (panel) copy(panel.innerText.replace(/\u00a0/g, " "));
  });

  /* ---------- code tabs ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tab]");
    if (!t) return;
    var box = t.closest("[data-tabs]");
    $$("[data-tab]", box).forEach(function (x) { x.setAttribute("aria-selected", String(x === t)); });
    $$(".panel", box).forEach(function (p) { p.hidden = p.id !== t.dataset.tab; });
  });

  /* ---------- live links ---------- */
  var live = { url: "", status: "unknown", updated: null, run: null };
  var liveHooks = [];                         // called after every status repaint

  function setDots(cls, text) {
    $$("[data-status-dot]").forEach(function (d) { d.className = "dot " + cls; });
    $$("[data-status-text]").forEach(function (t) { t.textContent = text; });
  }
  var LINK_PATHS = { panel: "", api: "/api/v1", swagger: "/docs", redoc: "/redoc", openapi: "/openapi.json", health: "/api/v1/health", guide: "/api-docs" };

  function paintLinks() {
    var url = live.url;
    $$("[data-live]").forEach(function (a) {
      var k = a.getAttribute("data-live"), p = LINK_PATHS[k] || "";
      if (url) { a.href = url + p; a.target = "_blank"; a.rel = "noopener"; a.removeAttribute("aria-disabled"); }
      else { a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); }
    });
    $$("[data-live-url]").forEach(function (s) {
      var p = LINK_PATHS[s.getAttribute("data-live-url")] || "";
      s.textContent = (url || PLACEHOLDER).replace(/^https?:\/\//, "") + p;
    });
    $$("[data-live-text]").forEach(function (s) { s.textContent = url || "سرویس فعلاً آنلاین نیست"; });
    $$(".base-url").forEach(function (s) { s.textContent = url || PLACEHOLDER; });
    $$("[data-live-label]").forEach(function (s) { s.textContent = url ? "باز کردن پنل" : "پنل فعلاً آفلاین است"; });
    $$("[data-needs-live]").forEach(function (el) { el.classList.toggle("is-offline", !url); });
    var tn = $("[data-try-note]");
    if (tn && !tn.dataset.touched) tn.textContent = url ? "متن خودت را روی سرویس زنده امتحان کن." : "سرویس فعلاً آفلاین است؛ نمونه‌ها را ببین.";
    var pages = SERVED_BY_SERVICE ? "https://USER.github.io/REPO/" : ROOT;
    $$("[data-pages-url]").forEach(function (s) { s.textContent = pages; });
    $$("[data-pages-url-js]").forEach(function (s) {
      var tail = /links\.json/.test(s.textContent) ? "api/links.json" : "";
      s.textContent = '"' + pages + tail + '"';
    });
    liveHooks.forEach(function (fn) { try { fn(); } catch (e) {} });
    var when = $("[data-status-when]");
    if (when) {
      if (live.status === "online") when.textContent = "آنلاین" + (live.updated ? " · به‌روزرسانی " + relTime(live.updated) : "");
      else if (live.status === "starting") when.textContent = "در حال راه‌اندازی سرویس…";
      else when.textContent = "آفلاین" + (live.updated ? " · آخرین تغییر " + relTime(live.updated) : "");
    }
  }
  function relTime(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!(d >= 0)) return "";
    if (d < 60) return "همین الان";
    if (d < 3600) return fa(Math.round(d / 60)) + " دقیقه پیش";
    if (d < 86400) return fa(Math.round(d / 3600)) + " ساعت پیش";
    return fa(Math.round(d / 86400)) + " روز پیش";
  }
  function decode(v) {
    if (!v) return "";
    try { return decodeURIComponent(escape(atob(v))); } catch (e) { try { return atob(v); } catch (e2) { return ""; } }
  }
  function ping(url) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000), t0 = performance.now();
    return fetch(url + "/health", { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(t);
        var ms = Math.round(performance.now() - t0);
        $$("[data-status-ms]").forEach(function (s) { s.textContent = r.ok ? fa(ms) + "ms" : ""; });
        return r.ok ? r.json() : null;
      })
      .catch(function () { clearTimeout(t); return null; });
  }
  function applyStatus() {
    paintLinks();
    if (!live.url) {
      $$("[data-status-ms]").forEach(function (s) { s.textContent = ""; });
      setDots(live.status === "starting" ? "warn" : "bad", live.status === "starting" ? "در حال راه‌اندازی" : "آفلاین"); return;
    }
    setDots("warn", "در حال بررسی…");
    ping(live.url).then(function (h) {
      if (h && h.status === "ok") { live.status = "online"; setDots("ok", "آنلاین"); }
      else if (h) { live.status = "starting"; setDots("warn", "در حال بارگذاری مدل‌ها"); }
      else { setDots(live.status === "online" ? "warn" : "bad", live.status === "online" ? "آنلاین (پاسخ نداد)" : "آفلاین"); }
      paintLinks();
    });
  }
  function loadStatus() {
    if (SERVED_BY_SERVICE) {
      live.url = location.origin; live.status = "online"; applyStatus(); return Promise.resolve();
    }
    var bust = "?t=" + Date.now();
    return fetch(ROOT + "api/links.json" + bust, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { live.url = (d.base_url || "").replace(/\/+$/, ""); live.status = d.status || "offline"; live.updated = d.updated_at; })
      .catch(function () {
        return fetch(ASSETS + "status.json" + bust, { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (d) { live.url = decode(d.url_payload).replace(/\/+$/, ""); live.status = d.status || "offline"; live.updated = d.updated_at; })
          .catch(function () { live.url = ""; live.status = "offline"; });
      })
      .then(function () { if (live.status === "offline") live.url = ""; applyStatus(); });
  }
  loadStatus();
  setInterval(function () { if (!document.hidden) loadStatus(); }, 60000);

  $$("[data-copy-live]").forEach(function (b) { b.addEventListener("click", function () { copy(live.url); }); });

  /* ---------- stamp demo (home) + real check on the live service ---------- */
  var MODELS = ["فارسی", "پرو", "سریع", "گسترده", "انگلیسی"];
  var MODEL_KEYS = ["persian", "textdetox_lg", "textdetox_sm", "multilingual", "twitter_off"];
  var WORD = { safe: "ایمن", suspect: "مشکوک", toxic: "سمی" };
  var COLOR = { safe: "var(--safe)", suspect: "var(--suspect)", toxic: "var(--toxic)" };
  var EX = [
    { t: "میشه لطفاً فردا ساعت ۵ وقت بذاریم صحبت کنیم؟", lang: ["فارسی"], v: "safe", s: 4, m: [3, 6, 4, 7, null] },
    { t: "اصلاً حواست به کارت هست یا نه؟ این دومین باره.", lang: ["فارسی"], v: "suspect", s: 61, m: [61, 48, 35, 22, null] },
    { t: "خیلی احمقی، دیگه هیچ‌وقت بهم پیام نده.", lang: ["فارسی"], v: "toxic", s: 96, m: [97, 93, 95, 88, null] },
    { t: "salam, mamnoon az komaket, kheili lotf kardi", lang: ["فینگیلیش", "سلام، ممنون از کمکت…"], v: "safe", s: 3, m: [2, 4, 3, 5, 6] },
    { t: "khafe sho ahmagh", lang: ["فینگیلیش", "خفه شو احمق"], v: "toxic", s: 91, m: [94, 89, 77, 41, 70] }
  ];
  var dText = $("[data-demo-text]"), dLang = $("[data-demo-lang]"), dVoters = $("[data-demo-voters]"), dStamp = $("[data-demo-stamp]");
  var chips = $$("[data-demo]"), runId = 0, auto = true;

  if (dVoters) dVoters.innerHTML = MODELS.map(function (n, i) {
    return '<div class="voter"><div class="meter"><i style="--n:' + i + '"></i><span></span></div>' + n + "</div>";
  }).join("");

  function setLang(parts, prefix) {
    if (!dLang) return;
    var p = parts || [];
    dLang.innerHTML = (prefix === false ? "" : "زبان: ") + esc(p[0] || "") +
      (p[1] ? ARROW + '<span dir="rtl">' + esc(p[1]) + "</span>" : "");
  }
  function setVoters(ex) {
    $$(".voter", dVoters).forEach(function (v, i) {
      var val = ex ? ex.m[i] : null, bar = $("i", v), lab = $("span", v);
      bar.style.setProperty("--s", val == null ? "0" : (Math.max(4, val) / 100).toFixed(3));
      bar.style.setProperty("--c", val == null ? "var(--text-3)" : val >= 50 ? COLOR.toxic : val >= 30 ? COLOR.suspect : COLOR.safe);
      lab.textContent = !ex ? "" : val == null ? "-" : fa(val);
      lab.style.color = val != null && val >= 40 ? "#fff" : "";
      v.style.opacity = ex && val == null ? ".45" : "1";
    });
  }
  async function typeText(me, t, fast) {
    dText.innerHTML = '<span class="typed"></span><span class="caret"></span>';
    var typed = $(".typed", dText), chars = Array.from(t);
    dText.dir = /[a-z]/i.test(t) && !/[\u0600-\u06FF]/.test(t) ? "ltr" : "rtl";
    var step = fast ? Math.max(1, Math.ceil(chars.length / 60)) : 1;
    for (var c = 0; c < chars.length; c += step) {
      if (me !== runId) return false;
      typed.textContent += chars.slice(c, c + step).join("");
      await wait(fast ? 12 : chars[c] === " " ? 38 : 26);
    }
    return me === runId;
  }
  async function showVerdict(me, ex) {
    var caret = $(".caret", dText); if (caret) caret.remove();
    setLang(ex.lang);
    setVoters(ex);
    await wait(900); if (me !== runId) return false;
    $("[data-demo-verdict]").textContent = WORD[ex.v];
    $("[data-demo-score]").textContent = ex.s + "%";
    void dStamp.offsetWidth;
    dStamp.className = "stamp " + ex.v + " on";
    var desk = dStamp.closest(".desk");
    if (desk) { desk.classList.remove("stamped"); void desk.offsetWidth; desk.classList.add("stamped"); }
    return true;
  }
  function resetDesk(pressed) {
    chips.forEach(function (c) { c.setAttribute("aria-pressed", String(+c.dataset.demo === pressed)); });
    // lift the old stamp off instead of making it vanish
    if (/\bon\b/.test(dStamp.className)) dStamp.className = dStamp.className.replace(/\bon\b/, "out");
    else if (!/\bout\b/.test(dStamp.className)) dStamp.className = "stamp";
    setVoters(null);
    if (dLang) dLang.textContent = "متن";
  }
  async function play(i) {
    if (!dText) return;
    var me = ++runId, ex = EX[i];
    resetDesk(i);
    if (!(await typeText(me, ex.t))) return;
    await wait(250); if (me !== runId) return;
    if (!(await showVerdict(me, ex))) return;
    if (auto) { await wait(3200); if (me !== runId || !auto) return; play((i + 1) % EX.length); }
  }
  // map a real /api/v1/check response onto the desk
  function fromApi(text, d) {
    var raw = d.raw_scores || {}, fing = d.fingilish_detected && d.fingilish_text;
    var lang = fing ? ["فینگیلیش", d.fingilish_text] : [{ fa: "فارسی", en: "انگلیسی", mixed: "ترکیبی" }[d.script] || "خودکار"];
    return {
      t: text, lang: lang, v: String(d.decision || "SAFE").toLowerCase(),
      s: Math.round((d.max_raw != null ? d.max_raw : 0) * 100),
      m: MODEL_KEYS.map(function (k) { return raw[k] == null ? null : Math.round(raw[k] * 100); })
    };
  }
  var tryForm = $("[data-try-form]"), tryIn = $("[data-try-text]"), tryBtn = $("[data-try-send]"), tryNote = $("[data-try-note]");
  async function tryLive(text) {
    if (!live.url) { toast("سرویس فعلاً آنلاین نیست"); return; }
    auto = false;
    var me = ++runId; resetDesk(-1);
    tryBtn.setAttribute("aria-disabled", "true");
    if (tryNote) tryNote.textContent = "در حال بررسی با پنج مدل…";
    var req = fetch(live.url + "/api/v1/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, detailed: true })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
    await typeText(me, text, true);
    var caret = $(".caret", dText);
    try {
      var x = await req;
      if (me !== runId) return;
      if (!x.ok || x.j.error) {
        var msg = x.j && x.j.error ? (x.j.error.message || x.j.error) : "خطای ناشناخته";
        if (caret) caret.remove();
        setLang(["خطا", String(msg)], false);
        if (tryNote) tryNote.textContent = "پاسخ نداد؛ دوباره امتحان کن.";
        return;
      }
      await showVerdict(me, fromApi(text, x.j));
      if (tryNote) {
        tryNote.innerHTML = (x.j.reason ? '<bdi dir="ltr">' + esc(x.j.reason) + "</bdi>" : "") +
          (x.j.latency_ms != null ? ' <span class="mono">' + fa(x.j.latency_ms) + "ms</span>" : "") +
          ' · <a href="' + esc(ROOT + "chat/?text=" + encodeURIComponent(text)) + '">ادامه در چت</a>';
        tryNote.dataset.touched = "1";
      }
    } catch (e) {
      if (caret) caret.remove();
      setLang(["خطا", "درخواست به سرویس نرسید"], false);
      if (tryNote) tryNote.textContent = "سرویس در دسترس نیست.";
    } finally {
      tryBtn.removeAttribute("aria-disabled");
    }
  }
  if (tryForm) tryForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = (tryIn.value || "").trim();
    if (!t) { tryIn.focus(); return; }
    tryLive(t);
  });
  if (dText) {
    chips.forEach(function (c) { c.addEventListener("click", function () { auto = false; play(+c.dataset.demo); }); });
    var started = false, start = function () { if (!started) { started = true; play(0); } };
    if ("IntersectionObserver" in window) {
      var dio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { start(); dio.disconnect(); } });
      dio.observe(dText);
    } else start();
    document.addEventListener("visibilitychange", function () { if (document.hidden) auto = false; });
  }

  /* ---------- API docs: TOC highlight ---------- */
  var toc = $("[data-toc]");
  if (toc && "IntersectionObserver" in window) {
    var links = $$('a[href^="#"]', toc), map = {};
    links.forEach(function (a) { var t = document.getElementById(a.getAttribute("href").slice(1)); if (t) map[t.id] = a; });
    var tio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("active"); });
        var a = map[e.target.id]; if (a) { a.classList.add("active"); if (window.innerWidth <= 960) a.scrollIntoView({ block: "nearest", inline: "center" }); }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    Object.keys(map).forEach(function (id) { tio.observe(document.getElementById(id)); });
    links.forEach(function (a) {
      a.addEventListener("click", function () {
        var t = document.getElementById(a.getAttribute("href").slice(1));
        if (t && t.tagName === "DETAILS") { setEp(t, true, true); flash(t); }
      });
    });
  }

  /* ---------- API docs: sliding accordion (open AND close animate) ---------- */
  var EASE = "cubic-bezier(.22, 1, .36, 1)";
  var LINK_IC = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  var eps = $$("details.ep");
  function flash(d) { d.classList.remove("flash"); void d.offsetWidth; d.classList.add("flash"); setTimeout(function () { d.classList.remove("flash"); }, 1500); }
  function syncTools() {
    var n = eps.filter(function (d) { return d.classList.contains("is-open"); }).length;
    var c = $("[data-ep-count]"); if (c) c.textContent = fa(n) + " / " + fa(eps.length) + " باز";
  }
  function setEp(d, open, instant) {
    var body = $(".ep-body", d);
    if (d.classList.contains("is-open") === open && !d._anim) { d.open = open; return; }
    var from = d.open ? body.getBoundingClientRect().height : 0;
    if (d._anim) { d._anim.cancel(); d._anim = null; }
    d.classList.toggle("is-open", open);
    syncTools();
    if (open && d.id && !instant) try { history.replaceState(null, "", "#" + d.id); } catch (e) {}
    if (instant || REDUCED || !body || !body.animate) { d.open = open; d.classList.remove("animating"); return; }
    d.classList.add("animating");
    d.open = true;
    var to = open ? body.getBoundingClientRect().height : 0;
    if (open && from === 0) {
      // children slide down a touch and fade in, one after another
      Array.prototype.forEach.call(body.children, function (c, i) {
        c.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }],
          { duration: 420, delay: 60 + i * 45, easing: EASE, fill: "backwards" });
      });
    }
    var a = body.animate([{ height: from + "px", opacity: open ? (from ? 1 : .2) : 1 }, { height: to + "px", opacity: open ? 1 : 0 }],
      { duration: open ? 440 : 300, easing: open ? EASE : "cubic-bezier(.4, 0, .2, 1)" });
    d._anim = a;
    a.onfinish = function () {
      d._anim = null; d.classList.remove("animating");
      if (!open) d.open = false;
    };
  }
  eps.forEach(function (d) {
    d.classList.add("acc");
    if (d.open) d.classList.add("is-open");
    var sum = $("summary", d);
    if (!sum) return;
    var link = document.createElement("button");
    link.type = "button"; link.className = "ep-link"; link.innerHTML = LINK_IC;
    link.setAttribute("aria-label", "کپی لینک این مسیر"); link.title = "کپی لینک";
    var chev = $(".chev", sum); sum.insertBefore(link, chev || null);
    link.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      copy(location.href.replace(/#.*$/, "") + "#" + d.id);
    });
    sum.addEventListener("click", function (e) { e.preventDefault(); setEp(d, !d.classList.contains("is-open")); });
  });
  syncTools();
  $$("[data-ep-all]").forEach(function (b) {
    b.addEventListener("click", function () {
      var open = b.getAttribute("data-ep-all") === "open";
      eps.forEach(function (d) { if (!d.hidden) setEp(d, open, false); });
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    });
  });
  function openFromHash(instant) {
    if (!location.hash) return;
    var h = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (h && h.tagName === "DETAILS") { setEp(h, true, instant); flash(h); }
  }
  openFromHash(true);
  window.addEventListener("hashchange", function () { openFromHash(false); });

  /* ---------- API docs: endpoint search ("/" focuses it) ---------- */
  var tocFilter = $("[data-toc-filter]");
  if (toc && tocFilter) {
    var tocLinks = $$("a[href^='#']", toc), heads = $$("h4", toc), empty = $("[data-toc-empty]", toc);
    var norm = function (x) { return String(x || "").toLowerCase().replace(/\s+/g, " ").trim(); };
    var applyFilter = function () {
      var q = norm(tocFilter.value), shown = 0;
      tocLinks.forEach(function (a) {
        var hit = !q || norm(a.textContent + " " + a.getAttribute("href")).indexOf(q) >= 0;
        a.hidden = !hit; if (hit) shown++;
      });
      heads.forEach(function (h4) {
        var n = h4.nextElementSibling, any = false;
        while (n && n.tagName !== "H4") { if (n.tagName === "A" && !n.hidden) any = true; n = n.nextElementSibling; }
        h4.hidden = !any;
      });
      if (empty) empty.hidden = shown > 0;
    };
    tocFilter.addEventListener("input", applyFilter);
    tocFilter.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var first = tocLinks.filter(function (a) { return !a.hidden; })[0];
        if (first) { first.click(); location.hash = first.getAttribute("href"); tocFilter.blur(); }
      } else if (e.key === "Escape") { tocFilter.value = ""; applyFilter(); tocFilter.blur(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = (document.activeElement && document.activeElement.tagName || "").toLowerCase();
      if (t === "input" || t === "textarea" || t === "select") return;
      e.preventDefault(); tocFilter.focus(); tocFilter.select();
    });
  }

  /* ---------- API console ---------- */
  var dataEl = $("#ep-data"), sel = $("[data-con-ep]");
  if (dataEl && sel) {
    var EPS = JSON.parse(dataEl.textContent);
    var body = $("[data-con-body]"), keyIn = $("[data-con-key]"), sendBtn = $("[data-con-send]");
    var resp = $("[data-con-resp]"), out = $("[data-con-out]"), stEl = $("[data-con-status]"), tmEl = $("[data-con-time]"), urlEl = $("[data-con-url]");
    var hdrEl = $("[data-con-headers]"), curlBtn = $("[data-con-curl]");
    try { keyIn.value = sessionStorage.getItem("guard_key") || ""; } catch (e) {}
    var fill = function () {
      var ep = EPS[+sel.value];
      body.value = ep.m === "POST" ? JSON.stringify(ep.b || {}, null, 2) : "";
      body.disabled = ep.m !== "POST";
      body.placeholder = ep.m === "POST" ? "" : "GET: بدنه ندارد";
    };
    sel.addEventListener("change", fill); fill();
    var hlJson = function (s) {
      return esc(s)
        .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)/g, '<span class="tok-p">$1</span>$2')
        .replace(/(:\s*|\[\s*|,\s*|^\s+)(&quot;(?:[^&]|&(?!quot;))*?&quot;)/gm, '$1<span class="tok-s">$2</span>')
        .replace(/(:\s*)(-?\d+(?:\.\d+)?)/g, '$1<span class="tok-n">$2</span>')
        .replace(/(:\s*)(true|false|null)/g, '$1<span class="tok-k">$2</span>');
    };
    var send = function () {
      var ep = EPS[+sel.value];
      if (!live.url) { toast("سرویس فعلاً آنلاین نیست"); return; }
      var payload;
      if (ep.m === "POST") {
        try { payload = JSON.stringify(JSON.parse(body.value || "{}")); }
        catch (e) { toast("JSON نامعتبر است"); body.focus(); return; }
      }
      var headers = { "Content-Type": "application/json" };
      var key = keyIn.value.trim(); if (key) headers["X-API-Key"] = key;
      try { sessionStorage.setItem("guard_key", key); } catch (e) {}
      var url = live.url + ep.p, t0 = performance.now();
      sendBtn.setAttribute("aria-disabled", "true");
      resp.hidden = false; stEl.className = "status-code"; stEl.textContent = "…"; tmEl.textContent = ""; urlEl.textContent = ep.m + " " + ep.p; out.textContent = "";
      fetch(url, { method: ep.m, headers: headers, body: payload })
        .then(function (r) { return r.text().then(function (t) { return { r: r, t: t }; }); })
        .then(function (x) {
          stEl.textContent = x.r.status; stEl.className = "status-code " + (x.r.ok ? "ok" : "err");
          if (hdrEl) {
            var hs = [["X-Request-ID", "request id"], ["X-RateLimit-Remaining", "باقی‌مانده"], ["X-Process-Time", "سرور"], ["Retry-After", "صبر"]];
            hdrEl.innerHTML = hs.map(function (h) {
              var v = x.r.headers.get(h[0]);
              return v ? '<span class="hdr"><b>' + esc(h[1]) + '</b><span class="mono">' + esc(v) + "</span></span>" : "";
            }).join("");
          }
          tmEl.textContent = fa(Math.round(performance.now() - t0)) + " میلی‌ثانیه";
          var pretty = x.t; try { pretty = JSON.stringify(JSON.parse(x.t), null, 2); } catch (e) {}
          out.innerHTML = hlJson(pretty);
        })
        .catch(function (err) {
          stEl.textContent = "ERR"; stEl.className = "status-code err";
          out.textContent = "درخواست نرسید: " + (err && err.message ? err.message : "network error");
        })
        .then(function () { sendBtn.removeAttribute("aria-disabled"); });
    };
    sendBtn.addEventListener("click", send);
    // "copy as curl": the exact request the console would send
    if (curlBtn) curlBtn.addEventListener("click", function () {
      var ep = EPS[+sel.value], base = live.url || PLACEHOLDER, key = keyIn.value.trim();
      var q = function (v) { return "'" + String(v).replace(/'/g, "'\\''") + "'"; };
      var cmd = "curl" + (ep.m === "POST" ? " -X POST" : "") + " " + q(base + ep.p);
      if (key) cmd += " \\\n  -H " + q("X-API-Key: " + key);
      if (ep.m === "POST") {
        var b; try { b = JSON.stringify(JSON.parse(body.value || "{}")); } catch (e) { toast("JSON نامعتبر است"); return; }
        cmd += " \\\n  -H 'Content-Type: application/json' \\\n  -d " + q(b);
      }
      copy(cmd);
    });
    body.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send(); });
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-try]"); if (!b) return;
      var d = JSON.parse(b.getAttribute("data-try"));
      var idx = EPS.findIndex(function (x) { return x.m === d.m && x.p.split("?")[0] === d.p.split("?")[0]; });
      if (idx >= 0) { sel.value = String(idx); fill(); }
      document.getElementById("console").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
    });
  }

  /* ---------- 404 page ---------- */
  var nf = $("[data-404]");
  if (nf) {
    var path = location.pathname + location.search;
    var rootPath = ROOT.replace(location.origin, "");
    var rel = path.indexOf(rootPath) === 0 ? path.slice(rootPath.length) : path.replace(/^\//, "");
    var pEl = $("[data-404-path]"); if (pEl) pEl.textContent = "/" + rel;
    var low = rel.toLowerCase(), guess = null;
    var GUESS = [[/^(api\/)?v1|^api\/v1|^docs|^redoc|^openapi/, "service"], [/api|endpoint|doc|swagger/, "api/"],
                 [/chat|goftego|panel|talk/, "chat/"], [/how|work|process|farayand/, "how-it-works/"], [/about|darbare/, "about/"], [/priv|harim/, "privacy/"]];
    for (var g = 0; g < GUESS.length; g++) if (GUESS[g][0].test(low)) { guess = GUESS[g][1]; break; }
    var sug = $("[data-404-guess]");
    if (sug && guess) {
      var paint404 = function () {
        if (guess === "service") {
          var svc = "/" + (/^v1/.test(rel) ? "api/" + rel : rel);
          if (live.url) { sug.innerHTML = 'این مسیر مال سرویس زنده است: <a class="inline-code" target="_blank" rel="noopener" href="' + esc(live.url + svc) + '">' + esc(svc) + "</a>"; sug.hidden = false; }
          else { sug.textContent = "این مسیر روی سرویس زنده است که الان آفلاین است."; sug.hidden = false; }
        } else {
          sug.innerHTML = 'شاید دنبال <a class="inline-code" href="' + esc(ROOT + guess) + '">' + esc(guess) + "</a> بودی؟"; sug.hidden = false;
        }
      };
      paint404(); liveHooks.push(paint404);
    }
  }

  /* ---------- secret access dialog: type "muvixo" ---------- */
  var access = $("#access"), lastFocus = null;
  function openAccess() {
    if (!access) return;
    lastFocus = document.activeElement;
    access.classList.add("open"); access.setAttribute("aria-hidden", "false");
    loadStatus().then(function () {
      var s = $("[data-access-status]", access);
      if (s) s.textContent = live.url ? "سرویس " + (live.status === "online" ? "آنلاین است." : "در حال آماده‌سازی است.") : "لینک فعالی منتشر نشده است.";
    });
    var c = $("[data-access-close]", access); if (c) setTimeout(function () { c.focus(); }, 50);
  }
  function closeAccess() {
    if (!access || !access.classList.contains("open")) return;
    access.classList.remove("open"); access.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (access) {
    access.addEventListener("click", function (e) { if (e.target === access) closeAccess(); });
    $$("[data-access-close]", access).forEach(function (b) { b.addEventListener("click", closeAccess); });
  }
  function typing(el) {
    if (!el) return false;
    var t = (el.tagName || "").toLowerCase();
    return t === "input" || t === "textarea" || t === "select" || el.isContentEditable === true;
  }
  var SECRET = "muvixo", buf = "";
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" || e.key === "Esc") { closeAccess(); setMenu(false); return; }
    if (!e.key || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    if (typing(e.target) || typing(document.activeElement)) return;
    buf = (buf + e.key.toLowerCase()).slice(-SECRET.length);
    if (buf === SECRET) { buf = ""; openAccess(); }
  });
})();
