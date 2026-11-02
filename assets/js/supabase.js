/* ── MyFinance – Supabase client ──────────────────────────── */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

if (!window.MF?.config?.supabaseUrl || !window.MF?.config?.supabaseKey) {
  throw new Error('[MyFinance] Missing Supabase credentials in config.js');
}
if (window.MF.config.supabaseUrl.includes('YOUR-PROJECT-REF')) {
  throw new Error('[MyFinance] config.js still has placeholder Supabase URL — fill it in.');
}

export const supabase = createClient(
  window.MF.config.supabaseUrl,
  window.MF.config.supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,   // required for magic-link & OAuth callbacks
      flowType: 'pkce',
    },
  }
);

/* Convenience for non-module scripts and manual console testing */
window.supabase = supabase;