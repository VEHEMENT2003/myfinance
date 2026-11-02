/* ── MyFinance – Profile editing (Phase 2) ───────────────── */
import { supabase } from './supabase.js';

export const Profile = {
  _currentProfile: null,

  /* ─── Load current profile ─────────────────────────────── */
  async load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle(); // FIXED: Doesn't crash if row is missing

    if (error) throw error;

    // Fallback if profile row doesn't exist yet
    const profile = data || {
      id: session.user.id,
      full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || ''
    };

    this._currentProfile = profile;
    return { user: session.user, profile };
  },

  /* ─── Update name ──────────────────────────────────────── */
  async updateName(newName) {
    const trimmed = (newName || '').trim();
    if (!trimmed) throw new Error('Name cannot be empty');
    if (trimmed.length > 80) throw new Error('Name is too long (max 80 chars)');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');

    // FIXED: Use upsert to create the row if it was missing
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, full_name: trimmed })
      .select()
      .single();

    if (error) throw error;
    this._currentProfile = data;

    /* Refresh greeting immediately */
    const firstName = trimmed.split(' ')[0];
    const greeting = MF.ui.greet(firstName) + ' 👋';
    const gDesktop = document.getElementById('greeting');
    const gMobile  = document.getElementById('greeting-mobile');
    if (gDesktop) gDesktop.textContent = greeting;
    if (gMobile)  gMobile.textContent  = greeting;

    /* Update any avatar initials on the page */
    this._syncAvatarInitial(trimmed);

    window.dispatchEvent(new CustomEvent('profile:updated', { detail: data }));
    return data;
  },

  /* ─── Modal ────────────────────────────────────────────── */
  async openEditModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    try {
      const { user, profile } = await this.load();
      const nameInput = document.getElementById('profile-name-input');
      const emailEl   = document.getElementById('profile-email-display');
      
      if (nameInput) nameInput.value = profile?.full_name || '';
      if (emailEl)   emailEl.textContent = user.email || '';

      modal.classList.remove('hidden');
      setTimeout(() => nameInput?.focus(), 50);
    } catch (err) {
      MF.ui.toast('Could not load profile: ' + err.message, 'error');
    }
  },

  closeEditModal() {
    document.getElementById('profile-modal')?.classList.add('hidden');
  },

  /* ─── Avatar initial helper ────────────────────────────── */
  _syncAvatarInitial(name) {
    const initial = (name || '?').charAt(0).toUpperCase();
    document.querySelectorAll('[data-avatar-initial]').forEach(el => {
      el.textContent = initial;
    });
  },

  /* ─── Init (bind form + modal events) ──────────────────── */
  init() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    modal.querySelector('[data-close-modal]')?.addEventListener('click', () => this.closeEditModal());
    modal.querySelector('[data-modal-backdrop]')?.addEventListener('click', () => this.closeEditModal());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        this.closeEditModal();
      }
    });

    const form = document.getElementById('profile-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await this.updateName(document.getElementById('profile-name-input').value);
        this.closeEditModal();
        MF.ui.toast('Name updated successfully', 'success');
      } catch (err) {
        MF.ui.toast(err.message || 'Update failed', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    this.load()
      .then(({ profile, user }) => {
        const name = profile?.full_name || user.email?.split('@')[0] || '';
        this._syncAvatarInitial(name);
      })
      .catch(err => console.warn('[profile] preload failed', err));
  },
};

window.Profile = Profile;
document.addEventListener('DOMContentLoaded', () => Profile.init());