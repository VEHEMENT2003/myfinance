/* ── MyFinance – Calendar & Notes (Phase 4) ──────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';

(function () {
  const $ = s => document.querySelector(s);
  const { formatINR, todayISO, escapeHtml, toast } = MF.ui;

  const state = {
    currentDate: new Date(),
    selectedDate: todayISO(),
    transactions: [],
  };

  /* ── Render Calendar Grid ── */
  async function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    
    // Header
    $('#cal-month-year').textContent = state.currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Fetch transactions for this month
    const start = new Date(year, month, 1).toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const txs = await DB.transactions.list({ from: start, to: end });
    
    // Group by date
    const map = {};
    txs.forEach(t => {
      if (!map[t.transaction_date]) map[t.transaction_date] = { in: 0, out: 0 };
      if (t.type === 'income')  map[t.transaction_date].in  += Number(t.amount);
      if (t.type === 'expense') map[t.transaction_date].out += Number(t.amount);
    });

    let html = '';
    // Empty cells for previous month
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="h-14 sm:h-20"></div>`;
    }
    
    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = map[dateStr];
      const isToday = dateStr === todayISO();
      const isSelected = dateStr === state.selectedDate;
      
      let indicator = '';
      if (dayData) {
        if (dayData.in && dayData.out) indicator = `<div class="flex gap-0.5 mt-1"><div class="w-1 h-1 rounded-full bg-income"></div><div class="w-1 h-1 rounded-full bg-expense"></div></div>`;
        else if (dayData.in)  indicator = `<div class="flex gap-0.5 mt-1"><div class="w-1 h-1 rounded-full bg-income"></div></div>`;
        else if (dayData.out) indicator = `<div class="flex gap-0.5 mt-1"><div class="w-1 h-1 rounded-full bg-expense"></div></div>`;
      }

      html += `
        <button data-date="${dateStr}" class="h-14 sm:h-20 p-1 sm:p-2 rounded-lg border flex flex-col items-center justify-between transition
          ${isSelected ? 'bg-accent/15 border-accent' : 'bg-bg-secondary border-transparent hover:border-brd'}
          ${isToday && !isSelected ? 'border-brd' : ''}">
          <span class="text-xs font-medium ${isToday ? 'text-accent' : isSelected ? 'text-accent' : 'text-txt-primary'}">${day}</span>
          ${indicator}
        </button>`;
    }
    $('#cal-grid').innerHTML = html;

    // Bind clicks
    document.querySelectorAll('[data-date]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedDate = btn.dataset.date;
        renderCalendar();
        loadSidebar();
      });
    });

    loadSidebar();
  }

  /* ── Sidebar (Notes & Transactions) ── */
  async function loadSidebar() {
    // Date label
    const d = new Date(state.selectedDate + 'T00:00:00');
    $('#side-date-label').textContent = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    // Fetch transactions for selected date
    const txs = await DB.transactions.list({ from: state.selectedDate, to: state.selectedDate });
    $('#side-transactions').innerHTML = txs.length ? txs.map(t => `
      <div class="flex items-center justify-between text-sm py-1">
        <span class="text-txt-primary truncate">${escapeHtml(t.title)}</span>
        <span class="${t.type === 'income' ? 'text-income' : 'text-expense'} font-medium">
          ${t.type === 'income' ? '+' : '−'}${formatINR(t.amount)}
        </span>
      </div>
    `).join('') : '<div class="text-xs text-txt-secondary text-center py-4">No transactions</div>';

    // Load note
    const note = await DB.notes.get(state.selectedDate);
    $('#note-input').value = note ? note.content : '';
  }

  /* ── Note Saving ── */
  let noteTimeout;
  $('#note-input')?.addEventListener('input', () => {
    $('#btn-save-note').classList.remove('hidden');
    clearTimeout(noteTimeout);
    noteTimeout = setTimeout(saveNote, 1500); // Auto-save after 1.5s
  });

  $('#btn-save-note')?.addEventListener('click', saveNote);

  async function saveNote() {
    const content = $('#note-input').value.trim();
    try {
      if (content) await DB.notes.save(state.selectedDate, content);
      else await DB.notes.remove(state.selectedDate);
      
      $('#btn-save-note').classList.add('hidden');
      toast('Note saved', 'success');
    } catch (err) {
      toast('Failed to save note', 'error');
    }
  }

  /* ── Navigation ── */
  $('#cal-prev').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
  });
  $('#cal-next').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
  });

  /* ── Boot ── */
  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'calendar' });
    await renderCalendar();
    MF.ui.refreshIcons();
  });
})();