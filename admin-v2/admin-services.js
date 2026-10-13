// Admin 2.0 — servizi dati e Auth condivisa. Nessuna dipendenza dalla UI.
(() => {
  'use strict';

  class AccessError extends Error {
    constructor(message, code = 'forbidden') { super(message); this.name = 'AdminAccessError'; this.code = code; }
  }

  function create(client) {
    if (!client) throw new Error('Servizio di accesso non disponibile.');
    const timeoutMs = 15000;
    let management = { version: 0, enabled: false };
    let writing = false;
    const operationIds = new Map();
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
        .select('id,auth_user_id,first_name,last_name,email,role,status,admin_avatar_path')
        .eq('auth_user_id', user.id).single());
      if (error) throw new Error('Non è stato possibile verificare il profilo NUBEMO. Riprova.');
      if (!profile || profile.auth_user_id !== user.id || profile.role !== 'admin' || profile.status !== 'active') {
        throw new AccessError('Accesso consentito soltanto a un Admin attivo.');
      }
      return { user, profile };
    }

    async function invoke(body) {
      const { data, error } = await request(client.auth.getSession());
      const session = data?.session;
      if (error || !session?.access_token) throw new AccessError('La sessione non è più disponibile. Accedi nuovamente.', 'unauthenticated');
      const response = await request(client.functions.invoke('swift-endpoint', {
        body, headers: { Authorization: `Bearer ${session.access_token}` }
      }));
      const httpStatus = response.error?.context?.status;
      if ([401, 403].includes(httpStatus)) {
        throw new AccessError('La sessione non consente più l’accesso Admin.', httpStatus === 401 ? 'unauthenticated' : 'forbidden');
      }
      if (response.error || response.data?.ok !== true) {
        let result = response.data;
        if (!result && response.error?.context?.json) {
          try { result = await response.error.context.json(); } catch (_) { /* Errore di rete senza payload. */ }
        }
        const messages = {
          duplicate: 'Email già utilizzata o richiesta già in corso. Aggiorna l’elenco.',
          state_changed: 'Lo stato è cambiato. Aggiorna l’elenco prima di riprovare.',
          ineligible: 'Il reinvio non è consentito per lo stato attuale dell’account.',
          invalid_input: 'Verifica i dati inseriti.',
          backend_unavailable: 'Gestione professionisti non ancora disponibile.',
          operation_pending: 'Richiesta già registrata. Verificare l’esito prima di un nuovo invio.',
          needs_review: 'Esito invio incerto. È necessaria una verifica amministrativa.',
          email_unconfirmed: 'Invito non confermato dal servizio email. Verificare l’esito prima di riprovare.',
          unavailable: 'Operazione non disponibile o già in corso.'
        };
        throw Object.assign(new Error(messages[result?.code] || 'Il servizio non ha confermato l’operazione. Riprova la lettura dei dati.'), { code: result?.code || 'backend_error' });
      }
      return response.data;
    }

    async function listProfessionals() {
      management = { version: 0, enabled: false };
      let response;
      try { response = await invoke({ action: 'list-professionals', management_version: 1 }); }
      catch (error) { if (error.name === 'AdminAccessError') throw error; throw new Error('Non è stato possibile caricare i professionisti. Riprova.'); }
      const rows = response.professionals;
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row.professional_id !== 'string' || !row.professional_id ||
        typeof row.profile_id !== 'string' || !row.profile_id)) {
        throw new Error('Il servizio ha restituito un elenco professionisti non valido.');
      }
      const config = response.management;
      if (config?.version === 1) {
        if (typeof config.enabled !== 'boolean' || !validLimit(config.default_patient_limit) || rows.some(row =>
          !Number.isInteger(row.active_patient_count) || row.active_patient_count < 0 ||
          !Number.isInteger(row.associated_patient_count) || row.associated_patient_count < 0 ||
          (row.active_patient_limit !== null && !validLimit(row.active_patient_limit)) ||
          row.available_patient_slots !== (row.active_patient_limit === null ? null : Math.max(0, row.active_patient_limit - row.active_patient_count)) ||
          ['can_resend','can_suspend','can_activate'].some(key => typeof row[key] !== 'boolean'))) {
          throw new Error('Il backend ha restituito capacità o autorizzazioni non valide.');
        }
        management = { ...config };
      }
      return rows;
    }

    function validLimit(value) { return Number.isInteger(value) && value >= 1 && value <= 100000; }
    function validId(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
    async function manage(action, values = {}) {
      if (management.version !== 1 || management.enabled !== true) throw new Error('Gestione professionisti non ancora disponibile.');
      if (writing) throw new Error('Un’operazione è già in corso.');
      const body = { action, management_version: 1 };
      if (action === 'invite-professional') {
        for (const key of ['first_name','last_name','email']) body[key] = typeof values[key] === 'string' ? values[key].trim() : '';
        body.email = body.email.toLowerCase();
        if (!body.first_name || !body.last_name || body.first_name.length > 100 || body.last_name.length > 100 || body.email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new Error('Inserisci nome, cognome e un’email valida.');
      } else if (['resend-professional-invite','suspend-professional','activate-professional','set-professional-limit'].includes(action)) {
        if (!validId(values.professional_id)) throw new Error('Professionista non valido.');
        body.professional_id = values.professional_id;
        if (action === 'suspend-professional') {
          if (values.confirmed !== true) throw new Error('Conferma esplicitamente la sospensione.');
          body.confirmed = true;
        }
      } else if (action !== 'set-default-patient-limit') throw new Error('Operazione non disponibile.');
      if (['set-professional-limit','set-default-patient-limit'].includes(action)) {
        if (!validLimit(values.limit)) throw new Error('Il limite deve essere un intero da 1 a 100.000.');
        body.limit = values.limit;
      }
      const emailAction = ['invite-professional','resend-professional-invite'].includes(action);
      const key = JSON.stringify(body);
      if (emailAction) {
        if (!operationIds.has(key)) operationIds.set(key, window.crypto.randomUUID());
        body.operation_id = operationIds.get(key);
      }
      writing = true;
      try {
        const result = await invoke(body);
        const confirmed = action === 'invite-professional' ? result.invited === true && validId(result.professional_id) && result.email_status === 'accepted' :
          action === 'resend-professional-invite' ? result.resent === true && result.professional_id === body.professional_id && result.email_status === 'accepted' :
          ['set-professional-limit','set-default-patient-limit'].includes(action) ? result.limit === body.limit && result.professional_id === (body.professional_id || null) :
          result.professional_id === body.professional_id && result.nubemo_status === (action === 'suspend-professional' ? 'suspended' : 'active');
        if (!confirmed) throw new Error('Il backend non ha confermato il risultato previsto. Verifica l’elenco.');
        if (emailAction) operationIds.delete(key);
        return result;
      } finally { writing = false; }
    }
    async function saveDefaultPatientLimit(limit) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100000) throw new Error('Il limite deve essere un intero da 1 a 100.000.');
      await verifyAccess();
      const { data, error } = await request(client.rpc('admin2_set_default_patient_limit', { p_limit: limit }));
      if (error || data !== limit) throw new Error('Non è stato possibile salvare il limite pazienti.');
      management = { ...management, default_patient_limit: limit };
      return limit;
    }
    function getManagement() { return Object.freeze({ ...management }); }

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

    async function publishPrivacy({version,title,file}) {
      const v=String(version||'').trim(), t=String(title||'').trim();
      if(!v || v.length>40 || !t || t.length>120) throw new Error('Versione o titolo non validi.');
      if(!file || file.type!=='application/pdf' || file.size<1 || file.size>10485760) throw new Error('Seleziona un PDF valido fino a 10 MB.');
      await verifyAccess();
      const path='nubemo/'+crypto.randomUUID()+'.pdf';
      const uploaded=await request(client.storage.from('privacy-documents').upload(path,file,{
        upsert:false,contentType:'application/pdf',cacheControl:'0'
      }));
      if(uploaded.error) throw new Error('Caricamento PDF non riuscito: '+uploaded.error.message);
      const published=await request(client.rpc('admin2_publish_privacy',{p_version:v,p_title:t,p_path:path}));
      if(published.error || !published.data) throw new Error('PDF caricato ma pubblicazione non completata. Verifica versione e stato prima di riprovare.');
      return published.data;
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

    async function getAdminAvatarUrl(profile) {
      if (!profile?.admin_avatar_path) return null;
      const path = profile.admin_avatar_path;
      if (!profile.auth_user_id || !['jpg', 'png', 'webp'].some(ext => path === profile.auth_user_id + '/avatar.' + ext)) return null;
      const { data, error } = await request(client.storage.from('admin-assets').createSignedUrl(path, 120));
      if (error || !data?.signedUrl) throw new Error('Non è stato possibile caricare la foto del profilo.');
      return data.signedUrl;
    }

    async function saveOwnIdentity({ firstName, lastName, avatarPath }) {
      const first = String(firstName || '').trim(), last = String(lastName || '').trim();
      if (!first || !last || first.length > 100 || last.length > 100) throw new Error('Inserisci nome e cognome validi.');
      const access = await verifyAccess();
      const { data, error } = await request(client.rpc('admin2_update_own_profile', {
        p_first_name: first, p_last_name: last, p_avatar_path: avatarPath ?? null
      }));
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row || row.id !== access.profile.id) throw new Error('Salvataggio profilo non riuscito.');
      return { ...access.profile, ...row, auth_user_id: access.user.id };
    }

    async function uploadAdminAvatar(file, userId) {
      const extensions = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
      const ext = extensions[file?.type];
      if (!ext || file.size > 2097152 || file.size === 0) throw new Error('Seleziona una foto JPG, PNG o WebP fino a 2 MB.');
      const access = await verifyAccess();
      if (access.user.id !== userId) throw new AccessError('La sessione è cambiata.');
      const path = userId + '/avatar.' + ext;
      const { error } = await request(client.storage.from('admin-assets').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '0' }));
      if (error) throw new Error('Caricamento della foto non riuscito: ' + error.message);
      return path;
    }

    async function signOut() {
      // Disconnette questa sessione, senza revocare gli accessi sugli altri dispositivi.
      const { error } = await request(client.auth.signOut({ scope: 'local' }));
      if (error) throw new Error('Disconnessione non riuscita. Riprova il logout.');
    }

    function onAuthChange(callback) { return client.auth.onAuthStateChange(callback).data.subscription; }
    return Object.freeze({ verifyAccess, listProfessionals, getManagement, manage, saveDefaultPatientLimit, loadCurrentPrivacy, loadAcceptances, publishPrivacy, createPrivacyUrl, getAdminAvatarUrl, saveOwnIdentity, uploadAdminAvatar, signOut, onAuthChange });
  }

  window.NubemoAdminServices = Object.freeze({ create, AccessError });
})();
