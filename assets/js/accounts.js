/* ── MyFinance – Accounts page (Phase 3) ─────────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';
import { supabase } from './supabase.js';

(function () {
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const { formatINR, escapeHtml, toast } = MF.ui;

  const COLORS = ['#00D6A0','#369CFF','#8058F5','#FF555F','#F5A623','#00C98D','#FF7AC6','#91A0B5'];
  const ICONS  = [
    'wallet','home','user','briefcase','credit-card','banknote','piggy-bank',
    'shopping-cart','shopping-bag','utensils','plane','car','fuel','heart',
    'film','graduation-cap','sparkles','shield','zap','tag','gift','percent',
    'trending-up','store'
  ];

  const state = {
    accounts: [],
    editingId: null,
    color: '#00D6A0',
    icon:  'wallet',
  };

  /* ═══════════════════════════════════════════════════════
     LOAD + RENDER
     ═══════════════════════════════════════════════════════ */

  async function load() {
    const grid = $('#acc-grid');
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-sm text-txt-secondary">Loading…</div>`;

    try {
      state.accounts = await DB.accounts.list();
      render();
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full text-center py-12 text-sm text-expense">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  function render() {
    const grid = $('#acc-grid');

    const total = state.accounts.reduce((s, a) => s + Number(a.current_balance), 0);
    $('#acc-total').textContent = formatINR(total);

    if (!state.accounts.length) {
      grid.innerHTML = `
        <div class="col-span-full card text-center py-16">
          <i data-lucide="wallet" class="w-10 h-10 mx-auto text-txt-secondary opacity-40 mb-3"></i>
          <div class="text-sm font-medium text-txt-primary mb-1">No accounts yet</div>
          <div class="text-xs text-txt-secondary mb-4">Create your first account to start tracking.</div>
          <button id="empty-add-account"
                  class="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-[#06221a] text-xs font-semibold">
            <i data-lucide="plus" class="w-4 h-4"></i> New Account
          </button>
        </div>`;
      MF.ui.refreshIcons();
      document.getElementById('empty-add-account')?.addEventListener('click', () => openModal());
      return;
    }

    grid.innerHTML = state.accounts.map(a => `
      <div class="card group">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style="background:${a.color}1a;color:${a.color}">
              <i data-lucide="${a.icon || 'wallet'}" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-txt-primary truncate flex items-center gap-2">
                ${escapeHtml(a.name)}
                ${a.is_default ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold tracking-wider">DEFAULT</span>' : ''}
              </div>
              <div class="text-[11px] text-txt-secondary capitalize">${a.type.replace('_',' ')}</div>
            </div>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <button data-acc-action="edit" data-acc-id="${a.id}"
                    class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-info">
              <i data-lucide="pencil" class="w-3 h-3"></i>
            </button>
            <button data-acc-action="delete" data-acc-id="${a.id}"
                    class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-expense">
              <i data-lucide="trash-2" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <div class="mt-3">
          <div class="text-xl font-bold text-txt-primary">${formatINR(Number(a.current_balance))}</div>
          ${a.description ? `<div class="text-[11px] text-txt-secondary mt-0.5 truncate">${escapeHtml(a.description)}</div>` : ''}
        </div>

        ${!a.is_default ? `
          <button data-acc-action="default" data-acc-id="${a.id}"
                  class="mt-3 w-full h-8 rounded-lg bg-bg-secondary border border-brd hover:border-accent text-[11px] text-txt-secondary hover:text-accent transition">
            Set as default
          </button>` : ''}
      </div>
    `).join('');

    MF.ui.refreshIcons();

    grid.querySelectorAll('[data-acc-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.accAction;
        const id = btn.dataset.accId;
        if (action === 'edit')    openModal(id);
        if (action === 'delete')  confirmDelete(id);
        if (action === 'default') setDefault(id);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════
     PICKERS
     ═══════════════════════════════════════════════════════ */

  function renderColorPicker() {
    const grid = $('#acc-color-grid');
    grid.innerHTML = COLORS.map(c => `
      <button type="button" data-pick-color="${c}"
              class="w-8 h-8 rounded-lg border-2 transition ${state.color === c ? 'border-txt-primary scale-110' : 'border-transparent'}"
              style="background:${c}"></button>
    `).join('');
    grid.querySelectorAll('[data-pick-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.color = btn.dataset.pickColor;
        renderColorPicker();
      });
    });
  }

  function renderIconPicker() {
    const grid = $('#acc-icon-grid');
    grid.innerHTML = ICONS.map(i => `
      <button type="button" data-pick-icon="${i}"
              class="w-8 h-8 rounded-lg border-2 flex items-center justify-center transition ${state.icon === i ? 'border-accent bg-accent/10' : 'border-transparent bg-bg-secondary hover:bg-bg-elevated'}"
              title="${i}">
        <i data-lucide="${i}" class="w-3.5 h-3.5 text-txt-primary"></i>
      </button>
    `).join('');
    MF.ui.refreshIcons();
    grid.querySelectorAll('[data-pick-icon]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.icon = btn.dataset.pickIcon;
        renderIconPicker();
      });
    });
  }

  /* ═══════════════════════════════════════════════════════
     MODAL
     ═══════════════════════════════════════════════════════ */

  function openModal(editId = null) {
    state.editingId = editId;
    $('#acc-modal-title').textContent = editId ? 'Edit Account' : 'New Account';
    $('#acc-form').reset();

    if (editId) {
      const a = state.accounts.find(x => x.id === editId);
      if (!a) return;
      state.color = a.color || '#00D6A0';
      state.icon  = a.icon  || 'wallet';
      $('#acc-name').value    = a.name;
      $('#acc-type').value    = a.type;
      $('#acc-opening').value = a.opening_balance;
      $('#acc-desc').value    = a.description || '';
      $('#acc-default').checked = a.is_default;
    } else {
      state.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      state.icon  = 'wallet';
      $('#acc-opening').value = 0;
      $('#acc-default').checked = false;
    }

    renderColorPicker();
    renderIconPicker();
    MF.ui.openModal('acc-modal');
    setTimeout(() => $('#acc-name')?.focus(), 100);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const payload = {
        user_id:         user.id,
        name:            $('#acc-name').value.trim(),
        type:            $('#acc-type').value,
        opening_balance: parseFloat($('#acc-opening').value) || 0,
        description:     $('#acc-desc').value.trim() || null,
        color:           state.color,
        icon:            state.icon,
        is_default:      $('#acc-default').checked,
      };

      if (!payload.name) throw new Error('Name is required');

      if (state.editingId) {
        await DB.accounts.update(state.editingId, payload);
        toast('Account updated', 'success');
      } else {
        if (state.accounts.length === 0) payload.is_default = true;
        await DB.accounts.create(payload);
        toast('Account created', 'success');
      }

      MF.ui.closeModal('acc-modal');
      await load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ═══════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════ */

  async function setDefault(id) {
    try {
      await DB.accounts.update(id, { is_default: true });
      toast('Default account updated', 'success');
      await load();
    } catch (err) {
      toast(err.message || 'Update failed', 'error');
    }
  }

  async function confirmDelete(id) {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;

    try {
      const count = await DB.transactions.countByAccount(id);
      if (count > 0) {
        toast(
          `Cannot delete "${acc.name}" — ${count} transaction(s) reference it. Delete or move them first.`,
          'error', 5000
        );
        return;
      }

      if (!confirm(`Delete account "${acc.name}"? This cannot be undone.`)) return;

      await DB.accounts.remove(id);
      toast('Account deleted', 'success');
      await load();
    } catch (err) {
      const msg = /foreign key|restrict/i.test(err.message)
        ? `Cannot delete "${acc.name}" because it has transactions.`
        : (err.message || 'Delete failed');
      toast(msg, 'error', 5000);
    }
  }

  /* ═══════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════ */

  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'accounts' });
    MF.ui.bindModal('acc-modal');

    $('#acc-form').addEventListener('submit', handleSubmit);
    $('#btn-add-account').addEventListener('click', () => openModal());
    $('#fab-add-account').addEventListener('click', () => openModal());

    await load();
    MF.ui.refreshIcons();
  });
})();