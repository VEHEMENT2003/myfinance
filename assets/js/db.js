/* ── MyFinance – Data access layer ───────────────────────── */
import { supabase } from './supabase.js';

export const DB = {
  /* ═══════════════════════════════════════════════════════
     TRANSACTIONS
     ═══════════════════════════════════════════════════════ */
  transactions: {
    async list(filters = {}) {
      let q = supabase.from('transactions').select(`
        id, type, amount, title, description,
        transaction_date, transaction_time, payment_mode,
        category_id, account_id, to_account_id,
        categories ( id, name, color, icon ),
        from_acc:accounts!account_id    ( id, name, color, icon ),
        to_acc:accounts!to_account_id   ( id, name, color, icon )
      `);

      if (filters.from)     q = q.gte('transaction_date', filters.from);
      if (filters.to)       q = q.lte('transaction_date', filters.to);
      if (filters.type)     q = q.eq('type', filters.type);
      if (filters.account)  q = q.eq('account_id', filters.account);
      if (filters.category) q = q.eq('category_id', filters.category);
      if (filters.mode)     q = q.eq('payment_mode', filters.mode);
      if (filters.search)   q = q.ilike('title', `%${filters.search}%`);

      q = q.order('transaction_date', { ascending: false })
           .order('transaction_time', { ascending: false })
           .limit(filters.limit || 300);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async create(payload) {
      const { data, error } = await supabase.from('transactions').insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase.from('transactions').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },

    async countByAccount(accountId) {
      const { count, error } = await supabase.from('transactions').select('id', { count: 'exact', head: true })
        .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`);
      if (error) throw error;
      return count || 0;
    },

    async countByCategory(categoryId) {
      const { count, error } = await supabase.from('transactions').select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId);
      if (error) throw error;
      return count || 0;
    },

    async sumExpensesByCategory(categoryId, startDate, endDate) {
      let q = supabase.from('transactions')
        .select('amount')
        .eq('type', 'expense')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      
      if (categoryId) q = q.eq('category_id', categoryId);
      
      const { data, error } = await q;
      if (error) throw error;
      return data.reduce((sum, tx) => sum + Number(tx.amount), 0);
    }
  },

  /* ═══════════════════════════════════════════════════════
     ACCOUNTS
     ═══════════════════════════════════════════════════════ */
  accounts: {
    async list({ includeArchived = false } = {}) {
      let q = supabase.from('accounts')
        .select('id, name, type, opening_balance, current_balance, description, color, icon, is_default, is_archived')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (!includeArchived) q = q.eq('is_archived', false);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async create(payload) {
      if (payload.is_default) {
        await supabase.from('accounts').update({ is_default: false }).eq('is_default', true);
      }
      const { data, error } = await supabase.from('accounts').insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      if (payload.is_default) {
        await supabase.from('accounts').update({ is_default: false }).eq('is_default', true).neq('id', id);
      }
      const { data, error } = await supabase.from('accounts').update(payload).eq('id', id).select().single();
      if (error) throw error;

      if ('opening_balance' in payload) {
        await supabase.rpc('recalc_account_balance', { p_account_id: id });
      }
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
  },

  /* ═══════════════════════════════════════════════════════
     CATEGORIES
     ═══════════════════════════════════════════════════════ */
  categories: {
    async list(type) {
      let q = supabase.from('categories')
        .select('id, name, type, icon, color, is_system')
        .order('is_system', { ascending: false })
        .order('name');
      if (type) q = q.eq('type', type);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async create(payload) {
      const { data, error } = await supabase.from('categories').insert({ ...payload, is_system: false }).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase.from('categories').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
  },

  /* ═══════════════════════════════════════════════════════
     BUDGETS, GOALS, NOTES, RECURRING
     ═══════════════════════════════════════════════════════ */
  budgets: {
    async list() {
      const { data, error } = await supabase.from('budgets')
        .select(`id, name, amount, start_date, end_date, alert_threshold, category_id, categories ( name, icon, color )`)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async create(payload) {
      const { data, error } = await supabase.from('budgets').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, payload) {
      const { data, error } = await supabase.from('budgets').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
    }
  },

  savings_goals: {
    async list() {
      const { data, error } = await supabase.from('savings_goals').select('*')
        .order('is_completed', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async create(payload) {
      const { data, error } = await supabase.from('savings_goals').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, payload) {
      const { data, error } = await supabase.from('savings_goals').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id);
      if (error) throw error;
    }
  },

  notes: {
    async get(date) {
      const { data, error } = await supabase.from('daily_notes').select('*').eq('note_date', date).maybeSingle();
      if (error) throw error;
      return data;
    },
    async save(date, content) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase.from('daily_notes')
        .upsert({ user_id: user.id, note_date: date, content }).select().single();
      if (error) throw error;
      return data;
    },
    async remove(date) {
      const { error } = await supabase.from('daily_notes').delete().eq('note_date', date);
      if (error) throw error;
    }
  },

  recurring: {
    async list() {
      const { data, error } = await supabase.from('recurring_transactions')
        .select(`*, categories ( name, color, icon ), accounts ( name )`)
        .order('next_run_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async create(payload) {
      const { data, error } = await supabase.from('recurring_transactions').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, payload) {
      const { data, error } = await supabase.from('recurring_transactions').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    async processDue() {
      const today = new Date().toISOString().slice(0, 10);
      const rules = await this.list();
      const dueRules = rules.filter(r => r.is_active && r.next_run_date <= today);
      
      for (const rule of dueRules) {
        await supabase.from('transactions').insert({
          user_id: rule.user_id, type: rule.type, amount: rule.amount, title: rule.title,
          category_id: rule.category_id, account_id: rule.account_id, payment_mode: rule.payment_mode,
          transaction_date: rule.next_run_date, is_recurring: true, recurring_rule_id: rule.id
        });
        await supabase.from('recurring_logs').insert({ recurring_rule_id: rule.id, occurrence_date: rule.next_run_date });

        let nextDate = new Date(rule.next_run_date);
        if (rule.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        if (rule.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        if (rule.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        if (rule.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

        await this.update(rule.id, { next_run_date: nextDate.toISOString().slice(0, 10) });
      }
    }
  },

  /* ═══════════════════════════════════════════════════════
     SETTINGS (NEW in Phase 6)
     ═══════════════════════════════════════════════════════ */
  settings: {
    async get() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { data, error } = await supabase.from('user_settings')
        .select('*').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      
      return data || {
        user_id: user.id, currency: 'INR', date_format: 'DD-MM-YYYY', time_format: '12h',
        timezone: 'Asia/Kolkata', theme: 'dark', default_account_id: null,
        budget_alerts: true, email_notifications: true
      };
    },

    async update(payload) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      
      const { data, error } = await supabase.from('user_settings')
        .upsert({ user_id: user.id, ...payload }).select().single();
      if (error) throw error;
      return data;
    }
  }
};

window.DB = DB;