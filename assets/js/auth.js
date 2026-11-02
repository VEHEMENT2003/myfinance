/* ── MyFinance – Auth helpers & route guard ──────────────── */
import { supabase } from './supabase.js';

export const Auth = {

  async signUp({ email, password, fullName }) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName || '' },
        emailRedirectTo: `${location.origin}/auth-callback.html`,
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password,
    });
    if (error) throw error;
    return data;
  },

  async sendMagicLink(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth-callback.html`,
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  },

  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth-callback.html`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    location.replace('login.html');
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  async requireAuth() {
    const session = await Auth.getSession();
    if (!session) {
      location.replace('login.html?redirect=' + encodeURIComponent(location.pathname));
      throw new Error('Not authenticated');
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle(); // FIXED: Prevents crash if profile is missing

    if (error) console.warn('[auth] profile fetch failed', error);

    return { user: session.user, profile };
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((_event, session) => callback(session));
  },
};

window.Auth = Auth;