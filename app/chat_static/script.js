const STORAGE_KEY = 'unicollect_chat_threads_v1';
const UI_KEY = 'unicollect_chat_ui_v1';
const THEME_KEY = 'unicollect_theme';
const REQUEST_TIMEOUT_MS = 180000;
const HEALTH_TIMEOUT_MS = 8000;
const MAX_TEXT = 8000;
const MAX_HISTORY_TURNS = 16;
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const CAN_HOVER = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);

const state = {
  threads: [],
  activeThreadId: null,
  isAnalyzing: false,
  health: null,
  justAddedThreadId: null,
  ctrl: null,          // AbortController of the in-flight request
  userAborted: false
};

const $ = id => document.getElementById(id);

/* تبدیل ارقام لاتین به ارقام فارسی (۰-۹) */
function faDigits(v) {
  return String(v).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

/* ---------------- icons (inline SVG, no external dependency) ---------------- */
const ICONS = {
  sidebar:     '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
  edit:        '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  search:      '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  layers:      '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  check:       '<path d="M20 6 9 17l-5-5"/>',
  share:       '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
  sun:         '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon:        '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  plus:        '<path d="M5 12h14"/><path d="M12 5v14"/>',
  arrowup:     '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  smile:       '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
  globe:       '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  alert:       '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  x:           '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trash:       '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  copy:        '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  refresh:     '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  lang:        '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  info:        '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  msg:         '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'
};

function svg(name) {
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
function hydrateIcons(root) {
  (root || document).querySelectorAll('i[data-i]').forEach(el => {
    if (!el.firstChild) el.innerHTML = svg(el.dataset.i);
  });
}

/* ---------------- Unicollect brand mark ---------------- */
const PETAL_D = 'M12 1.5c1.9 0 2.6 2.1 1.9 4.1l-.9 2.5c-.35.95-1.65.95-2 0l-.9-2.5C9.4 3.6 10.1 1.5 12 1.5z';
const MARK_INNER = [0, 1, 2, 3, 4, 5].map(k =>
  `<g transform="rotate(${k * 60} 12 12)"><path class="pt" style="--k:${k}" d="${PETAL_D}"/></g>`
).join('') + '<circle class="core" cx="12" cy="12" r="2.1"/>';
function markSVG(mode) {
  return `<svg class="pg-mark${mode ? ' ' + mode : ''}" viewBox="0 0 24 24" aria-hidden="true">${MARK_INNER}</svg>`;
}
function hydrateMarks(root) {
  (root || document).querySelectorAll('i[data-mark]').forEach(el => {
    if (!el.firstChild) el.innerHTML = markSVG(el.dataset.mark);
  });
}

/* ---------------- init ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  hydrateIcons();
  hydrateMarks();
  loadState();
  applyUiPrefs();
  syncThemeIcon();
  renderSidebarThreads();
  renderActiveThread();
  initComposer();
  initSearch();
  checkHealth();
  setInterval(() => { if (!document.hidden) checkHealth(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkHealth(); });
  watchSystemTheme();
  // delegated handler: the copy button on rendered code blocks lives inside
  // sanitized markdown HTML, so it can't carry an inline onclick attribute
  // (DOMPurify strips on* attributes by design) - listen on the stream instead.
  $('chat-stream').addEventListener('click', e => {
    const btn = e.target.closest('.code-copy');
    if (btn) copyCodeBlock(btn);
  });
  if (CAN_HOVER) $('prompt-input').focus();
  document.addEventListener('keydown', onGlobalKey);
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('ready')));
});

function onGlobalKey(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    isOpen('search-modal') ? closeSearch() : openSearch();
    return;
  }
  if (e.key === 'Escape') {
    if (isOpen('search-modal')) return closeSearch();
    if (isOpen('settings-modal')) return closeSettingsModal();
    closeMobileSidebar();
  }
}

/* Repairs replies saved while the server had the charset bug (UTF-8 bytes
   read as Latin-1, e.g. "Ø³ÙØ§Ù" instead of "سلام"). Such text only contains
   code points <= U+00FF, so it can be turned back into the original bytes
   and decoded as UTF-8. Anything that doesn't look like that is untouched. */
const MOJIBAKE_RE = /[\u00C2-\u00C3\u00D8-\u00DB\u00E2\u00F0][\u0080-\u00BF]/;
function fixMojibake(s) {
  if (typeof s !== 'string' || !MOJIBAKE_RE.test(s)) return s;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0xFF) return s;
  const bytes = Uint8Array.from(s, ch => ch.charCodeAt(0));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (e) {
    // some frames were dropped by the old bug: recover what we can
    const out = new TextDecoder('utf-8').decode(bytes).replace(/\uFFFD/g, '');
    return /[\u0600-\u06FF]/.test(out) ? out : s;
  }
}
function repairThreads(threads) {
  let changed = false;
  threads.forEach(t => t.messages.forEach(m => {
    if (m && typeof m.reply === 'string') {
      const f = fixMojibake(m.reply);
      if (f !== m.reply) { m.reply = f; changed = true; }
    }
  }));
  return changed;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state.threads = Array.isArray(p.threads) ? p.threads.filter(t => t && t.id && Array.isArray(t.messages)) : [];
      if (repairThreads(state.threads)) saveState();
      state.activeThreadId = state.threads.some(t => t.id === p.activeThreadId) ? p.activeThreadId : null;
    }
  } catch (e) { console.warn(e); }
}

let saveTimer = 0;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ threads: state.threads, activeThreadId: state.activeThreadId }));
    } catch (e) {
      console.warn(e);
      showToast('حافظه مرورگر پر است؛ گفتگوهای قدیمی را پاک کنید');
    }
  }, 120);
}
window.addEventListener('pagehide', () => {
  clearTimeout(saveTimer);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ threads: state.threads, activeThreadId: state.activeThreadId })); } catch (e) {}
});

function applyUiPrefs() {
  try {
    const ui = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
    if (ui.collapsed && window.innerWidth >= 768) $('app').classList.add('collapsed');
  } catch (e) {}
}
function saveUiPrefs() {
  try { localStorage.setItem(UI_KEY, JSON.stringify({ collapsed: $('app').classList.contains('collapsed') })); } catch (e) {}
}

