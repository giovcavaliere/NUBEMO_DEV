// Admin 2.0 — servizi di lettura e Logout Auth. Nessuna dipendenza dalla UI.
(() => {
  'use strict';

  class AccessError extends Error {
    constructor(message, code = 'forbidden') { super(message); this.name = 'AdminAccessError'; this.code = code; }
  }

  function create(client) {
    if (!client) throw new Error('Servizio di accesso non disponibile.');
    const timeoutMs = 15000;
    async function request(operation) {
      let timer;
      try {
        return await Promise.race([
          operation,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Il servizio non risponde. Riprova.')), timeoutMs);
          })
        ]);
      } finally { clearTimeout(timer); }
    }

    async function verifyAccess() {
      const result = await request(client.auth.getUser());
      if (result.error) {
        if ([400, 401, 403].includes(result.error.status) || result.error.name === 'AuthSessionMissingError') {
          throw new AccessError('Accedi con un account Admin attivo.', 'unauthenticated');
        }
        throw new Error('Non è stato possibile verificare la sessione. Riprova.');
      }
      const user = result.data?.user;
      if (!user?.id) throw new AccessError('Accedi con un account Admin attivo.', 'unauthenticated');
      const { data: profile, error } = await request(client.from('profiles')
        .select('id,auth_user_id,first_name,last_name,email,role,status')
        .eq('auth_user_id', user.id).single());
      if (error) throw new Error('Non è stato possibile verificare il profilo NUBEMO. Riprova.');
      if (!profile || profile.auth_user_id !== user.id || profile.role !== 'admin' || profile.status !== 'active') {
        throw new AccessError('Accesso consentito soltanto a un Admin attivo.');
      }
      return { user, profile };
    }

    async function listProfessionals() {
      const { data, error } = await request(client.auth.getSession());
      const session = data?.session;
      if (error || !session?.access_token) throw new AccessError('La sessione non è più disponibile. Accedi nuovamente.', 'unauthenticated');
      const response = await request(client.functions.invoke('swift-endpoint', {
        body: { action: 'list-professionals' },
        headers: { Authorization: `Bearer ${session.access_token}` }
      }));
      if (response.error?.context?.status === 401 || response.error?.context?.status === 403) {
        throw new AccessError('La sessione non consente più l’accesso Admin.', response.error.context.status === 401 ? 'unauthenticated' : 'forbidden');
      }
      if (response.error || response.data?.ok !== true || !Array.isArray(response.data.professionals)) {
        throw new Error('Non è stato possibile caricare i professionisti. Riprova.');
      }
      const rows = response.data.professionals;
      if (rows.some(row => !row || typeof row.professional_id !== 'string' || !row.professional_id ||
        typeof row.profile_id !== 'string' || !row.profile_id)) {
        throw new Error('Il servizio ha restituito un elenco professionisti non valido.');
      }
      return rows;
    }

    async function loadCurrentPrivacy() {
      const { data, error } = await request(client.from('privacy_documents')
        .select('id,document_type,version,title,storage_bucket,storage_path,published_at,active,created_at')
        .eq('document_type', 'nubemo').eq('active', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }).limit(1).maybeSingle());
      if (error) throw new Error('Non è stato possibile leggere l’informativa NUBEMO. Riprova.');
      return data || null;
    }

    async function loadAcceptances(documentId, profileIds) {
      const ids = [...new Set(profileIds.filter(Boolean))];
      if (!documentId || !ids.length) return [];
      const rows = [];
      // Lotti limitati per evitare URL REST troppo lunghi.
      for (let offset = 0; offset < ids.length; offset += 100) {
        const result = await request(client.from('privacy_acceptances')
          .select('profile_id,status,accepted_at,refused_at')
          .eq('privacy_document_id', documentId).in('profile_id', ids.slice(offset, offset + 100)));
        if (result.error || !Array.isArray(result.data)) throw new Error('Non è stato possibile leggere i consensi dei professionisti.');
        rows.push(...result.data);
      }
      return rows;
    }

    async function createPrivacyUrl(documentRow) {
      if (documentRow?.document_type !== 'nubemo' || documentRow.active !== true ||
        documentRow.storage_bucket !== 'privacy-documents' || !documentRow.storage_path?.startsWith('nubemo/')) {
        throw new Error('Il documento NUBEMO non è disponibile.');
      }
      const { data, error } = await request(client.storage.from('privacy-documents')
        .createSignedUrl(documentRow.storage_path, 300));
      if (error || !data?.signedUrl) throw new Error('Non è stato possibile aprire l’informativa.');
      return data.signedUrl;
    }

    async function signOut() {
      // Disconnette questa sessione, senza revocare gli accessi sugli altri dispositivi.
      const { error } = await request(client.auth.signOut({ scope: 'local' }));
      if (error) throw new Error('Disconnessione non riuscita. Riprova il logout.');
    }

    function onAuthChange(callback) { return client.auth.onAuthStateChange(callback).data.subscription; }
    return Object.freeze({ verifyAccess, listProfessionals, loadCurrentPrivacy, loadAcceptances, createPrivacyUrl, signOut, onAuthChange });
  }

  window.NubemoAdminServices = Object.freeze({ create, AccessError });
})();
