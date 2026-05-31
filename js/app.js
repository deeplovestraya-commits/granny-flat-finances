// ── State ────────────────────────────────────────────────────────────────────
const state = {
  role: null,
  pass: null,
  data: { version: '1.0', airbnb_imports: [], leases: [], expenses: [] },
  currentView: 'dashboard',
  incomeChart: null,
  expenseChart: null,
  editingLeaseId: null
};

const EXPENSE_LABELS = {
  repairs:     'Repairs & maintenance',
  cleaning:    'Cleaning',
  rates:       'Council rates',
  water:       'Water & sewerage',
  insurance:   'Insurance',
  utilities:   'Utilities',
  mortgage:    'Mortgage interest',
  gardening:   'Gardening',
  pest:        'Pest control',
  furnishings: 'Furnishings & equipment',
  linen:       'Linen & supplies',
  accounting:  'Accounting & tax',
  advertising: 'Advertising',
  other:       'Other'
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function aud(n) {
  return '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

// Australian financial year: 1 Jul – 30 Jun
function fyBounds(label) {
  // label like "FY2025–26" or "this-fy" / "last-fy"
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth(); // 0-based; July = 6

  let startYear = cm >= 6 ? cy : cy - 1;
  if (label === 'last-fy') startYear -= 1;
  return {
    start: `${startYear}-07-01`,
    end:   `${startYear + 1}-06-30`
  };
}

function periodFilter(dateISO, period) {
  if (!dateISO) return false;
  const now = new Date();
  const d = new Date(dateISO);

  if (period === 'all-time') return true;
  if (period === 'this-month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (period === 'last-month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
  }
  if (period === 'this-fy' || period === 'last-fy') {
    const { start, end } = fyBounds(period);
    return dateISO >= start && dateISO <= end;
  }
  return true;
}

// ── API ───────────────────────────────────────────────────────────────────────
async function apiAuth(password) {
  const res = await fetch('/.netlify/functions/tracker-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  return res.ok ? res.json() : null;
}

async function apiLoadData() {
  const res = await fetch('/.netlify/functions/tracker-data');
  return res.ok ? res.json() : state.data;
}

async function apiSaveData() {
  const res = await fetch('/.netlify/functions/tracker-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tracker-Pass': state.pass
    },
    body: JSON.stringify(state.data)
  });
  return res.ok;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  err.classList.add('hidden');

  const result = await apiAuth(pw);
  if (result && result.role) {
    state.role = result.role;
    state.pass = pw;
    sessionStorage.setItem('tracker-role', result.role);
    sessionStorage.setItem('tracker-pass', pw);
    await bootApp();
  } else {
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.clear();
  location.reload();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function bootApp() {
  showProcessing('Loading data...');
  state.data = await apiLoadData();
  hideProcessing();

  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  const roleBadge = document.getElementById('user-role-badge');
  roleBadge.textContent = state.role === 'admin' ? 'Admin' : 'Viewer';

  // Hide admin-only elements for viewers
  if (state.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  }

  populateFYDropdown();
  navigateTo('dashboard');
}

// ── Navigation ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

function navigateTo(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelector(`.nav-item[data-view="${view}"]`).classList.add('active');
  renderView(view);
}

function renderView(view) {
  if (view === 'dashboard')  renderDashboard();
  if (view === 'income')     renderIncome();
  if (view === 'expenses')   renderExpenses();
  if (view === 'reports')    renderReport();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const periodSelect = document.getElementById('dashboard-period');
periodSelect.addEventListener('change', renderDashboard);

function getFilteredTotals(period) {
  const airbnbIncome = state.data.airbnb_imports
    .filter(r => periodFilter(r.period_start, period))
    .reduce((s, r) => s + (r.total || 0), 0);

  const leaseIncome = state.data.leases
    .filter(r => periodFilter(r.start_date, period))
    .reduce((s, r) => s + (r.total_value || 0), 0);

  const totalExpenses = state.data.expenses
    .filter(r => periodFilter(r.date, period))
    .reduce((s, r) => s + (r.amount || 0), 0);

  const totalIncome = airbnbIncome + leaseIncome;
  const net = totalIncome - totalExpenses;
  return { totalIncome, totalExpenses, net, airbnbIncome, leaseIncome };
}

function renderDashboard() {
  const period = periodSelect.value;
  const { totalIncome, totalExpenses, net } = getFilteredTotals(period);

  document.getElementById('stat-income').textContent   = aud(totalIncome);
  document.getElementById('stat-expenses').textContent = aud(totalExpenses);
  document.getElementById('stat-your-share').textContent = aud(net / 2);
  document.getElementById('stat-pk-share').textContent   = aud(net / 2);

  renderIncomeChart(period);
  renderExpenseChart(period);
  renderRecentActivity();
}

function renderIncomeChart(period) {
  const ctx = document.getElementById('income-chart').getContext('2d');
  if (state.incomeChart) state.incomeChart.destroy();

  // Group by month
  const months = {};
  const addToMonth = (dateISO, amount) => {
    if (!dateISO) return;
    const key = dateISO.slice(0, 7); // YYYY-MM
    months[key] = (months[key] || 0) + amount;
  };

  state.data.airbnb_imports
    .filter(r => periodFilter(r.period_start, period))
    .forEach(r => addToMonth(r.period_start, r.total || 0));
  state.data.leases
    .filter(r => periodFilter(r.start_date, period))
    .forEach(r => addToMonth(r.start_date, r.total_value || 0));

  const labels = Object.keys(months).sort();
  const values = labels.map(l => months[l]);

  const fmt = l => {
    const [y, m] = l.split('-');
    return new Date(y, m - 1).toLocaleString('en-AU', { month: 'short', year: '2-digit' });
  };

  state.incomeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(fmt),
      datasets: [{
        label: 'Income (AUD)',
        data: values,
        backgroundColor: '#FF385C',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } }
    }
  });
}

function renderExpenseChart(period) {
  const ctx = document.getElementById('expense-chart').getContext('2d');
  if (state.expenseChart) state.expenseChart.destroy();

  const cats = {};
  state.data.expenses
    .filter(r => periodFilter(r.date, period))
    .forEach(r => { cats[r.category] = (cats[r.category] || 0) + (r.amount || 0); });

  const labels = Object.keys(cats).map(k => EXPENSE_LABELS[k] || k);
  const values = Object.values(cats);
  const colors = ['#FF385C','#FF6B81','#FF9AA2','#FFB7B2','#FFDAC1','#E2F0CB','#B5EAD7','#C7CEEA','#957DAD','#D291BC'];

  state.expenseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, values.length), borderWidth: 0 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } }
    }
  });
}