/* ---------------- health ---------------- */
let healthBusy = false;
async function checkHealth() {
  if (healthBusy) return;
  healthBusy = true;
  const dot = $('status-dot');
  const txt = $('status-text');
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  let cls, label;
  try {
    const r = await fetch('/health', { cache: 'no-store', signal: ctrl.signal });
    const d = await r.json();
    state.health = d;
    if (d.status === 'ok') { cls = 'sdot ok'; label = 'آنلاین'; }
    else if (d.status === 'loading') { cls = 'sdot warn'; label = 'در حال آماده‌سازی…'; }
    else { cls = 'sdot bad'; label = 'خطا در اتصال'; }
    if (isOpen('settings-modal')) renderHealthDetails(d);
  } catch (e) {
    cls = 'sdot bad'; label = 'سرور در دسترس نیست';
    state.health = { status: 'error', error: 'timeout/offline' };
    if (isOpen('settings-modal')) renderHealthDetails(state.health);
  } finally {
    clearTimeout(to);
    healthBusy = false;
  }
  if (dot.className !== cls) dot.className = cls;
  if (txt.textContent !== label) txt.textContent = label;
}
function renderHealthDetails(d) {
  const m = $('cfg-models');
  const nameEl = $('cfg-model');
  if (nameEl) nameEl.textContent = (d && d.model) || '—';
  if (!m) return;
  if (d && d.status === 'ok') {
    m.innerHTML = `<div class="ml"><span class="model-id">${escapeHtml(d.model || 'مدل گفتگو')}</span><span class="ok">● آماده</span></div>`;
  } else if (d && d.status === 'loading') {
    m.innerHTML = `<div class="ml"><span class="model-id">${escapeHtml(d.model || 'مدل گفتگو')}</span><span class="err">● در حال بارگذاری</span></div>`;
  } else {
    m.innerHTML = `<div class="ml"><span class="model-id">${escapeHtml((d && d.error) || 'سرویس در دسترس نیست')}</span><span class="err">● خطا</span></div>`;
  }
}

/* ---------------- sidebar ---------------- */
function isMobile() { return window.innerWidth < 768; }

function toggleSidebar() {
  const app = $('app');
  if (isMobile()) { app.classList.toggle('mobile-open'); return; }
  app.classList.toggle('collapsed');
  saveUiPrefs();
}
function closeMobileSidebar() { $('app').classList.remove('mobile-open'); }
window.addEventListener('resize', () => { if (!isMobile()) closeMobileSidebar(); }, { passive: true });

function busyToast() { showToast('صبر کنید تا پاسخ فعلی تمام شود'); }

function createNewThread() {
  if (state.isAnalyzing) return busyToast();
  state.activeThreadId = null;
  saveState();
  renderSidebarThreads();
  renderActiveThread();
  closeMobileSidebar();
  $('prompt-input').focus();
}

function selectThread(id) {
  if (state.isAnalyzing) return busyToast();
  closeMobileSidebar();
  if (id === state.activeThreadId) return;
  state.activeThreadId = id;
  saveState();
  renderSidebarThreads();
  renderActiveThread();
}

function deleteThread(event, id) {
  event.stopPropagation();
  if (state.isAnalyzing && id === state.activeThreadId) return busyToast();
  const row = event.target.closest('.thread');
  const finish = () => {
    state.threads = state.threads.filter(t => t.id !== id);
    if (state.activeThreadId === id) { state.activeThreadId = null; renderActiveThread(); }
    saveState();
    renderSidebarThreads();
    showToast('گفتگو حذف شد');
  };
  if (row && !REDUCED_MOTION) { row.classList.add('leaving'); setTimeout(finish, 180); }
  else finish();
}

function clearAllHistory() {
  if (state.isAnalyzing) return busyToast();
  if (!confirm('آیا تمام تاریخچه گفتگوها پاک شود؟')) return;
  state.threads = [];
  state.activeThreadId = null;
  saveState();
  renderSidebarThreads();
  renderActiveThread();
  closeSettingsModal();
  showToast('تاریخچه پاک شد');
}

function groupThreads(list) {
  const now = Date.now(), day = 86400000;
  const groups = { 'امروز': [], '۷ روز گذشته': [], 'قدیمی‌تر': [] };
  list.forEach(t => {
    const age = now - (t.updatedAt || t.createdAt || now);
    (age < day ? groups['امروز'] : age < day * 7 ? groups['۷ روز گذشته'] : groups['قدیمی‌تر']).push(t);
  });
  return groups;
}

function renderSidebarThreads() {
  const box = $('threads-list');
  const list = [...state.threads].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (!list.length) {
    box.innerHTML = `<div class="sb-empty">هنوز گفتگویی ثبت نشده است</div>`;
    return;
  }

  let html = '';
  for (const [label, items] of Object.entries(groupThreads(list))) {
    if (!items.length) continue;
    html += `<div class="sb-group-label">${label}</div>`;
    items.forEach(t => {
      const id = escapeHtml(t.id);
      const cls = ['thread', t.id === state.activeThreadId ? 'active' : '', t.id === state.justAddedThreadId ? 'entering' : ''].join(' ');
      const errored = t.messages.length && t.messages[t.messages.length - 1].error;
      html += `
        <div class="${cls}" role="button" tabindex="0" onclick="selectThread('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectThread('${id}')}">
          <div class="t-left"><span class="t-dot ${errored ? 'dot-err' : 'dot-ok'}"></span><span class="t-title" dir="auto">${escapeHtml(t.title || 'گفتگوی جدید')}</span></div>
          <button class="t-del" onclick="deleteThread(event,'${id}')" title="حذف" aria-label="حذف گفتگو">${svg('trash')}</button>
        </div>`;
    });
  }
  state.justAddedThreadId = null;
  box.innerHTML = html;
}

/* ---------------- search modal (Gemini-style) ---------------- */
const search = { sel: 0, items: [], raf: 0 };

