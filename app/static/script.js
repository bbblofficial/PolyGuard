const STORAGE_KEY = 'polyguard_threads_v4';
const UI_KEY = 'polyguard_ui_v1';
const REQUEST_TIMEOUT_MS = 180000;
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  threads: [],
  activeThreadId: null,
  isAnalyzing: false,
  viewMode: 'detailed',
  health: null,
  justAddedThreadId: null
};

const $ = id => document.getElementById(id);

/* ---------------- icons (inline SVG, no external dependency) ---------------- */
const ICONS = {
  shield:      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  shieldalert: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  shieldx:     '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m14.5 9.5-5 5"/><path d="m9.5 9.5 5 5"/>',
  sidebar:     '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
  edit:        '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  search:      '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  layers:      '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  chevron:     '<path d="m6 9 6 6 6-6"/>',
  check:       '<path d="M20 6 9 17l-5-5"/>',
  share:       '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
  sun:         '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon:        '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  plus:        '<path d="M5 12h14"/><path d="M12 5v14"/>',
  sliders:     '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  arrowup:     '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  smile:       '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
  globe:       '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  alert:       '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  x:           '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trash:       '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  copy:        '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  code:        '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  refresh:     '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  lang:        '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  info:        '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  clock:       '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
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

// PolyGuard brand mark: a scanning reticle. Four corner brackets
// frame a crosshair and a pulsing core - reads as "detection" rather than
// as a generic AI sparkle, and stays legible down to 15px.
const SPARK_SVG = `
  <g class="frame">
    <path d="M4 9 V4 H9"/>
    <path d="M15 4 H20 V9"/>
    <path d="M20 15 V20 H15"/>
    <path d="M9 20 H4 V15"/>
  </g>
  <g class="ticks">
    <line x1="12" y1="9"  x2="12" y2="11"/>
    <line x1="12" y1="13" x2="12" y2="15"/>
    <line x1="9"  y1="12" x2="11" y2="12"/>
    <line x1="13" y1="12" x2="15" y2="12"/>
  </g>
  <circle class="core" cx="12" cy="12" r="1.3"/>
`;
function sparkSVG(animated) {
  return `<svg class="ic spark${animated ? ' spark-live' : ''}" viewBox="0 0 24 24" aria-hidden="true">${SPARK_SVG}</svg>`;
}" viewBox="0 0 24 24" aria-hidden="true">${SPARK_SVG}</svg>`;
}

/* ---------------- init ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  hydrateIcons();
  loadState();
  applyUiPrefs();
  syncThemeIcon();
  renderSidebarThreads();
  renderActiveThread();
  initComposer();
  initSearch();
  checkHealth();
  setInterval(() => { if (!document.hidden) checkHealth(); }, 12000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkHealth(); });
  if (window.matchMedia('(hover: hover)').matches) $('prompt-input').focus();
  document.addEventListener('click', closeModelDropdown);
  document.addEventListener('keydown', onGlobalKey);
  // allow CSS transitions only after first paint (prevents a flash of
  // animating sidebar / modals on load)
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
    if ($('model-dropdown').classList.contains('open')) return closeModelDropdown();
    closeMobileSidebar();
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state.threads = Array.isArray(p.threads) ? p.threads.filter(t => t && t.id && Array.isArray(t.messages)) : [];
      state.activeThreadId = p.activeThreadId || null;
      state.viewMode = p.viewMode || 'detailed';
    }
  } catch (e) { console.warn(e); }
  updateViewModeCheckmarks();
}

let saveTimer = 0;
function saveState() {
  // debounce: big histories make JSON.stringify noticeable
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        threads: state.threads, activeThreadId: state.activeThreadId, viewMode: state.viewMode
      }));
    } catch (e) {
      console.warn(e);
      showToast('حافظه مرورگر پر است؛ گفتگوهای قدیمی را پاک کنید');
    }
  }, 120);
}
window.addEventListener('pagehide', () => {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      threads: state.threads, activeThreadId: state.activeThreadId, viewMode: state.viewMode
    }));
  } catch (e) {}
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
async function checkHealth() {
  const dot = $('status-dot');
  const txt = $('status-text');
  try {
    const r = await fetch('/health', { cache: 'no-store' });
    const d = await r.json();
    state.health = d;
    const n = (d.loaded_models || []).length;
    let cls, label;
    if (d.status === 'ok') { cls = 'sdot ok'; label = `${n}/5 مدل فعال`; }
    else if (d.status === 'loading') { cls = 'sdot warn'; label = `بارگذاری مدل‌ها (${n}/5)…`; }
    else { cls = 'sdot bad'; label = 'خطا در بارگذاری'; }
    if (dot.className !== cls) dot.className = cls;
    if (txt.textContent !== label) txt.textContent = label;
    if (isOpen('settings-modal')) renderHealthDetails(d);
  } catch (e) {
    dot.className = 'sdot bad';
    txt.textContent = 'سرور در دسترس نیست';
  }
}
function renderHealthDetails(d) {
  const c = $('cfg-concurrency');
  if (c && d.concurrency) c.textContent = `${d.concurrency} (Peak ${d.peak || 0})`;
  const m = $('cfg-models');
  if (m) {
    const ok = (d.loaded_models || []).map(x => `<div class="ml"><span>${escapeHtml(x)}</span><span class="ok">● Ready</span></div>`).join('');
    const er = Object.keys(d.errors || {}).map(x => `<div class="ml"><span>${escapeHtml(x)}</span><span class="err">● Error</span></div>`).join('');
    m.innerHTML = (ok + er) || 'مدلی بارگذاری نشده';
  }
}

/* ---------------- sidebar ---------------- */
function toggleSidebar() {
  const app = $('app');
  if (window.innerWidth < 768) app.classList.toggle('mobile-open');
  else { app.classList.toggle('collapsed'); saveUiPrefs(); }
}
function closeMobileSidebar() { $('app').classList.remove('mobile-open'); }

