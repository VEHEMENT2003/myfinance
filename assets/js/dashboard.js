/* ── MyFinance – Dashboard (Phase 4) ─────────────────────── */
import { MFApp } from './app.js';
import { supabase } from './supabase.js';

(function () {
  const $ = s => document.querySelector(s);
  const { formatINR, greet, refreshIcons } = MF.ui;

  /* ── Date-range helper (current month) ── */
  function monthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end:   end.toISOString().slice(0, 10),
    };
  }

  /* ── Load everything in parallel ── */
  async function loadDashboard() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { start, end } = monthRange();

    const [profileRes, accountsRes, txRes, budgetsRes, goalsRes] = await Promise.all([
      // 1. Profile (safe fetch)
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),

      // 2. Accounts
      supabase.from('accounts')
        .select('id,name,type,current_balance,color,icon,is_default')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('is_default', { ascending: false }),

      // 3. Transactions (Current Month)
      supabase.from('transactions')
        .select(`
          id, type, amount, title, transaction_date, transaction_time,
          payment_mode, category_id, account_id,
          categories ( name, color, icon ),
          accounts  ( name )
        `)
        .eq('user_id', user.id)
        .gte('transaction_date', start)
        .lte('transaction_date', end)
        .order('transaction_date', { ascending: false })
        .order('transaction_time', { ascending: false }),

      // 4. Budgets
      supabase.from('budgets')
        .select(`
          id, name, amount, alert_threshold, category_id,
          categories ( name, color, icon )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .lte('start_date', end)
        .gte('end_date', start),

      // 5. Savings Goals (Top 4)
      supabase.from('savings_goals')
        .select('id, name, target_amount, saved_amount, color, icon')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .order('created_at', { ascending: false })
        .limit(4),
    ]);

    const name = profileRes.data?.full_name?.split(' ')[0]
      || user.email.split('@')[0];

    renderDashboard({
      name,
      accounts:     accountsRes.data || [],
      transactions: txRes.data      || [],
      budgets:      budgetsRes.data || [],
      goals:        goalsRes.data   || [],
    });
  }

  /* ── Render ── */
  function renderDashboard({ name, accounts, transactions, budgets, goals }) {

    const greeting = greet(name) + ' 👋';
    const gDesktop = $('#greeting');
    const gMobile  = $('#greeting-mobile');
    if (gDesktop) gDesktop.textContent = greeting;
    if (gMobile)  gMobile.textContent  = greeting;

    /* Totals — transfers excluded */
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount), 0);

    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount), 0);

    const balance = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
    const savings = income - expenses;

    setText('sum-balance',  formatINR(balance));
    setText('sum-income',   formatINR(income));
    setText('sum-expenses', formatINR(expenses));
    setText('sum-savings',  formatINR(Math.max(savings, 0)));

    /* Donut data */
    const byCategory = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const key   = t.category_id || 'uncategorised';
        const label = t.categories?.name || 'Uncategorised';
        const color = t.categories?.color || '#91A0B5';
        byCategory[key] = byCategory[key] || { name: label, color, amount: 0 };
        byCategory[key].amount += Number(t.amount);
      });
    renderExpenseDonut(Object.values(byCategory));

    /* Recent (first 5) */
    renderRecent(transactions.slice(0, 5));

    /* Budgets — compute spent from this month's expenses */
    const spentByCategory = {};
    transactions
      .filter(t => t.type === 'expense' && t.category_id)
      .forEach(t => {
        spentByCategory[t.category_id] =
          (spentByCategory[t.category_id] || 0) + Number(t.amount);
      });

    renderBudgets(budgets.map(b => ({
      name:  b.categories?.name || b.name,
      color: b.categories?.color || '#00D6A0',
      icon:  b.categories?.icon  || 'target',
      limit: Number(b.amount),
      spent: spentByCategory[b.category_id] || 0,
    })));

    renderGoals(goals);
    renderAccounts(accounts);

    refreshIcons();
  }

  /* ── Small renderers ── */

  function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function renderExpenseDonut(categories) {
    const ctx = document.getElementById('expenseDonut');
    if (!ctx) return;
    const total = categories.reduce((s, c) => s + c.amount, 0);

    if (window.__expenseChart) window.__expenseChart.destroy();

    window.__expenseChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories.map(c => c.name),
        datasets: [{
          data: categories.map(c => c.amount),
          backgroundColor: categories.map(c => c.color),
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '72%',
        plugins: { legend: { display: false } },
        maintainAspectRatio: false,
      },
    });

    const totalEl = $('#donut-total');
    if (totalEl) totalEl.textContent = formatINR(total);

    $('#donut-legend').innerHTML = categories.length
      ? categories.map(c => {
          const pct = total ? Math.round((c.amount / total) * 100) : 0;
          return `
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${c.color}"></span>
                <span class="text-txt-primary truncate">${MF.ui.escapeHtml(c.name)}</span>
              </div>
              <div class="text-txt-secondary flex-shrink-0 ml-3">
                <span class="text-txt-primary font-medium">${pct}%</span>
                <span class="ml-2 text-xs">${formatINR(c.amount)}</span>
              </div>
            </div>`;
        }).join('')
      : `<div class="text-xs text-txt-secondary text-center py-6">No expenses this month</div>`;
  }

  function renderRecent(txs) {
    const list = $('#recent-list');
    if (!list) return;
    if (!txs.length) {
      list.innerHTML = `<div class="text-xs text-txt-secondary text-center py-8">No transactions yet this month</div>`;
      return;
    }
    list.innerHTML = txs.map(t => {
      const isIncome = t.type === 'income';
      const color = isIncome ? '#00C98D' : '#FF555F';
      const sign  = isIncome ? '+' : '−';
      const catName = t.categories?.name || (t.type === 'transfer' ? 'Transfer' : 'Uncategorised');
      const accName = t.accounts?.name || '—';
      return `
        <div class="flex items-center gap-3 py-3 border-b border-brd/60 last:border-0">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style="background:${color}1a;color:${color}">
            <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-txt-primary truncate">${MF.ui.escapeHtml(t.title)}</div>
            <div class="text-[11px] text-txt-secondary truncate">${MF.ui.escapeHtml(catName)} • ${MF.ui.escapeHtml(accName)}</div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-sm font-semibold" style="color:${color}">${sign}${formatINR(Number(t.amount))}</div>
            <div class="text-[11px] text-txt-secondary">${t.transaction_date}</div>
          </div>
        </div>`;
    }).join('');
  }

  function renderBudgets(budgets) {
    const list = $('#budget-list');
    if (!list) return;
    if (!budgets.length) {
      list.innerHTML = `<div class="text-xs text-txt-secondary text-center py-8">No active budgets</div>`;
      return;
    }
    list.innerHTML = budgets.map(b => {
      const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
      const color = pct >= 100 ? '#FF555F' : pct >= 80 ? '#F5A623' : b.color;
      return `
        <div class="py-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-txt-primary">${MF.ui.escapeHtml(b.name)}</span>
            <span class="text-xs text-txt-secondary">${formatINR(b.spent)} / ${formatINR(b.limit)}</span>
          </div>
          <div class="h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div class="h-full rounded-full transition-all" style="width:${pct}%; background:${color}"></div>
          </div>
          <div class="text-right text-[11px] text-txt-secondary mt-1" style="color:${pct >= 100 ? '#FF555F' : 'inherit'}">${pct}%</div>
        </div>`;
    }).join('');
  }

  function renderGoals(goals) {
    const grid = $('#goals-grid');
    if (!grid) return;
    if (!goals.length) {
      grid.innerHTML = `<div class="col-span-full text-xs text-txt-secondary text-center py-6">No active goals</div>`;
      return;
    }
    grid.innerHTML = goals.map(g => {
      const pct = Math.min(100, Math.round((Number(g.saved_amount) / Number(g.target_amount)) * 100));
      return `
        <div class="card">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-2/10 text-accent-2">
              <i data-lucide="piggy-bank" class="w-4 h-4"></i>
            </div>
            <div class="text-sm font-medium text-txt-primary truncate">${MF.ui.escapeHtml(g.name)}</div>
          </div>
          <div class="flex justify-between text-xs text-txt-secondary mb-1">
            <span>${formatINR(Number(g.saved_amount))}</span>
            <span>${formatINR(Number(g.target_amount))}</span>
          </div>
          <div class="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
            <div class="h-full rounded-full bg-accent-2" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function renderAccounts(accounts) {
    const grid = $('#accounts-grid');
    if (!grid) return;
    if (!accounts.length) {
      grid.innerHTML = `<div class="col-span-full text-xs text-txt-secondary text-center py-8">No accounts yet</div>`;
      return;
    }
    grid.innerHTML = accounts.map(a => `
      <div class="card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center"
               style="background:${a.color}1a;color:${a.color}">
            <i data-lucide="${a.icon || 'wallet'}" class="w-4 h-4"></i>
          </div>
          <div class="text-sm font-medium text-txt-primary truncate">${MF.ui.escapeHtml(a.name)}</div>
        </div>
        <div class="text-xl font-bold text-txt-primary">${formatINR(Number(a.current_balance))}</div>
      </div>
    `).join('');
  }

  /* ── Boot ── */
  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'dashboard' });
    await loadDashboard();
  });
})();