function initSearch() {
  const inp = $('search-input');
  inp.addEventListener('input', () => {
    $('search-clear').classList.toggle('hidden-soft', !inp.value);
    if (search.raf) return;
    search.raf = requestAnimationFrame(() => { search.raf = 0; renderSearchResults(); });
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!search.items.length) return;
      const d = e.key === 'ArrowDown' ? 1 : -1;
      search.sel = (search.sel + d + search.items.length) % search.items.length;
      paintSearchSelection(true);
    } else if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      const it = search.items[search.sel];
      if (it) pickSearchResult(it.id);
    }
  });
}

function openSearch() {
  closeMobileSidebar();
  const inp = $('search-input');
  inp.value = '';
  $('search-clear').classList.add('hidden-soft');
  renderSearchResults();
  openModal('search-modal');
  inp.focus({ preventScroll: true });
  setTimeout(() => inp.focus({ preventScroll: true }), 30);
}
function closeSearch() { closeModal('search-modal'); }
function clearSearch() {
  const inp = $('search-input');
  inp.value = '';
  $('search-clear').classList.add('hidden-soft');
  renderSearchResults();
  inp.focus();
}

function snippetAround(text, q, span) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, span * 2);
  const start = Math.max(0, i - span);
  return (start > 0 ? '…' : '') + text.slice(start, i + q.length + span) + (i + q.length + span < text.length ? '…' : '');
}
function highlight(text, q) {
  if (!q) return escapeHtml(text);
  const lower = text.toLowerCase();
  let out = '', pos = 0, i;
  while ((i = lower.indexOf(q, pos)) !== -1) {
    out += escapeHtml(text.slice(pos, i)) + '<mark>' + escapeHtml(text.slice(i, i + q.length)) + '</mark>';
    pos = i + q.length;
  }
  return out + escapeHtml(text.slice(pos));
}
function relTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts, m = 60000, h = 60 * m, d = 24 * h;
  if (diff < m) return 'همین الان';
  if (diff < h) return `${faDigits(Math.floor(diff / m))} دقیقه پیش`;
  if (diff < d) return `${faDigits(Math.floor(diff / h))} ساعت پیش`;
  if (diff < 7 * d) return `${faDigits(Math.floor(diff / d))} روز پیش`;
  try { return new Date(ts).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }); } catch (e) { return ''; }
}

function renderSearchResults() {
  const q = $('search-input').value.toLowerCase().trim();
  const box = $('search-results');
  const label = $('search-label');
  const sorted = [...state.threads].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  let items;
  if (!q) {
    items = sorted.slice(0, 20).map(t => ({ t, snippet: t.messages?.[t.messages.length - 1]?.reply || t.messages?.[t.messages.length - 1]?.text || '' }));
    label.textContent = items.length ? 'گفتگوهای اخیر' : '';
  } else {
    items = [];
    for (const t of sorted) {
      const inTitle = (t.title || '').toLowerCase().includes(q);
      const hit = (t.messages || []).find(m => (m.text || '').toLowerCase().includes(q) || (m.reply || '').toLowerCase().includes(q));
      if (inTitle || hit) {
        const base = hit ? ((hit.text || '').toLowerCase().includes(q) ? hit.text : hit.reply) : (t.messages?.[0]?.text || '');
        items.push({ t, snippet: snippetAround(base, q, 40) });
      }
      if (items.length >= 50) break;
    }
    label.textContent = items.length ? `${items.length.toLocaleString('fa-IR')} نتیجه` : '';
  }

  search.items = items.map(x => x.t);
  search.sel = 0;

  if (!items.length) {
    box.innerHTML = `<div class="search-empty">${svg(q ? 'search' : 'msg')}<span>${q ? 'گفتگویی با این عبارت پیدا نشد' : 'هنوز گفتگویی ثبت نشده است'}</span></div>`;
    return;
  }

  box.innerHTML = items.map(({ t, snippet }, idx) => `
    <button class="search-item${t.id === state.activeThreadId ? ' current' : ''}" role="option" data-idx="${idx}" style="--i:${Math.min(idx, 10)}"
            onclick="pickSearchResult('${t.id}')" onmousemove="hoverSearch(${idx})">
      <span class="si-ico">${svg('msg')}</span>
      <span class="si-text">
        <span class="si-title" dir="auto">${highlight(t.title || 'گفتگوی جدید', q)}</span>
        <span class="si-snip" dir="auto">${highlight((snippet || '').replace(/\s+/g, ' '), q)}</span>
      </span>
      <span class="si-time">${relTime(t.updatedAt || t.createdAt)}</span>
    </button>`).join('');
  paintSearchSelection(false);
}
function hoverSearch(idx) {
  if (search.sel === idx) return;
  search.sel = idx;
  paintSearchSelection(false);
}
function paintSearchSelection(scroll) {
  const nodes = $('search-results').querySelectorAll('.search-item');
  nodes.forEach((n, i) => n.classList.toggle('sel', i === search.sel));
  if (scroll && nodes[search.sel]) nodes[search.sel].scrollIntoView({ block: 'nearest' });
}
function pickSearchResult(id) {
  closeSearch();
  if (state.isAnalyzing) { showToast('صبر کنید تا پاسخ فعلی تمام شود'); return; }
  selectThread(id);
}

/* ---------------- chat rendering ---------------- */
function setWelcome(on) {
  $('main').classList.toggle('welcome', on);
}

let streamToken = 0;

