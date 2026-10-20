/* Unicollect panel: check text against /api/v1/check. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var THEME_KEY = 'unicollect_theme', HIST_KEY = 'unicollect_panel_history_v2', MAX = 20000;
  var fa = new Intl.NumberFormat('fa-IR');
  var VERDICT = {
    SAFE: { fa: 'ایمن', title: 'متن ایمن است', desc: 'هیچ سیگنال معناداری از قوانین رأی‌گیری عبور نکرد.' },
    SUSPECT: { fa: 'مشکوک', title: 'متن مشکوک است', desc: 'سیگنالی هست اما تأیید کافی ندارد. بهتر است انسانی بازبینی شود.' },
    TOXIC: { fa: 'سمی', title: 'متن سمی است', desc: 'چند مدل مستقل این متن را توهین‌آمیز یا سمی تشخیص دادند.' }
  };
  var SCRIPT = { fa: 'فارسی', en: 'لاتین', mixed: 'ترکیبی' };
  var ERR = {
    models_loading: ['مدل‌ها در حال بارگذاری‌اند', 'سرویس تازه راه افتاده. چند ثانیه دیگر دوباره امتحان کن.'],
    empty_text: ['متن خالی است', 'اول متنی بنویس.'],
    text_too_long: ['متن خیلی طولانی است', 'حداکثر ۲۰٬۰۰۰ نویسه مجاز است.'],
    no_models_applicable: ['مدلی قابل اجرا نبود', 'برای این متن هیچ مدلی اجرا نشد.'],
    network: ['اتصال برقرار نشد', 'سرور پاسخ نداد. اتصال اینترنت یا وضعیت سرویس را بررسی کن.'],
    timeout: ['زمان پاسخ تمام شد', 'سرور در زمان مقرر پاسخ نداد. دوباره امتحان کن.']
  };

  /* theme */
  function stored() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  function sys() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#15111f' : '#f6f4fb';
    $('theme').setAttribute('aria-label', t === 'dark' ? 'روشن کردن پوسته' : 'تاریک کردن پوسته');
    $('theme').setAttribute('aria-pressed', String(t === 'dark'));
  }
  applyTheme(stored() || sys());
  $('theme').addEventListener('click', function () {
    var n = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, n); } catch (e) {}
    applyTheme(n);
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var f = function () { if (!stored()) applyTheme(sys()); };
    if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f);
  }

  /* toast + copy */
  var tt;
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 1800); }
  function copy(text) {
    var done = function () { toast('کپی شد'); };
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fb); } else fb();
    function fb() { var a = document.createElement('textarea'); a.value = text; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); done(); }
  }

  /* health */
  function health() {
    var h = $('health');
    fetch('/health', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      var st = d.status === 'ok' ? 'ok' : d.status === 'loading' ? 'loading' : 'error';
      h.dataset.state = st;
      h.lastElementChild.textContent = st === 'ok' ? fa.format((d.loaded_models || []).length) + ' مدل آماده' : st === 'loading' ? 'در حال بارگذاری مدل‌ها' : 'خطا در مدل‌ها';
      h.title = st === 'ok' ? (d.loaded_models || []).join('، ') : '';
    }).catch(function () { h.dataset.state = 'down'; h.lastElementChild.textContent = 'سرور در دسترس نیست'; });
  }
  health();
  setInterval(function () { if (!document.hidden) health(); }, 15000);

  /* composer */
  var ta = $('text'), btn = $('check'), count = $('count');
  function updateCount() {
    var n = ta.value.length;
    count.textContent = fa.format(n) + ' / ' + fa.format(MAX);
    count.classList.toggle('warn', n > MAX * 0.95);
    btn.disabled = !ta.value.trim() || busy;
  }
  ta.addEventListener('input', updateCount);
  ta.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } });
  document.querySelectorAll('[data-sample]').forEach(function (b) { b.addEventListener('click', function () { ta.value = b.dataset.sample; updateCount(); ta.focus(); }); });
  $('clear').addEventListener('click', function () { ta.value = ''; updateCount(); setState('empty'); ta.focus(); });
  $('retry').addEventListener('click', function () { run(); });

  /* result */
  var res = $('result'), busy = false, last = null;
  function setState(s) { res.dataset.state = s; }
  function pct(x) { return fa.format(Math.round((x || 0) * 100)) + '٪'; }
  function color(x) { return x >= 0.5 ? 'var(--toxic)' : x >= 0.25 ? 'var(--suspect)' : 'var(--safe)'; }
  function showError(code, msg) {
    var e = ERR[code] || ['خطا', msg || 'خطای ناشناخته.'];
    $('err-title').textContent = e[0]; $('err-msg').textContent = e[1] + (ERR[code] ? '' : '');
    setState('error');
  }
  function render(d) {
    last = d;
    var v = VERDICT[d.decision] || VERDICT.SAFE, stamp = $('stamp');
    stamp.dataset.v = d.decision;
    $('stamp-fa').textContent = v.fa; $('stamp-en').textContent = d.decision;
    stamp.classList.remove('in'); void stamp.offsetWidth; stamp.classList.add('in');
    $('v-title').textContent = v.title; $('v-desc').textContent = v.desc;
    $('s-conf').textContent = pct(d.confidence);
    $('s-votes').textContent = fa.format(d.votes_count || 0) + ' از ' + fa.format(d.total_models || 0);
    $('s-script').textContent = d.fingilish_detected ? 'فینگلیش' : (SCRIPT[d.script] || d.script || '-');
    $('s-time').textContent = fa.format(d.latency_ms || 0) + ' ms';
    $('fing').hidden = !d.fingilish_detected;
    $('fing-text').textContent = d.fingilish_text || '';
    var ul = $('models'); ul.innerHTML = '';
    var scores = d.raw_scores || {}, labels = d.labels || {}, votes = d.votes || {};
    Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; }).forEach(function (k) {
      var li = document.createElement('li'), s = scores[k];
      li.innerHTML = '<span class="nm"></span><span class="track"><i></i></span><span class="sc"></span><span class="vote"></span>';
      li.querySelector('.nm').textContent = labels[k] || k;
      li.querySelector('.sc').textContent = s.toFixed(2);
      var vt = li.querySelector('.vote'); vt.textContent = votes[k] ? 'رأی سمی' : 'بدون رأی'; if (votes[k]) vt.classList.add('yes');
      var bar = li.querySelector('.track i'); bar.style.background = color(s);
      ul.appendChild(li);
      requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = Math.max(2, s * 100) + '%'; }); });
    });
    var sk = d.skipped_models || [];
    $('skipped').hidden = !sk.length;
    $('skipped').textContent = sk.length ? 'به‌خاطر زبان متن اجرا نشد: ' + sk.join('، ') : '';
    setState('done');
  }
  function run() {
    var text = ta.value;
    if (!text.trim() || busy) return;
    busy = true; updateCount(); setState('loading');
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 180000);
    fetch('/api/v1/check', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ text: text, detailed: true }), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok || x.d.error) {
          var e = x.d.error || {};
          if (Array.isArray(x.d.detail)) return showError('', 'درخواست نامعتبر بود.');
          return showError(e.code || '', e.message || (typeof e === 'string' ? e : ''));
        }
        if (!x.d.decision) return showError('', 'پاسخ کامل نبود.');
        render(x.d); addHistory(text, x.d);
      })
      .catch(function (e) { showError(e && e.name === 'AbortError' ? 'timeout' : 'network'); })
      .then(function () { clearTimeout(timer); busy = false; updateCount(); });
  }
  btn.addEventListener('click', run);
  $('copy-json').addEventListener('click', function () { if (last) copy(JSON.stringify(last, null, 2)); });
  $('dl-json').addEventListener('click', function () {
    if (!last) return;
    var blob = new Blob([JSON.stringify(last, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'unicollect-' + Date.now() + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  /* history (this browser only) */
  function loadHist() { try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (e) { return []; } }
  function saveHist(h) { try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 12))); } catch (e) {} }
  function rel(ts) {
    var d = (ts - Date.now()) / 1000, a = Math.abs(d), r = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' });
    return a < 60 ? 'همین الان' : a < 3600 ? r.format(Math.round(d / 60), 'minute') : a < 86400 ? r.format(Math.round(d / 3600), 'hour') : r.format(Math.round(d / 86400), 'day');
  }
  function drawHist() {
    var h = loadHist(), ul = $('history-list'); ul.innerHTML = '';
    $('history-empty').hidden = h.length > 0; $('clear-history').hidden = !h.length;
    h.forEach(function (it) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span class="pill"></span><span class="t"></span><time></time>';
      b.querySelector('.pill').textContent = (VERDICT[it.r.decision] || {}).fa || it.r.decision;
      b.querySelector('.pill').classList.add(it.r.decision);
      b.querySelector('.t').textContent = it.text;
      b.querySelector('time').textContent = rel(it.at);
      b.addEventListener('click', function () { ta.value = it.text; updateCount(); render(it.r); });
      li.appendChild(b); ul.appendChild(li);
    });
  }
  function addHistory(text, r) { var h = loadHist().filter(function (x) { return x.text !== text; }); h.unshift({ text: text.slice(0, 2000), r: r, at: Date.now() }); saveHist(h); drawHist(); }
  $('clear-history').addEventListener('click', function () { try { localStorage.removeItem(HIST_KEY); } catch (e) {} drawHist(); toast('تاریخچه پاک شد'); });
  drawHist(); updateCount();
})();
