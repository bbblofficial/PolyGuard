const STORAGE_KEY = 'unicollect_threads_v4';
const UI_KEY = 'unicollect_ui_v1';
const THEME_KEY = 'unicollect_theme';
const REQUEST_TIMEOUT_MS = 180000;
const HEALTH_TIMEOUT_MS = 8000;
const MAX_TEXT = 20000;
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const CAN_HOVER = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);

const state = {
  threads: [],
  activeThreadId: null,
  isAnalyzing: false,
  viewMode: 'detailed',
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
  msg:         '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  stop:        '<rect x="7" y="7" width="10" height="10" rx="2"/>'
};

function svg(name) {
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
function hydrateIcons(root) {
  (root || document).querySelectorAll('i[data-i]').forEach(el => {
    if (!el.firstChild) el.innerHTML = svg(el.dataset.i);
  });
}

/* ---------------- Unicollect brand mark ----------------
   Six tapered petals around a core. Animations are scale/opacity only:
   - "intro": petals scale in one after another (hero, new chat)
   - "live" : a scale + fade wave travels around the ring (thinking)
   The rotation below is static geometry (petal placement), not motion. */
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
  setInterval(() => { if (!document.hidden) checkHealth(); }, 12000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkHealth(); });
  watchSystemTheme();
  if (CAN_HOVER) $('prompt-input').focus();
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
      state.activeThreadId = state.threads.some(t => t.id === p.activeThreadId) ? p.activeThreadId : null;
      state.viewMode = p.viewMode === 'compact' ? 'compact' : 'detailed';
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
let healthBusy = false;
async function checkHealth() {
  if (healthBusy) return;          // never stack requests on a slow tunnel
  healthBusy = true;
  const dot = $('status-dot');
  const txt = $('status-text');
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  let cls, label, pill;
  try {
    const r = await fetch('/health', { cache: 'no-store', signal: ctrl.signal });
    const d = await r.json();
    state.health = d;
    const n = (d.loaded_models || []).length;
    const total = n + Object.keys(d.errors || {}).length || 5;
    if (d.status === 'ok') { cls = 'sdot ok'; label = `${fa(n)}/${fa(total)} مدل فعال`; pill = `${fa(n)} مدل فعال`; }
    else if (d.status === 'loading') { cls = 'sdot warn'; label = `بارگذاری مدل‌ها (${fa(n)}/${fa(total)})…`; pill = 'در حال بارگذاری'; }
    else { cls = 'sdot bad'; label = 'خطا در بارگذاری'; pill = 'خطا در مدل‌ها'; }
    if (isOpen('settings-modal')) renderHealthDetails(d);
  } catch (e) {
    cls = 'sdot bad'; label = 'سرور در دسترس نیست'; pill = 'آفلاین';
  } finally {
    clearTimeout(to);
    healthBusy = false;
  }
  if (dot.className !== cls) dot.className = cls;
  if (txt.textContent !== label) txt.textContent = label;
  const p = $('models-pill');
  if (p && p.textContent !== pill) p.textContent = pill;
}
function fa(n) { return Number(n).toLocaleString('fa-IR'); }
function renderHealthDetails(d) {
  const c = $('cfg-concurrency');
  if (c && d.concurrency) c.textContent = `${faDigits(d.concurrency)} (اوج ${faDigits(d.peak || 0)})`;
  const m = $('cfg-models');
  if (m) {
    const ok = (d.loaded_models || []).map(x => `<div class="ml"><span class="model-id">${escapeHtml(x)}</span><span class="ok">● آماده</span></div>`).join('');
    const er = Object.keys(d.errors || {}).map(x => `<div class="ml"><span>${escapeHtml(x)}</span><span class="err">● خطا</span></div>`).join('');
    m.innerHTML = (ok + er) || 'مدلی بارگذاری نشده';
  }
}

/* ---------------- sidebar ---------------- */
function isMobile() { return window.innerWidth < 768; }