function renderActiveThread() {
  streamToken++;
  stopThinking();
  const stream = $('chat-stream');
  const thread = state.threads.find(t => t.id === state.activeThreadId);
  if (!thread || !thread.messages.length) {
    setWelcome(true);
    stream.innerHTML = '';
    return;
  }
  setWelcome(false);
  stream.innerHTML = thread.messages.map(m => buildTurnHTML(m)).join('');
  scrollToBottom(false);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/* ---------------- streaming text (Claude-like, fade only) ---------------- */
const SEGMENTER = (window.Intl && Intl.Segmenter) ? new Intl.Segmenter('fa', { granularity: 'word' }) : null;
function splitWords(text) {
  if (SEGMENTER) {
    const out = [];
    for (const { segment, isWordLike } of SEGMENTER.segment(text)) {
      if (isWordLike || !out.length) out.push(segment);
      else out[out.length - 1] += segment;
    }
    return out;
  }
  return text.match(/\S+\s*|\s+/g) || [text];
}

function streamText(el, text, opts, token) {
  if (!el) return Promise.resolve();
  if (REDUCED_MOTION || !text) { el.textContent = text || ''; return Promise.resolve(); }
  const o = Object.assign({ cps: 70, maxMs: 1600, dot: true }, opts || {});
  const cps = Math.max(o.cps, text.length / Math.max(0.1, o.maxMs / 1000));
  const parts = splitWords(text);
  return new Promise(resolve => {
    el.textContent = '';
    let dot = null;
    if (o.dot) { dot = document.createElement('span'); dot.className = 'stream-dot'; el.appendChild(dot); }
    let shown = 0, idx = 0, t0 = 0, lastPin = 0, finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      el.textContent = text;
      resolve();
    };
    const frame = now => {
      if (token !== streamToken || !el.isConnected) return done();
      if (!t0) t0 = now;
      const due = ((now - t0) / 1000) * cps;
      const frag = document.createDocumentFragment();
      while (idx < parts.length && shown < due) {
        const s = document.createElement('span');
        s.className = 'tw';
        s.textContent = parts[idx];
        frag.appendChild(s);
        shown += parts[idx].length;
        idx++;
      }
      if (frag.firstChild) {
        el.insertBefore(frag, dot);
        if (now - lastPin > 120) { keepPinned(); lastPin = now; }
      }
      if (idx >= parts.length) {
        if (dot) dot.classList.add('bye');
        setTimeout(done, 420);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/* ---------------- thinking indicator ---------------- */
const THINK_PHASES = ['در حال فکر کردن', 'در حال نوشتن پاسخ'];
const thinking = { phaseTimer: 0, clockTimer: 0, t0: 0, phaseIndex: 0, phaseDoneAt: 0 };

function startThinking() {
  stopThinking();
  thinking.t0 = performance.now();
  thinking.phaseIndex = 0;
  thinking.phaseDoneAt = 0;

  const label = () => $('think-text');

  const nextPhase = () => {
    const el = label();
    if (!el) return stopThinking();

    if (thinking.phaseIndex >= THINK_PHASES.length - 1) {
      thinking.phaseTimer = setTimeout(() => {
        thinking.phaseDoneAt = performance.now();
        thinking.phaseTimer = 0;
      }, 500 + Math.random() * 700);
      return;
    }

    thinking.phaseIndex += 1;
    const phase = THINK_PHASES[thinking.phaseIndex];

    if (REDUCED_MOTION) {
      el.textContent = phase;
    } else {
      el.classList.add('swap');
      setTimeout(() => {
        if (!el.isConnected) return;
        el.textContent = phase;
        el.classList.remove('swap');
      }, 200);
    }

    thinking.phaseTimer = setTimeout(nextPhase, 500 + Math.random() * 700);
  };

  thinking.phaseTimer = setTimeout(nextPhase, 500 + Math.random() * 700);

  thinking.clockTimer = setInterval(() => {
    const t = $('think-time');
    if (!t) return;
    const sec = Math.floor((performance.now() - thinking.t0) / 1000);
    const value = sec >= 2 ? `${faDigits(sec)} ثانیه` : '';
    if (t.textContent !== value) t.textContent = value;
  }, 250);
}

function stopThinking() {
  clearTimeout(thinking.phaseTimer);
  clearInterval(thinking.clockTimer);
  thinking.phaseTimer = 0;
  thinking.clockTimer = 0;
  thinking.phaseIndex = 0;
  thinking.phaseDoneAt = 0;
}

function replacePendingTurn(html) {
  const pending = $('pending-turn');
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  if (pending && pending.parentNode) pending.replaceWith(tpl.content);
  else $('chat-stream').appendChild(tpl.content);
}

// Shows an error turn (used when the stream never produced a single token).
// The text itself still streams in word by word, same as before.
async function revealErrorTurn(msg) {
  const token = ++streamToken;
  setWelcome(false);
  replacePendingTurn(buildTurnHTML(msg, { animate: true, fresh: true }));
  keepPinned(true);
  if (REDUCED_MOTION) return;
  await streamText($(`err-text-${msg.id}`), msg.error, { cps: 90, maxMs: 2200, dot: false }, token);
  keepPinned(true);
}

// Swap the pending turn's live-streamed DOM for the final, static markup
// (action buttons, final dir/font, etc). By the time this runs the text is
// already fully visible, so there is nothing left to animate - this just
// normalizes the DOM to match what a re-render of the thread would produce.
function finalizePendingTurn(msg) {
  replacePendingTurn(buildTurnHTML(msg, { fresh: true }));
}

function userTurnHTML(msg, noFade) {
  const id = escapeHtml(msg.id);
  const dir = textDir(msg.text || '');
  return `
    <div class="msg user${noFade ? '' : ' fade'}">
      <div class="ubox">
        <div class="bubble" dir="${dir}">${escapeHtml(msg.text)}</div>
        <div class="uacts">
          <button class="icon-btn" onclick="copyUserText('${id}')" title="کپی متن">${svg('copy')}</button>
          <button class="icon-btn" onclick="reSend('${id}')" title="ارسال مجدد">${svg('refresh')}</button>
        </div>
      </div>
    </div>`;
}

function buildTurnHTML(msg, opts) {
  const animate = !!(opts && opts.animate) && !REDUCED_MOTION;
  const user = userTurnHTML(msg, opts && opts.fresh);
  const mid = escapeHtml(msg.id);

  if (msg.error) {
    const errInner = animate
      ? `<span class="err-text" id="err-text-${mid}"></span>`
      : `<span class="err-text">${escapeHtml(msg.error)}</span>`;
    return `${user}
      <div class="msg bot fade" id="botmsg-${mid}"><div class="bbox">
        <div class="err-line">
          <span class="err-icon">${svg('alert')}</span>
          ${errInner}
        </div>
        <div class="actions">
          <button class="icon-btn" onclick="reSend('${mid}')" title="تلاش مجدد">${svg('refresh')}</button>
        </div>
      </div></div>`;
  }

  const bodyInner = animate
    ? `<span class="type-target bot-text" id="bot-text-${mid}"></span>`
    : `<div class="bot-text markdown-body" dir="${textDir(msg.reply || '')}">${renderMarkdown(msg.reply || '')}</div>`;

  return `${user}
    <div class="msg bot fade" id="botmsg-${mid}"><div class="bbox">
      ${bodyInner}
      <div class="actions">
        <button class="icon-btn" onclick="copyReply('${mid}')" title="کپی پاسخ">${svg('copy')}</button>
        <button class="icon-btn" onclick="reSend('${mid}')" title="ارسال مجدد">${svg('refresh')}</button>
      </div>
    </div></div>`;
}

/* ---------------- send ---------------- */
let msgSeq = 0;
function newId(prefix) { return `${prefix}_${Date.now().toString(36)}${(msgSeq++).toString(36)}`; }

function onSendClick() {
  if (state.isAnalyzing) return stopAnalysis();
  sendMessage();
}
function stopAnalysis() {
  if (!state.isAnalyzing) return;
  state.userAborted = true;
  streamToken++;
  if (state.ctrl) {
    try { state.ctrl.abort(); } catch (e) {}
  }
}

function setBusy(on) {
  state.isAnalyzing = on;
  const b = $('send-btn');
  b.classList.toggle('busy', on);
  b.title = on ? 'توقف' : 'ارسال';
  b.setAttribute('aria-label', b.title);
  composer.canSend = null;
  syncComposer();
}

function historyFor(thread) {
  const turns = thread.messages.filter(m => !m.error && m.reply);
  const flat = [];
  turns.slice(-MAX_HISTORY_TURNS).forEach(m => {
    flat.push({ role: 'user', content: m.text });
    flat.push({ role: 'assistant', content: m.reply });
  });
  return flat;
}

async function sendMessage(overrideText) {
  const input = $('prompt-input');
  const fromInput = typeof overrideText !== 'string';
  const text = (fromInput ? input.value : overrideText).trim();
  if (!text || state.isAnalyzing) return;
  if (text.length > MAX_TEXT) { showToast(`پیام طولانی است (حداکثر ${faDigits(MAX_TEXT)} نویسه)`); return; }

  const ctrl = new AbortController();
  state.ctrl = ctrl;
  state.userAborted = false;
  setBusy(true);
  if (fromInput) { input.value = ''; onComposerInput(true); }

  let thread = state.threads.find(t => t.id === state.activeThreadId);
  let createdThread = false;
  if (!thread) {
    const oneLine = text.replace(/\s+/g, ' ');
    thread = {
      id: newId('th'),
      title: oneLine.slice(0, 40) + (oneLine.length > 40 ? '…' : ''),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    state.threads.unshift(thread);
    state.activeThreadId = thread.id;
    state.justAddedThreadId = thread.id;
    createdThread = true;
    renderSidebarThreads();
  }

  const history = historyFor(thread);

  streamToken++;
  appendPendingTurn(text);

  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    let reply = '', error = null, gotAnyToken = false;

    try {
      const r = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: ctrl.signal
      });

      if (!r.ok || !r.body) {
        error = `پاسخ نامعتبر از سرور (HTTP ${r.status})`;
      } else {
        // Real token-by-token streaming: parse the `data: {...}\n\n` SSE
        // frames as they arrive and push each chunk to the DOM immediately
        // (see appendLiveToken) - this is the actual "live typing", not a
        // simulated reveal of an already-complete answer.
        const reader = r.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buf = '';
        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = frame.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') break outer;
            let obj = null;
            try { obj = JSON.parse(payload); } catch (e) { continue; }
            if (obj && typeof obj.t === 'string' && obj.t) {
              reply += obj.t;
              gotAnyToken = true;
              appendLiveToken(obj.t, reply);
            } else if (obj && obj.error) {
              error = obj.error;
              break outer;
            }
          }
        }
      }
    } catch (e) {
      if (state.userAborted) { error = null; }
      else if (!gotAnyToken) error = e.name === 'AbortError' ? 'زمان پاسخ‌گویی سرور تمام شد' : 'ارتباط با سرور برقرار نشد';
      // else: connection dropped mid-stream but we already have a partial
      // reply - keep it rather than throwing it away.
    }

    if (state.userAborted) {
      stopThinking();
      const pending = $('pending-turn');
      if (pending && !REDUCED_MOTION) { pending.classList.add('pending-fade'); await sleep(200); }
      if (createdThread && !thread.messages.length) {
        state.threads = state.threads.filter(t => t.id !== thread.id);
        if (state.activeThreadId === thread.id) state.activeThreadId = null;
        saveState();
        renderSidebarThreads();
      }
      renderActiveThread();
      if (fromInput && !input.value) { input.value = text; onComposerInput(true); }
      showToast('ارسال متوقف شد');
      return;
    }

    stopThinking();

    // An error with no tokens at all -> show the familiar error row (with
    // its own streamed-in text). An error after a partial reply, or a clean
    // reply, both keep whatever text already streamed onto the screen.
    const msg = gotAnyToken
      ? { id: newId('msg'), text, reply, error: null, ts: Date.now() }
      : { id: newId('msg'), text, reply: null, error: error || 'پاسخی از سرور دریافت نشد', ts: Date.now() };

    thread.messages.push(msg);
    thread.updatedAt = Date.now();
    saveState();
    renderSidebarThreads();

    if (state.activeThreadId !== thread.id) return;

    if (!gotAnyToken) {
      await revealErrorTurn(msg);
    } else {
      finalizePendingTurn(msg);
      keepPinned();
    }
  } finally {
    clearTimeout(timer);
    stopThinking();
    state.ctrl = null;
    setBusy(false);
    if (CAN_HOVER) input.focus({ preventScroll: true });
  }
}

// The pending turn holds BOTH the thinking indicator and the (initially
// empty, hidden) live reply element from the start, so the very first token
// that arrives over the network can just be appended directly - no DOM
// rebuild in the middle of a stream.
function appendPendingTurn(text) {
  setWelcome(false);
  const stream = $('chat-stream');
  const old = $('pending-turn');
  if (old) old.remove();
  const div = document.createElement('div');
  div.id = 'pending-turn';
  div.style.display = 'contents';
  div.innerHTML = `
    ${userTurnHTML({ id: 'pending', text })}
    <div class="msg bot fade"><div class="bbox">
      <div class="thinking-block" role="status" aria-live="polite" id="pending-think">
        ${markSVG('live')}
        <span class="thinking-label"><span class="thinking-text" id="think-text">${THINK_PHASES[0]}</span></span>
        <span class="thinking-time mono" id="think-time"></span>
      </div>
      <span class="bot-text type-target hidden" id="pending-bot-text" dir="rtl"></span>
    </div></div>`;
  stream.appendChild(div);
  startThinking();
  scrollToBottom(true);
}

// Called once per incoming network chunk while a reply is streaming live.
function appendLiveToken(chunk, fullSoFar) {
  const think = $('pending-think');
  const el = $('pending-bot-text');
  if (!el) return;
  if (think && !think.classList.contains('hidden')) {
    think.classList.add('hidden');
    el.classList.remove('hidden');
  }
  const dir = textDir(fullSoFar);
  if (el.getAttribute('dir') !== dir) el.setAttribute('dir', dir);

  let dot = el.querySelector('.stream-dot');
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'stream-dot';
    el.appendChild(dot);
  }
  const span = document.createElement('span');
  span.className = 'tw';
  span.textContent = chunk;
  el.insertBefore(span, dot);
  keepPinned();
}

