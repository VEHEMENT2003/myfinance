/* ── MyFinance – Categories page (Phase 3) ───────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';
import { supabase } from './supabase.js';

(function () {
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const { escapeHtml, toast } = MF.ui;

  const COLORS = ['#00D6A0','#369CFF','#8058F5','#FF555F','#F5A623','#00C98D','#FF7AC6','#91A0B5'];
  const ICONS  = [
    'tag','utensils','shopping-cart','shopping-bag','plane','fuel','home','zap',
    'heart-pulse','film','graduation-cap','sparkles','shield','landmark','car',
    'banknote','briefcase','store','gift','percent','trending-up','plus-circle',
    'piggy-bank','wallet'
  ];

  const state = {
    all: [],
    tab: 'expense',
    editingId: null,
    color: '#00D6A0',
    icon:  'tag',
    formType: 'expense',
  };

  /* ═══════════════════════════════════════════════════════
     LOAD + RENDER
     ═══════════════════════════════════════════════════════ */

  async function load() {
    const grid = $('#cat-grid');
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-sm text-txt-secondary">Loading…</div>`;

    try {
      state.all = await DB.categories.list();
      render();
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full text-center py-12 text-sm text-expense">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  function render() {
    const grid = $('#cat-grid');
    const list = state.all.filter(c => c.type === state.tab);

    $$('.cat-tab').forEach(t => {
      const active = t.id === `tab-${state.tab}`;
      t.className = `cat-tab h-9 rounded-lg text-xs font-semibold transition ${
        active ? 'bg-accent text-[#06221a]' : 'text-txt-secondary hover:text-txt-primary'
      }`;
    });

    if (!list.length) {
      grid.innerHTML = `
        <div class="col-span-full card text-center py-16">
          <i data-lucide="tag" class="w-10 h-10 mx-auto text-txt-secondary opacity-40 mb-3"></i>
          <div class="text-sm font-medium text-txt-primary mb-1">No ${state.tab} categories</div>
          <div class="text-xs text-txt-secondary mb-4">Add a category to start organising.</div>
          <button id="empty-add-cat"
                  class="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-[#06221a] text-xs font-semibold">
            <i data-lucide="plus" class="w-4 h-4"></i> New Category
          </button>
        </div>`;
      MF.ui.refreshIcons();
      document.getElementById('empty-add-cat')?.addEventListener('click', () => openModal());
      return;
    }

    grid.innerHTML = list.map(c => `
      <div class="card group flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style="background:${c.color}1a;color:${c.color}">
          <i data-lucide="${c.icon || 'tag'}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-txt-primary truncate flex items-center gap-1.5">
            ${escapeHtml(c.name)}
            ${c.is_system ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-info/15 text-info font-semibold">DEFAULT</span>' : ''}
          </div>
          <div class="text-[11px] text-txt-secondary capitalize">${c.type}</div>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button data-cat-action="edit" data-cat-id="${c.id}"
                  class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-info">
            <i data-lucide="pencil" class="w-3 h-3"></i>
          </button>
          <button data-cat-action="delete" data-cat-id="${c.id}"
                  class="w-7 h-7 rounded-lg bg-bg-secondary border border-brd flex items-center justify-center text-txt-secondary hover:text-expense">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
          </button>
        </div>
      </div>
    `).join('');

    MF.ui.refreshIcons();

    grid.querySelectorAll('[data-cat-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.catAction;
        const id = btn.dataset.catId;
        if (action === 'edit')   openModal(id);
        if (action === 'delete') confirmDelete(id);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════
     PICKERS
     ═══════════════════════════════════════════════════════ */

  function renderColorPicker() {
    const grid = $('#cat-color-grid');
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
    const grid = $('#cat-icon-grid');
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

  function setFormType(type) {
    state.formType = type;
    $$('.cat-type-btn').forEach(btn => {
      const active = btn.dataset.catType === type;
      btn.className = `cat-type-btn h-9 rounded-lg text-xs font-semibold transition ${
        active ? 'bg-accent text-[#06221a]' : 'text-txt-secondary hover:text-txt-primary'
      }`;
    });
  }

  /* ═══════════════════════════════════════════════════════
     MODAL
     ═══════════════════════════════════════════════════════ */

  function openModal(editId = null) {
    state.editingId = editId;
    $('#cat-modal-title').textContent = editId ? 'Edit Category' : 'New Category';
    $('#cat-form').reset();

    if (editId) {
      const c = state.all.find(x => x.id === editId);
      if (!c) return;
      state.color = c.color || '#00D6A0';
      state.icon  = c.icon  || 'tag';
      $('#cat-name').value = c.name;
      setFormType(c.type);
    } else {
      state.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      state.icon  = 'tag';
      setFormType(state.tab);
    }

    renderColorPicker();
    renderIconPicker();
    MF.ui.openModal('cat-modal');
    setTimeout(() => $('#cat-name')?.focus(), 100);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const payload = {
        user_id: user.id,
        name:    $('#cat-name').value.trim(),
        type:    state.formType,
        color:   state.color,
        icon:    state.icon,
      };

      if (!payload.name) throw new Error('Name is required');

      if (state.editingId) {
        const existing = state.all.find(x => x.id === state.editingId);
        if (existing?.is_system) delete payload.type;
        await DB.categories.update(state.editingId, payload);
        toast('Category updated', 'success');
      } else {
        await DB.categories.create(payload);
        toast('Category created', 'success');
      }

      MF.ui.closeModal('cat-modal');
      await load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function confirmDelete(id) {
    const c = state.all.find(x => x.id === id);
    if (!c) return;

    try {
      const count = await DB.transactions.countByCategory(id);
      if (count > 0) {
        toast(
          `Cannot delete "${c.name}" — ${count} transaction(s) use it. Reassign them first.`,
          'error', 5000
        );
        return;
      }

      const msg = c.is_system
        ? `Delete default category "${c.name}"? It won't be restored automatically.`
        : `Delete category "${c.name}"?`;
      if (!confirm(msg)) return;

      await DB.categories.remove(id);
      toast('Category deleted', 'success');
      await load();
    } catch (err) {
      const msg = /foreign key|restrict/i.test(err.message)
        ? `Cannot delete "${c.name}" — it's used by transactions.`
        : (err.message || 'Delete failed');
      toast(msg, 'error', 5000);
    }
  }

  /* ═══════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════ */

  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'categories' });
    MF.ui.bindModal('cat-modal');

    $$('.cat-type-btn').forEach(btn => {
      btn.addEventListener('click', () => setFormType(btn.dataset.catType));
    });

    $('#tab-expense').addEventListener('click', () => { state.tab = 'expense'; render(); });
    $('#tab-income').addEventListener('click',  () => { state.tab = 'income';  render(); });

    $('#cat-form').addEventListener('submit', handleSubmit);
    $('#btn-add-category').addEventListener('click', () => openModal());
    $('#fab-add-category').addEventListener('click', () => openModal());

    await load();
    MF.ui.refreshIcons();
  });
})();