function createNewThread() {
  if (state.isAnalyzing) return;
  state.activeThreadId = null;
  saveState();
  renderSidebarThreads();
  renderActiveThread();
  closeMobileSidebar();
  $('prompt-input').focus();
}

function selectThread(id) {
  if (state.isAnalyzing) return;
  state.activeThreadId = id;
  saveState();
  renderSidebarThreads();
  renderActiveThread();
  closeMobileSidebar();
}

function deleteThread(event, id) {
  event.stopPropagation();
  if (state.isAnalyzing && id === state.activeThreadId) return;
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
  if (state.isAnalyzing) return;
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

function lastDecision(t) {
  const last = t.messages?.[t.messages.length - 1]?.result?.decision;
  return last === 'TOXIC' ? 'dot-bad' : last === 'SUSPECT' ? 'dot-warn' : 'dot-ok';
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
      const cls = ['thread', t.id === state.activeThreadId ? 'active' : '', t.id === state.justAddedThreadId ? 'entering' : ''].join(' ');
      html += `
        <div class="${cls}" role="button" tabindex="0" onclick="selectThread('${t.id}')" onkeydown="if(event.key==='Enter')selectThread('${t.id}')">
          <div class="t-left"><span class="t-dot ${lastDecision(t)}"></span><span class="t-title">${escapeHtml(t.title || 'تحلیل جدید')}</span></div>
          <button class="t-del" onclick="deleteThread(event,'${t.id}')" title="حذف">${svg('trash')}</button>
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
  closeModelDropdown();
  const inp = $('search-input');
  inp.value = '';
  $('search-clear').classList.add('hidden-soft');
  renderSearchResults();
  openModal('search-modal');
  // focus after the element is visible (iOS needs it inside the gesture)
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
  const fa = n => Number(n).toLocaleString('fa-IR');
  if (diff < m) return 'همین الان';
  if (diff < h) return `${fa(Math.floor(diff / m))} دقیقه پیش`;
  if (diff < d) return `${fa(Math.floor(diff / h))} ساعت پیش`;
  if (diff < 7 * d) return `${fa(Math.floor(diff / d))} روز پیش`;
  try { return new Date(ts).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }); } catch (e) { return ''; }
}

function renderSearchResults() {
  const q = $('search-input').value.toLowerCase().trim();
  const box = $('search-results');
  const label = $('search-label');
  const sorted = [...state.threads].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  let items;
  if (!q) {
    items = sorted.slice(0, 20).map(t => ({ t, snippet: t.messages?.[t.messages.length - 1]?.text || '' }));
    label.textContent = items.length ? 'گفتگوهای اخیر' : '';
  } else {
    items = [];
    for (const t of sorted) {
      const inTitle = (t.title || '').toLowerCase().includes(q);
      const hit = (t.messages || []).find(m => (m.text || '').toLowerCase().includes(q));
      if (inTitle || hit) items.push({ t, snippet: hit ? snippetAround(hit.text, q, 40) : (t.messages?.[0]?.text || '') });
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
      <span class="si-ico">${svg('msg')}<span class="t-dot ${lastDecision(t)}"></span></span>
      <span class="si-text">
        <span class="si-title" dir="auto">${highlight(t.title || 'تحلیل جدید', q)}</span>
        <span class="si-snip" dir="auto">${highlight(snippet.replace(/\s+/g, ' '), q)}</span>
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
  if (state.isAnalyzing) { showToast('صبر کنید تا تحلیل فعلی تمام شود'); return; }
  selectThread(id);
}

/* ---------------- chat rendering ---------------- */
function setWelcome(on) {
  $('main').classList.toggle('welcome', on);
}

// Any re-render cancels an in-flight typewriter run.
let streamToken = 0;

function renderActiveThread() {
  streamToken++;
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

/* ---------------- Claude-style typewriter ---------------- */
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Claude streams text in small word-sized chunks at a steady pace and each
// chunk softly fades in; there is no blinking caret. This reproduces that:
// a requestAnimationFrame clock decides how many characters are "due",
// whole words are appended as <span>s with a short opacity fade, and once
// done the spans are collapsed back to a plain text node.
function streamText(el, text, cps, token) {
  if (!el) return Promise.resolve();
  if (REDUCED_MOTION || !text) { el.textContent = text; return Promise.resolve(); }
  const parts = text.match(/\S+\s*|\s+/g) || [text];
  return new Promise(resolve => {
    el.textContent = '';
    let shown = 0, idx = 0, t0 = 0, last = 0;
    const done = () => { el.textContent = text; el.classList.remove('streaming'); resolve(); };
    el.classList.add('streaming');
    const frame = now => {
      if (token !== streamToken || !el.isConnected) return done();
      if (!t0) t0 = now;
      // slight ease-in so the first words don't pop all at once
      const due = Math.floor(((now - t0) / 1000) * cps);
      let chunk = '';
      while (idx < parts.length && shown + chunk.length < due) chunk += parts[idx++];
      if (chunk) {
        const s = document.createElement('span');
        s.className = 'tw';
        s.textContent = chunk;
        el.appendChild(s);
        shown += chunk.length;
        if (now - last > 120) { keepPinned(); last = now; }
      }
      if (idx >= parts.length) { setTimeout(() => { if (el.isConnected) done(); else resolve(); }, 260); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// Renders every message normally, except the newest one (msgId): its
// title/subtitle stream in like Claude, and the rest of the card (meter,
// stats, breakdown, actions) cascades in.
async function renderActiveThreadWithTyping(msgId) {
  const stream = $('chat-stream');
  const thread = state.threads.find(t => t.id === state.activeThreadId);
  if (!thread || !thread.messages.length) return;
  setWelcome(false);
  const token = ++streamToken;

  const last = thread.messages[thread.messages.length - 1];
  const older = thread.messages.slice(0, -1).map(m => buildTurnHTML(m)).join('');
  stream.innerHTML = older + buildTurnHTML(last, { animate: last.id === msgId });
  scrollToBottom(true);

  if (last.id !== msgId || !last.result || last.result.error) return;

  const meta = DECISIONS[last.result.decision] || { title: 'نتیجه نامشخص', text: '' };
  const wrap = $(`botmsg-${last.id}`);
  const reveal = () => {
    if (!wrap) return;
    wrap.querySelectorAll('.reveal-item').forEach((el, idx) => {
      if (REDUCED_MOTION) el.classList.add('show');
      else setTimeout(() => el.classList.add('show'), idx * 70);
    });
    setTimeout(keepPinned, 450);
  };

  await streamText($(`type-title-${last.id}`), meta.title, 60, token);
  if (token !== streamToken) return reveal();
  // the subtitle streams while the card body starts cascading in
  const sub = streamText($(`type-sub-${last.id}`), meta.text, 120, token);
  setTimeout(reveal, 120);
  await sub;
}

const DECISIONS = {
  TOXIC:   { icon: 'shieldx',     title: 'محتوای سمی شناسایی شد', text: 'بر اساس رأی‌گیری اجماعی مدل‌ها، این متن حاوی الفاظ توهین‌آمیز یا سمی است.' },
  SUSPECT: { icon: 'shieldalert', title: 'محتوای مشکوک',          text: 'برخی مدل‌ها احتمال سمیت متوسطی دیده‌اند اما اجماع کافی نیست؛ بازبینی انسانی پیشنهاد می‌شود.' },
  SAFE:    { icon: 'shield',      title: 'محتوای سالم',           text: 'هیچ‌یک از مدل‌ها نشانه‌ای از توهین یا سمیت در این متن پیدا نکردند.' }
};

function scriptLabel(s) { return s === 'fa' ? 'فارسی' : s === 'en' ? 'انگلیسی' : 'مختلط'; }
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); }

// "✦ ۱٫۲ ثانیه فکر کرد" - Claude-style thought-time header.
function thoughtLineHTML(ms, revealCls) {
  if (typeof ms !== 'number') return '';
  const secs = (ms / 1000).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `<div class="thought-line ${revealCls}" title="زمان صرف‌شده برای تحلیل این متن">
    <span class="thought-sparkle">${sparkSVG(false)}</span>
    <span>${secs} ثانیه فکر کرد</span>
  </div>`;
}

function userTurnHTML(msg) {
  return `
    <div class="msg user fade">
      <div class="ubox">
        <div class="bubble" dir="auto">${escapeHtml(msg.text)}</div>
        <div class="uacts">
          <button class="icon-btn" onclick="copyUserText('${msg.id}')" title="کپی متن">${svg('copy')}</button>
          <button class="icon-btn" onclick="reAnalyze('${msg.id}')" title="تحلیل مجدد">${svg('refresh')}</button>
        </div>
      </div>
    </div>`;
}

function buildTurnHTML(msg, opts) {
  const animate = !!(opts && opts.animate) && !REDUCED_MOTION;
  const user = userTurnHTML(msg);
  const r = msg.result;

  if (!r || r.error || !r.decision) {
    const e = r && r.error ? (typeof r.error === 'string' ? r.error : JSON.stringify(r.error)) : 'پاسخی از سرور دریافت نشد';
    return `${user}
      <div class="msg bot fade"><div class="bot-body">
        <div class="err-box">${svg('alert')}<span>خطا در پردازش: ${escapeHtml(e)}</span></div>
        <div class="actions"><button class="icon-btn" onclick="reAnalyze('${msg.id}')" title="تلاش مجدد">${svg('refresh')}</button></div>
      </div></div>`;
  }

  const meta = DECISIONS[r.decision] || { icon: 'info', title: 'نتیجه نامشخص', text: 'پاسخ معتبری از سرور دریافت نشد.' };
  const maxPct = Math.max(0, Math.min(100, num(r.max_raw) * 100));
  const titleInner = animate ? `<span class="type-target" id="type-title-${msg.id}"></span>` : escapeHtml(meta.title);
  const subInner = animate ? `<span class="type-target" id="type-sub-${msg.id}"></span>` : escapeHtml(meta.text);
  const revealCls = animate ? 'reveal-item' : '';
  const votes = r.votes || {};

  const rows = Object.keys(r.raw_scores || {}).map(key => {
    const raw = num(r.raw_scores[key]);
    const voted = !!votes[key];
    const w = (r.weights && r.weights[key]) || 1;
    const pct = Math.min(100, raw * 100).toFixed(1);
    const fill = voted ? 'f-bad' : raw >= 0.35 ? 'f-warn' : 'f-ok';
    return `
      <div class="mrow">
        <div class="mrow-top">
          <div class="mrow-name">
            <span class="tag ${voted ? 'bad' : 'ok'}">${voted ? 'رأی سمی' : 'سالم'}</span>
            <span class="n">${escapeHtml(r.labels?.[key] || key)}</span>
          </div>
          <div class="mrow-val mono"><span>${pct}%</span><span class="wt">×${w}</span></div>
        </div>
        <div class="bar"><div class="${fill}" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');

  const skipped = (r.skipped_models && r.skipped_models.length)
    ? `<div class="bd-foot">${svg('info')}<span>فیلتر زبان (${scriptLabel(r.script)}): <span class="mono">${r.skipped_models.map(escapeHtml).join(', ')}</span> اجرا نشد.</span></div>`
    : '';

  let fing = '';
  if (r.fingilish_detected && r.fingilish_text) {
    const a = r.analysis || {};
    const chip = (d) => d ? `<span class="tag ${d === 'SAFE' ? 'ok' : 'bad'}">${escapeHtml(d)}</span>` : '';
    fing = `
      <div class="note ${revealCls}">
        <span class="note-ico">${svg('lang')}</span>
        <div class="note-body">
          <div class="note-title">فینگیلیش تشخیص داده شد</div>
          <div class="note-flow">
            <span class="np mono" dir="ltr">${escapeHtml(msg.text.length > 60 ? msg.text.slice(0, 60) + '…' : msg.text)}</span>
            <span class="arrow">←</span>
            <span class="np fa" dir="rtl">${escapeHtml(r.fingilish_text.length > 60 ? r.fingilish_text.slice(0, 60) + '…' : r.fingilish_text)}</span>
          </div>
          <div class="note-res">متن اصلی ${chip(a.original?.decision)} <span class="sep">·</span> نسخه‌ی فارسی ${chip(a.fingilish?.decision)}</div>
        </div>
      </div>`;
  }

  const detailed = state.viewMode === 'detailed';
  const breakdown = `
    <details class="breakdown ${revealCls}" ${detailed ? 'open' : ''}>
      <summary>ریز نمرات مدل‌ها ${svg('chevron')}</summary>
      <div class="bd-card">${rows}${skipped}</div>
    </details>`;

  const thought = thoughtLineHTML(msg.thinkingMs, revealCls);

  return `${user}
    <div class="msg bot fade${animate ? ' anim' : ''}" id="botmsg-${msg.id}"><div class="bot-body">
      ${thought}
      <div class="result ${escapeHtml(r.decision)}">
        <div class="res-head">
          <span class="res-ico">${svg(meta.icon)}</span>
          <div class="res-txt">
            <div class="res-title">${titleInner}</div>
            <div class="res-sub">${subInner}</div>
          </div>
          <div class="res-score mono ${revealCls}" title="بیشترین نمره‌ی خام">${maxPct.toFixed(0)}<small>%</small></div>
        </div>
        <div class="meter ${revealCls}">
          <div class="meter-fill" style="width:${maxPct}%"></div>
          <i class="tick" style="inset-inline-start:50%"></i>
          <i class="tick" style="inset-inline-start:90%"></i>
        </div>
        <div class="meter-legend ${revealCls}"><span><i class="lg"></i>آستانه رأی ۵۰٪</span><span><i class="lg"></i>حد قاطع ۹۰٪</span></div>
        ${fing}
        <div class="stats ${revealCls}">
          <div class="stat"><div class="k">آرای سمیت</div><div class="v mono">${num(r.votes_count)} / ${num(r.total_models)}</div></div>
          <div class="stat"><div class="k">اطمینان</div><div class="v mono">${(num(r.confidence) * 100).toFixed(1)}%</div></div>
          <div class="stat"><div class="k">زبان</div><div class="v">${scriptLabel(r.script)}</div></div>
          <div class="stat"><div class="k">زمان</div><div class="v mono">${num(r.latency_ms)} ms</div></div>
        </div>
        ${breakdown}
      </div>
      <div class="actions ${revealCls}">
        <button class="icon-btn" onclick="copyReport('${msg.id}')" title="کپی گزارش">${svg('copy')}</button>
        <button class="icon-btn" onclick="copyMessageJSON('${msg.id}')" title="کپی JSON">${svg('code')}</button>
        <button class="icon-btn" onclick="reAnalyze('${msg.id}')" title="تحلیل مجدد">${svg('refresh')}</button>
      </div>
    </div></div>`;
}

/* ---------------- analyze ---------------- */
let msgSeq = 0;
function newId(prefix) { return `${prefix}_${Date.now().toString(36)}${(msgSeq++).toString(36)}`; }

async function analyze(overrideText) {
  const input = $('prompt-input');
  const text = (typeof overrideText === 'string' ? overrideText : input.value).trim();
  if (!text || state.isAnalyzing) return;

  state.isAnalyzing = true;
  const sendBtn = $('send-btn');
  sendBtn.disabled = true;
  sendBtn.classList.add('busy');
  if (typeof overrideText !== 'string') {
    input.value = '';
    syncComposer();
  }

  let thread = state.threads.find(t => t.id === state.activeThreadId);
  if (!thread) {
    thread = {
      id: newId('th'),
      title: text.slice(0, 40) + (text.length > 40 ? '…' : ''),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    state.threads.unshift(thread);
    state.activeThreadId = thread.id;
    state.justAddedThreadId = thread.id;
    renderSidebarThreads();
  }

  streamToken++; // stop any previous typewriter
  appendPendingTurn(text);

  const sentAt = performance.now();
  // keep the Thinking indicator up long enough that it never just flashes
  const MIN_THINKING_MS = 900;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    let result;
    try {
      const r = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: ctrl.signal
      });
      try { result = await r.json(); }
      catch (_) { result = { error: `پاسخ نامعتبر از سرور (HTTP ${r.status})` }; }
    } catch (e) {
      result = { error: e.name === 'AbortError' ? 'زمان پاسخ‌گویی سرور تمام شد' : 'ارتباط با سرور برقرار نشد' };
    }

    const realElapsedMs = performance.now() - sentAt;
    if (MIN_THINKING_MS > realElapsedMs) await sleep(MIN_THINKING_MS - realElapsedMs);
    const thinkingMs = Math.max(realElapsedMs, MIN_THINKING_MS);

    const msg = { id: newId('msg'), text, result, ts: Date.now(), thinkingMs: Math.round(thinkingMs) };
    thread.messages.push(msg);
    thread.updatedAt = Date.now();
    saveState();
    renderSidebarThreads();

    // fade the Thinking block out before the answer replaces it
    const pending = $('pending-turn');
    if (pending && !REDUCED_MOTION) {
      pending.classList.add('pending-fade');
      await sleep(200);
    }

    if (state.activeThreadId !== thread.id) return; // user moved away
    if (result && !result.error) await renderActiveThreadWithTyping(msg.id);
    else renderActiveThread();
  } finally {
    clearTimeout(timer);
    state.isAnalyzing = false;
    sendBtn.classList.remove('busy');
    syncComposer();
    if (window.matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
  }
}

