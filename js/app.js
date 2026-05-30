// js/app.js
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CATEGORIES = ['income','bills','expenses','savings'];

let currentUser = null;
let currentDate = new Date();
let currentMonthId = null;
let currentData = { income: [], bills: [], expenses: [], savings: [] };

// ─── INIT ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  document.getElementById('user-email').textContent = currentUser.email;
  await loadTheme();
  initCharts();
  await switchMonth();
  setupThemePicker();
});

// ─── MONTH NAVIGATION ────────────────────────────────────────────────────────
function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  switchMonth();
}

async function switchMonth() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth() + 1;
  document.getElementById('display-month').textContent = `${MONTHS[m-1]} ${y}`;
  setSaveStatus('loading');

  // Get or create month record
  let { data: monthRow } = await db
    .from('months')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('year', y)
    .eq('month', m)
    .single();

  if (!monthRow) {
    const { data: newMonth } = await db
      .from('months')
      .insert({ user_id: currentUser.id, year: y, month: m })
      .select('id')
      .single();
    monthRow = newMonth;
    await seedFromPreviousMonth(monthRow.id, y, m);
  }

  currentMonthId = monthRow.id;
  await loadEntries();
  await loadTrend();
}

// Seed new month from previous if exists
async function seedFromPreviousMonth(newMonthId, year, month) {
  const prevDate = new Date(year, month - 2, 1);
  const py = prevDate.getFullYear(), pm = prevDate.getMonth() + 1;

  const { data: prevMonth } = await db
    .from('months')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('year', py)
    .eq('month', pm)
    .single();

  if (!prevMonth) {
    // Seed with defaults
    const defaults = [
      { category:'income',   name:'Paycheck 1',     planned:3500, actual:0, is_recurring:false },
      { category:'income',   name:'Side Hustle',    planned:500,  actual:0, is_recurring:false },
      { category:'bills',    name:'Rent',           planned:1200, actual:0, is_recurring:true  },
      { category:'bills',    name:'Internet',       planned:80,   actual:0, is_recurring:true  },
      { category:'bills',    name:'Phone',          planned:60,   actual:0, is_recurring:true  },
      { category:'expenses', name:'Groceries',      planned:400,  actual:0, is_recurring:false },
      { category:'expenses', name:'Dining Out',     planned:200,  actual:0, is_recurring:false },
      { category:'expenses', name:'Transport',      planned:150,  actual:0, is_recurring:false },
      { category:'savings',  name:'Emergency Fund', planned:200,  actual:0, is_recurring:false },
      { category:'savings',  name:'Vacation',       planned:100,  actual:0, is_recurring:false },
    ];
    await db.from('entries').insert(defaults.map((e,i) => ({ ...e, month_id: newMonthId, user_id: currentUser.id, sort_order: i })));
    return;
  }

  const { data: prevEntries } = await db.from('entries').select('*').eq('month_id', prevMonth.id);
  if (prevEntries && prevEntries.length) {
    const seeded = prevEntries.map(e => ({
      month_id: newMonthId,
      user_id: currentUser.id,
      category: e.category,
      name: e.name,
      planned: e.planned,
      actual: 0,
      is_recurring: e.is_recurring,
      sort_order: e.sort_order
    }));
    await db.from('entries').insert(seeded);
  }
}

// ─── LOAD ENTRIES ────────────────────────────────────────────────────────────
async function loadEntries() {
  const { data: entries } = await db
    .from('entries')
    .select('*')
    .eq('month_id', currentMonthId)
    .order('sort_order');

  currentData = { income: [], bills: [], expenses: [], savings: [] };
  (entries || []).forEach(e => {
    if (currentData[e.category]) currentData[e.category].push(e);
  });

  renderTables();
  updateDashboard();
  setSaveStatus('saved');
}

