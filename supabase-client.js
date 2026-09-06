// NUBEMO 4.0 DEV — client pubblico Supabase.
// In frontend sono ammessi solo Project URL e Publishable/anon key.
(() => {
  const SUPABASE_URL = 'https://bggvwwjwzfskabgkynwp.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7FTdy-tahqbSSHv0Xoa6EQ_bb-GAKoK';

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
