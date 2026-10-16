const STORAGE_KEY = 'polyguard_threads_v4';

const state = {
  threads: [],
  activeThreadId: null,
  isAnalyzing: false,
  viewMode: 'detailed',
  health: null
};

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
  info:        '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
};

function svg(name) {
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
function hydrateIcons(root) {
  (root || document).querySelectorAll('i[data-i]').forEach(el => {
    if (!el.firstChild) el.innerHTML = svg(el.dataset.i);
  });
}

/* ---------------- init ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  hydrateIcons();
  loadState();
  syncThemeIcon();
  renderSidebarThreads();
  renderActiveThread();
  checkHealth();
  setInterval(checkHealth, 12000);
  if (window.innerWidth < 768) document.getElementById('app').classList.remove('collapsed');
  document.getElementById('prompt-input').focus();
  document.addEventListener('click', () => document.getElementById('model-dropdown').classList.add('hidden'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettingsModal(); });
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state.threads = p.threads || [];
      state.activeThreadId = p.activeThreadId || null;
      state.viewMode = p.viewMode || 'detailed';
    }
  } catch (e) { console.warn(e); }
  updateViewModeCheckmarks();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      threads: state.threads, activeThreadId: state.activeThreadId, viewMode: state.viewMode
    }));
  } catch (e) { console.warn(e); }
}

/* ---------------- health ---------------- */
async function checkHealth() {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  try {
    const r = await fetch('/health');
    const d = await r.json();
    state.health = d;
    const n = (d.loaded_models || []).length;
    if (d.status === 'ok') {
      dot.className = 'sdot ok';
      txt.textContent = `${n}/5 مدل فعال`;
    } else if (d.status === 'loading') {
      dot.className = 'sdot warn';
      txt.textContent = `بارگذاری مدل‌ها (${n}/5)…`;
    } else {
      dot.className = 'sdot bad';
      txt.textContent = 'خطا در بارگذاری';
    }
    const c = document.getElementById('cfg-concurrency');
    if (c && d.concurrency) c.textContent = `${d.concurrency} (Peak ${d.peak || 0})`;
    const m = document.getElementById('cfg-models');
    if (m) {
      const ok = (d.loaded_models || []).map(x => `<div class="ml"><span>${escapeHtml(x)}</span><span class="ok">● Ready</span></div>`).join('');
      const er = Object.keys(d.errors || {}).map(x => `<div class="ml"><span>${escapeHtml(x)}</span><span class="err">● Error</span></div>`).join('');
      m.innerHTML = (ok + er) || 'مدلی بارگذاری نشده';
    }
  } catch (e) {
    dot.className = 'sdot bad';
    txt.textContent = 'سرور آفلاین';
  }
}

/* ---------------- sidebar ---------------- */
function toggleSidebar() {
  const app = document.getElementById('app');
  if (window.innerWidth < 768) app.classList.toggle('mobile-open');
  else app.classList.toggle('collapsed');
}
function closeMobileSidebar() { document.getElementById('app').classList.remove('mobile-open'); }

function toggleSearchInput() {
  const box = document.getElementById('sidebar-search-box');
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) document.getElementById('search-threads').focus();
}

function createNewThread() {
  if (state.isAnalyzing) return;
  state.activeThreadId = null;
  saveState();
  renderSidebarThreads();
  renderActiveThread();
  closeMobileSidebar();
  document.getElementById('prompt-input').focus();
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
  state.threads = state.threads.filter(t => t.id !== id);
  if (state.activeThreadId === id) state.activeThreadId = null;
  saveState();
  renderSidebarThreads();
  renderActiveThread();
  showToast('گفتگو حذف شد');
}

function clearAllHistory() {
  if (!confirm('آیا تمام تاریخچه گفتگوها پاک شود؟')) return;
  state.threads = [];
  state.activeThreadId = null;
  saveState();
  renderSidebarThreads();
  renderActiveThread();
  closeSettingsModal();
  showToast('تاریخچه پاک شد');
}