function reSend(msgId) {
  if (state.isAnalyzing) return busyToast();
  const msg = findMessage(msgId);
  if (msg) sendMessage(msg.text);
}

/* ---------------- composer: smooth, animated typing ---------------- */
const INK_MS = 380;
const INK_MAX_LEN = 5000;
const MAX_TA_H = 200;
const composer = { len: -1, canSend: null, h: 0, prev: '', fresh: [], raf: 0, cleanup: 0, dir: 'rtl', ink: false, long: false, instant: false };

const RTL_CH = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CH = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;
function textDir(v) {
  for (let i = 0; i < v.length && i < 400; i++) {
    const c = v[i];
    if (RTL_CH.test(c)) return 'rtl';
    if (LTR_CH.test(c)) return 'ltr';
  }
  return 'rtl';
}

function initComposer() {
  const el = $('prompt-input');
  composer.ink = !REDUCED_MOTION;
  composer.long = el.value.length > INK_MAX_LEN;
  el.addEventListener('input', () => onComposerInput(false));
  el.addEventListener('keydown', handleKey);
  el.addEventListener('scroll', syncMirrorScroll, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(() => scheduleComposer()).observe($('ta-mirror-inner'));
  composer.prev = el.value;
  renderMirror();
  syncComposer(true);
}

function onComposerInput(instant) {
  const el = $('prompt-input');
  const v = el.value;
  composer.long = v.length > INK_MAX_LEN;
  if (composer.ink && !instant && !composer.long) trackInsert(composer.prev, v);
  else composer.fresh = [];
  composer.prev = v;
  composer.instant = !!instant;
  renderMirror();
  syncComposer();
}
function scheduleComposer() {
  if (composer.raf) return;
  composer.raf = requestAnimationFrame(() => { composer.raf = 0; syncComposer(); });
}

function trackInsert(a, b) {
  const now = performance.now();
  let p = 0;
  const minLen = Math.min(a.length, b.length);
  while (p < minLen && a.charCodeAt(p) === b.charCodeAt(p)) p++;
  let s = 0;
  while (s < minLen - p && a.charCodeAt(a.length - 1 - s) === b.charCodeAt(b.length - 1 - s)) s++;
  const removed = a.length - p - s, inserted = b.length - p - s, delta = inserted - removed;
  const next = [];
  for (const r of composer.fresh) {
    if (now - r.t >= INK_MS) continue;
    if (r.e <= p) next.push(r);
    else if (r.s >= p + removed) next.push({ s: r.s + delta, e: r.e + delta, t: r.t });
  }
  if (inserted > 0) next.push({ s: p, e: p + inserted, t: now });
  next.sort((x, y) => x.s - y.s);
  composer.fresh = next;
}

function renderMirror() {
  const inner = $('ta-mirror-inner');
  const el = $('prompt-input');
  const v = el.value;
  const dir = textDir(v);
  if (dir !== composer.dir) { composer.dir = dir; el.dir = dir; inner.dir = dir; }
  $('ta-ph').classList.toggle('off', v.length > 0);
  document.documentElement.classList.toggle('ink', composer.ink && !composer.long);
  if (composer.long) { inner.textContent = ''; return; }
  const now = performance.now();
  let html = '', pos = 0;
  const live = composer.ink ? composer.fresh.filter(r => now - r.t < INK_MS) : [];
  for (const r of live) {
    if (r.s < pos) continue;
    html += escapeHtml(v.slice(pos, r.s));
    html += `<span class="ink-new" style="animation-delay:${-Math.round(now - r.t)}ms">${escapeHtml(v.slice(r.s, r.e))}</span>`;
    pos = r.e;
  }
  html += escapeHtml(v.slice(pos));
  if (!v || v.endsWith('\n')) html += '\u200b';
  inner.innerHTML = html;
  if (inner.dir !== dir) inner.dir = dir;

  clearTimeout(composer.cleanup);
  if (live.length) composer.cleanup = setTimeout(() => { composer.fresh = []; renderMirror(); }, INK_MS + 20);
  syncMirrorScroll();
}
function syncMirrorScroll() {
  const m = $('ta-mirror');
  const el = $('prompt-input');
  if (m.scrollTop !== el.scrollTop) m.scrollTop = el.scrollTop;
}

function syncComposer(first) {
  const el = $('prompt-input');
  const wrap = $('ta-wrap');
  const inner = $('ta-mirror-inner');

  const contentH = composer.long ? MAX_TA_H + 1 : inner.scrollHeight;
  const h = Math.max(Math.min(contentH, MAX_TA_H), 0) || el.offsetHeight;
  if (h !== composer.h) {
    composer.h = h;
    el.style.height = h + 'px';
    if (first || composer.instant) {
      wrap.style.transition = 'none';
      wrap.style.height = h + 'px';
      void wrap.offsetHeight;
      wrap.style.transition = '';
    } else wrap.style.height = h + 'px';
    el.style.overflowY = contentH > MAX_TA_H ? 'auto' : 'hidden';
    syncMirrorScroll();
  }
  composer.instant = false;

  const len = el.value.length;
  if (len !== composer.len) {
    composer.len = len;
    const c = $('char-counter');
    if (len > 200) { c.textContent = `${faDigits(len)} / ${faDigits(MAX_TEXT)}`; c.classList.remove('off'); }
    else c.classList.add('off');
  }
  const canSend = state.isAnalyzing || (len > 0 && /\S/.test(el.value));
  if (canSend !== composer.canSend) {
    composer.canSend = canSend;
    $('send-btn').disabled = !canSend;
  }
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    if (!state.isAnalyzing) sendMessage();
  }
}

