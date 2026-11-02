/* ── MyFinance – Shared UI helpers ───────────────────────── */
window.MF = window.MF || {};

window.MF.ui = {

  /* ─── Formatting ───────────────────────────────────────── */

  formatINR(amount, withDecimals = false) {
    const opts = {
      style: 'currency',
      currency: 'INR',
      locale: 'en-IN',
      minimumFractionDigits: withDecimals ? 2 : 0,
      maximumFractionDigits: withDecimals ? 2 : 0,
    };
    return new Intl.NumberFormat('en-IN', opts).format(Number(amount) || 0);
  },

  formatNumber(n) {
    return new Intl.NumberFormat('en-IN').format(Number(n) || 0);
  },

  /* "07 Oct 2025" */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  /* "11:30 AM" from "HH:MM:SS" */
  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(+h, +m);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  },

  /* Today as YYYY-MM-DD in local time */
  todayISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  },

  greet(name) {
    const h = new Date().getHours();
    const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    return `Good ${part}, ${name}`;
  },

  /* ─── Icons ────────────────────────────────────────────── */

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  /* ─── Toast ────────────────────────────────────────────── */

  toast(message, type = 'info', duration = 3200) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  /* ─── Escape ───────────────────────────────────────────── */

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /* ─── Modal helpers ────────────────────────────────────── */

  openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    document.body.style.overflow = '';
  },

  bindModal(id) {
    const m = document.getElementById(id);
    if (!m) return;

    m.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => this.closeModal(id));
    });
    m.querySelectorAll('[data-modal-backdrop]').forEach(el => {
      el.addEventListener('click', () => this.closeModal(id));
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !m.classList.contains('hidden')) {
        this.closeModal(id);
      }
    });
  },
};