// Desktop: the sidebar content fades + scales out, THEN the column
// collapses (and the reverse on open). No sliding.
let sbTimer = 0;
function toggleSidebar() {
  const app = $('app');
  if (isMobile()) { app.classList.toggle('mobile-open'); return; }
  app.classList.toggle('collapsed');
  saveUiPrefs();
}
function reflowFade() {
  const b = document.querySelector('.main .body');
  if (!b || REDUCED_MOTION) return;
  b.classList.remove('reflow'); void b.offsetWidth; b.classList.add('reflow');
}
function closeMobileSidebar() { $('app').classList.remove('mobile-open'); }
window.addEventListener('resize', () => { if (!isMobile()) closeMobileSidebar(); }, { passive: true });

function busyToast() { showToast('صبر کنید تا تحلیل فعلی تمام شود'); }

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
  if (id === state.activeThreadId) return;   // no pointless re-render / flash
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

function lastDecision(t) {
  const r = t.messages?.[t.messages.length - 1]?.result;
  if (!r || r.error || !r.decision) return 'dot-err';     // was shown as "safe" before
  return r.decision === 'TOXIC' ? 'dot-bad' : r.decision === 'SUSPECT' ? 'dot-warn' : 'dot-ok';
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
      html += `
        <div class="${cls}" role="button" tabindex="0" onclick="selectThread('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectThread('${id}')}">
          <div class="t-left"><span class="t-dot ${lastDecision(t)}"></span><span class="t-title" dir="auto">${escapeHtml(t.title || 'تحلیل جدید')}</span></div>
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
    initBreakdowns(stream);
    scrollToBottom(false);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/* ---------------- streaming text (Claude-like) ----------------
   Words are released by a requestAnimationFrame clock at a steady pace
   and each one fades in (opacity only). The pace adapts to the length so
   short and long texts both feel natural, and a small pulsing dot rides
   at the end of the text while it streams (ChatGPT-style). */
const SEGMENTER = (window.Intl && Intl.Segmenter) ? new Intl.Segmenter('fa', { granularity: 'word' }) : null;
function splitWords(text) {
  if (SEGMENTER) {
    // merge each word with the whitespace/punctuation that follows it
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
  // never take longer than maxMs, however long the text is
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
      el.textContent = text;   // collapse spans back into one text node
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
        setTimeout(done, 420);   // let the last words finish fading in
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/* ---------------- thinking indicator ----------------
   Animated mark (petal wave) + a status line that cross-fades between
   phases + an elapsed-time counter that appears after 2 s. */
const THINK_PHASES = ['در حال فکر کردن', 'در حال بررسی', 'رأی اجتماعی', 'پرسش از مدل ها'];
const thinking = { phaseTimer: 0, clockTimer: 0, t0: 0, phaseIndex: 0, phaseDoneAt: 0 };

function startThinking() {
  stopThinking();
  thinking.t0 = performance.now();
  thinking.phaseIndex = 0;
  thinking.phaseDoneAt = 0;

  const label = () => $('think-text');

  // Advance through the phase list one step at a time. Each phase
  // (including the last) is shown for a random 700-1700 ms before we move
  // on. When the last phase finishes its dwell, phaseDoneAt is set and the
  // caller (analyze) can reveal the answer.
  const nextPhase = () => {
    const el = label();
    if (!el) return stopThinking();

    if (thinking.phaseIndex >= THINK_PHASES.length - 1) {
      // last phase is on screen right now -> wait out its dwell, then done
      thinking.phaseTimer = setTimeout(() => {
        thinking.phaseDoneAt = performance.now();
        thinking.phaseTimer = 0;
      }, 700 + Math.random() * 1000);
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

    thinking.phaseTimer = setTimeout(nextPhase, 700 + Math.random() * 1000);
  };

  // phase[0] is already visible (written by appendPendingTurn), so wait one
  // dwell interval, then start advancing.
  thinking.phaseTimer = setTimeout(nextPhase, 700 + Math.random() * 1000);

  thinking.clockTimer = setInterval(() => {
    const t = $('think-time');
    if (!t) return;
    const sec = Math.floor((performance.now() - thinking.t0) / 1000);
    const value = sec >= 2 ? `${fa(sec)} ثانیه` : '';
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

/* Swap the pending (thinking) turn for the finished one WITHOUT
   re-rendering older messages (that used to make the whole chat flash). */
function replacePendingTurn(html) {
  const pending = $('pending-turn');
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  if (pending && pending.parentNode) pending.replaceWith(tpl.content);
  else $('chat-stream').appendChild(tpl.content);
  initBreakdowns($('chat-stream'));
}

const DECISIONS = {
  TOXIC:   { icon: 'shieldx',     title: 'محتوای سمی شناسایی شد', text: 'بر اساس رأی‌گیری اجماعی مدل‌ها، این متن حاوی الفاظ توهین‌آمیز یا سمی است.' },
  SUSPECT: { icon: 'shieldalert', title: 'محتوای مشکوک',          text: 'برخی مدل‌ها احتمال سمیت متوسطی دیده‌اند اما اجماع کافی نیست؛ بازبینی انسانی پیشنهاد می‌شود.' },
  SAFE:    { icon: 'shield',      title: 'محتوای سالم',           text: 'هیچ‌یک از مدل‌ها نشانه‌ای از توهین یا سمیت در این متن پیدا نکردند.' }
};

// Shows the newest answer: title + subtitle stream in, then the rest of
// the card (meter, stats, breakdown, actions) cascades in.
async function revealNewTurn(msg) {
  const token = ++streamToken;
  setWelcome(false);
  replacePendingTurn(buildTurnHTML(msg, { animate: true, fresh: true }));
  keepPinned(true);

  const r = msg.result;
  if (!r || r.error || !r.decision || REDUCED_MOTION) return;

  const meta = DECISIONS[r.decision] || { title: 'نتیجه نامشخص', text: '' };
  const wrap = $(`botmsg-${msg.id}`);
  const reveal = () => {
    if (!wrap) return;
    wrap.querySelectorAll('.reveal-item').forEach((el, idx) => {
      setTimeout(() => el.classList.add('show'), idx * 70);
    });
    setTimeout(() => keepPinned(), 480);
  };

  await streamText($(`type-title-${msg.id}`), meta.title, { cps: 45, maxMs: 900, dot: false }, token);
  if (token !== streamToken) return reveal();
  const sub = streamText($(`type-sub-${msg.id}`), meta.text, { cps: 110, maxMs: 1500 }, token);
  setTimeout(reveal, 140);
  await sub;
}

function scriptLabel(s) { return s === 'fa' ? 'فارسی' : s === 'en' ? 'انگلیسی' : 'مختلط'; }
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); }

// "۱٫۲ ثانیه فکر کرد": Claude-style thought-time header.
function thoughtLineHTML(ms, fresh) {
  if (typeof ms !== 'number') return '';
  const secs = (ms / 1000).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // a fresh one takes the Thinking block's place: same spot, petals pop in
  return `<div class="thought-line${fresh ? ' fresh' : ''}" title="زمان صرف‌شده برای تحلیل این متن">
    ${markSVG(fresh ? 'intro' : '')}
    <span>${secs} ثانیه فکر کرد</span>
  </div>`;
}

function userTurnHTML(msg, noFade) {
  const id = escapeHtml(msg.id);
  return `
    <div class="msg user${noFade ? '' : ' fade'}">
      <div class="ubox">
        <div class="bubble" dir="auto">${escapeHtml(msg.text)}</div>
        <div class="uacts">
          <button class="icon-btn" onclick="copyUserText('${id}')" title="کپی متن">${svg('copy')}</button>
          <button class="icon-btn" onclick="reAnalyze('${id}')" title="تحلیل مجدد">${svg('refresh')}</button>
        </div>
      </div>
    </div>`;
}

function buildTurnHTML(msg, opts) {
  const animate = !!(opts && opts.animate) && !REDUCED_MOTION;
  const user = userTurnHTML(msg, opts && opts.fresh);
  const r = msg.result;
  const mid = escapeHtml(msg.id);

  if (!r || r.error || !r.decision) {
    const e = r && r.error ? (typeof r.error === 'string' ? r.error : JSON.stringify(r.error)) : 'پاسخی از سرور دریافت نشد';
    return `${user}
      <div class="msg bot fade"><div class="bot-body">
        <div class="err-box">${svg('alert')}<span>خطا در پردازش: ${escapeHtml(e)}</span></div>
        <div class="actions"><button class="icon-btn" onclick="reAnalyze('${mid}')" title="تلاش مجدد">${svg('refresh')}</button></div>
      </div></div>`;
  }

  const decision = DECISIONS[r.decision] ? r.decision : 'UNKNOWN';
  const meta = DECISIONS[decision] || { icon: 'info', title: 'نتیجه نامشخص', text: 'پاسخ معتبری از سرور دریافت نشد.' };
  const maxPct = Math.max(0, Math.min(100, num(r.max_raw) * 100));
  const titleInner = animate ? `<span class="type-target" id="type-title-${mid}"></span>` : escapeHtml(meta.title);
  const subInner = animate ? `<span class="type-target" id="type-sub-${mid}"></span>` : escapeHtml(meta.text);
  const revealCls = animate ? 'reveal-item' : '';
  const votes = r.votes || {};
  const voteThr = num(r.vote_threshold, 0.5);

  const rows = Object.keys(r.raw_scores || {}).map(key => {
    const raw = Math.max(0, num(r.raw_scores[key]));
    const voted = !!votes[key];
    const w = num(r.weights && r.weights[key], 1);
    const pct = Math.min(100, raw * 100).toFixed(1);
    const fill = voted ? 'f-bad' : raw >= 0.35 ? 'f-warn' : 'f-ok';
    const tag = voted ? '<span class="tag bad">رأی سمی</span>' : raw >= 0.35 ? '<span class="tag warn">مشکوک</span>' : '<span class="tag ok">سالم</span>';
    return `
      <div class="mrow">
        <div class="mrow-top">
          <div class="mrow-name">${tag}<span class="n">${escapeHtml(r.labels?.[key] || key)}</span></div>
          <div class="mrow-val"><span>${faDigits(pct)}٪</span><span class="wt">×${faDigits(w)}</span></div>
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
    const chip = (d) => { if (!d) return ''; const label = d === 'SAFE' ? 'سالم' : d === 'SUSPECT' ? 'مشکوک' : d === 'TOXIC' ? 'سمی' : 'نامشخص'; return `<span class="tag ${d === 'SAFE' ? 'ok' : d === 'SUSPECT' ? 'warn' : 'bad'}">${label}</span>`; };
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
      <summary>ریز نمرات مدل‌ها <span class="chev-ico">${svg('chevron')}</span></summary>
      <div class="bd-card">${rows}${skipped}</div>
    </details>`;

  const thought = thoughtLineHTML(msg.thinkingMs, animate);

  return `${user}
    <div class="msg bot fade${animate ? ' anim' : ''}" id="botmsg-${mid}"><div class="bot-body">
      ${thought}
      <div class="result ${decision}">
        <div class="res-head">
          <span class="res-ico">${svg(meta.icon)}</span>
          <div class="res-txt">
            <div class="res-title">${titleInner}</div>
            <div class="res-sub">${subInner}</div>
          </div>
          <div class="res-score ${revealCls}" title="بیشترین نمره‌ی خام">${faDigits(maxPct.toFixed(0))}<small>٪</small></div>
        </div>
        <div class="meter ${revealCls}">
          <div class="meter-fill" style="width:${maxPct}%"></div>
          <i class="tick" style="inset-inline-start:${voteThr * 100}%"></i>
          <i class="tick" style="inset-inline-start:90%"></i>
        </div>
        <div class="meter-legend ${revealCls}"><span><i class="lg"></i>آستانه رأی ${fa(Math.round(voteThr * 100))}٪</span><span><i class="lg"></i>حد قاطع ۹۰٪</span></div>
        ${fing}
        <div class="stats ${revealCls}">
          <div class="stat"><div class="k">آرای سمیت</div><div class="v num-ltr">${faDigits(num(r.votes_count))} / ${faDigits(num(r.total_models))}</div></div>
          <div class="stat" title="میانگین دو نمره‌ی بالاتر مدل‌ها"><div class="k">میانگین ۲ نمره‌ی برتر</div><div class="v">${faDigits((num(r.confidence) * 100).toFixed(1))}٪</div></div>
          <div class="stat"><div class="k">زبان</div><div class="v">${scriptLabel(r.script)}</div></div>
          <div class="stat"><div class="k">زمان سرور</div><div class="v">${faDigits(num(r.latency_ms))} میلی‌ثانیه</div></div>
        </div>
        ${breakdown}
      </div>
      <div class="actions ${revealCls}">
        <button class="icon-btn" onclick="copyReport('${mid}')" title="کپی گزارش">${svg('copy')}</button>
        <button class="icon-btn" onclick="copyMessageJSON('${mid}')" title="کپی JSON">${svg('code')}</button>
        <button class="icon-btn" onclick="reAnalyze('${mid}')" title="تحلیل مجدد">${svg('refresh')}</button>
      </div>
    </div></div>`;
}


/* انیمیشن باز/بسته شدن details.breakdown (ارتفاع نرم) */
function initBreakdowns(root) {
  (root || document).querySelectorAll('details.breakdown:not([data-bd])').forEach(d => {
    d.dataset.bd = '1';
    const summary = d.querySelector('summary');
    const card = d.querySelector('.bd-card');
    if (!summary || !card) return;

    summary.addEventListener('click', e => {
      e.preventDefault();
      if (REDUCED_MOTION) { d.open = !d.open; return; }
      if (card.classList.contains('animating')) return;
      card.classList.add('animating');

      if (!d.open) {
        // ---- باز شدن ----
        card.style.height = '0px';
        d.open = true;
        const target = card.scrollHeight;
        requestAnimationFrame(() => {
          card.style.transition = 'height .35s cubic-bezier(.22,1,.36,1)';
          card.style.height = target + 'px';
        });
        setTimeout(() => {
          card.style.transition = '';
          card.style.height = '';
          card.classList.remove('animating');
        }, 380);
      } else {
        // ---- بسته شدن ----
        const start = card.scrollHeight;
        card.style.height = start + 'px';
        requestAnimationFrame(() => {
          card.style.transition = 'height .3s cubic-bezier(.22,1,.36,1)';
          card.style.height = '0px';
        });
        setTimeout(() => {
          d.open = false;
          card.style.transition = '';
          card.style.height = '';
          card.classList.remove('animating');
        }, 320);
      }
    });
  });
}

/* ---------------- analyze ---------------- */
let msgSeq = 0;
function newId(prefix) { return `${prefix}_${Date.now().toString(36)}${(msgSeq++).toString(36)}`; }

// Send button doubles as a Stop button while a request is in flight.
function onSendClick() {
  if (state.isAnalyzing) return stopAnalysis();
  analyze();
}
function stopAnalysis() {
  if (!state.isAnalyzing || !state.ctrl) return;
  state.userAborted = true;
  state.ctrl.abort();
}

function setBusy(on) {
  state.isAnalyzing = on;
  const b = $('send-btn');
  b.classList.toggle('busy', on);
  b.title = on ? 'توقف' : 'ارسال';
  b.setAttribute('aria-label', b.title);
  composer.canSend = null;          // force syncComposer to re-apply `disabled`
  syncComposer();
}

function normalizeResult(r, status) {
  if (!r || typeof r !== 'object') return { error: `پاسخ نامعتبر از سرور (HTTP ${status})` };
  if (r.error) return r;
  if (!r.decision) {
    // e.g. FastAPI 422 {"detail": [...]}, or a proxy error page parsed as JSON
    const d = r.detail ? (typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)) : `HTTP ${status}`;
    return { error: `پاسخ نامعتبر از سرور: ${d}` };
  }
  return r;
}

async function analyze(overrideText) {
  const input = $('prompt-input');
  const fromInput = typeof overrideText !== 'string';
  const text = (fromInput ? input.value : overrideText).trim();
  if (!text || state.isAnalyzing) return;
  if (text.length > MAX_TEXT) { showToast(`متن طولانی است (حداکثر ${fa(MAX_TEXT)} نویسه)`); return; }

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

  streamToken++; // stop any previous typewriter
  appendPendingTurn(text);

  const sentAt = performance.now();
  // keep the Thinking indicator up long enough that it never just flashes
  const MIN_THINKING_MS = 1100;
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
      let body = null;
      try { body = await r.json(); } catch (_) { body = null; }
      result = normalizeResult(body, r.status);
    } catch (e) {
      if (state.userAborted) result = null;
      else result = { error: e.name === 'AbortError' ? 'زمان پاسخ‌گویی سرور تمام شد' : 'ارتباط با سرور برقرار نشد' };
    }

    // ---- user pressed Stop: drop the turn, give the text back ----
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
      showToast('تحلیل متوقف شد');
      return;
    }

    // Wait for the *last* phase's dwell to finish (not a fixed floor).
    // If the API already answered, the phases still play out in full;
    // if it hasn't, we wait for it in parallel. THINKING_SAFETY_MS caps
    // the total wait so a stuck phase timer can never freeze the UI.
    const THINKING_SAFETY_MS = 12000;
    const phasesDone = (async () => {
      while (!thinking.phaseDoneAt &&
             (performance.now() - sentAt) < THINKING_SAFETY_MS) {
        await sleep(60);
      }
    })();
    await Promise.race([
      phasesDone,
      sleep(Math.max(0, THINKING_SAFETY_MS - (performance.now() - sentAt)))
    ]);
    const thinkingMs = Math.max(performance.now() - sentAt, MIN_THINKING_MS);

    const msg = { id: newId('msg'), text, result, ts: Date.now(), thinkingMs: Math.round(thinkingMs) };
    thread.messages.push(msg);
    thread.updatedAt = Date.now();
    saveState();
    renderSidebarThreads();

    // fade + scale the Thinking block out before the answer replaces it
    stopThinking();
    const pending = $('pending-turn');
    if (pending && !REDUCED_MOTION) {
      pending.classList.add('pending-fade');
      await sleep(220);
    }

    if (state.activeThreadId !== thread.id) return; // user moved away
    await revealNewTurn(msg);
  } finally {
    clearTimeout(timer);
    stopThinking();
    state.ctrl = null;
    setBusy(false);
    if (CAN_HOVER) input.focus({ preventScroll: true });
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
  // same markup as the final user turn, so nothing jumps when it's swapped
  div.innerHTML = `
    ${userTurnHTML({ id: 'pending', text })}
    <div class="msg bot fade"><div class="bot-body">
      <div class="thinking-block" role="status" aria-live="polite">
        ${markSVG('live')}
        <span class="thinking-label"><span class="thinking-text" id="think-text">${THINK_PHASES[0]}</span></span>
        <span class="thinking-time mono" id="think-time"></span>
      </div>
    </div></div>`;
  stream.appendChild(div);
  startThinking();
  scrollToBottom(true);
}

function reAnalyze(msgId) {
  if (state.isAnalyzing) return busyToast();
  const msg = findMessage(msgId);
  if (msg) analyze(msg.text);
}

/* ---------------- composer: smooth, animated typing ----------------
   The textarea stays the real input (caret, selection, IME, a11y), but in
   "ink" mode its glyphs are transparent and a pixel-identical mirror
   underneath paints the text. Freshly inserted characters are wrapped in
   short-lived spans that fade in, so typing (and pasting) feels alive.
   The box grows/shrinks with a smooth height transition, the placeholder
   fades/scales away, and the send button scales in when it becomes active.
   Very long texts fall back to plain rendering to stay lag-free. */
const INK_MS = 380;
const INK_MAX_LEN = 5000;
const MAX_TA_H = 200;
const composer = { len: -1, canSend: null, h: 0, prev: '', fresh: [], raf: 0, cleanup: 0, dir: 'rtl', ink: false, long: false, instant: false };

const RTL_CH = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CH = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;
function textDir(v) {
  // first strong character decides (like dir=auto), empty -> rtl
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
  // re-measure when wrapping changes (web font loaded, sidebar toggled, resize)
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
  // render synchronously so the mirror never lags a frame behind the caret
  renderMirror();
  syncComposer();
}
function scheduleComposer() {
  if (composer.raf) return;
  composer.raf = requestAnimationFrame(() => { composer.raf = 0; syncComposer(); });
}

// Diff old/new value -> which range was inserted; keep earlier fresh
// ranges (shifted) so a fast typist sees a continuous soft trail.
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
    // ranges touched by the edit are simply dropped (shown fully)
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
  // huge texts: plain textarea rendering, no mirror work per keystroke
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
  // a trailing newline needs a character after it to occupy a line
  if (!v || v.endsWith('\n')) html += '\u200b';
  inner.innerHTML = html;
  if (inner.dir !== dir) inner.dir = dir;

  // drop the spans once they've finished fading (keeps the DOM tiny and
  // removes any sub-pixel shaping differences between spans)
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

  // height: measured from the mirror (no "height:auto" thrash on the textarea)
  const contentH = composer.long ? MAX_TA_H + 1 : inner.scrollHeight;
  const h = Math.max(Math.min(contentH, MAX_TA_H), 0) || el.offsetHeight;
  if (h !== composer.h) {
    composer.h = h;
    el.style.height = h + 'px';           // textarea jumps to its final size…
    if (first || composer.instant) {
      wrap.style.transition = 'none';
      wrap.style.height = h + 'px';
      void wrap.offsetHeight;
      wrap.style.transition = '';
    } else wrap.style.height = h + 'px';  // …while the box animates to it
    el.style.overflowY = contentH > MAX_TA_H ? 'auto' : 'hidden';
    syncMirrorScroll();
  }
  composer.instant = false;

  const len = el.value.length;
  if (len !== composer.len) {
    composer.len = len;
    const c = $('char-counter');
    if (len > 200) { c.textContent = `${fa(len)} / ${fa(MAX_TEXT)}`; c.classList.remove('off'); }
    else c.classList.add('off');
  }
  const canSend = state.isAnalyzing || (len > 0 && /\S/.test(el.value));
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
    if (!state.isAnalyzing) analyze();
  }
}

function useStarter(text) { analyze(text); }

// inserts at the caret (used to replace the whole message)
async function pasteClipboard() {
  try {
    const t = await navigator.clipboard.readText();
    if (!t) return;
    const input = $('prompt-input');
    input.focus();
    const room = MAX_TEXT - (input.value.length - (input.selectionEnd - input.selectionStart));
    const chunk = t.slice(0, Math.max(0, room));
    if (!chunk) { showToast('به حداکثر طول متن رسیده‌اید'); return; }
    input.setRangeText(chunk, input.selectionStart, input.selectionEnd, 'end');
    onComposerInput(false);
  } catch (e) { showToast('دسترسی به کلیپ‌بورد ممکن نیست'); }
}

/* ---------------- dropdown / theme / modals ---------------- */
function toggleModelDropdown(e) {
  e.stopPropagation();
  $('model-dropdown').classList.toggle('open');
}
function closeModelDropdown() { $('model-dropdown').classList.remove('open'); }

function setViewMode(mode) {
  closeModelDropdown();
  if (mode === state.viewMode) return;
  state.viewMode = mode;
  saveState();
  updateViewModeCheckmarks();
  updateModelButtonLabel();
  // toggle open/closed in place instead of re-rendering (keeps scroll + no flash)
  document.querySelectorAll('#chat-stream details.breakdown').forEach(d => { d.open = mode === 'detailed'; });
}

function updateViewModeCheckmarks() {
  const d = $('check-detailed');
  const c = $('check-compact');
  if (!d || !c) return;
  d.classList.toggle('off', state.viewMode !== 'detailed');
  c.classList.toggle('off', state.viewMode === 'detailed');
}

function updateModelButtonLabel() {
  const el = $('model-name');
  if (el) el.textContent = state.viewMode === 'compact' ? 'Light' : 'Flash';
}

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
// follow the OS theme until the user picks one explicitly
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
  closeModelDropdown();
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

function copyMessageJSON(id) {
  const m = findMessage(id);
  if (!m) return;
  copyText(JSON.stringify(m.result, null, 2)).then(() => showToast('JSON کپی شد'));
}

function copyReport(id) {
  const m = findMessage(id);
  if (!m || !m.result) return;
  const r = m.result;
  copyText(`متن: "${m.text}"\nنتیجه: ${r.decision} (میانگین ۲ نمره‌ی برتر ${faDigits((num(r.confidence) * 100).toFixed(1))}٪ | آرا ${faDigits(num(r.votes_count))}/${faDigits(num(r.total_models))})`)
    .then(() => showToast('گزارش کپی شد'));
}

function exportCurrentThread() {
  const t = state.threads.find(x => x.id === state.activeThreadId);
  if (!t) { showToast('گفتگویی برای خروجی انتخاب نشده'); return; }
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `unicollect_${t.id}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500); // revoking immediately breaks the download in Firefox
  showToast('فایل JSON دانلود شد');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/* ==== UNICOLLECT FIXER: HERO GREETING ==== */
