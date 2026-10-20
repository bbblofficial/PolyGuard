/* Unicollect — shared behaviour for the public site.
   theme toggle · mobile drawer · self-playing demo (home) · secret
   service-access dialog (type "muvixo") · copy-to-clipboard. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var THEME_KEY = "unicollect_theme";

  function scriptBase() {
    var s = document.currentScript;
    if (!s) { var all = document.getElementsByTagName("script"); s = all[all.length - 1]; }
    if (!s || !s.src) return "";
    return s.src.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
  }
  var BASE = scriptBase();

  function fa(n) { return String(n).replace(/[0-9]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, REDUCED ? 0 : ms); }); }

  /* ---------- theme (same key + logic as Unicollect Chat) ---------- */
  function setThemeColor() {
    var dark = document.documentElement.classList.contains("dark");
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute("content", dark ? "#212121" : "#ffffff"); });
  }
  var themeBtn = $("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var dark = !document.documentElement.classList.contains("dark");
      document.documentElement.classList.toggle("dark", dark);
      try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (e) {}
      setThemeColor();
    });
  }
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var onChange = function () {
      var saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
      if (saved) return;
      document.documentElement.classList.toggle("dark", !mq.matches);
      setThemeColor();
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange);
  }
  setThemeColor();

  /* ---------- mobile drawer ---------- */
  var menuButton = document.querySelector(".site-menu-toggle");
  var nav = $("site-nav");
  function setMenu(open) {
    if (!nav || !menuButton) return;
    nav.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    menuButton.setAttribute("aria-label", open ? "بستن منو" : "باز کردن منو");
    document.body.classList.toggle("menu-open", open);
  }
  if (menuButton && nav) {
    menuButton.addEventListener("click", function (e) { e.stopPropagation(); setMenu(!nav.classList.contains("is-open")); });
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-menu-close]") || (nav.classList.contains("is-open") && e.target.closest(".sb-item"))) setMenu(false);
    });
    window.addEventListener("resize", function () { if (window.innerWidth >= 768 && nav.classList.contains("is-open")) setMenu(false); });
  }

  /* ---------- in-page anchors scroll the inner .scroll pane ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var t = document.querySelector(a.getAttribute("href"));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); }
  });

  /* ---------- self-playing demo (home only) ---------- */
  var MODELS = ["فارسی", "پرو", "سریع", "گسترده", "انگلیسی"];
  var VERDICT = {
    safe:    { title: "ایمن",  sub: "لحن محترمانه است؛ می‌توانی بفرستی.", ico: '<path d="M20 6 9 17l-5-5"/>' },
    suspect: { title: "مشکوک", sub: "توهین مستقیم نیست، ولی ممکن است تند خوانده شود.", ico: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>' },
    toxic:   { title: "سمی",   sub: "شامل توهین مستقیم است؛ بهتر است بازنویسی شود.", ico: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>' }
  };
  var EXAMPLES = [
    { text: "میشه لطفاً فردا ساعت ۵ وقت بذاریم صحبت کنیم؟", lang: "فارسی", tone: "safe", score: 4, models: [3, 6, 4, 7, 2] },
    { text: "اصلاً حواست به کارت هست یا نه؟ این دومین باره.", lang: "فارسی", tone: "suspect", score: 52, models: [61, 48, 55, 44, 39] },
    { text: "خیلی احمقی، دیگه هیچ‌وقت بهم پیام نده.", lang: "فارسی", tone: "toxic", score: 94, models: [97, 93, 95, 88, 81] },
    { text: "salam, mamnoon az komaket, kheili lotf kardi", lang: "فینگیلیش", tone: "safe", score: 3, models: [2, 4, 3, 5, 6] }
  ];
  var MARK = (function () {
    var d = "M12 1.5c1.9 0 2.6 2.1 1.9 4.1l-.9 2.5c-.35.95-1.65.95-2 0l-.9-2.5C9.4 3.6 10.1 1.5 12 1.5z", p = "";
    for (var k = 0; k < 6; k++) p += '<g transform="rotate(' + (k * 60) + ' 12 12)"><path class="pt" style="--k:' + k + '" d="' + d + '"/></g>';
    return function (mode) { return '<svg class="pg-mark ' + (mode || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + p + '<circle class="core" cx="12" cy="12" r="2.1"/></svg>'; };
  })();

  var thread = $("demo-thread"), input = $("demo-input"), send = $("demo-send");
  var chips = document.querySelectorAll("[data-demo]");
  var run = 0, autoplay = true;

  function verdictHTML(ex) {
    var v = VERDICT[ex.tone], bars = "";
    ex.models.forEach(function (w, n) {
      bars += '<div class="v-model"><span>' + MODELS[n] + '</span><div class="v-bar"><i style="--w:' + w + '%;--n:' + n + '"></i></div></div>';
    });
    return '<div class="verdict ' + ex.tone + '">' +
      '<div class="v-head"><span class="v-ico"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + v.ico + '</svg></span>' +
      '<div><div class="v-title">' + v.title + '</div><div class="v-sub">' + v.sub + '</div></div>' +
      '<span class="v-score">' + fa(ex.score) + '٪</span></div>' +
      '<div class="v-models">' + bars + '</div>' +
      '<div class="v-note">زبان: ' + ex.lang + ' · رأی اجماعی ۵ مدل</div></div>';
  }

  async function play(i) {
    if (!thread || !input) return;
    var me = ++run, ex = EXAMPLES[i];
    chips.forEach(function (c) { c.setAttribute("aria-pressed", String(+c.dataset.demo === i)); });
    thread.innerHTML = "";
    send.classList.remove("ready");
    // type into the composer
    input.innerHTML = '<span class="typed"></span><span class="caret"></span>';
    var typed = input.querySelector(".typed");
    var chars = Array.from(ex.text);
    for (var c = 0; c < chars.length; c++) {
      if (me !== run) return;
      typed.textContent += chars[c];
      if (c === 0) send.classList.add("ready");
      await sleep(chars[c] === " " ? 40 : 28);
    }
    await sleep(320); if (me !== run) return;
    send.classList.add("press"); await sleep(140); send.classList.remove("press", "ready");
    input.innerHTML = '<span class="ph">یک نمونه را از پایین انتخاب کن…</span>';
    // user bubble
    var u = document.createElement("div");
    u.className = "msg user in";
    u.innerHTML = '<div class="bubble">' + esc(ex.text) + "</div>";
    thread.appendChild(u);
    await sleep(260); if (me !== run) return;
    // thinking
    var b = document.createElement("div");
    b.className = "msg bot in";
    b.innerHTML = '<span class="bot-avatar">' + MARK() + '</span><div class="bot-text"><span class="thinking">' + MARK("live") + '<span class="shimmer">در حال رأی‌گیری بین مدل‌ها…</span></span></div>';
    thread.appendChild(b);
    await sleep(1300); if (me !== run) return;
    b.querySelector(".bot-text").innerHTML = verdictHTML(ex);
    if (autoplay) { await sleep(3600); if (me !== run || !autoplay) return; play((i + 1) % EXAMPLES.length); }
  }
  if (thread) {
    chips.forEach(function (c) { c.addEventListener("click", function () { autoplay = false; play(+c.dataset.demo); }); });
    // start once it's visible; pause the loop while the tab is hidden
    setTimeout(function () { play(0); }, REDUCED ? 0 : 700);
    document.addEventListener("visibilitychange", function () { if (document.hidden) autoplay = false; });
  }

  /* ---------- secret access dialog (type "muvixo") ---------- */
  var access = $("access");
  var currentUrl = "", currentChatUrl = "";

  function decodePayload(value) {
    if (!value) return "";
    try { return decodeURIComponent(escape(window.atob(value))); }
    catch (e) { try { return window.atob(value); } catch (e2) { return ""; } }
  }
  function setDot(id, cls) { var d = $(id); if (d) d.className = "sdot " + cls; }

  function applyLink(urlEl, statusEl, openEl, dotId, url, status, offlineMsg) {
    if (!urlEl || !statusEl || !openEl) return "";
    if (!url) {
      urlEl.textContent = offlineMsg;
      ["href", "target", "rel"].forEach(function (a) { urlEl.removeAttribute(a); openEl.removeAttribute(a); });
      openEl.setAttribute("aria-disabled", "true");
      statusEl.textContent = "لینک فعالی منتشر نشده است.";
      setDot(dotId, "bad");
      return "";
    }
    urlEl.textContent = url;
    [urlEl, openEl].forEach(function (el) {
      el.setAttribute("href", url); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer");
    });
    openEl.removeAttribute("aria-disabled");
    var online = status === "online";
    statusEl.textContent = online ? "سرویس آماده استفاده است." : "در حال آماده‌سازی سرویس…";
    setDot(dotId, online ? "ok" : "warn");
    return url;
  }
  function markUnavailable(urlEl, statusEl, openEl, dotId, msg) {
    if (!urlEl || !statusEl || !openEl) return;
    urlEl.textContent = msg;
    ["href", "target", "rel"].forEach(function (a) { urlEl.removeAttribute(a); openEl.removeAttribute(a); });
    openEl.setAttribute("aria-disabled", "true");
    statusEl.textContent = "چند لحظه بعد دوباره امتحان کن.";
    setDot(dotId, "bad");
  }
  function loadStatus() {
    var u = $("service-url"), s = $("access-status"), o = $("open-service");
    var cu = $("chat-service-url"), cs = $("chat-access-status"), co = $("open-chat-service");
    if (!u || !s || !o) return;
    fetch(BASE + "status.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        currentUrl = applyLink(u, s, o, "access-dot", decodePayload(d && d.url_payload), d && d.status, "سرویس فعلاً آنلاین نیست");
        currentChatUrl = applyLink(cu, cs, co, "chat-access-dot", decodePayload(d && d.chat_url_payload), d && d.chat_status, "سرویس چت فعلاً آنلاین نیست");
      })
      .catch(function () {
        markUnavailable(u, s, o, "access-dot", "وضعیت فعلاً در دسترس نیست");
        markUnavailable(cu, cs, co, "chat-access-dot", "وضعیت فعلاً در دسترس نیست");
      });
  }
  var lastFocus = null;
  function openAccess() {
    if (!access) return;
    lastFocus = document.activeElement;
    access.classList.add("open");
    access.setAttribute("aria-hidden", "false");
    loadStatus();
    var c = $("close-access"); if (c) setTimeout(function () { c.focus(); }, 50);
  }
  function closeAccess() {
    if (!access || !access.classList.contains("open")) return;
    access.classList.remove("open");
    access.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (access) {
    access.addEventListener("click", function (e) { if (e.target === access) closeAccess(); });
    var cb = $("close-access"); if (cb) cb.addEventListener("click", closeAccess);
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
  }
  var SECRET = "muvixo", typed = "";
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" || e.key === "Esc") { closeAccess(); setMenu(false); return; }
    if (!e.key || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
    typed = (typed + e.key.toLowerCase()).slice(-SECRET.length);
    if (typed === SECRET) { typed = ""; openAccess(); }
  });

  /* ---------- clipboard ---------- */
  function copyToClipboard(text) {
    var toast = $("toast");
    function done() {
      if (!toast) return;
      toast.classList.add("show");
      setTimeout(function () { toast.classList.remove("show"); }, 1400);
    }
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, done); return; }
    var area = document.createElement("textarea");
    area.value = text; area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(area); area.select();
    try { document.execCommand("copy"); } catch (e) {}
    area.remove(); done();
  }
  var cp = $("copy-service"); if (cp) cp.addEventListener("click", function () { if (currentUrl) copyToClipboard(currentUrl); });
  var ccp = $("copy-chat-service"); if (ccp) ccp.addEventListener("click", function () { if (currentChatUrl) copyToClipboard(currentChatUrl); });
})();
