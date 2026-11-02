# MyFinance

Personal expense tracker — **Phase 1: UI Foundation** (sample data only).

## Run locally
npx serve . -l 3000
# or: python3 -m http.server 3000

Open http://localhost:3000 → redirects to `login.html` → "Get Started" → `dashboard.html`.

## Phase 1 scope
- Design system (colors, cards, typography)
- Responsive shell (desktop sidebar / mobile bottom nav + FAB)
- Dashboard: summary cards, quick actions, donut breakdown,
  income-vs-expense trend, recent transactions, budgets, accounts
- All data is **labelled sample data** from `assets/js/config.js`

## Not in Phase 1 (intentional)
- Supabase auth, RLS, database → Phase 2
- Transactions/Accounts/Categories CRUD → Phase 3
- Calendar, Budgets, Recurring, Savings → Phase 4
- Analytics, Reports (PDF/Excel) → Phase 5

Sidebar items for later phases show a "Coming in Phase X" toast —
**no dead buttons**.