function appendPendingTurn(text) {
  setWelcome(false);
  const stream = $('chat-stream');
  const old = $('pending-turn');
  if (old) old.remove();
  const div = document.createElement('div');
  div.id = 'pending-turn';
  div.style.display = 'contents';
  div.innerHTML = `
    <div class="msg user fade"><div class="ubox"><div class="bubble" dir="auto">${escapeHtml(text)}</div></div></div>
    <div class="msg bot fade"><div class="bot-body">
      <div class="thinking-block" role="status" aria-live="polite">
        <span class="thinking-sparkle">${sparkSVG(true)}</span>
        <span class="thinking-text">در حال فکر کردن</span>
      </div>
    </div></div>`;
  stream.appendChild(div);
  scrollToBottom(true);
}

function reAnalyze(msgId) {
  const msg = findMessage(msgId);
  if (msg) analyze(msg.text);
}

/* ---------------- composer (lag-free) ---------------- */
// Native auto-grow where supported (Chrome/Edge 123+, Safari 18.2+): the
// browser sizes the textarea itself, so typing never forces a JS layout.
// Elsewhere we measure at most once per frame. Counter / send-button
// updates only touch the DOM when their value actually changes.
const HAS_FIELD_SIZING = !!(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'));
const composer = { raf: 0, len: -1, canSend: null, h: 0 };

function initComposer() {
  const el = $('prompt-input');
  if (HAS_FIELD_SIZING) document.documentElement.classList.add('field-sizing');
  el.addEventListener('input', scheduleComposerSync, { passive: true });
  el.addEventListener('keydown', handleKey);
  syncComposer();
}
function scheduleComposerSync() {
  if (composer.raf) return;
  composer.raf = requestAnimationFrame(() => { composer.raf = 0; syncComposer(); });
}
function syncComposer() {
  const el = $('prompt-input');
  if (!HAS_FIELD_SIZING) {
    el.style.height = 'auto';
    const h = Math.min(el.scrollHeight, 200);
    el.style.height = h + 'px';
    composer.h = h;
  }
  const len = el.value.length;
  if (len !== composer.len) {
    composer.len = len;
    const c = $('char-counter');
    if (len > 200) { c.textContent = len.toLocaleString('fa-IR'); c.classList.remove('hidden'); }
    else c.classList.add('hidden');
  }
  const canSend = len > 0 && !state.isAnalyzing && /\S/.test(el.value);
  if (canSend !== composer.canSend) {
    composer.canSend = canSend;
    $('send-btn').disabled = !canSend;
  }
}
// kept for backwards compatibility with older inline handlers
function autoResize() { syncComposer(); }

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    analyze();
  }
}