function renderRecentActivity() {
  const list = document.getElementById('recent-list');
  const all = [
    ...state.data.airbnb_imports.map(r => ({ date: r.period_start, label: `Airbnb – ${fmtDate(r.period_start)}`, amount: r.total, type: 'income' })),
    ...state.data.leases.map(r => ({ date: r.start_date, label: `Lease – ${r.tenant_name}`, amount: r.total_value, type: 'income' })),
    ...state.data.expenses.map(r => ({ date: r.date, label: `${EXPENSE_LABELS[r.category] || r.category} – ${r.vendor}`, amount: r.amount, type: 'expense' }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);

  if (!all.length) {
    list.innerHTML = '<p class="empty-state">No activity yet.</p>';
    return;
  }
  list.innerHTML = all.map(item => `
    <div class="activity-item">
      <div>
        <div class="activity-label">${item.label}</div>
        <div class="activity-date">${fmtDate(item.date)}</div>
      </div>
      <div class="activity-amount ${item.type === 'income' ? 'positive' : 'negative'}">
        ${item.type === 'income' ? '+' : '-'}${aud(item.amount)}
      </div>
    </div>
  `).join('');
}

// ── Income – Tabs ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const parent = tab.closest('.tab-bar').parentElement;
    parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    parent.querySelector(`#tab-${tab.dataset.tab}`).classList.add('active');
  });
});

function renderIncome() {
  renderAirbnbTable();
  renderLeasesTable();
}

// ── Airbnb Import ─────────────────────────────────────────────────────────────
const airbnbDropZone  = document.getElementById('airbnb-drop-zone');
const airbnbFileInput = document.getElementById('airbnb-file-input');

if (airbnbDropZone) {
  airbnbDropZone.addEventListener('dragover',  e => { e.preventDefault(); airbnbDropZone.classList.add('drag-over'); });
  airbnbDropZone.addEventListener('dragleave', () => airbnbDropZone.classList.remove('drag-over'));
  airbnbDropZone.addEventListener('drop', e => {
    e.preventDefault();
    airbnbDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleAirbnbFile(file);
  });
}
if (airbnbFileInput) {
  airbnbFileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleAirbnbFile(e.target.files[0]);
  });
}