function renderSidebarThreads() {
  const box = document.getElementById('threads-list');
  const q = (document.getElementById('search-threads')?.value || '').toLowerCase().trim();

  const list = state.threads
    .filter(t => !q || (t.title || '').toLowerCase().includes(q) ||
                 (t.messages || []).some(m => (m.text || '').toLowerCase().includes(q)))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (!list.length) {
    box.innerHTML = `<div class="sb-empty">${q ? 'موردی یافت نشد' : 'هنوز گفتگویی ثبت نشده است'}</div>`;
    return;
  }

  const now = Date.now(), day = 86400000;
  const groups = { 'امروز': [], '۷ روز گذشته': [], 'قدیمی‌تر': [] };
  list.forEach(t => {
    const age = now - (t.updatedAt || t.createdAt || now);
    (age < day ? groups['امروز'] : age < day * 7 ? groups['۷ روز گذشته'] : groups['قدیمی‌تر']).push(t);
  });

  let html = '';
  for (const [label, items] of Object.entries(groups)) {
    if (!items.length) continue;
    html += `<div class="sb-group-label">${label}</div>`;
    items.forEach(t => {
      const last = t.messages?.[t.messages.length - 1]?.result?.decision;
      const dotCls = last === 'TOXIC' ? 'dot-bad' : last === 'SUSPECT' ? 'dot-warn' : 'dot-ok';
      html += `
        <div class="thread ${t.id === state.activeThreadId ? 'active' : ''}" onclick="selectThread('${t.id}')">
          <div class="t-left"><span class="t-dot ${dotCls}"></span><span class="t-title">${escapeHtml(t.title || 'تحلیل جدید')}</span></div>
          <button class="t-del" onclick="deleteThread(event,'${t.id}')" title="حذف">${svg('trash')}</button>
        </div>`;
    });
  }
  box.innerHTML = html;
}

/* ---------------- chat rendering ---------------- */
function setWelcome(on) {
  document.getElementById('main').classList.toggle('welcome', on);
}

function renderActiveThread() {
  const stream = document.getElementById('chat-stream');
  const thread = state.threads.find(t => t.id === state.activeThreadId);
  if (!thread || !thread.messages.length) {
    setWelcome(true);
    stream.innerHTML = '';
    return;
  }
  setWelcome(false);
  stream.innerHTML = thread.messages.map(buildTurnHTML).join('');
  scrollToBottom(false);
}

const DECISIONS = {
  TOXIC:   { icon: 'shieldx',     title: 'محتوای سمی شناسایی شد', text: 'بر اساس رأی‌گیری اجماعی مدل‌ها، این متن حاوی الفاظ توهین‌آمیز یا سمی است.' },
  SUSPECT: { icon: 'shieldalert', title: 'محتوای مشکوک',          text: 'برخی مدل‌ها احتمال سمیت متوسطی دیده‌اند اما اجماع کافی نیست؛ بازبینی انسانی پیشنهاد می‌شود.' },
  SAFE:    { icon: 'shield',      title: 'محتوای سالم',           text: 'هیچ‌یک از مدل‌ها نشانه‌ای از توهین یا سمیت در این متن پیدا نکردند.' }
};

function scriptLabel(s) { return s === 'fa' ? 'فارسی' : s === 'en' ? 'انگلیسی' : 'مختلط'; }

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