function useStarter(text) { analyze(text); }

async function pasteClipboard() {
  try {
    const t = await navigator.clipboard.readText();
    if (t) {
      const input = $('prompt-input');
      input.value = t.slice(0, 20000);
      syncComposer();
      input.focus();
    }
  } catch (e) { showToast('دسترسی به کلیپ‌بورد ممکن نیست'); }
}

/* ---------------- dropdown / theme / modals ---------------- */
function toggleModelDropdown(e) {
  e.stopPropagation();
  $('model-dropdown').classList.toggle('open');
}
function closeModelDropdown() { $('model-dropdown').classList.remove('open'); }

function setViewMode(mode) {
  state.viewMode = mode;
  saveState();
  updateViewModeCheckmarks();
  renderActiveThread();
  closeModelDropdown();
}

function updateViewModeCheckmarks() {
  const d = $('check-detailed');
  const c = $('check-compact');
  if (!d || !c) return;
  d.classList.toggle('hidden', state.viewMode !== 'detailed');
  c.classList.toggle('hidden', state.viewMode === 'detailed');
}

function syncThemeIcon() {
  $('theme-icon').innerHTML = svg(document.documentElement.classList.contains('dark') ? 'sun' : 'moon');
}

function toggleTheme() {
  const root = document.documentElement;
  if (!REDUCED_MOTION) {
    root.classList.add('theme-anim');
    clearTimeout(toggleTheme._t);
    toggleTheme._t = setTimeout(() => root.classList.remove('theme-anim'), 320);
  }
  root.classList.toggle('dark');
  try { localStorage.setItem('polyguard_theme', root.classList.contains('dark') ? 'dark' : 'light'); } catch (e) {}
  syncThemeIcon();
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
  if (lastFocus && lastFocus.focus && window.matchMedia('(hover: hover)').matches) lastFocus.focus({ preventScroll: true });
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
// Only follow new content if the user hasn't scrolled up to read.
function keepPinned() {
  const c = $('messages-container');
  if (c.scrollHeight - c.scrollTop - c.clientHeight < 160) c.scrollTop = c.scrollHeight;
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

function copyMessageJSON(id) {
  const m = findMessage(id);
  if (!m) return;
  copyText(JSON.stringify(m.result, null, 2)).then(() => showToast('JSON کپی شد'));
}

function copyReport(id) {
  const m = findMessage(id);
  if (!m || !m.result) return;
  const r = m.result;
  copyText(`متن: "${m.text}"\nنتیجه: ${r.decision} (اطمینان ${(num(r.confidence) * 100).toFixed(1)}% | آرا ${num(r.votes_count)}/${num(r.total_models)})`)
    .then(() => showToast('گزارش کپی شد'));
}

function exportCurrentThread() {
  const t = state.threads.find(x => x.id === state.activeThreadId);
  if (!t) { showToast('گفتگویی برای خروجی انتخاب نشده'); return; }
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `polyguard_${t.id}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500); // revoking immediately breaks the download in Firefox
  showToast('فایل JSON دانلود شد');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