/*
   Rotates the welcome-screen hero text. On each visit (and each new
   chat), one of the following is picked:

     • a greeting chosen from the *user's local hour*
         صبحت بخیر   (05:00–11:59)
         ظهرت بخیر   (12:00–15:59)
         عصرت بخیر   (16:00–18:59)
         شبت بخیر    (19:00–04:59)
     • or one of a set of playful prompt lines, at random

   Picked once on first load, and again whenever a fresh chat starts.
*/
(function () {
  "use strict";

  var HERO_STATIC = [
    'چه متنی را برایتان بررسی کنم؟',
    'بزن بریم سراغ بررسی!',
    'دیگه چه فحش‌هایی قراره ببینم!',
    'خب، چی آوردی برام؟',
    'امروز چه متنی رو بررسی کنیم؟',
    'متن بعدی رو بفرست تا ببینم',
    'بذار ببینم چی آوردی',
    'آماده‌ی بررسی‌ام، شروع کن!',
    'چه خبر؟ متن جدیدی داری؟',
    'بریم سراغ یه بررسی دیگه',
    'چی تو سرت می‌گذره؟',
    'متن بعدی رو بفرست',
    'چه نوشته‌ای داری برای من؟',
    'بیا شروع کنیم',
    'منتظر متنتم...'
  ];

  function pickGreeting() {
    var h = new Date().getHours();
    if (h >= 5  && h < 12) return 'صبحت بخیر';
    if (h >= 12 && h < 16) return 'ظهرت بخیر';
    if (h >= 16 && h < 19) return 'عصرت بخیر';
    return 'شبت بخیر';
  }

  function pickHeroText() {
    // ~25% chance of a time-appropriate greeting
    if (Math.random() < 0.25) return pickGreeting();
    return HERO_STATIC[Math.floor(Math.random() * HERO_STATIC.length)];
  }

  var reduced = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function applyHero() {
    var el = document.getElementById('hero-text');
    if (!el) return;

    var next = pickHeroText();
    if (el.textContent === next) return;

    if (reduced) {
      el.textContent = next;
      return;
    }

    // soft crossfade: fade out, swap the string, fade back in
    el.style.transition = 'opacity .18s ease';
    el.style.opacity = '0';
    window.setTimeout(function () {
      el.textContent = next;
      // on the next frame, put opacity back so the fade-in runs
      window.requestAnimationFrame(function () {
        el.style.opacity = '';
      });
    }, 180);
  }

  // expose for the createNewThread hook below
  window.updateHeroGreeting = applyHero;

  // run once after the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // let the existing DOMContentLoaded handler run first
      window.setTimeout(applyHero, 0);
    });
  } else {
    applyHero();
  }

  // wrap createNewThread so every fresh chat also gets a fresh line
  function hookNewThread() {
    var orig = window.createNewThread;
    if (typeof orig !== 'function' || orig.__heroWrapped) return;
    var wrapped = function () {
      var out = orig.apply(this, arguments);
      window.setTimeout(applyHero, 40);
      return out;
    };
    wrapped.__heroWrapped = true;
    window.createNewThread = wrapped;
  }

  // createNewThread is defined by the main script; wait until it exists
  if (typeof window.createNewThread === 'function') {
    hookNewThread();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      window.setTimeout(hookNewThread, 0);
    });
  }
})();
/* ==== /UNICOLLECT FIXER: HERO GREETING ==== */
