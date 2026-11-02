/* ── MyFinance – Application shell (Phase 6) ─────────────── */
import { Auth } from './auth.js';

window.MF = window.MF || {};

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',        icon: 'layout-dashboard', href: 'dashboard.html',    phase: 2 },
  { id: 'transactions', label: 'Transactions',     icon: 'receipt',          href: 'transactions.html', phase: 3 },
  { id: 'calendar',     label: 'Calendar & Notes', icon: 'calendar-days',    href: 'calendar.html',     phase: 4 },
  { id: 'accounts',     label: 'Accounts',         icon: 'wallet',           href: 'accounts.html',     phase: 3 },
  { id: 'categories',   label: 'Categories',       icon: 'tags',             href: 'categories.html',   phase: 3 },
  { id: 'budgets',      label: 'Budgets',          icon: 'target',           href: 'budgets.html',      phase: 4 },
  { id: 'analytics',    label: 'Analytics',        icon: 'bar-chart-3',      href: 'analytics.html',    phase: 5 },
  { id: 'savings',      label: 'Savings Goals',    icon: 'piggy-bank',       href: 'savings.html',      phase: 4 },
  { id: 'recurring',    label: 'Recurring',        icon: 'repeat',           href: 'recurring.html',    phase: 4 },
  { id: 'reports',      label: 'Reports',          icon: 'file-text',        href: 'reports.html',      phase: 5 },
  { id: 'settings',     label: 'Settings',         icon: 'settings',         href: 'settings.html',     phase: 6 },
];

const MOBILE_NAV = ['dashboard', 'transactions', 'accounts', 'budgets'];

function renderSidebar(activeId) {
  const nav = NAV.map(item => `
    <a class="nav-item ${item.id === activeId ? 'active' : ''}"
       href="${item.href || '#'}" data-nav="${item.id}" data-phase="${item.phase}">
      <i data-lucide="${item.icon}"></i><span>${item.label}</span>
    </a>
  `).join('');

  return `
    <div class="flex items-center gap-3 px-2 mb-6">
      <div class="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-glow">
        <i data-lucide="wallet" class="w-5 h-5 text-[#06221a]"></i>
      </div>
      <div class="leading-tight">
        <div class="font-bold text-txt-primary text-[16px]">MyFinance</div>
        <div class="text-[11px] text-txt-secondary">Track • Plan • Save</div>
      </div>
    </div>
    <nav class="flex flex-col gap-1">${nav}</nav>
    <div class="mt-4 pt-4 border-t border-brd">
      <a href="#" data-signout class="nav-item text-expense hover:text-expense/80 hover:bg-expense/10">
        <i data-lucide="log-out"></i><span>Sign Out</span>
      </a>
    </div>
    <div class="mt-auto pt-6 text-[11px] text-txt-secondary px-2">
      <div>MyFinance • v1.0</div><div class="mt-1 opacity-60">Phase 6 (Complete)</div>
    </div>`;
}

function renderMobileNav(activeId) {
  const items = MOBILE_NAV.map(id => {
    const item = NAV.find(n => n.id === id);
    return `
      <a href="${item.href || '#'}" data-nav="${id}" data-phase="${item.phase}" class="${id === activeId ? 'active' : ''}">
        <i data-lucide="${item.icon}"></i><span>${item.label.split(' ')[0]}</span>
      </a>`;
  }).join('');
  return items + `
    <a href="#" data-more="true"><i data-lucide="ellipsis"></i><span>More</span></a>`;
}

function bindNav(scopeSelector) {
  document.querySelectorAll(`${scopeSelector} [data-nav]`).forEach(el => {
    const phase = Number(el.dataset.phase);
    if (phase > 6) {
      el.addEventListener('click', e => {
        e.preventDefault();
        MF.ui.toast(`"${el.textContent.trim()}" arrives in a later phase.`, 'info');
      });
    }
  });
  document.querySelectorAll(`${scopeSelector} [data-more]`).forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      MF.ui.toast('Full navigation menu arrives in a later phase.', 'info');
    });
  });
}

function bindSidebarToggle() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !backdrop) return;
  const open  = () => { sidebar.classList.remove('hidden-mobile'); backdrop.classList.remove('hidden'); };
  const close = () => { sidebar.classList.add('hidden-mobile');    backdrop.classList.add('hidden'); };
  document.querySelectorAll('[data-open-sidebar]').forEach(b => b.addEventListener('click', open));
  document.querySelectorAll('[data-close-sidebar]').forEach(b => b.addEventListener('click', close));
  backdrop.addEventListener('click', close);
}

function bindSignOut() {
  document.querySelectorAll('[data-signout]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await Auth.signOut(); }
      catch (err) { MF.ui.toast('Sign out failed: ' + err.message, 'error'); }
    });
  });
}

export const MFApp = {
  NAV,
  async init({ activeId = 'dashboard' } = {}) {
    try { await Auth.requireAuth(); } catch { return; }
    
    const sidebar   = document.getElementById('sidebar');
    const mobileNav = document.getElementById('mobile-nav');
    if (sidebar)   sidebar.innerHTML   = renderSidebar(activeId);
    if (mobileNav) mobileNav.innerHTML = renderMobileNav(activeId);
    
    bindSidebarToggle();
    bindNav('#sidebar');
    bindNav('#mobile-nav');
    bindSignOut();
    
    Auth.onAuthStateChange((session) => { if (!session) location.replace('login.html'); });
    MF.ui.refreshIcons();
  },
};
window.MF.app = MFApp;