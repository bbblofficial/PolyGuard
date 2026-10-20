/* Unicollect - public site behaviour.
   theme · mobile menu · live service links · copy · code tabs
   demo · "muvixo" shortcut · docs scrollspy · API playground   */
(function () {
  'use strict';

  var root = document.documentElement;
  var THEME_KEY = 'unicollect_theme';
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  var STATUS_URL = new URL('status.json', SCRIPT_SRC).href;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var faNum = new Intl.NumberFormat('fa-IR');

  root.classList.remove('no-js');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------------- theme ---------------- */
  function storedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  function systemTheme() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#15111f' : '#f6f4fb');
    $$('.theme-toggle').forEach(function (b) {
      var label = t === 'dark' ? 'روشن کردن پوسته' : 'تاریک کردن پوسته';
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
      b.setAttribute('aria-pressed', String(t === 'dark'));
    });
  }
  applyTheme(storedTheme() || systemTheme());
  $$('.theme-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      applyTheme(next);
    });
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSys = function () { if (!storedTheme()) applyTheme(systemTheme()); };
    if (mq.addEventListener) mq.addEventListener('change', onSys); else if (mq.addListener) mq.addListener(onSys);
  }
  window.addEventListener('storage', function (e) { if (e.key === THEME_KEY) applyTheme(e.newValue || systemTheme()); });

  /* ---------------- toast ---------------- */
  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1800);
  }

  /* ---------------- copy ---------------- */
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).catch(fallback); else fallback();
    toast('کپی شد');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy], [data-copy-from]');
    if (!b) return;
    e.preventDefault();
    var text = b.getAttribute('data-copy');
    if (text == null) {
      var src = b.getAttribute('data-copy-from') === 'code'
        ? b.closest('.code').querySelector('[data-panel]:not([hidden]) pre, pre')
        : document.querySelector(b.getAttribute('data-copy-from'));
      text = src ? src.innerText.trim() : '';
    }
    if (text) copyText(text);
  });

  /* ---------------- mobile menu ---------------- */
  var header = $('.site-header'), burger = $('.burger');
  function setMenu(open) {
    if (!header || !burger) return;
    header.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'بستن منو' : 'باز کردن منو');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (burger) {
    burger.addEventListener('click', function () { setMenu(!header.classList.contains('menu-open')); });
    header.addEventListener('click', function (e) { if (e.target === header || e.target.closest('.nav a')) setMenu(false); });
    document.addEventListener('click', function (e) {
      if (header.classList.contains('menu-open') && !e.target.closest('.nav') && !e.target.closest('.burger')) setMenu(false);
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 860) setMenu(false); });
  }

  /* ---------------- code tabs ---------------- */
  $$('.code .tabs').forEach(function (tabs) {
    var code = tabs.closest('.code');
    tabs.addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (!tab) return;
      var lang = tab.getAttribute('data-tab');
      $$('.tab', tabs).forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
      $$('[data-panel]', code).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== lang; });
    });
  });

  /* ---------------- live service links ---------------- */
  var LINKS = [
    { name: 'پنل بررسی متن', hint: 'رابط کاربری Unicollect', path: '/' },
    { name: 'اطلاعات API', hint: 'نسخه، محدودیت‌ها و مسیرها', path: '/api/v1/info' },
    { name: 'Swagger UI', hint: 'مستندات تعاملی', path: '/docs' },
    { name: 'ReDoc', hint: 'مستندات خوانا', path: '/redoc' },
    { name: 'OpenAPI', hint: 'فایل JSON مشخصات', path: '/openapi.json' },
    { name: 'سلامت سرویس', hint: 'وضعیت مدل‌ها', path: '/health' },
    { name: 'مدل‌ها', hint: 'فهرست پنج مدل', path: '/api/v1/models' },
    { name: 'آمار', hint: 'زمان کار و شمارنده‌ها', path: '/api/v1/stats' }
  ];
  var ICON_OPEN = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
  var ICON_COPY = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>';
  var service = { state: 'loading', url: '' };

  function decodePayload(p) {
    if (!p) return '';
    try { var s = atob(p); try { return decodeURIComponent(s); } catch (e) { return s; } } catch (e) { return ''; }
  }
  function relTime(iso) {
    if (!iso) return '';
    var diff = (Date.parse(iso) - Date.now()) / 1000;
    if (isNaN(diff)) return '';
    var rtf = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' });
    var a = Math.abs(diff);
    if (a < 60) return rtf.format(Math.round(diff), 'second');
    if (a < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
  }
  function renderLinks() {
    var online = service.state === 'online';
    $$('[data-links]').forEach(function (ul) {
      ul.setAttribute('data-state', online ? 'online' : 'offline');
      ul.innerHTML = LINKS.map(function (l) {
        var full = online ? service.url + (l.path === '/' ? '/' : l.path) : '';
        return '<li class="link-row">' +
          '<div class="link-name">' + esc(l.name) + '<small>' + esc(l.hint) + '</small></div>' +
          '<div class="link-url" title="' + esc(full) + '">' + (online ? esc(full.replace(/^https?:\/\//, '')) : esc(l.path)) + '</div>' +
          '<div class="link-actions">' +
            '<a class="icon-btn" ' + (online ? 'href="' + esc(full) + '" target="_blank" rel="noopener"' : 'aria-disabled="true" tabindex="-1"') + ' aria-label="باز کردن ' + esc(l.name) + '">' + ICON_OPEN + '</a>' +
            '<button class="icon-btn" type="button" ' + (online ? 'data-copy="' + esc(full) + '"' : 'disabled') + ' aria-label="کپی لینک ' + esc(l.name) + '">' + ICON_COPY + '</button>' +
          '</div></li>';
      }).join('');
    });
    var labels = { online: 'آنلاین', preparing: 'در حال آماده‌سازی', offline: 'آفلاین', loading: 'در حال بررسی…' };
    $$('[data-status-pill]').forEach(function (p) {
      p.setAttribute('data-state', service.state === 'loading' ? 'preparing' : service.state);
      p.innerHTML = '<span class="dot"></span>' + labels[service.state];
    });
    $$('[data-status-meta]').forEach(function (m) {
      m.textContent = service.updated ? 'آخرین به‌روزرسانی ' + relTime(service.updated) : '';
    });
    $$('[data-base-url]').forEach(function (el) { el.textContent = online ? service.url : 'https://<your-tunnel>.trycloudflare.com'; });
    $$('[data-base-copy]').forEach(function (b) { if (online) b.setAttribute('data-copy', service.url); else b.removeAttribute('data-copy'); b.disabled = !online; });
    $$('[data-open-panel]').forEach(function (a) {
      if (online) { a.href = service.url + '/'; a.removeAttribute('aria-disabled'); a.target = '_blank'; a.rel = 'noopener'; }
      else { a.setAttribute('aria-disabled', 'true'); }
    });
    var urlField = $('#play-base');
    if (urlField && online && !urlField.dataset.touched) urlField.value = service.url;
  }
  function loadStatus() {
    if (!$('[data-links], [data-status-pill], [data-base-url], #play-base, [data-open-panel]')) return;
    fetch(STATUS_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var url = decodePayload(d.url_payload).replace(/\/+$/, '');
        service.updated = d.updated_at || '';
        if (d.status === 'online' && /^https:\/\//.test(url)) {
          service.state = 'online'; service.url = url; renderLinks();
          // confirm the tunnel really answers before trusting it
          var ctrl = window.AbortController ? new AbortController() : null;
          var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
          fetch(url + '/health', { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
            .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error(r.status); })
            .catch(function () { clearTimeout(timer); service.state = 'offline'; renderLinks(); });
        } else {
          service.state = (d.status === 'preparing' || d.status === 'starting') ? 'preparing' : 'offline';
          service.url = ''; renderLinks();
        }
      })
      .catch(function () { service.state = 'offline'; service.url = ''; renderLinks(); });
  }
  renderLinks();
  loadStatus();
  setInterval(function () { if (!document.hidden) loadStatus(); }, 60000);

  /* ---------------- "muvixo" shortcut -> links dialog ---------------- */
  var dialog = $('#access-dialog'), lastFocus = null;
  function openDialog() {
    if (!dialog) return;
    lastFocus = document.activeElement;
    dialog.classList.add('is-open'); dialog.setAttribute('aria-hidden', 'false');
    var c = $('.dialog-close', dialog); if (c) c.focus();
    loadStatus();
  }
  function closeDialog() {
    if (!dialog || !dialog.classList.contains('is-open')) return;
    dialog.classList.remove('is-open'); dialog.setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (dialog) {
    dialog.addEventListener('click', function (e) { if (e.target === dialog || e.target.closest('.dialog-close')) closeDialog(); });
    $$('[data-open-dialog]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); openDialog(); }); });
  }
  var typed = '';
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDialog(); setMenu(false); return; }
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!e.key || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === 'muvixo') { typed = ''; openDialog(); }
  });

  /* ---------------- home demo ---------------- */
  var demo = $('[data-demo]');
  if (demo) {
    var SAMPLES = [
      { text: 'سلام، وقت بخیر. از همکاری با شما واقعاً خوشحالم.', v: 'SAFE', fa: 'ایمن', s: [0.02, 0.01, 0.03, 0.01], votes: 0, ms: 212, lang: 'فارسی' },
      { text: 'in harfa chie mizani, kheyli bi mazeyi', v: 'SUSPECT', fa: 'مشکوک', s: [0.66, 0.31, 0.22, 0.08], votes: 1, ms: 388, lang: 'فینگلیش' },
      { text: 'You are completely stupid and useless', v: 'TOXIC', fa: 'سمی', s: [0.12, 0.94, 0.89, 0.81], votes: 3, ms: 247, lang: 'انگلیسی' }
    ];
    var input = $('[data-demo-input]', demo), stamp = $('[data-demo-stamp]', demo);
    var bars = $$('.bar i', demo), nums = $$('.bar-row b', demo), foot = $('[data-demo-foot]', demo), langEl = $('[data-demo-lang]', demo);
    var colorFor = function (x) { return x >= 0.5 ? 'var(--toxic)' : x >= 0.25 ? 'var(--suspect)' : 'var(--safe)'; };
    var idx = 0, timer = null;
    var show = function (smp) {
      stamp.classList.remove('is-wait');
      stamp.setAttribute('data-v', smp.v);
      $('.stamp-fa', stamp).textContent = smp.fa;
      $('.stamp-en', stamp).textContent = smp.v;
      stamp.classList.remove('is-in'); void stamp.offsetWidth; stamp.classList.add('is-in');
      bars.forEach(function (b, i) { b.style.width = Math.max(3, smp.s[i] * 100) + '%'; b.style.background = colorFor(smp.s[i]); });
      nums.forEach(function (n, i) { n.textContent = smp.s[i].toFixed(2); });
      foot.textContent = 'رأی‌ها ' + faNum.format(smp.votes) + ' از ' + faNum.format(4) + ' · ' + faNum.format(smp.ms) + ' میلی‌ثانیه';
      langEl.textContent = smp.lang;
    };
    var play = function () {
      var smp = SAMPLES[idx % SAMPLES.length]; idx++;
      bars.forEach(function (b) { b.style.width = '0%'; });
      langEl.textContent = smp.lang;
      stamp.classList.add('is-wait');
      if (reduceMotion) { input.textContent = smp.text; show(smp); timer = setTimeout(play, 4200); return; }
      input.innerHTML = '<span></span><i class="caret"></i>';
      var span = input.firstChild, i = 0, chars = Array.from(smp.text);
      var type = function () {
        if (i < chars.length) { span.textContent += chars[i++]; timer = setTimeout(type, 34); }
        else { timer = setTimeout(function () { show(smp); timer = setTimeout(play, 3600); }, 380); }
      };
      type();
    };
    document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else { clearTimeout(timer); play(); } });
    play();
  }

  /* ---------------- reveal on scroll ---------------- */
  var pending = $$('.reveal');
  var revealTick = false;
  function revealVisible() {
    revealTick = false;
    var limit = window.innerHeight * 0.94;
    pending = pending.filter(function (el) {
      if (reduceMotion || el.getBoundingClientRect().top < limit) { el.classList.add('is-in'); return false; }
      return true;
    });
    if (!pending.length) { window.removeEventListener('scroll', onRevealScroll); window.removeEventListener('resize', onRevealScroll); }
  }
  function onRevealScroll() { if (!revealTick) { revealTick = true; requestAnimationFrame(revealVisible); } }
  window.addEventListener('scroll', onRevealScroll, { passive: true });
  window.addEventListener('resize', onRevealScroll);
  revealVisible();

  /* ---------------- docs scrollspy ---------------- */
  var tocLinks = $$('.toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          tocLinks.forEach(function (a) { a.classList.remove('is-active'); });
          map[en.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
  }

  /* ---------------- API playground ---------------- */
  var pg = $('#playground');
  if (pg) {
    var ENDPOINTS = {
      'check': { m: 'POST', p: '/api/v1/check', b: { text: 'سلام، روز خوبی داشته باشی', detailed: true } },
      'batch': { m: 'POST', p: '/api/v1/check/batch', b: { texts: ['سلام دوست من', 'You are useless'], detailed: false } },
      'detect': { m: 'POST', p: '/api/v1/detect', b: { text: 'salam khoobi?' } },
      'fingilish': { m: 'POST', p: '/api/v1/fingilish', b: { text: 'merci ke komak kardi' } },
      'legacy': { m: 'POST', p: '/api/check', b: { text: 'Have a nice day' } },
      'health': { m: 'GET', p: '/health' },
      'info': { m: 'GET', p: '/api/v1/info' },
      'models': { m: 'GET', p: '/api/v1/models' },
      'thresholds': { m: 'GET', p: '/api/v1/thresholds' },
      'stats': { m: 'GET', p: '/api/v1/stats' }
    };
    var sel = $('#play-endpoint', pg), base = $('#play-base', pg), body = $('#play-body', pg);
    var out = $('#play-out', pg), stat = $('#play-status', pg), send = $('#play-send', pg), sig = $('#play-sig', pg);
    base.addEventListener('input', function () { base.dataset.touched = '1'; });
    var sync = function () {
      var ep = ENDPOINTS[sel.value];
      sig.textContent = ep.m + ' ' + ep.p;
      body.value = ep.b ? JSON.stringify(ep.b, null, 2) : '';
      body.disabled = !ep.b;
      body.placeholder = ep.b ? '' : 'این مسیر بدنه ندارد';
    };
    sel.addEventListener('change', sync); sync();
    var run = function () {
      var ep = ENDPOINTS[sel.value], url = (base.value || '').trim().replace(/\/+$/, '');
      if (!/^https?:\/\//.test(url)) { stat.className = 'http-status err'; stat.textContent = 'آدرس معتبر نیست'; out.textContent = 'آدرس پایه سرویس را وارد کن؛ مثلاً https://xxxx.trycloudflare.com'; return; }
      var opts = { method: ep.m, headers: { 'Accept': 'application/json' } };
      if (ep.b) {
        try { opts.body = JSON.stringify(JSON.parse(body.value)); } catch (e) { stat.className = 'http-status err'; stat.textContent = 'JSON نامعتبر'; out.textContent = String(e.message); return; }
        opts.headers['Content-Type'] = 'application/json';
      }
      send.disabled = true; stat.className = 'http-status'; stat.textContent = 'در حال ارسال…'; out.textContent = '';
      var t0 = performance.now();
      fetch(url + ep.p, opts)
        .then(function (r) {
          var ms = Math.round(performance.now() - t0);
          return r.text().then(function (txt) {
            stat.className = 'http-status ' + (r.ok ? 'ok' : 'err');
            stat.textContent = r.status + ' · ' + ms + 'ms';
            try { out.textContent = JSON.stringify(JSON.parse(txt), null, 2); } catch (e) { out.textContent = txt; }
          });
        })
        .catch(function (e) { stat.className = 'http-status err'; stat.textContent = 'خطای شبکه'; out.textContent = 'اتصال برقرار نشد. سرویس آنلاین است؟\n' + e; })
        .then(function () { send.disabled = false; });
    };
    send.addEventListener('click', run);
    body.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } });
  }
})();
