// NUBEMO 2.0 — servizi Auth sul client condiviso, senza DOM o persistenza aggiuntiva.
(() => {
  'use strict';
  class AccessError extends Error {
    constructor(message, code) { super(message); this.name = 'AuthV2AccessError'; this.code = code; }
  }
  function create(client) {
    if (!client) throw new Error('Servizio di accesso non disponibile. Ricarica la pagina.');
    async function request(operation) {
      let timer;
      try {
        return await Promise.race([operation, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Il servizio non risponde. Riprova.')), 15000);
        })]);
      } finally { clearTimeout(timer); }
    }
    async function verifyProfile() {
      const result = await request(client.auth.getUser());
      if (result.error) {
        if ([400, 401, 403].includes(result.error.status) || result.error.name === 'AuthSessionMissingError') {
          throw new AccessError('Accedi con il tuo account NUBEMO.', 'unauthenticated');
        }
        throw new Error('Non è stato possibile verificare la sessione. Riprova.');
      }
      const user = result.data?.user;
      if (!user?.id) throw new AccessError('Accedi con il tuo account NUBEMO.', 'unauthenticated');
      const { data: profile, error } = await request(client.from('profiles')
        .select('id,auth_user_id,first_name,last_name,email,role,status')
        .eq('auth_user_id', user.id).single());
      if (error || !profile) throw new Error('Profilo NUBEMO non disponibile per questo account.');
      if (profile.auth_user_id !== user.id) throw new AccessError('Accesso non autorizzato.', 'forbidden');
      if (profile.status !== 'active') {
        const label = { suspended: 'sospeso', disabled: 'disabilitato' }[profile.status];
        throw new AccessError(label ? `Account ${label}. Accesso a NUBEMO non consentito.` : 'Account non attivo. Accesso a NUBEMO non consentito.', 'forbidden');
      }
      if (!['admin', 'professional', 'patient'].includes(profile.role)) throw new AccessError('Ruolo NUBEMO non riconosciuto.', 'forbidden');
      return profile;
    }
    async function restore() {
      try { return await verifyProfile(); }
      catch (error) { if (error.code === 'unauthenticated') return null; throw error; }
    }
    async function login(email, password) {
      const address = String(email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Inserisci un indirizzo email valido.');
      if (!password) throw new Error('Inserisci la password.');
      const { error } = await request(client.auth.signInWithPassword({ email: address, password }));
      if (error) {
        if (error.code === 'invalid_credentials' || error.message === 'Invalid login credentials') throw new Error('Email o password non corretti.');
        if (error.code === 'email_not_confirmed') throw new Error('Account non ancora confermato. Controlla l’invito ricevuto.');
        throw new Error('Non è stato possibile accedere. Riprova.');
      }
      return verifyProfile();
    }
    async function signOut() {
      const { error } = await request(client.auth.signOut({ scope: 'local' }));
      if (error) throw new Error('Disconnessione non riuscita. Riprova.');
    }
    function onAuthChange(callback) { return client.auth.onAuthStateChange(callback).data.subscription; }
    return Object.freeze({ login, restore, signOut, onAuthChange });
  }
  window.NubemoAuthV2 = Object.freeze({ create });
})();
