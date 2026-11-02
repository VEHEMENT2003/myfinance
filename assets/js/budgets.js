/* ── MyFinance – Budgets (Phase 4) ───────────────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';
import { supabase } from './supabase.js';

(function () {
  const $ = s => document.querySelector(s);
  const { formatINR, todayISO, escapeHtml, toast } = MF.ui;

  let state = { budgets: [], categories: [], editingId: null };

  async function load() {
    const grid = $('#budget-grid');
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-sm text-txt-secondary">Loading…</div>`;
    
    try {
      const [budgets, categories] = await Promise.all([
        DB.budgets.list(),
        DB.categories.list('expense')
      ]);
      
      // Calculate real spending for each budget
      for (let b of budgets) {
        b.spent = await DB.transactions.sumExpensesByCategory(b.category_id, b.start_date, b.end_date);
      }
      
      state.budgets = budgets;
      state.categories = categories;
      render();
      populateCategorySelect();
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full text-center py-12 text-sm text-expense">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  function render() {
    const grid = $('#budget-grid');
    if (!state.budgets.length) {
      grid.innerHTML = `
        <div class="col-span-full card text-center py-16">
          <i data-lucide="target" class="w-10 h-10 mx-auto text-txt-secondary opacity-40 mb-3"></i>
          <div class="text-sm font-medium text-txt-primary mb-1">No budgets yet</div>
          <div class="text-xs text-txt-secondary mb-4">Set a limit for your expenses.</div>
          <button id="empty-add-btn" class="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-[#06221a] text-xs font-semibold">
            <i data-lucide="plus" class="w-4 h-4"></i> Create Budget
          </button>
        </div>`;
      MF.ui.refreshIcons();
      document.getElementById('empty-add-btn')?.addEventListener('click', () => openModal());
      return;
    }

    grid.innerHTML = state.budgets.map(b => {
      const pct = Math.min(100, Math.round((b.spent / b.amount) * 100));
      const isWarning = pct >= 80 && pct < 100;
      const isOver = pct >= 100;
      const color = isOver ? '#FF555F' : isWarning ? '#F5A623' : '#00D6A0';

      return `
        <div class="card p-5 group relative">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${b.categories?.color || '#00D6A0'}1a;color:${b.categories?.color || '#00D6A0'}">
                <i data-lucide="${b.categories?.icon || 'target'}" class="w-5 h-5"></i>
              </div>
              <div>
                <div class="text-sm font-semibold text-txt-primary">${escapeHtml(b.name || b.categories?.name || 'Overall')}</div>
                <div class="text-[11px] text-txt-secondary">${b.start_date} to ${b.end_date}</div>
              </div>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button data-b-id="${b.id}" data-action="edit" class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-info"><i data-lucide="pencil" class="w-3 h-3"></i></button>
              <button data-b-id="${b.id}" data-action="delete" class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-expense"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
            </div>
          </div>
          
          <div class="flex items-end justify-between mb-2">
            <div class="text-xl font-bold text-txt-primary">${formatINR(b.spent)} <span class="text-xs font-normal text-txt-secondary">/ ${formatINR(b.amount)}</span></div>
            <div class="text-xs font-semibold" style="color:${color}">${pct}%</div>
          </div>
          
          <div class="h-2.5 rounded-full bg-bg-elevated overflow-hidden">
            <div class="h-full rounded-full transition-all" style="width:${pct}%; background:${color}"></div>
          </div>
          
          ${isOver ? '<div class="text-[11px] text-expense mt-2 font-medium flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Over budget!</div>' : ''}
        </div>`;
    }).join('');

    MF.ui.refreshIcons();
    
    // Bind actions
    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'edit') openModal(btn.dataset.bId);
        if (btn.dataset.action === 'delete') deleteBudget(btn.dataset.bId);
      });
    });
  }

  function populateCategorySelect() {
    const sel = $('#b-category');
    sel.innerHTML = state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  function openModal(id = null) {
    state.editingId = id;
    $('#budget-modal-title').textContent = id ? 'Edit Budget' : 'New Budget';
    $('#budget-form').reset();

    if (id) {
      const b = state.budgets.find(x => x.id === id);
      if (b) {
        $('#b-category').value = b.category_id || '';
        $('#b-amount').value = b.amount;
        $('#b-start').value = b.start_date;
        $('#b-end').value = b.end_date;
      }
    } else {
      // Default to current month
      const now = new Date();
      $('#b-start').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      $('#b-end').value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    }

    MF.ui.openModal('budget-modal');
    setTimeout(() => $('#b-amount').focus(), 100);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const catId = $('#b-category').value;
      const catName = state.categories.find(c => c.id === catId)?.name || 'Budget';

      const payload = {
        user_id: user.id,
        name: catName,
        category_id: catId,
        amount: parseFloat($('#b-amount').value),
        start_date: $('#b-start').value,
        end_date: $('#b-end').value,
      };

      if (state.editingId) await DB.budgets.update(state.editingId, payload);
      else await DB.budgets.create(payload);

      MF.ui.closeModal('budget-modal');
      toast('Budget saved', 'success');
      await load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteBudget(id) {
    if (!confirm('Delete this budget?')) return;
    try {
      await DB.budgets.remove(id);
      toast('Budget deleted', 'success');
      await load();
    } catch (err) {
      toast('Delete failed', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'budgets' });
    MF.ui.bindModal('budget-modal');
    $('#budget-form').addEventListener('submit', handleSubmit);
    $('#btn-add-budget').addEventListener('click', () => openModal());
    $('#fab-add-budget').addEventListener('click', () => openModal());
    await load();
  });
})();