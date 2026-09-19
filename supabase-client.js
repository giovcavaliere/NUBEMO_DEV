// NUBEMO — client pubblico Supabase.
// URL e Publishable key vengono letti esclusivamente dalla configurazione ambiente.
(() => {
  'use strict';

  const config = window.NUBEMO_CONFIG;
  if (!config) {
    throw new Error('Configurazione NUBEMO non disponibile.');
  }

  const SUPABASE_URL = String(config.supabaseUrl || '').trim();
  const SUPABASE_PUBLISHABLE_KEY = String(config.supabasePublishableKey || '').trim();

  if (!SUPABASE_URL) {
    throw new Error('Supabase URL non configurato per NUBEMO.');
  }
  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase Publishable key non configurata per NUBEMO.');
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Libreria Supabase non disponibile.');
  }

  window.nubemoSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