function useStarter(text) { sendMessage(text); }

async function pasteClipboard() {
  try {
    const t = await navigator.clipboard.readText();
    if (!t) return;
    const input = $('prompt-input');
    input.focus();
    const room = MAX_TEXT - (input.value.length - (input.selectionEnd - input.selectionStart));
    const chunk = t.slice(0, Math.max(0, room));
    if (!chunk) { showToast('به حداکثر طول پیام رسیده‌اید'); return; }
    input.setRangeText(chunk, input.selectionStart, input.selectionEnd, 'end');
    onComposerInput(false);
  } catch (e) { showToast('دسترسی به کلیپ‌بورد ممکن نیست'); }
}

/* ---------------- theme / modals ---------------- */
function syncThemeIcon() {
  $('theme-icon').innerHTML = svg(document.documentElement.classList.contains('dark') ? 'sun' : 'moon');
}
function setTheme(dark) {
  const root = document.documentElement;
  if (root.classList.contains('dark') === dark) return;
  if (!REDUCED_MOTION) {
    root.classList.add('theme-anim');
    clearTimeout(setTheme._t);
    setTheme._t = setTimeout(() => root.classList.remove('theme-anim'), 340);
  }
  root.classList.toggle('dark', dark);
  syncThemeIcon();
}
function toggleTheme() {
  const dark = !document.documentElement.classList.contains('dark');
  setTheme(dark);
  try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
}
function watchSystemTheme() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!saved) setTheme(mq.matches);
  };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

