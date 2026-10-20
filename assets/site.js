/* Unicollect Guard: public site behaviour
   theme · drawer · live links (api/links.json) · stamp demo · API docs
   (tabs, copy, TOC, console) · secret "muvixo" access dialog. */
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
  var SERVED_BY_SERVICE = location.pathname.indexOf("/site/") === 0;

  function fa(n) { return String(n).replace(/[0-9]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, REDUCED ? 0 : ms); }); }

  /* ---------- theme ---------- */
  function paintThemeColor() {
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute("content", document.documentElement.classList.contains("dark") ? "#120c2a" : "#f7f3f8");
  }
  $$("[data-theme-toggle]").forEach(function (b) {
    b.addEventListener("click", function () {
      var dark = !document.documentElement.classList.contains("dark");
      document.documentElement.classList.toggle("dark", dark);
      try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (e) {}
      paintThemeColor();
    });
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onMq = function () {
      var saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
      if (!saved) { document.documentElement.classList.toggle("dark", mq.matches); paintThemeColor(); }
    };
    if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
  }
  paintThemeColor();

  /* ---------- header + drawer ---------- */
  var top = $("#top");
  function onScroll() { if (top) top.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  var drawer = $("#drawer"), opener = $("[data-menu-open]");
  function setMenu(open) {
    if (!drawer) return;
    drawer.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    if (opener) opener.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (opener) opener.addEventListener("click", function () { setMenu(true); });
  $$("[data-menu-close]").forEach(function (b) { b.addEventListener("click", function () { setMenu(false); }); });
  if (drawer) $$("a", drawer).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  window.addEventListener("resize", function () { if (window.innerWidth > 820) setMenu(false); });

  /* ---------- reveal on scroll ---------- */
  document.documentElement.classList.add("js");
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !REDUCED) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
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
    var pages = SERVED_BY_SERVICE ? "https://USER.github.io/REPO/" : ROOT;
    $$("[data-pages-url]").forEach(function (s) { s.textContent = pages; });
    $$("[data-pages-url-js]").forEach(function (s) {
      var tail = /links\.json/.test(s.textContent) ? "api/links.json" : "";
      s.textContent = '"' + pages + tail + '"';
    });
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
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(url + "/health", { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(t); return r.ok ? r.json() : null; })
      .catch(function () { clearTimeout(t); return null; });
  }
  function applyStatus() {
    paintLinks();
    if (!live.url) { setDots(live.status === "starting" ? "warn" : "bad", live.status === "starting" ? "در حال راه‌اندازی" : "آفلاین"); return; }
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

  /* ---------- stamp demo (home) ---------- */
  var MODELS = ["فارسی", "پرو", "سریع", "گسترده", "انگلیسی"];
  var WORD = { safe: "ایمن", suspect: "مشکوک", toxic: "سمی" };
  var COLOR = { safe: "var(--safe)", suspect: "var(--suspect)", toxic: "var(--toxic)" };
  var EX = [
    { t: "میشه لطفاً فردا ساعت ۵ وقت بذاریم صحبت کنیم؟", lang: "فارسی", v: "safe", s: 4, m: [3, 6, 4, 7, null] },
    { t: "اصلاً حواست به کارت هست یا نه؟ این دومین باره.", lang: "فارسی", v: "suspect", s: 61, m: [61, 48, 35, 22, null] },
    { t: "خیلی احمقی، دیگه هیچ‌وقت بهم پیام نده.", lang: "فارسی", v: "toxic", s: 96, m: [97, 93, 95, 88, null] },
    { t: "salam, mamnoon az komaket, kheili lotf kardi", lang: "فینگیلیش → سلام، ممنون از کمکت…", v: "safe", s: 3, m: [2, 4, 3, 5, 6] },
    { t: "khafe sho ahmagh", lang: "فینگیلیش → خفه شو احمق", v: "toxic", s: 91, m: [94, 89, 77, 41, 70] }
  ];
  var dText = $("[data-demo-text]"), dLang = $("[data-demo-lang]"), dVoters = $("[data-demo-voters]"), dStamp = $("[data-demo-stamp]");
  var chips = $$("[data-demo]"), runId = 0, auto = true;

  if (dVoters) dVoters.innerHTML = MODELS.map(function (n, i) {
    return '<div class="voter"><div class="meter"><i style="--n:' + i + '"></i><span></span></div>' + n + "</div>";
  }).join("");

  function setVoters(ex) {
    $$(".voter", dVoters).forEach(function (v, i) {
      var val = ex ? ex.m[i] : null, bar = $("i", v), lab = $("span", v);
      bar.style.setProperty("--h", val == null ? "0%" : Math.max(4, val) + "%");
      bar.style.setProperty("--c", val == null ? "var(--text-3)" : val >= 50 ? COLOR.toxic : val >= 30 ? COLOR.suspect : COLOR.safe);
      lab.textContent = !ex ? "" : val == null ? "—" : fa(val);
      lab.style.color = val != null && val >= 40 ? "#fff" : "";
      v.style.opacity = ex && val == null ? ".45" : "1";
    });
  }
  async function play(i) {
    if (!dText) return;
    var me = ++runId, ex = EX[i];
    chips.forEach(function (c) { c.setAttribute("aria-pressed", String(+c.dataset.demo === i)); });
    dStamp.className = "stamp"; setVoters(null);
    dLang.textContent = "متن";
    dText.innerHTML = '<span class="typed"></span><span class="caret"></span>';
    var typed = $(".typed", dText), chars = Array.from(ex.t);
    dText.dir = /[a-z]/i.test(ex.t) ? "ltr" : "rtl";
    for (var c = 0; c < chars.length; c++) {
      if (me !== runId) return;
      typed.textContent += chars[c];
      await wait(chars[c] === " " ? 38 : 26);
    }
    await wait(250); if (me !== runId) return;
    var caret = $(".caret", dText); if (caret) caret.remove();
    dLang.textContent = "زبان: " + ex.lang;
    setVoters(ex);
    await wait(900); if (me !== runId) return;
    $("[data-demo-verdict]").textContent = WORD[ex.v];
    $("[data-demo-score]").textContent = ex.s + "%";
    void dStamp.offsetWidth;
    dStamp.className = "stamp " + ex.v + " on";
    if (auto) { await wait(3200); if (me !== runId || !auto) return; play((i + 1) % EX.length); }
  }
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
        if (t && t.tagName === "DETAILS") t.open = true;
      });
    });
  }
  if (location.hash) { var h = document.getElementById(location.hash.slice(1)); if (h && h.tagName === "DETAILS") h.open = true; }

  /* ---------- API console ---------- */
  var dataEl = $("#ep-data"), sel = $("[data-con-ep]");
  if (dataEl && sel) {
    var EPS = JSON.parse(dataEl.textContent);
    var body = $("[data-con-body]"), keyIn = $("[data-con-key]"), sendBtn = $("[data-con-send]");
    var resp = $("[data-con-resp]"), out = $("[data-con-out]"), stEl = $("[data-con-status]"), tmEl = $("[data-con-time]"), urlEl = $("[data-con-url]");
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
    body.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send(); });
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-try]"); if (!b) return;
      var d = JSON.parse(b.getAttribute("data-try"));
      var idx = EPS.findIndex(function (x) { return x.m === d.m && x.p.split("?")[0] === d.p.split("?")[0]; });
      if (idx >= 0) { sel.value = String(idx); fill(); }
      document.getElementById("console").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
    });
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
