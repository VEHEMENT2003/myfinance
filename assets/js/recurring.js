/* ── MyFinance – Recurring Rules (Phase 4) ───────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';
import { supabase } from './supabase.js';

(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const { formatINR, todayISO, formatDate, escapeHtml, toast } = MF.ui;

  let state = { rules: [], accounts: [], categories: [], editingId: null, type: 'expense' };

  async function load() {
    const list = $('#rules-list');
    list.innerHTML = `<div class="text-center py-12 text-sm text-txt-secondary">Loading…</div>`;
    
    try {
      state.rules = await DB.recurring.list();
      render();
    } catch (err) {
      list.innerHTML = `<div class="text-center py-12 text-sm text-expense">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  function render() {
    const list = $('#rules-list');
    if (!state.rules.length) {
      list.innerHTML = `
        <div class="card text-center py-16">
          <i data-lucide="repeat" class="w-10 h-10 mx-auto text-txt-secondary opacity-40 mb-3"></i>
          <div class="text-sm font-medium text-txt-primary mb-1">No recurring rules</div>
          <div class="text-xs text-txt-secondary mb-4">Automate your bills and salary.</div>
          <button id="empty-add-btn" class="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-[#06221a] text-xs font-semibold">
            <i data-lucide="plus" class="w-4 h-4"></i> Create Rule
          </button>
        </div>`;
      MF.ui.refreshIcons();
      document.getElementById('empty-add-btn')?.addEventListener('click', () => openModal());
      return;
    }

    list.innerHTML = state.rules.map(r => {
      const isIncome = r.type === 'income';
      const color = isIncome ? '#00C98D' : '#FF555F';

      return `
        <div class="card flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 opacity-${r.is_active ? '100' : '50'}">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${color}1a;color:${color}">
              <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="text-sm font-semibold text-txt-primary flex items-center gap-2">
                ${escapeHtml(r.title)}
                ${!r.is_active ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-txt-secondary">PAUSED</span>' : ''}
              </div>
              <div class="text-[11px] text-txt-secondary capitalize">${r.frequency} • ${r.categories?.name || 'Uncategorised'} • ${r.accounts?.name}</div>
            </div>
          </div>
          
          <div class="flex items-center justify-between sm:justify-end gap-6 sm:w-1/2">
            <div class="text-right">
              <div class="text-sm font-bold" style="color:${color}">${isIncome ? '+' : '−'}${formatINR(r.amount)}</div>
              <div class="text-[10px] text-txt-secondary">Next: ${formatDate(r.next_run_date)}</div>
            </div>
            
            <div class="flex items-center gap-1">
              <button data-action="toggle" data-id="${r.id}" class="w-8 h-8 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-accent" title="${r.is_active ? 'Pause' : 'Resume'}">
                <i data-lucide="${r.is_active ? 'pause' : 'play'}" class="w-3.5 h-3.5"></i>
              </button>
              <button data-action="edit" data-id="${r.id}" class="w-8 h-8 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-info"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
              <button data-action="delete" data-id="${r.id}" class="w-8 h-8 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-expense"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
          </div>
        </div>`;
    }).join('');

    MF.ui.refreshIcons();

    list.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const rule = state.rules.find(x => x.id === id);
        if (btn.dataset.action === 'edit') openModal(id);
        if (btn.dataset.action === 'delete') {
          if(confirm('Delete this rule?')) {
            await DB.recurring.remove(id);
            toast('Rule deleted', 'success');
            await load();
          }
        }
        if (btn.dataset.action === 'toggle') {
          await DB.recurring.update(id, { is_active: !rule.is_active });
          toast(rule.is_active ? 'Rule paused' : 'Rule resumed', 'success');
          await load();
        }
      });
    });
  }

  function setFormType(type) {
    state.type = type;
    $$('.rule-type-btn').forEach(btn => {
      const active = btn.dataset.type === type;
      btn.className = `rule-type-btn h-9 rounded-lg text-xs font-semibold transition ${active ? 'bg-accent text-[#06221a]' : 'text-txt-secondary hover:text-txt-primary'}`;
    });
    populateCategories();
  }

  function populateCategories() {
    const cats = state.categories.filter(c => c.type === state.type);
    $('#r-category').innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  async function openModal(id = null) {
    state.editingId = id;
    $('#rule-modal-title').textContent = id ? 'Edit Rule' : 'New Rule';
    $('#rule-form').reset();

    if (!state.accounts.length) {
      [state.accounts, state.categories] = await Promise.all([DB.accounts.list(), DB.categories.list()]);
      $('#r-account').innerHTML = state.accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    }

    if (id) {
      const r = state.rules.find(x => x.id === id);
      setFormType(r.type);
      $('#r-title').value = r.title;
      $('#r-amount').value = r.amount;
      $('#r-account').value = r.account_id;
      $('#r-category').value = r.category_id;
      $('#r-frequency').value = r.frequency;
      $('#r-start').value = r.next_run_date;
    } else {
      setFormType('expense');
      $('#r-start').value = todayISO();
    }

    MF.ui.openModal('rule-modal');
    setTimeout(() => $('#r-title').focus(), 100);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        user_id: user.id,
        type: state.type,
        title: $('#r-title').value.trim(),
        amount: parseFloat($('#r-amount').value),
        account_id: $('#r-account').value,
        category_id: $('#r-category').value,
        frequency: $('#r-frequency').value,
        next_run_date: $('#r-start').value,
      };

      if (state.editingId) await DB.recurring.update(state.editingId, payload);
      else await DB.recurring.create(payload);

      MF.ui.closeModal('rule-modal');
      toast('Recurring rule saved', 'success');
      await load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'recurring' });
    MF.ui.bindModal('rule-modal');
    $('#rule-form').addEventListener('submit', handleSubmit);
    $('#btn-add-rule').addEventListener('click', () => openModal());
    $('#fab-add-rule').addEventListener('click', () => openModal());
    $$('.rule-type-btn').forEach(btn => btn.addEventListener('click', () => setFormType(btn.dataset.type)));
    
    // Process any due transactions on load
    await DB.recurring.processDue();
    await load();
  });
})();