async function handleAirbnbFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Please upload a PDF file.');
    return;
  }
  showProcessing('Reading Airbnb PDF...');
  try {
    const text = await extractPDFText(file);
    const parsed = parseAirbnbPDF(text);

    if (!parsed.period_start) {
      hideProcessing();
      alert('Could not read the period from this PDF. Please check it is an Airbnb earnings report.');
      return;
    }

    // Duplicate check
    const exists = state.data.airbnb_imports.find(r => r.period_start === parsed.period_start);
    if (exists) {
      hideProcessing();
      if (!confirm(`An import for ${fmtDate(parsed.period_start)} already exists. Replace it?`)) return;
      state.data.airbnb_imports = state.data.airbnb_imports.filter(r => r.period_start !== parsed.period_start);
    }

    state.data.airbnb_imports.push({ id: uid(), ...parsed, imported_at: new Date().toISOString() });
    state.data.airbnb_imports.sort((a, b) => (b.period_start || '').localeCompare(a.period_start || ''));

    await apiSaveData();
    hideProcessing();
    renderAirbnbTable();
    renderDashboard();
  } catch (err) {
    hideProcessing();
    alert('Error reading PDF: ' + err.message);
  }
}

function renderAirbnbTable() {
  const tbody = document.getElementById('airbnb-tbody');
  const rows = state.data.airbnb_imports;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No Airbnb imports yet. Drop a monthly earnings PDF above.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}</td>
      <td class="text-right">${aud(r.gross_earnings)}</td>
      <td class="text-right">${aud(r.adjustments)}</td>
      <td class="text-right amount-negative">${aud(r.service_fees)}</td>
      <td class="text-right">${aud(r.tax_withheld)}</td>
      <td class="text-right amount-positive">${aud(r.total)}</td>
      <td class="text-right">${r.nights_booked}</td>
      <td class="admin-only text-right">
        <button class="btn-danger" onclick="deleteAirbnb('${r.id}')">Remove</button>
      </td>
    </tr>
  `).join('');

  if (state.role !== 'admin') {
    tbody.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  }
}

window.deleteAirbnb = async (id) => {
  if (!confirm('Remove this Airbnb import?')) return;
  state.data.airbnb_imports = state.data.airbnb_imports.filter(r => r.id !== id);
  await apiSaveData();
  renderAirbnbTable();
  renderDashboard();
};

// ── Leases ────────────────────────────────────────────────────────────────────
document.getElementById('add-lease-btn')?.addEventListener('click', () => openLeaseModal());
document.getElementById('lease-modal-close')?.addEventListener('click', closeLeaseModal);
document.getElementById('lease-cancel-btn')?.addEventListener('click', closeLeaseModal);

// Auto-calculate total value
['lease-start', 'lease-end', 'lease-rent-pw'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    const start = document.getElementById('lease-start').value;
    const end   = document.getElementById('lease-end').value;
    const pw    = parseFloat(document.getElementById('lease-rent-pw').value) || 0;
    if (start && end && pw) {
      const days  = (new Date(end) - new Date(start)) / 86400000;
      const weeks = days / 7;
      document.getElementById('lease-total').value = (weeks * pw).toFixed(2);
    }
  });
});

document.getElementById('lease-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const lease = {
    id: state.editingLeaseId || uid(),
    tenant_name: document.getElementById('lease-tenant').value.trim(),
    start_date:  document.getElementById('lease-start').value,
    end_date:    document.getElementById('lease-end').value,
    rent_per_week: parseFloat(document.getElementById('lease-rent-pw').value) || 0,
    total_value: parseFloat(document.getElementById('lease-total').value) || 0,
    notes: document.getElementById('lease-notes').value.trim(),
    created_at: new Date().toISOString()
  };

  if (state.editingLeaseId) {
    const i = state.data.leases.findIndex(r => r.id === state.editingLeaseId);
    if (i >= 0) state.data.leases[i] = lease;
  } else {
    state.data.leases.unshift(lease);
  }

  showProcessing('Saving...');
  await apiSaveData();
  hideProcessing();
  closeLeaseModal();
  renderLeasesTable();
  renderDashboard();
});

function openLeaseModal(id) {
  state.editingLeaseId = id || null;
  const modal = document.getElementById('lease-modal');
  document.getElementById('lease-modal-title').textContent = id ? 'Edit lease' : 'Add lease';
  document.getElementById('lease-form').reset();

  if (id) {
    const r = state.data.leases.find(l => l.id === id);
    if (r) {
      document.getElementById('lease-tenant').value   = r.tenant_name;
      document.getElementById('lease-start').value    = r.start_date;
      document.getElementById('lease-end').value      = r.end_date;
      document.getElementById('lease-rent-pw').value  = r.rent_per_week;
      document.getElementById('lease-total').value    = r.total_value;
      document.getElementById('lease-notes').value    = r.notes || '';
    }
  }
  modal.classList.remove('hidden');
}

function closeLeaseModal() {
  document.getElementById('lease-modal').classList.add('hidden');
  state.editingLeaseId = null;
}

function renderLeasesTable() {
  const tbody = document.getElementById('leases-tbody');
  if (!state.data.leases.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No leases yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.data.leases.map(r => `
    <tr>
      <td>${r.tenant_name}</td>
      <td>${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}</td>
      <td class="text-right">${aud(r.rent_per_week)} / week</td>
      <td class="text-right amount-positive">${aud(r.total_value)}</td>
      <td>${r.notes || ''}</td>
      <td class="admin-only text-right">
        <button class="btn-outline" style="padding:4px 10px;font-size:12px;margin-right:4px" onclick="openLeaseModal('${r.id}')">Edit</button>
        <button class="btn-danger" onclick="deleteLease('${r.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
  if (state.role !== 'admin') {
    tbody.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  }
}