// ─── LOAD TREND (6 months) ───────────────────────────────────────────────────
async function loadTrend() {
  const trendData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;

    const { data: monthRow } = await db.from('months').select('id').eq('user_id', currentUser.id).eq('year', y).eq('month', m).single();
    if (!monthRow) { trendData.push({ label: MONTH_SHORT[m-1], savings: 0, income: 0 }); continue; }

    const { data: entries } = await db.from('entries').select('category,actual').eq('month_id', monthRow.id);
    const sum = (cat) => (entries || []).filter(e => e.category === cat).reduce((a,e) => a + parseFloat(e.actual||0), 0);
    trendData.push({ label: MONTH_SHORT[m-1], savings: sum('savings'), income: sum('income') });
  }
  updateCharts(currentData, trendData);
}

// ─── RENDER TABLES ───────────────────────────────────────────────────────────
function renderTables() {
  CATEGORIES.forEach(cat => {
    const tbody = document.getElementById(`tbody-${cat}`);
    tbody.innerHTML = '';
    currentData[cat].forEach((item) => {
      const diff = parseFloat(item.actual) - parseFloat(item.planned);
      const diffClass = diff > 0 ? 'diff-pos' : diff < 0 ? 'diff-neg' : 'diff-zero';
      const diffSign  = diff > 0 ? '+' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="display:flex;align-items:center;gap:5px;">
            ${item.is_recurring ? '<span class="recur-dot" title="Recurring">↻</span>' : ''}
            <input class="cell-input" value="${escHtml(item.name)}"
              onchange="updateEntry('${item.id}','name',this.value)">
          </div>
        </td>
        <td><input class="cell-input right" type="number" value="${item.planned}"
          onchange="updateEntry('${item.id}','planned',+this.value)"></td>
        <td><input class="cell-input right" type="number" value="${item.actual}"
          style="${diff < 0 && cat !== 'income' ? 'color:var(--red)' : diff > 0 && cat === 'income' ? 'color:var(--green)' : ''}"
          onchange="updateEntry('${item.id}','actual',+this.value)"></td>
        <td><span class="${diffClass}">${diff !== 0 ? diffSign + fmt(Math.abs(diff)) : '—'}</span></td>
        <td><button class="del-btn" onclick="removeEntry('${item.id}','${cat}')">✕</button></td>
      `;
      tbody.appendChild(tr);
    });
  });

  let total = CATEGORIES.reduce((a,c) => a + currentData[c].length, 0);
  document.getElementById('item-count').textContent = total + ' items';
}

// ─── DASHBOARD CARDS + ALERTS ────────────────────────────────────────────────
function updateDashboard() {
  const sum = (arr, k) => arr.reduce((a, r) => a + (parseFloat(r[k]) || 0), 0);
  const T = {};
  CATEGORIES.forEach(c => T[c] = { plan: sum(currentData[c],'planned'), actual: sum(currentData[c],'actual') });

  const spent = T.bills.actual + T.expenses.actual + T.savings.actual;
  const rem   = T.income.actual - spent;

  document.getElementById('card-income').textContent   = fmt(T.income.actual);
  document.getElementById('card-bills').textContent    = fmt(T.bills.actual);
  document.getElementById('card-expenses').textContent = fmt(T.expenses.actual);
  document.getElementById('card-savings').textContent  = fmt(T.savings.actual);
  const remEl = document.getElementById('card-remaining');
  remEl.textContent   = fmt(rem);
  remEl.style.color   = rem >= 0 ? 'var(--green)' : 'var(--red)';

  renderAlerts();
}

function renderAlerts() {
  const alertsEl = document.getElementById('alerts-row');
  alertsEl.innerHTML = '';
  const alerts = [];

  CATEGORIES.forEach(cat => {
    currentData[cat].forEach(item => {
      const plan = parseFloat(item.planned) || 0;
      const actual = parseFloat(item.actual) || 0;
      if (plan === 0) return;
      const pct = Math.round((actual / plan) * 100);
      if (cat === 'expenses' || cat === 'bills') {
        if (pct > 100) alerts.push({ type:'over', text:`${item.name}: ${pct}% of budget` });
        else if (pct >= 85) alerts.push({ type:'warn', text:`${item.name}: ${pct}% used` });
      }
      if (cat === 'savings' && actual >= plan) alerts.push({ type:'ok', text:`${item.name} on track` });
    });
  });

  if (!alerts.length) alerts.push({ type:'ok', text:'All budgets on track' });

  alerts.slice(0,5).forEach(a => {
    const icon = a.type === 'over' ? '⚠' : a.type === 'warn' ? '◉' : '✓';
    const pill = document.createElement('div');
    pill.className = `alert-pill alert-${a.type}`;
    pill.textContent = `${icon} ${a.text}`;
    alertsEl.appendChild(pill);
  });
}

// ─── CRUD ────────────────────────────────────────────────────────────────────
async function addEntry(category) {
  const sort = currentData[category].length;
  const { data, error } = await db.from('entries').insert({
    month_id: currentMonthId,
    user_id: currentUser.id,
    category,
    name: 'New Item',
    planned: 0,
    actual: 0,
    sort_order: sort
  }).select().single();

  if (!error) {
    currentData[category].push(data);
    renderTables();
    updateDashboard();
    setSaveStatus('saved');
  }
}

let saveTimer = null;
async function updateEntry(id, field, value) {
  // Optimistic UI update
  CATEGORIES.forEach(cat => {
    const item = currentData[cat].find(e => e.id === id);
    if (item) item[field] = value;
  });
  updateDashboard();

  clearTimeout(saveTimer);
  setSaveStatus('saving');
  saveTimer = setTimeout(async () => {
    await db.from('entries').update({ [field]: value }).eq('id', id);
    setSaveStatus('saved');
    loadTrend();
  }, 600);
}

async function removeEntry(id, category) {
  currentData[category] = currentData[category].filter(e => e.id !== id);
  renderTables();
  updateDashboard();
  await db.from('entries').delete().eq('id', id);
  setSaveStatus('saved');
}

// ─── THEME ───────────────────────────────────────────────────────────────────
const THEMES = [
  { name:'Midnight',  bg:'#0d0d0f', surface:'#13131a', surface2:'#18181f', border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.13)', text:'#e8e6e0', text2:'#7a7888', text3:'#3a3a48' },
  { name:'Deep Navy', bg:'#050c1a', surface:'#0b1628', surface2:'#0f1e36', border:'rgba(100,160,255,0.1)',  border2:'rgba(100,160,255,0.2)',  text:'#d6e4f7', text2:'#5a7aaa', text3:'#2a3a58' },
  { name:'Forest',    bg:'#040f0a', surface:'#0a1f14', surface2:'#0e2a1b', border:'rgba(90,212,130,0.1)',   border2:'rgba(90,212,130,0.2)',   text:'#c8f0d4', text2:'#4a8860', text3:'#1e3828' },
  { name:'Plum',      bg:'#0e0514', surface:'#180c22', surface2:'#1e1030', border:'rgba(180,120,255,0.1)',  border2:'rgba(180,120,255,0.2)',  text:'#e4d0f8', text2:'#7a5aa8', text3:'#3a1e58' },
  { name:'Espresso',  bg:'#110b05', surface:'#1e1408', surface2:'#271c0e', border:'rgba(220,160,80,0.1)',   border2:'rgba(220,160,80,0.2)',   text:'#f0e0c8', text2:'#8a6840', text3:'#40281a' },
  { name:'Slate',     bg:'#0a0e12', surface:'#111620', surface2:'#161d2a', border:'rgba(160,180,210,0.1)',  border2:'rgba(160,180,210,0.2)',  text:'#d0d8e8', text2:'#5a6880', text3:'#2a3040' },
  { name:'Rose Dark', bg:'#120508', surface:'#1f0c12', surface2:'#2a101a', border:'rgba(240,100,130,0.1)',  border2:'rgba(240,100,130,0.2)',  text:'#f4d0da', text2:'#a05070', text3:'#4a1828' },
  { name:'Light',     bg:'#f4f2ee', surface:'#ffffff',  surface2:'#eeecea', border:'rgba(0,0,0,0.08)',       border2:'rgba(0,0,0,0.15)',       text:'#1a1a20', text2:'#6a6878', text3:'#b0aeb8' },
  { name:'Warm White',bg:'#faf6f0', surface:'#ffffff',  surface2:'#f0ebe3', border:'rgba(0,0,0,0.08)',       border2:'rgba(0,0,0,0.15)',       text:'#2a200a', text2:'#7a6848', text3:'#c0a888' },
];

function applyTheme(t) {
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg);
  r.setProperty('--surface', t.surface);
  r.setProperty('--surface2', t.surface2);
  r.setProperty('--border', t.border);
  r.setProperty('--border2', t.border2);
  r.setProperty('--text', t.text);
  r.setProperty('--text2', t.text2);
  r.setProperty('--text3', t.text3);
  document.body.style.background = t.bg;
  document.body.style.color = t.text;
}

function applyCustomBg(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const lum = 0.299*r + 0.587*g + 0.114*b;
  const light = lum > 140;
  const mix = (v,t,p) => Math.round(v+(t-v)*p);
  const sr = mix(r,255,0.12), sg = mix(g,255,0.12), sb = mix(b,255,0.12);
  const sr2 = mix(r,255,0.22), sg2 = mix(g,255,0.22), sb2 = mix(b,255,0.22);
  applyTheme({
    bg: hex, surface: `rgb(${sr},${sg},${sb})`, surface2: `rgb(${sr2},${sg2},${sb2})`,
    border:  light ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.08)',
    border2: light ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.16)',
    text:  light ? '#1a1a20' : '#e8e6e0',
    text2: light ? '#6a6870' : '#7a7888',
    text3: light ? '#aaa8b8' : '#3a3a48',
  });
}

function setupThemePicker() {
  const row = document.getElementById('swatch-row');
  THEMES.forEach((t, i) => {
    const s = document.createElement('div');
    s.className = 'swatch' + (i === 0 ? ' active' : '');
    s.style.background = t.bg;
    if (t.bg === '#f4f2ee' || t.bg === '#faf6f0') s.style.border = '2px solid rgba(0,0,0,0.15)';
    s.title = t.name;
    s.addEventListener('click', () => {
      row.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      applyTheme(t);
      saveTheme(t.name, t.bg);
    });
    row.appendChild(s);
  });

  document.getElementById('custom-color').addEventListener('input', e => {
    row.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
    applyCustomBg(e.target.value);
    saveTheme('custom', e.target.value);
  });
}

async function loadTheme() {
  const { data } = await db.from('themes').select('*').eq('user_id', currentUser.id).single();
  if (!data) return;
  if (data.preset_name === 'custom') {
    applyCustomBg(data.bg_color);
    document.getElementById('custom-color').value = data.bg_color;
  } else {
    const t = THEMES.find(x => x.name === data.preset_name);
    if (t) applyTheme(t);
  }
}

let themeTimer = null;
async function saveTheme(name, bg) {
  clearTimeout(themeTimer);
  themeTimer = setTimeout(async () => {
    await db.from('themes').upsert({ user_id: currentUser.id, preset_name: name, bg_color: bg }, { onConflict: 'user_id' });
  }, 800);
}

// ─── EXPORT CSV ──────────────────────────────────────────────────────────────
function exportCSV() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth()+1;
  let csv = `Month,${MONTHS[m-1]} ${y}\nCategory,Item,Planned,Actual\n`;
  CATEGORIES.forEach(cat => {
    currentData[cat].forEach(r => {
      csv += `${cat.toUpperCase()},${r.name},${r.planned},${r.actual}\n`;
    });
  });
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `budget_${y}-${String(m).padStart(2,'0')}.csv`;
  a.click();
}

// ─── CLEAR ALL ───────────────────────────────────────────────────────────────
async function clearMonth() {
  if (!confirm('Delete all entries for this month? This cannot be undone.')) return;
  await db.from('entries').delete().eq('month_id', currentMonthId);
  await loadEntries();
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmt(n) { return '$' + Math.round(n).toLocaleString(); }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function setSaveStatus(state) {
  const el = document.getElementById('save-status');
  if (state === 'saved')   { el.innerHTML = '☁ synced'; el.style.color = 'var(--green)'; }
  if (state === 'saving')  { el.innerHTML = '↑ saving…'; el.style.color = 'var(--text3)'; }
  if (state === 'loading') { el.innerHTML = '… loading'; el.style.color = 'var(--text3)'; }
}
