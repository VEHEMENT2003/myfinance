/* ── MyFinance – Savings Goals (Phase 4) ─────────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';
import { supabase } from './supabase.js';

(function () {
  const $ = s => document.querySelector(s);
  const { formatINR, escapeHtml, toast } = MF.ui;

  let state = { goals: [], editingId: null, fundingId: null };
  const COLORS = ['#00D6A0','#369CFF','#8058F5','#FF555F','#F5A623'];

  async function load() {
    const grid = $('#goals-grid');
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-sm text-txt-secondary">Loading…</div>`;
    
    try {
      state.goals = await DB.savings_goals.list();
      render();
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full text-center py-12 text-sm text-expense">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  function render() {
    const grid = $('#goals-grid');
    if (!state.goals.length) {
      grid.innerHTML = `
        <div class="col-span-full card text-center py-16">
          <i data-lucide="piggy-bank" class="w-10 h-10 mx-auto text-txt-secondary opacity-40 mb-3"></i>
          <div class="text-sm font-medium text-txt-primary mb-1">No savings goals</div>
          <div class="text-xs text-txt-secondary mb-4">Start saving towards something new.</div>
          <button id="empty-add-btn" class="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-[#06221a] text-xs font-semibold">
            <i data-lucide="plus" class="w-4 h-4"></i> Create Goal
          </button>
        </div>`;
      MF.ui.refreshIcons();
      document.getElementById('empty-add-btn')?.addEventListener('click', () => openModal());
      return;
    }

    grid.innerHTML = state.goals.map(g => {
      const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
      const isComplete = pct >= 100;

      return `
        <div class="card p-5 group relative ${isComplete ? 'opacity-70' : ''}">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-accent-2/10 text-accent-2">
                <i data-lucide="piggy-bank" class="w-5 h-5"></i>
              </div>
              <div>
                <div class="text-sm font-semibold text-txt-primary">${escapeHtml(g.name)}</div>
                <div class="text-[11px] text-txt-secondary">${isComplete ? 'Completed' : 'In Progress'}</div>
              </div>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button data-action="fund" data-id="${g.id}" class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-income" title="Add Funds"><i data-lucide="plus" class="w-3 h-3"></i></button>
              <button data-action="edit" data-id="${g.id}" class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-info"><i data-lucide="pencil" class="w-3 h-3"></i></button>
              <button data-action="delete" data-id="${g.id}" class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-expense"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
            </div>
          </div>
          
          <div class="flex justify-between items-end mb-2">
            <div class="text-xl font-bold text-txt-primary">${formatINR(g.saved_amount)} <span class="text-xs font-normal text-txt-secondary">/ ${formatINR(g.target_amount)}</span></div>
            <div class="text-xs font-semibold text-accent-2">${pct}%</div>
          </div>
          
          <div class="h-2.5 rounded-full bg-bg-elevated overflow-hidden">
            <div class="h-full rounded-full transition-all bg-accent-2" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');

    MF.ui.refreshIcons();
    
    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === 'edit') openModal(id);
        if (btn.dataset.action === 'delete') deleteGoal(id);
        if (btn.dataset.action === 'fund') openFundsModal(id);
      });
    });
  }

  function openModal(id = null) {
    state.editingId = id;
    $('#goal-modal-title').textContent = id ? 'Edit Goal' : 'New Goal';
    $('#goal-form').reset();

    if (id) {
      const g = state.goals.find(x => x.id === id);
      if (g) {
        $('#g-name').value = g.name;
        $('#g-target').value = g.target_amount;
        $('#g-saved').value = g.saved_amount;
      }
    } else {
      $('#g-saved').value = 0;
    }

    MF.ui.openModal('goal-modal');
    setTimeout(() => $('#g-name').focus(), 100);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const target = parseFloat($('#g-target').value);
      const saved = parseFloat($('#g-saved').value);

      const payload = {
        user_id: user.id,
        name: $('#g-name').value.trim(),
        target_amount: target,
        saved_amount: saved,
        is_completed: saved >= target,
      };

      if (state.editingId) await DB.savings_goals.update(state.editingId, payload);
      else await DB.savings_goals.create(payload);

      MF.ui.closeModal('goal-modal');
      toast('Goal saved', 'success');
      await load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function openFundsModal(id) {
    state.fundingId = id;
    $('#funds-form').reset();
    MF.ui.openModal('funds-modal');
    setTimeout(() => $('#f-amount').focus(), 100);
  }

  $('#funds-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat($('#f-amount').value);
    const g = state.goals.find(x => x.id === state.fundingId);
    if (!g) return;

    const newSaved = Number(g.saved_amount) + amount;
    try {
      await DB.savings_goals.update(g.id, {
        saved_amount: newSaved,
        is_completed: newSaved >= g.target_amount
      });
      MF.ui.closeModal('funds-modal');
      toast(`Added ${formatINR(amount)} to ${g.name}`, 'success');
      await load();
    } catch (err) {
      toast('Failed to add funds', 'error');
    }
  });

  async function deleteGoal(id) {
    if (!confirm('Delete this goal?')) return;
    try {
      await DB.savings_goals.remove(id);
      toast('Goal deleted', 'success');
      await load();
    } catch (err) {
      toast('Delete failed', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'savings' });
    MF.ui.bindModal('goal-modal');
    MF.ui.bindModal('funds-modal');
    $('#goal-form').addEventListener('submit', handleSubmit);
    $('#btn-add-goal').addEventListener('click', () => openModal());
    $('#fab-add-goal').addEventListener('click', () => openModal());
    await load();
  });
})();