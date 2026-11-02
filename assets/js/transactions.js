/* ── MyFinance – Transactions page (Phase 3) ─────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';
import { supabase } from './supabase.js';

(function () {
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const { formatINR, formatDate, formatTime, todayISO, escapeHtml, toast } = MF.ui;

  const state = {
    transactions: [],
    accounts: [],
    categories: [],
    filters: { type: '', from: '', to: '', account: '', category: '', search: '' },
    editingId: null,
    currentType: 'expense',
  };

  /* ═══════════════════════════════════════════════════════
     LOAD
     ═══════════════════════════════════════════════════════ */

  async function loadAccountsAndCategories() {
    const [accounts, categories] = await Promise.all([
      DB.accounts.list(),
      DB.categories.list(),
    ]);
    state.accounts   = accounts;
    state.categories = categories;

    const accFilter = $('#f-account');
    accFilter.innerHTML = '<option value="">All accounts</option>' +
      accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');

    const catFilter = $('#f-category');
    catFilter.innerHTML = '<option value="">All categories</option>' +
      categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.type})</option>`).join('');

    const txAccount = $('#tx-account');
    txAccount.innerHTML = accounts.length
      ? accounts.map(a => `<option value="${a.id}" ${a.is_default ? 'selected' : ''}>${escapeHtml(a.name)} — ${formatINR(a.current_balance)}</option>`).join('')
      : '<option value="">Create an account first</option>';

    const txToAccount = $('#tx-to-account');
    txToAccount.innerHTML = '<option value="">Select destination</option>' +
      accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  }

  async function loadTransactions() {
    const list = $('#tx-list');
    list.innerHTML = `<div class="text-center py-12 text-sm text-txt-secondary">Loading…</div>`;

    try {
      const rows = await DB.transactions.list(state.filters);
      state.transactions = rows;
      renderTransactions(rows);
      renderViewTotals(rows);
    } catch (err) {
      console.error(err);
      list.innerHTML = `<div class="text-center py-12 text-sm text-expense">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */

  function renderTransactions(rows) {
    const list = $('#tx-list');

    if (!rows.length) {
      list.innerHTML = `
        <div class="card text-center py-16">
          <i data-lucide="receipt" class="w-10 h-10 mx-auto text-txt-secondary opacity-40 mb-3"></i>
          <div class="text-sm font-medium text-txt-primary mb-1">No transactions found</div>
          <div class="text-xs text-txt-secondary mb-4">Adjust your filters or add your first transaction.</div>
          <button id="empty-add-tx"
                  class="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-[#06221a] text-xs font-semibold">
            <i data-lucide="plus" class="w-4 h-4"></i> Add Transaction
          </button>
        </div>`;
      MF.ui.refreshIcons();
      document.getElementById('empty-add-tx')?.addEventListener('click', () => openModal('expense'));
      return;
    }

    const groups = {};
    rows.forEach(t => {
      (groups[t.transaction_date] = groups[t.transaction_date] || []).push(t);
    });

    list.innerHTML = Object.entries(groups).map(([date, txs]) => {
      const dayIn  = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const dayOut = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

      return `
        <div class="card p-0 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-brd bg-bg-secondary/50">
            <span class="text-xs font-semibold text-txt-primary">${formatDate(date)}</span>
            <span class="text-[11px] text-txt-secondary">
              ${dayIn  ? `<span class="text-income">+${formatINR(dayIn)}</span>`  : ''}
              ${dayIn && dayOut ? ' · ' : ''}
              ${dayOut ? `<span class="text-expense">−${formatINR(dayOut)}</span>` : ''}
            </span>
          </div>
          <div class="divide-y divide-brd/60">
            ${txs.map(txRow).join('')}
          </div>
        </div>`;
    }).join('');

    MF.ui.refreshIcons();

    list.querySelectorAll('[data-tx-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.txAction;
        const id = btn.dataset.txId;
        if (action === 'edit')   openModal(null, id);
        if (action === 'delete') confirmDelete(id);
      });
    });
  }

  function txRow(t) {
    const isIncome   = t.type === 'income';
    const isTransfer = t.type === 'transfer';
    const color = isIncome ? '#00C98D' : isTransfer ? '#369CFF' : '#FF555F';
    const sign  = isIncome ? '+' : isTransfer ? '' : '−';

    const icon = isTransfer ? 'arrow-right-left'
               : (t.categories?.icon || (isIncome ? 'arrow-down-left' : 'arrow-up-right'));

    const title = isTransfer
      ? `${t.from_acc?.name || '—'} → ${t.to_acc?.name || '—'}`
      : t.title;

    const subtitle = isTransfer
      ? 'Transfer'
      : `${t.categories?.name || 'Uncategorised'} • ${(t.payment_mode || '').replace('_',' ')}`;

    return `
      <div class="flex items-center gap-3 px-4 py-3 hover:bg-bg-secondary/40 transition group">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style="background:${color}1a;color:${color}">
          <i data-lucide="${icon}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-txt-primary truncate">${escapeHtml(title)}</div>
          <div class="text-[11px] text-txt-secondary truncate capitalize">${escapeHtml(subtitle)}</div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-sm font-semibold" style="color:${color}">${sign}${formatINR(Number(t.amount))}</div>
          <div class="text-[11px] text-txt-secondary">${formatTime(t.transaction_time)}</div>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition ml-1">
          <button data-tx-action="edit" data-tx-id="${t.id}"
                  class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-info transition">
            <i data-lucide="pencil" class="w-3 h-3"></i>
          </button>
          <button data-tx-action="delete" data-tx-id="${t.id}"
                  class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-expense transition">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
          </button>
        </div>
      </div>`;
  }

  function renderViewTotals(rows) {
    const income   = rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const net = income - expenses;
    const el = $('#view-totals');
    if (el) {
      el.innerHTML = `
        <span>${rows.length} transaction${rows.length === 1 ? '' : 's'}</span>
        · <span class="text-income">+${formatINR(income)}</span>
        · <span class="text-expense">−${formatINR(expenses)}</span>
        · <span class="text-txt-primary font-medium">${net >= 0 ? '+' : '−'}${formatINR(Math.abs(net))}</span>`;
    }
  }

  /* ═══════════════════════════════════════════════════════
     MODAL
     ═══════════════════════════════════════════════════════ */

  function setType(type) {
    state.currentType = type;

    $$('.tx-type-btn').forEach(btn => {
      const active = btn.dataset.txType === type;
      btn.className = `tx-type-btn h-9 rounded-lg text-xs font-semibold transition ${
        active ? 'bg-accent text-[#06221a]' : 'text-txt-secondary hover:text-txt-primary'
      }`;
    });

    const isTransfer = type === 'transfer';
    $('#tx-category-wrap').classList.toggle('hidden', isTransfer);
    $('#tx-to-account-wrap').classList.toggle('hidden', !isTransfer);
    $('#tx-mode-wrap').classList.toggle('hidden', isTransfer);
    $('#tx-account-label').textContent = isTransfer ? 'From Account' : 'Account';

    const catSelect = $('#tx-category');
    const catList = state.categories.filter(c => c.type === type);
    catSelect.innerHTML = catList.length
      ? catList.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
      : '<option value="">No categories — create one first</option>';
    catSelect.required = !isTransfer;
  }

  function openModal(type = 'expense', editId = null) {
    state.editingId = editId;
    $('#tx-modal-title').textContent = editId ? 'Edit Transaction' : 'Add Transaction';

    const form = $('#tx-form');
    form.reset();
    $('#tx-date').value = todayISO();
    $('#tx-time').value = new Date().toTimeString().slice(0, 5);
    $('#tx-desc').value = '';

    const accountOptions = state.accounts.map(a =>
      `<option value="${a.id}">${escapeHtml(a.name)} — ${formatINR(a.current_balance)}</option>`
    ).join('');
    $('#tx-account').innerHTML = accountOptions || '<option value="">No accounts</option>';
    $('#tx-to-account').innerHTML = '<option value="">Select destination</option>' + accountOptions;

    if (editId) {
      const tx = state.transactions.find(t => t.id === editId);
      if (!tx) return;
      setType(tx.type);
      $('#tx-amount').value = tx.amount;
      $('#tx-date').value   = tx.transaction_date;
      $('#tx-time').value   = tx.transaction_time.slice(0, 5);
      $('#tx-title').value  = tx.title;
      $('#tx-desc').value   = tx.description || '';
      $('#tx-account').value = tx.account_id;
      if (tx.type === 'transfer') $('#tx-to-account').value = tx.to_account_id || '';
      else if (tx.category_id) $('#tx-category').value = tx.category_id;
      if (tx.payment_mode) $('#tx-mode').value = tx.payment_mode;
    } else {
      setType(type);
    }

    MF.ui.openModal('tx-modal');
    MF.ui.refreshIcons();
    setTimeout(() => $('#tx-amount')?.focus(), 100);
  }

  /* ═══════════════════════════════════════════════════════
     SUBMIT
     ═══════════════════════════════════════════════════════ */

  async function handleSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const type   = state.currentType;
      const amount = parseFloat($('#tx-amount').value);
      if (!(amount > 0)) throw new Error('Amount must be greater than 0');

      const payload = {
        user_id:          user.id,
        type,
        amount,
        title:            $('#tx-title').value.trim(),
        transaction_date: $('#tx-date').value,
        transaction_time: $('#tx-time').value + ':00',
        account_id:       $('#tx-account').value,
        description:      $('#tx-desc').value.trim() || null,
      };

      if (type === 'transfer') {
        payload.to_account_id = $('#tx-to-account').value;
        payload.category_id   = null;
        payload.payment_mode  = null;
        if (!payload.to_account_id) throw new Error('Destination account is required');
        if (payload.to_account_id === payload.account_id) throw new Error('From and To accounts must differ');
      } else {
        payload.category_id  = $('#tx-category').value || null;
        payload.payment_mode = $('#tx-mode').value;
        payload.to_account_id = null;
      }

      if (state.editingId) {
        await DB.transactions.update(state.editingId, payload);
        toast('Transaction updated', 'success');
      } else {
        await DB.transactions.create(payload);
        toast('Transaction added', 'success');
      }

      MF.ui.closeModal('tx-modal');
      await Promise.all([loadAccountsAndCategories(), loadTransactions()]);
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ═══════════════════════════════════════════════════════
     DELETE
     ═══════════════════════════════════════════════════════ */

  function confirmDelete(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;
    const msg = `Delete "${tx.title}" (${formatINR(Number(tx.amount))})? This cannot be undone.`;
    if (!confirm(msg)) return;

    (async () => {
      try {
        await DB.transactions.remove(id);
        toast('Transaction deleted', 'success');
        await Promise.all([loadAccountsAndCategories(), loadTransactions()]);
      } catch (err) {
        toast(err.message || 'Delete failed', 'error');
      }
    })();
  }

  /* ═══════════════════════════════════════════════════════
     FILTERS
     ═══════════════════════════════════════════════════════ */

  function bindFilters() {
    const apply = debounce(() => {
      state.filters.search = $('#f-search').value.trim();
      state.filters.from   = $('#f-from').value;
      state.filters.to     = $('#f-to').value;
      state.filters.account  = $('#f-account').value;
      state.filters.category = $('#f-category').value;
      loadTransactions();
    }, 250);

    $('#f-search').addEventListener('input', apply);
    $('#f-from').addEventListener('change', apply);
    $('#f-to').addEventListener('change', apply);
    $('#f-account').addEventListener('change', apply);
    $('#f-category').addEventListener('change', apply);

    $$('[data-type-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.filters.type = btn.dataset.typeFilter;
        $$('[data-type-filter]').forEach(b => {
          const active = b === btn;
          b.className = `type-tab px-3 h-8 rounded-md text-xs font-medium transition ${
            active ? 'bg-accent text-[#06221a]' : 'text-txt-secondary hover:text-txt-primary'
          }`;
        });
        loadTransactions();
      });
    });
    const all = document.querySelector('[data-type-filter=""]');
    if (all) all.className = 'type-tab px-3 h-8 rounded-md text-xs font-medium transition bg-accent text-[#06221a]';

    $('#btn-clear-filters').addEventListener('click', () => {
      $('#f-search').value = '';
      $('#f-from').value   = '';
      $('#f-to').value     = '';
      $('#f-account').value  = '';
      $('#f-category').value = '';
      state.filters = { type: state.filters.type, from: '', to: '', account: '', category: '', search: '' };
      loadTransactions();
    });
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  /* ═══════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════ */

  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'transactions' });

    MF.ui.bindModal('tx-modal');

    $$('.tx-type-btn').forEach(btn => {
      btn.addEventListener('click', () => setType(btn.dataset.txType));
    });

    $('#tx-form').addEventListener('submit', handleSubmit);
    $('#btn-add-tx').addEventListener('click', () => openModal('expense'));
    $('#fab-add-tx').addEventListener('click', () => openModal('expense'));

    bindFilters();
    await loadAccountsAndCategories();
    await loadTransactions();

    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add') {
      openModal(params.get('type') || 'expense');
      history.replaceState({}, '', 'transactions.html');
    }

    MF.ui.refreshIcons();
  });
})();