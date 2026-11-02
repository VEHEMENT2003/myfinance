/* ── MyFinance – Reports & Exports (Phase 5) ─────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';

(function () {
  const $ = s => document.querySelector(s);
  const { formatINR, formatDate, todayISO, escapeHtml, toast } = MF.ui;

  let state = { transactions: [], accounts: [] };

  async function initFilters() {
    const now = new Date();
    $('#r-start').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    $('#r-end').value = todayISO();

    const accounts = await DB.accounts.list();
    state.accounts = accounts;
    $('#r-account').innerHTML = '<option value="">All Accounts</option>' + 
      accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  }

  async function generate() {
    const from = $('#r-start').value;
    const to = $('#r-end').value;
    const account = $('#r-account').value;

    if (!from || !to) {
      toast('Please select a start and end date', 'error');
      return;
    }

    const btn = $('#btn-generate');
    btn.disabled = true;
    btn.textContent = 'Generating…';

    try {
      const txs = await DB.transactions.list({ from, to, account, limit: 5000 });
      state.transactions = txs;
      renderPreview(txs);
    } catch (err) {
      toast('Failed to generate report', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Report';
    }
  }

  function renderPreview(txs) {
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    
    $('#sum-income').textContent = formatINR(income);
    $('#sum-expense').textContent = formatINR(expense);
    $('#sum-net').textContent = formatINR(income - expense);
    $('#sum-net').className = `text-xl font-bold ${income - expense >= 0 ? 'text-income' : 'text-expense'}`;
    $('#tx-count').textContent = txs.length;

    const body = $('#preview-body');
    if (!txs.length) {
      body.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-xs">No transactions found for this period.</td></tr>`;
      return;
    }

    body.innerHTML = txs.map(t => `
      <tr class="hover:bg-bg-secondary/30">
        <td class="px-4 py-3 whitespace-nowrap text-xs">${formatDate(t.transaction_date)}</td>
        <td class="px-4 py-3 text-txt-primary font-medium">${escapeHtml(t.title)}</td>
        <td class="px-4 py-3 text-xs">${escapeHtml(t.categories?.name || '—')}</td>
        <td class="px-4 py-3 text-xs">${escapeHtml(t.from_acc?.name || '—')}</td>
        <td class="px-4 py-3 text-right font-semibold ${t.type === 'income' ? 'text-income' : t.type === 'expense' ? 'text-expense' : 'text-info'}">
          ${t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}${formatINR(t.amount)}
        </td>
      </tr>
    `).join('');
  }

  /* ═══════════════════════════════════════════════════════
     EXPORTS
     ═══════════════════════════════════════════════════════ */

  function getExportData() {
    return state.transactions.map(t => ({
      Date: t.transaction_date,
      Title: t.title,
      Type: t.type,
      Category: t.categories?.name || 'Uncategorised',
      Account: t.from_acc?.name || '',
      'Payment Mode': (t.payment_mode || '').replace('_', ' '),
      Amount: Number(t.amount),
    }));
  }

  // CSV Export
  $('#btn-export-csv').addEventListener('click', () => {
    const data = getExportData();
    if (!data.length) return toast('No data to export', 'error');

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MyFinance_Report_${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Excel Export
  $('#btn-export-excel').addEventListener('click', () => {
    const data = getExportData();
    if (!data.length) return toast('No data to export', 'error');

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `MyFinance_Report_${todayISO()}.xlsx`);
  });

  // PDF Export
  $('#btn-export-pdf').addEventListener('click', () => {
    const data = state.transactions;
    if (!data.length) return toast('No data to export', 'error');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const income = data.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = data.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    // Header
    doc.setFontSize(20);
    doc.setTextColor(8, 15, 28);
    doc.text('MyFinance', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Report Period: ${$('#r-start').value} to ${$('#r-end').value}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 33);

    // Summary
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary', 14, 45);
    
    doc.setFontSize(10);
    doc.text(`Total Income: Rs. ${income.toFixed(2)}`, 14, 52);
    doc.text(`Total Expenses: Rs. ${expense.toFixed(2)}`, 14, 58);
    doc.text(`Net Cash Flow: Rs. ${(income - expense).toFixed(2)}`, 14, 64);

    // Table
    const tableData = data.map(t => [
      t.transaction_date,
      t.title,
      t.categories?.name || '-',
      t.from_acc?.name || '-',
      `${t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}${Number(t.amount).toFixed(2)}`
    ]);

    doc.autoTable({
      startY: 72,
      head: [['Date', 'Title', 'Category', 'Account', 'Amount (Rs)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [8, 15, 28], textColor: [244, 247, 251] },
      styles: { fontSize: 8 },
      columnStyles: { 4: { halign: 'right' } }
    });

    doc.save(`MyFinance_Report_${todayISO()}.pdf`);
  });

  /* ── Boot ── */
  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'reports' });
    await initFilters();
    $('#btn-generate').addEventListener('click', generate);
    
    // Auto-generate on first load
    await generate();
  });
})();