window.openLeaseModal = openLeaseModal;
window.deleteLease = async (id) => {
  if (!confirm('Delete this lease?')) return;
  state.data.leases = state.data.leases.filter(r => r.id !== id);
  await apiSaveData();
  renderLeasesTable();
  renderDashboard();
};

// ── Expenses ──────────────────────────────────────────────────────────────────
const expenseDropZone  = document.getElementById('expense-drop-zone');
const expenseFileInput = document.getElementById('expense-file-input');
const expenseFilter    = document.getElementById('expense-filter');

if (expenseDropZone) {
  expenseDropZone.addEventListener('dragover',  e => { e.preventDefault(); expenseDropZone.classList.add('drag-over'); });
  expenseDropZone.addEventListener('dragleave', () => expenseDropZone.classList.remove('drag-over'));
  expenseDropZone.addEventListener('drop', e => {
    e.preventDefault();
    expenseDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleExpenseFile(file);
  });
}
if (expenseFileInput) {
  expenseFileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleExpenseFile(e.target.files[0]);
  });
}
expenseFilter?.addEventListener('change', renderExpenses);

async function handleExpenseFile(file) {
  showProcessing('Reading document...');
  let parsed = { date: isoToday(), amount: null, vendor: '' };

  try {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      const text = await extractPDFText(file);
      parsed = { ...parsed, ...parseExpensePDF(text) };
    }
  } catch (err) {
    console.warn('PDF parse error', err);
  }

  hideProcessing();
  openExpenseModal(parsed);
}

document.getElementById('expense-modal-close')?.addEventListener('click',  closeExpenseModal);
document.getElementById('expense-cancel-btn')?.addEventListener('click',   closeExpenseModal);

document.getElementById('expense-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const expense = {
    id: uid(),
    date:     document.getElementById('exp-date').value,
    vendor:   document.getElementById('exp-vendor').value.trim(),
    category: document.getElementById('exp-category').value,
    amount:   parseFloat(document.getElementById('exp-amount').value) || 0,
    notes:    document.getElementById('exp-notes').value.trim(),
    created_at: new Date().toISOString()
  };

  state.data.expenses.unshift(expense);
  showProcessing('Saving...');
  await apiSaveData();
  hideProcessing();
  closeExpenseModal();
  renderExpenses();
  renderDashboard();
});

function openExpenseModal(prefill = {}) {
  document.getElementById('expense-form').reset();
  document.getElementById('exp-date').value   = prefill.date   || isoToday();
  document.getElementById('exp-amount').value = prefill.amount || '';
  document.getElementById('exp-vendor').value = prefill.vendor || '';
  document.getElementById('expense-modal').classList.remove('hidden');
}

function closeExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

// Allow manually adding expense without uploading a file
document.getElementById('add-expense-btn')?.addEventListener('click', () => openExpenseModal());

function renderExpenses() {
  const tbody = document.getElementById('expenses-tbody');
  const cat   = expenseFilter?.value || 'all';
  const rows  = state.data.expenses.filter(r => cat === 'all' || r.category === cat);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No expenses yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${fmtDate(r.date)}</td>
      <td>${r.vendor}</td>
      <td>${EXPENSE_LABELS[r.category] || r.category}</td>
      <td class="text-right amount-negative">${aud(r.amount)}</td>
      <td>${r.notes || ''}</td>
      <td class="admin-only text-right">
        <button class="btn-danger" onclick="deleteExpense('${r.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
  if (state.role !== 'admin') {
    tbody.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  }
}