function buildTurnHTML(msg) {
  const user = userTurnHTML(msg);
  const r = msg.result;

  if (!r || r.error) {
    const e = r && r.error ? (typeof r.error === 'string' ? r.error : JSON.stringify(r.error)) : 'پاسخی از سرور دریافت نشد';
    return `${user}
      <div class="msg bot fade"><div class="bot-body">
        <div class="err-box">${svg('alert')}<span>خطا در پردازش: ${escapeHtml(e)}</span></div>
        <div class="actions"><button class="icon-btn" onclick="reAnalyze('${msg.id}')" title="تلاش مجدد">${svg('refresh')}</button></div>
      </div></div>`;
  }

  const meta = DECISIONS[r.decision] || { icon: 'info', title: 'نتیجه نامشخص', text: 'پاسخ معتبری از سرور دریافت نشد.' };
  const maxPct = Math.min(100, r.max_raw * 100);

  const rows = Object.keys(r.raw_scores || {}).map(key => {
    const raw = r.raw_scores[key];
    const voted = r.votes[key];
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
    const chip = (d) => d ? `<span class="tag ${d === 'SAFE' ? 'ok' : 'bad'}">${d}</span>` : '';
    fing = `
      <div class="note">
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
    <details class="breakdown" ${detailed ? 'open' : ''}>
      <summary>ریز نمرات مدل‌ها ${svg('chevron')}</summary>
      <div class="bd-card">${rows}${skipped}</div>
    </details>`;

  return `${user}
    <div class="msg bot fade"><div class="bot-body">
      <div class="result ${r.decision}">
        <div class="res-head">
          <span class="res-ico">${svg(meta.icon)}</span>
          <div class="res-txt">
            <div class="res-title">${meta.title}</div>
            <div class="res-sub">${meta.text}</div>
          </div>
          <div class="res-score mono" title="بیشترین نمره‌ی خام">${maxPct.toFixed(0)}<small>%</small></div>
        </div>
        <div class="meter">
          <div class="meter-fill" style="width:${maxPct}%"></div>
          <i class="tick" style="inset-inline-start:50%"></i>
          <i class="tick" style="inset-inline-start:90%"></i>
        </div>
        <div class="meter-legend"><span><i class="lg"></i>آستانه رأی ۵۰٪</span><span><i class="lg"></i>حد قاطع ۹۰٪</span></div>
        ${fing}
        <div class="stats">
          <div class="stat"><div class="k">آرای سمیت</div><div class="v mono">${r.votes_count} / ${r.total_models}</div></div>
          <div class="stat"><div class="k">اطمینان</div><div class="v mono">${(r.confidence * 100).toFixed(1)}%</div></div>
          <div class="stat"><div class="k">زبان</div><div class="v">${scriptLabel(r.script)}</div></div>
          <div class="stat"><div class="k">زمان</div><div class="v mono">${r.latency_ms || 0} ms</div></div>
        </div>
        ${breakdown}
      </div>
      <div class="actions">
        <button class="icon-btn" onclick="copyReport('${msg.id}')" title="کپی گزارش">${svg('copy')}</button>
        <button class="icon-btn" onclick="copyMessageJSON('${msg.id}')" title="کپی JSON">${svg('code')}</button>
        <button class="icon-btn" onclick="reAnalyze('${msg.id}')" title="تحلیل مجدد">${svg('refresh')}</button>
      </div>
    </div></div>`;
}

/* ---------------- analyze ---------------- */
async function analyze(overrideText) {
  const input = document.getElementById('prompt-input');
  const text = (typeof overrideText === 'string' ? overrideText : input.value).trim();
  if (!text || state.isAnalyzing) return;

  state.isAnalyzing = true;
  const sendBtn = document.getElementById('send-btn');
  sendBtn.disabled = true;
  sendBtn.classList.add('busy');
  if (typeof overrideText !== 'string') {
    input.value = '';
    autoResize(input);
  }

  let thread = state.threads.find(t => t.id === state.activeThreadId);
  if (!thread) {
    thread = {
      id: 'th_' + Date.now(),
      title: text.slice(0, 40) + (text.length > 40 ? '…' : ''),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    state.threads.unshift(thread);
    state.activeThreadId = thread.id;
  }

  appendPendingTurn(text);

  try {
    const r = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    let result;
    try { result = await r.json(); }
    catch (_) { result = { error: `پاسخ نامعتبر (HTTP ${r.status})` }; }

    thread.messages.push({ id: 'msg_' + Date.now(), text, result, ts: Date.now() });
    thread.updatedAt = Date.now();
    saveState();
    renderSidebarThreads();
    renderActiveThread();
  } catch (e) {
    showToast('خطا در ارتباط با سرور');
    renderActiveThread();
  } finally {
    state.isAnalyzing = false;
    document.getElementById('send-btn').classList.remove('busy');
    autoResize(input);
    input.focus();
  }
}

function appendPendingTurn(text) {
  setWelcome(false);
  const stream = document.getElementById('chat-stream');
  const old = document.getElementById('pending-turn');
  if (old) old.remove();
  const div = document.createElement('div');
  div.id = 'pending-turn';
  div.style.display = 'contents';
  div.innerHTML = `
    <div class="msg user fade"><div class="ubox"><div class="bubble" dir="auto">${escapeHtml(text)}</div></div></div>
    <div class="msg bot fade"><div class="bot-body"><div class="pending"><span class="thinking"></span><span class="shimmer">در حال بررسی با ۵ مدل…</span></div></div></div>`;
  stream.appendChild(div);
  scrollToBottom(true);
}

function reAnalyze(msgId) {
  const msg = findMessage(msgId);
  if (msg) analyze(msg.text);
}

/* ---------------- composer ---------------- */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  const c = document.getElementById('char-counter');
  if (el.value.length) { c.textContent = el.value.length; c.classList.remove('hidden'); }
  else c.classList.add('hidden');
  document.getElementById('send-btn').disabled = !el.value.trim() || state.isAnalyzing;
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    analyze();
  }
}

function useStarter(text) { analyze(text); }

async function pasteClipboard() {
  try {
    const t = await navigator.clipboard.readText();
    if (t) {
      const input = document.getElementById('prompt-input');
      input.value = t;
      autoResize(input);
      input.focus();
    }
  } catch (e) { showToast('دسترسی به کلیپ‌بورد ممکن نیست'); }
}

/* ---------------- dropdown / theme / modal ---------------- */
function toggleModelDropdown(e) {
  e.stopPropagation();
  document.getElementById('model-dropdown').classList.toggle('hidden');
}

function setViewMode(mode) {
  state.viewMode = mode;
  saveState();
  updateViewModeCheckmarks();
  renderActiveThread();
  document.getElementById('model-dropdown').classList.add('hidden');
}

function updateViewModeCheckmarks() {
  const d = document.getElementById('check-detailed');
  const c = document.getElementById('check-compact');
  if (!d || !c) return;
  d.classList.toggle('hidden', state.viewMode !== 'detailed');
  c.classList.toggle('hidden', state.viewMode === 'detailed');
}

function syncThemeIcon() {
  const icon = document.getElementById('theme-icon');
  icon.innerHTML = svg(document.documentElement.classList.contains('dark') ? 'sun' : 'moon');
}

function toggleTheme() {
  const root = document.documentElement;
  root.classList.toggle('dark');
  try { localStorage.setItem('polyguard_theme', root.classList.contains('dark') ? 'dark' : 'light'); } catch (e) {}
  syncThemeIcon();
}

function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); checkHealth(); closeMobileSidebar(); }
function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-message').textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ---------------- helpers ---------------- */
function scrollToBottom(smooth) {
  const c = document.getElementById('messages-container');
  c.scrollTo({ top: c.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

function findMessage(id) {
  for (const t of state.threads) {
    const f = t.messages.find(m => m.id === id);
    if (f) return f;
  }
  return null;
}

function copyText(s) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s);
  const ta = document.createElement('textarea');
  ta.value = s; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove();
  return Promise.resolve();
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
  copyText(`متن: "${m.text}"\nنتیجه: ${r.decision} (اطمینان ${(r.confidence * 100).toFixed(1)}% | آرا ${r.votes_count}/${r.total_models})`)
    .then(() => showToast('گزارش کپی شد'));
}

function exportCurrentThread() {
  const t = state.threads.find(x => x.id === state.activeThreadId);
  if (!t) { showToast('گفتگویی برای خروجی انتخاب نشده'); return; }
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `polyguard_${t.id}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('فایل JSON دانلود شد');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
