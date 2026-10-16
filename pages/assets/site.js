/* Unicollect — shared behaviour for the marketing site. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function scriptBase() {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName("script");
      s = all[all.length - 1];
    }
    if (!s || !s.src) return "";
    return s.src.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
  }

  function decodePayload(value) {
    if (!value) return "";
    try { return decodeURIComponent(escape(window.atob(value))); }
    catch (e) { try { return window.atob(value); } catch (e2) { return ""; } }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" ||
           el.isContentEditable === true;
  }

  /* ---------- mobile drawer ---------- */

  var menuButton = document.querySelector(".site-menu-toggle");
  var nav = document.getElementById("site-nav");

  function setMenu(open) {
    if (!nav || !menuButton) return;
    nav.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    menuButton.setAttribute("aria-label", open ? "بستن منو" : "باز کردن منو");
    document.body.classList.toggle("menu-open", open);
  }

  if (menuButton && nav) {
    menuButton.addEventListener("click", function (e) {
      e.stopPropagation();
      setMenu(!nav.classList.contains("is-open"));
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a") || event.target.closest("[data-menu-close]")) {
        setMenu(false);
      }
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(event.target)) return;
      if (menuButton.contains(event.target)) return;
      setMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" || event.key === "Esc") setMenu(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 800 && nav.classList.contains("is-open")) setMenu(false);
    });
  }

  /* ---------- service status (secret panel) ---------- */

  var access = document.getElementById("access");
  var currentUrl = "";

  function loadStatus() {
    var urlEl = $("service-url");
    var statusEl = $("access-status");
    var openEl = $("open-service");
    if (!urlEl || !statusEl || !openEl) return;

    var endpoint = scriptBase() + "status.json?t=" + Date.now();

    fetch(endpoint, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        var url = decodePayload(data && data.url_payload);

        if (!url) {
          urlEl.textContent = "سرویس فعلاً آنلاین نیست";
          urlEl.removeAttribute("href");
          urlEl.removeAttribute("target");
          urlEl.removeAttribute("rel");
          openEl.removeAttribute("href");
          openEl.setAttribute("aria-disabled", "true");
          statusEl.textContent = "لینک فعالی منتشر نشده است.";
          return;
        }

        currentUrl = url;
        urlEl.textContent = url;
        urlEl.setAttribute("href", url);
        urlEl.setAttribute("target", "_blank");
        urlEl.setAttribute("rel", "noopener noreferrer");

        openEl.setAttribute("href", url);
        openEl.setAttribute("target", "_blank");
        openEl.setAttribute("rel", "noopener noreferrer");
        openEl.removeAttribute("aria-disabled");

        statusEl.textContent =
          data && data.status === "online"
            ? "سرویس آماده استفاده است."
            : "در حال آماده‌سازی سرویس…";
      })
      .catch(function () {
        urlEl.textContent = "وضعیت فعلاً در دسترس نیست";
        urlEl.removeAttribute("href");
        urlEl.removeAttribute("target");
        urlEl.removeAttribute("rel");
        openEl.removeAttribute("href");
        openEl.setAttribute("aria-disabled", "true");
        statusEl.textContent = "چند لحظه بعد دوباره امتحان کن.";
      });
  }

  /* ---------- secret reveal (type "muvixo") ---------- */

  var SECRET = "muvixo";
  var typed = "";

  function revealAccess() {
    if (!access) return;
    access.classList.add("open");
    if (typeof access.scrollIntoView === "function") {
      access.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    loadStatus();
  }

  document.addEventListener("keydown", function (event) {
    if (event.key.length !== 1) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return;

    typed = (typed + event.key.toLowerCase()).slice(-SECRET.length);
    if (typed === SECRET) { typed = ""; revealAccess(); }
  });

  var closeButton = $("close-access");
  if (closeButton) {
    closeButton.addEventListener("click", function () {
      access.classList.remove("open");
    });
  }

  var copyButton = $("copy-service");
  if (copyButton) {
    copyButton.addEventListener("click", function () {
      if (!currentUrl) return;
      var toast = $("toast");
      function done() {
        if (!toast) return;
        toast.classList.add("show");
        window.setTimeout(function () { toast.classList.remove("show"); }, 1400);
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(currentUrl).then(done, done);
        return;
      }
      var area = document.createElement("textarea");
      area.value = currentUrl;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      area.remove();
      done();
    });
  }
})();