let lastFocus = null;
function isOpen(id) { return $(id).classList.contains('open'); }
function openModal(id) {
  lastFocus = document.activeElement;
  $(id).classList.add('open');
}
function closeModal(id) {
  const m = $(id);
  if (!m.classList.contains('open')) return;
  m.classList.remove('open');
  if (lastFocus && lastFocus.focus && CAN_HOVER) lastFocus.focus({ preventScroll: true });
}

function openSettingsModal() {
  closeMobileSidebar();
  if (state.health) renderHealthDetails(state.health);
  openModal('settings-modal');
  checkHealth();
}
function closeSettingsModal() { closeModal('settings-modal'); }

function showToast(msg) {
  const t = $('toast');
  $('toast-message').textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------------- helpers ---------------- */
function scrollToBottom(smooth) {
  const c = $('messages-container');
  c.scrollTo({ top: c.scrollHeight, behavior: smooth && !REDUCED_MOTION ? 'smooth' : 'auto' });
}
function keepPinned(force) {
  const c = $('messages-container');
  if (force || c.scrollHeight - c.scrollTop - c.clientHeight < 160) c.scrollTop = c.scrollHeight;
}

function findMessage(id) {
  for (const t of state.threads) {
    const f = t.messages.find(m => m.id === id);
    if (f) return f;
  }
  return null;
}

function copyText(s) {
  if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
    return navigator.clipboard.writeText(s).catch(() => legacyCopy(s));
  }
  legacyCopy(s);
  return Promise.resolve();
}
function legacyCopy(s) {
  const ta = document.createElement('textarea');
  ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove();
}

function copyUserText(id) {
  const m = findMessage(id);
  if (m) copyText(m.text).then(() => showToast('متن کپی شد'));
}
function copyReply(id) {
  const m = findMessage(id);
  if (m && m.reply) copyText(m.reply).then(() => showToast('پاسخ کپی شد'));
}

function exportCurrentThread() {
  const t = state.threads.find(x => x.id === state.activeThreadId);
  if (!t) { showToast('گفتگویی برای خروجی انتخاب نشده'); return; }
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `unicollect_chat_${t.id}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast('فایل JSON دانلود شد');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/* ---------------- markdown / code / math rendering (assistant replies) ----------------
   Pipeline: protect fenced/inline code -> extract $...$ / $$...$$ / \(...\) / \[...\] math
   -> run the rest through marked (GFM) with a code renderer that syntax-highlights via
   highlight.js and adds a copy button -> sanitize with DOMPurify -> splice the math back
   in as KaTeX-rendered HTML (computed after sanitizing, so KaTeX's own markup is never
   fought by the sanitizer's tag allowlist). */
let _mdRendererReady = false;
function ensureMarkdownRenderer() {
  if (_mdRendererReady || typeof marked === 'undefined') return;
  const renderer = new marked.Renderer();
  renderer.code = (code, infostring) => {
    const lang = (infostring || '').trim().split(/\s+/)[0].toLowerCase();
    let highlighted;
    try {
      if (typeof hljs !== 'undefined') {
        highlighted = (lang && hljs.getLanguage(lang))
          ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
          : hljs.highlightAuto(code).value;
      } else {
        highlighted = escapeHtml(code);
      }
    } catch (e) { highlighted = escapeHtml(code); }
    const langClass = lang ? ` language-${lang}` : '';
    return `<div class="code-block">` +
      `<div class="code-head">` +
        `<span class="code-lang">${escapeHtml(lang || 'متن')}</span>` +
        `<button type="button" class="code-copy" title="کپی کد">${svg('copy')}<span>کپی</span></button>` +
      `</div>` +
      `<pre><code class="hljs${langClass}">${highlighted}</code></pre>` +
    `</div>`;
  };
  renderer.link = (href, title, text) => {
    const safeHref = escapeHtml(href || '');
    const t = title ? ` title="${escapeHtml(title)}"` : '';
    return `<a href="${safeHref}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };
  marked.setOptions({ renderer, gfm: true, breaks: true });
  _mdRendererReady = true;
}