window.deleteExpense = async (id) => {
  if (!confirm('Delete this expense?')) return;
  state.data.expenses = state.data.expenses.filter(r => r.id !== id);
  await apiSaveData();
  renderExpenses();
  renderDashboard();
};

// ── Reports ───────────────────────────────────────────────────────────────────
function populateFYDropdown() {
  const sel = document.getElementById('report-fy');
  const now = new Date();
  const currentFYStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  sel.innerHTML = '';
  for (let y = currentFYStart; y >= currentFYStart - 4; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `FY${y}–${String(y + 1).slice(2)}`;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', renderReport);
}

function renderReport() {
  const fyStart = parseInt(document.getElementById('report-fy').value);
  const start = `${fyStart}-07-01`;
  const end   = `${fyStart + 1}-06-30`;

  const inRange = date => date >= start && date <= end;

  const airbnbTotal = state.data.airbnb_imports
    .filter(r => inRange(r.period_start || ''))
    .reduce((s, r) => s + (r.total || 0), 0);

  const leaseTotal = state.data.leases
    .filter(r => inRange(r.start_date || ''))
    .reduce((s, r) => s + (r.total_value || 0), 0);

  const totalIncome = airbnbTotal + leaseTotal;

  // Expenses by category
  const expByCat = {};
  state.data.expenses
    .filter(r => inRange(r.date || ''))
    .forEach(r => { expByCat[r.category] = (expByCat[r.category] || 0) + (r.amount || 0); });

  const totalExpenses = Object.values(expByCat).reduce((s, v) => s + v, 0);
  const net = totalIncome - totalExpenses;

  document.getElementById('report-airbnb-total').textContent = aud(airbnbTotal);
  document.getElementById('report-lease-total').textContent  = aud(leaseTotal);
  document.getElementById('report-income-total').textContent = aud(totalIncome);
  document.getElementById('report-net').textContent          = aud(net);
  document.getElementById('report-your-share').textContent   = aud(net / 2);
  document.getElementById('report-pk-share').textContent     = aud(net / 2);

  const expTbody = document.getElementById('report-expenses-tbody');
  expTbody.innerHTML = Object.entries(expByCat).map(([cat, amt]) => `
    <tr>
      <td>${EXPENSE_LABELS[cat] || cat}</td>
      <td class="text-right">${aud(amt)}</td>
    </tr>
  `).join('') + `
    <tr class="total-row">
      <td>Total expenses</td>
      <td class="text-right">${aud(totalExpenses)}</td>
    </tr>
  `;
}

document.getElementById('export-pdf-btn')?.addEventListener('click', () => window.print());

document.getElementById('export-csv-btn')?.addEventListener('click', () => {
  const fyStart = parseInt(document.getElementById('report-fy').value);
  const start = `${fyStart}-07-01`;
  const end   = `${fyStart + 1}-06-30`;
  const inRange = d => d >= start && d <= end;

  const rows = [
    ['Type', 'Date', 'Description', 'Category', 'Amount (AUD)'],
    ...state.data.airbnb_imports.filter(r => inRange(r.period_start || '')).map(r =>
      ['Income – Airbnb', r.period_start, `Airbnb ${fmtDate(r.period_start)}–${fmtDate(r.period_end)}`, 'Airbnb', r.total]
    ),
    ...state.data.leases.filter(r => inRange(r.start_date || '')).map(r =>
      ['Income – Lease', r.start_date, `Lease – ${r.tenant_name}`, 'Direct lease', r.total_value]
    ),
    ...state.data.expenses.filter(r => inRange(r.date || '')).map(r =>
      ['Expense', r.date, r.vendor, EXPENSE_LABELS[r.category] || r.category, -r.amount]
    )
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `granny-flat-FY${fyStart}-${fyStart+1}.csv`;
  a.click();
});

// ── Processing overlay ────────────────────────────────────────────────────────
function showProcessing(msg) {
  document.getElementById('processing-text').textContent = msg || 'Processing...';
  document.getElementById('processing-overlay').classList.remove('hidden');
}
function hideProcessing() {
  document.getElementById('processing-overlay').classList.add('hidden');
}

// ── Auto-login from session ───────────────────────────────────────────────────
(async () => {
  const savedRole = sessionStorage.getItem('tracker-role');
  const savedPass = sessionStorage.getItem('tracker-pass');
  if (savedRole && savedPass) {
    state.role = savedRole;
    state.pass = savedPass;
    await bootApp();
  }
})();
