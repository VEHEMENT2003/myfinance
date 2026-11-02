/* ── MyFinance – Settings (Phase 6) ──────────────────────── */
import { MFApp } from './app.js';
import { DB } from './db.js';

(function () {
  const $ = s => document.querySelector(s);
  const { toast, todayISO } = MF.ui;

  async function loadSettings() {
    try {
      const settings = await DB.settings.get();
      const accounts = await DB.accounts.list();

      // Populate form
      $('#set-currency').value = settings.currency || 'INR';
      $('#set-dateformat').value = settings.date_format || 'DD-MM-YYYY';
      $('#set-timeformat').checked = (settings.time_format || '12h') === '12h';
      $('#set-budget-alerts').checked = settings.budget_alerts !== false;

      // Default account dropdown
      const accSelect = $('#set-default-account');
      accSelect.innerHTML = '<option value="">None</option>' + 
        accounts.map(a => `<option value="${a.id}" ${a.id === settings.default_account_id ? 'selected' : ''}>${a.name}</option>`).join('');

      // Store globally so UI can use it if needed
      window.MF.userSettings = settings;
    } catch (err) {
      toast('Failed to load settings', 'error');
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const payload = {
        currency: $('#set-currency').value,
        date_format: $('#set-dateformat').value,
        time_format: $('#set-timeformat').checked ? '12h' : '24h',
        default_account_id: $('#set-default-account').value || null,
        budget_alerts: $('#set-budget-alerts').checked,
      };

      await DB.settings.update(payload);
      window.MF.userSettings = payload; // update global
      toast('Settings saved successfully', 'success');
    } catch (err) {
      toast('Failed to save settings: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  }

  /* ═══════════════════════════════════════════════════════
     BACKUP & RESTORE
     ═══════════════════════════════════════════════════════ */

  async function exportBackup() {
    try {
      // Fetch all tables
      const [accs, cats, txs, budgets, goals, notes, recurring] = await Promise.all([
        DB.accounts.list({ includeArchived: true }),
        DB.categories.list(),
        DB.transactions.list({ limit: 100000 }),
        DB.budgets.list(),
        DB.savings_goals.list(),
        DB.notes.list(), // We need a list function for notes
        DB.recurring.list()
      ]);

      const data = { accounts: accs, categories: cats, transactions: txs, budgets, goals, notes: notes || [], recurring };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MyFinance_Backup_${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup exported', 'success');
    } catch (err) {
      toast('Export failed: ' + err.message, 'error');
    }
  }

  async function importBackup(file) {
    if (!confirm('Are you sure? This will overwrite your current data.')) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.transactions || !data.accounts) throw new Error('Invalid backup file format');
        
        toast('Importing data... Please wait.', 'info', 5000);

        // 1. Delete existing data (except categories which might break FKs)
        await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('budgets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('savings_goals').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // 2. Insert new data
        if (data.accounts.length)   await supabase.from('accounts').insert(data.accounts);
        if (data.transactions.length) await supabase.from('transactions').insert(data.transactions);
        if (data.budgets.length)    await supabase.from('budgets').insert(data.budgets);
        if (data.goals.length)      await supabase.from('savings_goals').insert(data.goals);

        toast('Backup restored! Reloading...', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        toast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ── Boot ── */
  document.addEventListener('DOMContentLoaded', async () => {
    await MFApp.init({ activeId: 'settings' });
    
    $('#settings-form').addEventListener('submit', saveSettings);
    
    $('#btn-export-backup').addEventListener('click', exportBackup);
    $('#input-import').addEventListener('change', (e) => {
      if (e.target.files.length) importBackup(e.target.files[0]);
    });

    await loadSettings();
  });
})();