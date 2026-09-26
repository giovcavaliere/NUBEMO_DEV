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

  const AUTH_COOKIE_PREFIX = 'nubemo-auth-';
  const COOKIE_CHUNK_BYTES = 3000;

  const cookieStorage = Object.freeze({
    getItem(key) {
      const base = AUTH_COOKIE_PREFIX + encodeURIComponent(String(key));
      const cookies = Object.fromEntries(document.cookie.split(';').map(part => {
        const i=part.indexOf('=');
        if(i<0)return [part.trim(),''];
        return [part.slice(0,i).trim(),part.slice(i+1)];
      }));
      const count = Number(cookies[base + '-count'] || 0);
      if (!count) return cookies[base] ? decodeURIComponent(cookies[base]) : null;
      let encoded='';
      for(let i=0;i<count;i++){
        const part=cookies[base+'-'+i];
        if(part==null)return null;
        encoded += part;
      }
      return encoded ? decodeURIComponent(encoded) : null;
    },
    setItem(key, value) {
      const base = AUTH_COOKIE_PREFIX + encodeURIComponent(String(key));
      this.removeItem(key);
      const encoded = encodeURIComponent(String(value));
      const chunks=[];
      for(let i=0;i<encoded.length;i+=COOKIE_CHUNK_BYTES) chunks.push(encoded.slice(i,i+COOKIE_CHUNK_BYTES));
      const attrs='; Path=/; SameSite=Lax; Secure; Max-Age=31536000';
      if(chunks.length<=1){document.cookie=base+'='+chunks[0]+attrs;return;}
      document.cookie=base+'-count='+chunks.length+attrs;
      chunks.forEach((part,i)=>{document.cookie=base+'-'+i+'='+part+attrs;});
    },
    removeItem(key) {
      const base = AUTH_COOKIE_PREFIX + encodeURIComponent(String(key));
      const expire='; Path=/; SameSite=Lax; Secure; Max-Age=0';
      const cookies = Object.fromEntries(document.cookie.split(';').map(part => {
        const i=part.indexOf('=');
        if(i<0)return [part.trim(),''];
        return [part.slice(0,i).trim(),part.slice(i+1)];
      }));
      const count=Number(cookies[base+'-count']||0);
      document.cookie=base+'='+expire;
      document.cookie=base+'-count='+expire;
      for(let i=0;i<count;i++) document.cookie=base+'-'+i+'='+expire;
    }
  });

  window.nubemoSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storage: cookieStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