function extractMath(text) {
  const items = [];
  const stash = (display, tex) => { items.push({ display, tex }); return `\u0000MX${items.length - 1}\u0000`; };
  let out = text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => stash(true, tex))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => stash(true, tex))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => stash(false, tex))
    .replace(/(^|[^\\$\w])\$([^\s$][^$\n]*?)\$(?!\$)/g, (m, pre, tex) => `${pre}${stash(false, tex)}`);
  return { text: out, items };
}

function renderMarkdown(raw) {
  const text = String(raw || '');
  if (!text) return '';
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') return escapeHtml(text);
  ensureMarkdownRenderer();

  // protect fenced/inline code from the math-extraction pass below
  const codeBlocks = [];
  let t = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, m => {
    codeBlocks.push(m); return `\u0000CB${codeBlocks.length - 1}\u0000`;
  });
  const inlineCodes = [];
  t = t.replace(/`[^`\n]+`/g, m => { inlineCodes.push(m); return `\u0000IC${inlineCodes.length - 1}\u0000`; });

  const { text: mathed, items: mathItems } = extractMath(t);
  t = mathed
    .replace(/\u0000CB(\d+)\u0000/g, (_, i) => codeBlocks[+i])
    .replace(/\u0000IC(\d+)\u0000/g, (_, i) => inlineCodes[+i]);

  let html;
  try { html = marked.parse(t); } catch (e) { return escapeHtml(text); }

  let clean = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });

  clean = clean.replace(/\u0000MX(\d+)\u0000/g, (_, i) => {
    const { display, tex } = mathItems[+i];
    if (typeof katex === 'undefined') return escapeHtml(display ? `$$${tex}$$` : `$${tex}$`);
    try { return katex.renderToString(tex, { throwOnError: false, displayMode: display, strict: false }); }
    catch (e) { return escapeHtml(display ? `$$${tex}$$` : `$${tex}$`); }
  });

  return clean;
}

function copyCodeBlock(btn) {
  const block = btn.closest('.code-block');
  const code = block && block.querySelector('code');
  if (!code) return;
  copyText(code.textContent).then(() => {
    btn.classList.add('copied');
    const label = btn.querySelector('span');
    const prev = label ? label.textContent : '';
    if (label) label.textContent = 'کپی شد';
    showToast('کد کپی شد');
    setTimeout(() => { btn.classList.remove('copied'); if (label) label.textContent = prev; }, 1600);
  });
}

/* ==== hero greeting ==== */
(function () {
  "use strict";
  var PROMPT_POOL = [
    'امروز چطور کمکت کنم؟',
    'چه کمکی از دستم برمیاد؟',
    'بگو چی لازم داری',
    'آماده‌ام، چی تو ذهنته؟',
    'بریم سراغ یه کار جدید',
    'چه چیزی رو باهم بنویسیم؟',
    'چه سوالی داری؟',
    'بگو تا کمکت کنم',
    'امروز رو با چی شروع کنیم؟',
    'منتظر پیامتم…'
  ];
  var bag = [];
  function refillBag() {
    bag = PROMPT_POOL.slice();
    for (var i = bag.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
    }
  }
  function popPrompt(prev) {
    if (!bag.length) refillBag();
    if (bag.length > 1 && bag[bag.length - 1] === prev) {
      var t = bag[bag.length - 1];
      bag[bag.length - 1] = bag[bag.length - 2];
      bag[bag.length - 2] = t;
    }
    return bag.pop();
  }
  function pickGreeting() {
    var h = new Date().getHours();
    if (h >= 5 && h < 12) return 'صبحت بخیر';
    if (h >= 12 && h < 16) return 'ظهرت بخیر';
    if (h >= 16 && h < 19) return 'عصرت بخیر';
    return 'شبت بخیر';
  }
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var lastGreeting = '', lastPrompt = '';
  function crossfade(el, next) {
    if (!el) return false;
    if (el.textContent === next) return true;
    if (reduced) { el.textContent = next; return true; }
    el.style.transition = 'opacity .18s ease';
    el.style.opacity = '0';
    window.setTimeout(function () {
      el.textContent = next;
      window.requestAnimationFrame(function () { el.style.opacity = ''; });
    }, 180);
    return true;
  }
  function applyHero() {
    var gEl = document.getElementById('hero-greeting');
    var pEl = document.getElementById('hero-prompt');
    if (!gEl && !pEl) return false;
    var g = pickGreeting();
    var p = popPrompt(lastPrompt);
    crossfade(gEl, g);
    crossfade(pEl, p);
    lastGreeting = g; lastPrompt = p;
    return true;
  }
  window.applyHeroGreeting = applyHero;
  var tries = 0;
  function tryApply() {
    if (applyHero()) return true;
    if (++tries >= 30) return true;
    window.setTimeout(tryApply, 100);
    return false;
  }
  if (!tryApply()) {
    document.addEventListener('DOMContentLoaded', tryApply, { once: true });
    window.addEventListener('load', tryApply, { once: true });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) applyHero(); });
  window.addEventListener('focus', function () { applyHero(); });
  function wrapFn(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__heroWrappedV1) return false;
    var wrapped = function () {
      var out = orig.apply(this, arguments);
      window.setTimeout(applyHero, 20);
      return out;
    };
    wrapped.__heroWrappedV1 = true;
    window[name] = wrapped;
    return true;
  }
  function hookAll() {
    var a = wrapFn('renderActiveThread');
    var b = wrapFn('createNewThread');
    return a || b;
  }
  if (!hookAll()) {
    var ht = 0;
    var iv = window.setInterval(function () {
      if (hookAll() || ++ht > 40) window.clearInterval(iv);
    }, 50);
  }
})();
