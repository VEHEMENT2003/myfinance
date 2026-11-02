/* ── MyFinance – Analytics (Phase 5) ─────────────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';

(function () {
  const $ = s => document.querySelector(s);
  const { formatINR, escapeHtml } = MF.ui;

  let charts = { cashflow: null, categories: null, modes: null, savings: null };

  // Format: YYYY-MM-DD
  const fmt = (d) => d.toISOString().slice(0, 10);

  function getRange(type) {
    const now = new Date();
    let start = new Date(), end = new Date();

    if (type === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (type === '3_months') {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === '6_months') {
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'this_year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }
    return { from: fmt(start), to: fmt(end) };
  }

  async function load() {
    const rangeType = $('#range-filter').value;
    const { from, to } = getRange(rangeType);

    try {
      const txs = await DB.transactions.list({ from, to, limit: 1000 });
      render(txs, from, to, rangeType);
    } catch (err) {
      console.error(err);
      MF.ui.toast('Failed to load analytics', 'error');
    }
  }

  function render(txs, from, to, rangeType) {
    // 1. KPIs
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    
    $('#kpi-income').textContent = formatINR(income);
    $('#kpi-expense').textContent = formatINR(expenses);
    $('#kpi-savings').textContent = formatINR(income - expenses);

    // 2. Cashflow Chart (Line)
    const isLongRange = rangeType === '6_months' || rangeType === 'this_year';
    const labels = [];
    const incomeData = [];
    const expenseData = [];

    if (isLongRange) {
      // Group by month
      const months = {};
      txs.forEach(t => {
        const m = t.transaction_date.slice(0, 7); // YYYY-MM
        if (!months[m]) months[m] = { in: 0, out: 0 };
        if (t.type === 'income') months[m].in += Number(t.amount);
        if (t.type === 'expense') months[m].out += Number(t.amount);
      });
      Object.keys(months).sort().forEach(m => {
        labels.push(new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
        incomeData.push(months[m].in);
        expenseData.push(months[m].out);
      });
    } else {
      // Group by day
      const days = {};
      txs.forEach(t => {
        if (!days[t.transaction_date]) days[t.transaction_date] = { in: 0, out: 0 };
        if (t.type === 'income') days[t.transaction_date].in += Number(t.amount);
        if (t.type === 'expense') days[t.transaction_date].out += Number(t.amount);
      });
      Object.keys(days).sort().forEach(d => {
        labels.push(new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
        incomeData.push(days[d].in);
        expenseData.push(days[d].out);
      });
    }

    renderLineChart('cashflow', labels, incomeData, expenseData);

    // 3. Category Chart (Doughnut)
    const cats = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const name = t.categories?.name || 'Uncategorised';
      const color = t.categories?.color || '#91A0B5';
      if (!cats[name]) cats[name] = { amount: 0, color };
      cats[name].amount += Number(t.amount);
    });
    renderDoughnutChart('categories', Object.keys(cats), Object.values(cats).map(c => c.amount), Object.values(cats).map(c => c.color));

    // 4. Payment Mode (Bar)
    const modes = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const m = (t.payment_mode || 'other').replace('_', ' ');
      if (!modes[m]) modes[m] = 0;
      modes[m] += Number(t.amount);
    });
    renderBarChart('modes', Object.keys(modes), Object.values(modes));

    // 5. Savings Trend (Bar)
    const savingsLabels = [];
    const savingsData = [];
    // Simplified: Income - Expenses per period (month/day)
    if (isLongRange) {
      const months = {};
      txs.forEach(t => {
        const m = t.transaction_date.slice(0, 7);
        if (!months[m]) months[m] = 0;
        if (t.type === 'income') months[m] += Number(t.amount);
        if (t.type === 'expense') months[m] -= Number(t.amount);
      });
      Object.keys(months).sort().forEach(m => {
        savingsLabels.push(new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short' }));
        savingsData.push(months[m]);
      });
    } else {
      // Just show overall savings for short ranges
      savingsLabels = ['Net Savings'];
      savingsData = [income - expenses];
    }
    renderBarChart('savings', savingsLabels, savingsData, '#00D6A0');
  }

  /* ── Chart.js Renderers ── */

  function renderLineChart(id, labels, inData, outData) {
    if (charts[id]) charts[id].destroy();
    const ctx = document.getElementById(`chart-${id}`);
    
    const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(0,214,160,0.2)');
    grad.addColorStop(1, 'rgba(0,214,160,0)');

    charts[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Income', data: inData, borderColor: '#00C98D', backgroundColor: grad, fill: true, tension: 0.3 },
          { label: 'Expense', data: outData, borderColor: '#FF555F', backgroundColor: 'transparent', borderDash: [5,5], tension: 0.3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#91A0B5', usePointStyle: true, boxWidth: 6 } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#91A0B5', maxTicksLimit: 10 } },
          y: { grid: { color: 'rgba(36,54,77,0.3)' }, ticks: { color: '#91A0B5', callback: v => '₹' + v/1000 + 'k' } }
        }
      }
    });
  }

  function renderDoughnutChart(id, labels, data, colors) {
    if (charts[id]) charts[id].destroy();
    const ctx = document.getElementById(`chart-${id}`);
    
    charts[id] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0, cutout: '70%' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#91A0B5', usePointStyle: true, boxWidth: 8 } } }
      }
    });
  }

  function renderBarChart(id, labels, data, color = '#369CFF') {
    if (charts[id]) charts[id].destroy();
    const ctx = document.getElementById(`chart-${id}`);
    
    charts[id] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: color, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#91A0B5' } },
          y: { grid: { color: 'rgba(36,54,77,0.3)' }, ticks: { color: '#91A0B5', callback: v => '₹' + v } }
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'analytics' });
    $('#range-filter').addEventListener('change', load);
    await load();
  });
})();