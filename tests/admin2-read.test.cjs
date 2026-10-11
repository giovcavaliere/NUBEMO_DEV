const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.join(__dirname, '..', 'admin-v2');
const source = file => fs.readFileSync(path.join(base, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function moduleFor(file, extra = {}) {
  const context = { window: {}, setTimeout, clearTimeout, ...extra };
  vm.runInNewContext(source(file), context);
  return context.window;
}
const admin = { id: 'profile-admin', auth_user_id: 'auth-admin', role: 'admin', status: 'active' };
function clientFor(options = {}) {
  const calls = [];
  const client = {
    calls,
    auth: {
      getUser: async () => { calls.push(['getUser']); return options.userResult || { data: { user: { id: 'auth-admin', user_metadata: { role: 'admin' } } } }; },
      getSession: async () => options.sessionResult || { data: { session: { access_token: 'test-jwt' } } },
      onAuthStateChange: callback => { client.callback = callback; return { data: { subscription: { unsubscribe() {} } } }; }
    },
    functions: { invoke: async (...args) => { calls.push(['invoke', ...args]); return options.functionResult || { data: { ok: true, professionals: [] } }; } },
    storage: { from: bucket => ({ createSignedUrl: async (file, seconds) => { calls.push(['signedUrl', bucket, file, seconds]); return options.urlResult || { data: { signedUrl: 'https://example.invalid/signed.pdf' } }; } }) },
    from(table) {
      const query = { table, steps: [] };
      calls.push(['from', query]);
      const result = () => {
        if (options.resolveTable) return options.resolveTable(table, query);
        if (table === 'profiles') return { data: options.profile === undefined ? admin : options.profile, error: options.profileError };
        if (table === 'privacy_documents') return { data: options.document || null, error: options.privacyError };
        if (table === 'privacy_acceptances') return { data: options.acceptances || [], error: options.acceptanceError };
        throw Error('Unexpected table: ' + table);
      };
      const builder = {};
      for (const method of ['select', 'eq', 'order', 'limit', 'in']) builder[method] = (...args) => { query.steps.push([method, ...args]); return builder; };
      builder.single = builder.maybeSingle = async () => result();
      builder.then = (resolve, reject) => Promise.resolve(result()).then(resolve, reject);
      return builder;
    }
  };
  return client;
}
function service(client, extra) { return moduleFor('admin-services.js', extra).NubemoAdminServices.create(client); }
const views = moduleFor('admin-views.js').NubemoAdminViews;
const row = (id, fields = {}) => ({ professional_id: id, profile_id: 'profile-' + id, first_name: 'Laura', last_name: 'Rossi', email: id + '@example.invalid', account_status: 'active', nubemo_status: 'active', professional_status: 'active', ...fields });
const documentRow = { id: 'doc', document_type: 'nubemo', active: true, storage_bucket: 'privacy-documents', storage_path: 'nubemo/v1/document.pdf', version: '1.0', title: 'Privacy NUBEMO' };
const stateFor = (rows = []) => ({ professionals: { phase: 'ready', rows }, privacy: { phase: 'ready', document: documentRow }, consents: { phase: 'ready', rows: [] } });

test('Auth server e profilo persistente autorizzano unicamente Admin attivo', async () => {
  const client = clientFor();
  assert.equal((await service(client).verifyAccess()).profile.id, admin.id);
  const q = client.calls.find(c => c[0] === 'from')[1];
  assert.equal(q.table, 'profiles');
  assert.deepEqual(plain(q.steps.find(step => step[0] === 'eq')), ['eq', 'auth_user_id', 'auth-admin']);
  for (const profile of [{ ...admin, role: 'patient' }, { ...admin, status: 'suspended' }, { ...admin, auth_user_id: 'other' }, null]) {
    await assert.rejects(service(clientFor({ profile })).verifyAccess(), { name: 'AdminAccessError' });
  }
});
test('Metadati utente Admin non superano il ruolo patient del database', async () => {
  await assert.rejects(service(clientFor({ profile: { ...admin, role: 'patient' } })).verifyAccess(), { name: 'AdminAccessError' });
});
test('Sessione assente, token scaduto e rete indisponibile restano distinti', async () => {
  await assert.rejects(service(clientFor({ userResult: { data: { user: null } } })).verifyAccess(), { name: 'AdminAccessError' });
  await assert.rejects(service(clientFor({ userResult: { error: { status: 401 } } })).verifyAccess(), { name: 'AdminAccessError' });
  await assert.rejects(service(clientFor({ userResult: { error: { status: 503 } } })).verifyAccess(), e => e.name !== 'AdminAccessError' && /sessione/.test(e.message));
});
test('Timeout limita attese senza mostrare dati o richiedere scritture', async () => {
  const client = clientFor(); client.auth.getUser = () => new Promise(() => {});
  await assert.rejects(service(client, { setTimeout: fn => setTimeout(fn, 1) }).verifyAccess(), /non risponde/);
});
test('Elenco usa soltanto list-professionals e JWT di sessione', async () => {
  const client = clientFor(); assert.deepEqual(plain(await service(client).listProfessionals()), []);
  const invoke = client.calls.find(c => c[0] === 'invoke');
  assert.deepEqual(plain(invoke.slice(1)), ['swift-endpoint', { body: { action: 'list-professionals' }, headers: { Authorization: 'Bearer test-jwt' } }]);
});
test('Elenco vuoto valido distinto da errori, payload malformato e accesso revocato', async () => {
  for (const result of [{ data: { ok: false } }, { data: { ok: true } }, { data: { ok: true, professionals: [{}] } }, { error: { message: 'network' } }]) {
    await assert.rejects(service(clientFor({ functionResult: result })).listProfessionals());
  }
  await assert.rejects(service(clientFor({ functionResult: { error: { context: { status: 403 } } } })).listProfessionals(), { name: 'AdminAccessError' });
  const client = clientFor({ sessionResult: { data: { session: null } } });
  await assert.rejects(service(client).listProfessionals(), { name: 'AdminAccessError' });
  assert.equal(client.calls.some(c => c[0] === 'invoke'), false);
});
test('Privacy legge unicamente ultima informativa NUBEMO attiva', async () => {
  const client = clientFor({ document: documentRow });
  assert.equal((await service(client).loadCurrentPrivacy()).id, 'doc');
  const q = client.calls.find(c => c[0] === 'from')[1];
  assert.equal(q.table, 'privacy_documents');
  assert.ok(q.steps.some(s => s[0] === 'eq' && s[1] === 'document_type' && s[2] === 'nubemo'));
  assert.ok(q.steps.some(s => s[0] === 'eq' && s[1] === 'active' && s[2] === true));
  assert.deepEqual(plain(q.steps.find(s => s[0] === 'limit')), ['limit', 1]);
  assert.equal(await service(clientFor()).loadCurrentPrivacy(), null);
  await assert.rejects(service(clientFor({ privacyError: {} })).loadCurrentPrivacy());
});
test('Consensi: nessuna query senza documento/profili; lotti e filtro versione', async () => {
  const client = clientFor(); const api = service(client);
  await api.loadAcceptances(null, ['p']); await api.loadAcceptances('doc', []);
  assert.equal(client.calls.length, 0);
  await api.loadAcceptances('doc', Array.from({ length: 201 }, (_, i) => 'p' + i));
  const queries = client.calls.filter(c => c[0] === 'from').map(c => c[1]);
  assert.equal(queries.length, 3);
  for (const q of queries) {
    assert.equal(q.table, 'privacy_acceptances');
    assert.ok(q.steps.some(s => s[0] === 'eq' && s[1] === 'privacy_document_id' && s[2] === 'doc'));
    assert.ok(q.steps.find(s => s[0] === 'in')[2].length <= 100);
  }
});
test('Link PDF limitato a informativa NUBEMO, bucket privato e 300 secondi', async () => {
  const client = clientFor();
  assert.equal(await service(client).createPrivacyUrl(documentRow), 'https://example.invalid/signed.pdf');
  assert.deepEqual(client.calls[0], ['signedUrl', 'privacy-documents', 'nubemo/v1/document.pdf', 300]);
  for (const invalid of [{ ...documentRow, active: false }, { ...documentRow, storage_bucket: 'patient-documents' }, { ...documentRow, storage_path: 'patients/clinical.pdf' }]) {
    await assert.rejects(service(clientFor()).createPrivacyUrl(invalid));
  }
});
test('KPI distinguono account confermato, stato profilo e stato professionista', () => {
  const rows = [row('1'), row('2', { account_status: 'invited' }), row('3', { nubemo_status: 'suspended' }), row('4', { professional_status: 'suspended' }), row('5', { nubemo_status: 'disabled' })];
  assert.deepEqual(plain(views.summarize(rows)), { total: 5, active: 1, invited: 1, suspended: 2 });
  assert.deepEqual(plain(views.summarize([])), { total: 0, active: 0, invited: 0, suspended: 0 });
});
test('Ricerca nome/cognome/email e filtro si combinano senza mutare la lista', () => {
  const rows = [row('first'), row('second', { first_name: 'Marco', nubemo_status: 'suspended' })];
  assert.equal(views.filter(rows, '  MARCO ', 'suspended').length, 1);
  assert.equal(views.filter(rows, 'FIRST@', 'all').length, 1);
  assert.equal(views.filter(rows, 'MARCO', 'active').length, 0);
  assert.equal(rows.length, 2);
});
test('Privacy senza informativa, consenso mancante/rifiutato e errore non equivalgono ad accettata', () => {
  const p = row('1'); const s = stateFor([p]);
  assert.equal(views.privacyLabel(p, s), 'In attesa');
  s.consents.rows = [{ profile_id: p.profile_id, status: 'refused' }];
  assert.equal(views.privacyLabel(p, s), 'Rifiutata');
  s.consents.rows[0].status = 'accepted'; assert.equal(views.privacyLabel(p, s), 'Accettata');
  s.consents.phase = 'error'; assert.equal(views.privacyLabel(p, s), 'Non disponibile');
  s.privacy.document = null; assert.equal(views.privacyLabel(p, s), 'Nessuna informativa');
  s.privacy.phase = 'error'; assert.equal(views.privacyLabel(p, s), 'Non disponibile');
});
test('Dati esterni escapati e operazioni di scrittura disabilitate nel markup', () => {
  const markup = views.professionalMarkup(row('x\" onclick=\"bad', { first_name: '<img src=x onerror=bad>', account_status: 'invited', nubemo_status: 'disabled' }), stateFor());
  assert.ok(!markup.includes('<img'));
  assert.ok(markup.includes('&lt;img'));
  assert.ok(markup.includes('x&amp;') === false);
  assert.ok(markup.includes('x&quot; onclick=&quot;bad'));
  assert.ok(markup.includes('Disabilitato'));
  assert.ok(markup.includes('Non disponibile'));
  assert.match(markup, /data-admin-prof-resend="[^"]*" disabled/);
  assert.match(markup, /data-admin-prof-toggle="[^"]*" disabled/);
});

// Doppio DOM minimale per test di coordinamento. Non renderizza CSS e non è un browser.
class Element {
  constructor() { this.hidden = true; this.textContent = ''; this.disabled = false; this.dataset = {}; this.listeners = {}; this.attrs = {}; this.classList = { toggle: (key, value) => { this.attrs[key] = value; } }; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn(event); }
}
function appHarness(overrides = {}) {
  const root = new Element(), gate = new Element(), message = new Element(), retry = new Element();
  const viewsByRoute = ['dashboard', 'professionisti', 'privacy', 'impostazioni'].map(value => Object.assign(new Element(), { dataset: { adminView: value } }));
  const links = viewsByRoute.map(view => Object.assign(new Element(), { dataset: { adminRoute: view.dataset.adminView } }));
  const doc = new Element(); doc.visibilityState = 'hidden';
  const button = new Element(), note = new Element();
  root.querySelectorAll = selector => selector === '[data-admin-view]' ? viewsByRoute : selector === '[data-admin-route]' ? links : [];
  root.querySelector = selector => selector === '[data-admin-privacy-preview]' ? button : note;
  gate.querySelector = selector => selector === '[data-admin-access-message]' ? message : retry;
  doc.querySelector = selector => selector === '.admin2' ? root : gate;
  let authCallback; const calls = []; const renders = [];
  const api = {
    verifyAccess: async () => ({ user: { id: 'auth-admin' }, profile: admin }),
    listProfessionals: async () => { calls.push('list'); return [row('1')]; },
    loadCurrentPrivacy: async () => { calls.push('privacy'); return documentRow; },
    loadAcceptances: async () => [],
    createPrivacyUrl: async () => 'https://example.invalid/signed.pdf',
    onAuthChange: fn => { authCallback = fn; }, ...overrides
  };
  const window = new Element(); window.NubemoAdminServices = { create: () => api };
  window.NubemoAdminViews = { create: () => ({ identity() {}, render: s => renders.push(plain(s)), clear: () => renders.push('cleared') }) };
  const location = { hash: '#privacy', assign() {} }; window.location = location;
  vm.runInNewContext(source('admin-app.js'), { window, document: doc, location, setTimeout, clearTimeout });
  return { root, gate, message, retry, doc, window, calls, renders, routes: viewsByRoute, auth: (event, session) => authCallback(event, session) };
}
const tick = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('Nessun contenuto o lettura dati prima della verifica Admin', async () => {
  const access = deferred(); const h = appHarness({ verifyAccess: () => access.promise });
  assert.equal(h.root.hidden, true); assert.equal(h.calls.length, 0);
  access.resolve({ user: { id: 'auth-admin' }, profile: admin }); await tick();
  assert.equal(h.root.hidden, false); assert.equal(h.gate.hidden, true);
  assert.equal(h.routes.find(r => r.dataset.adminView === 'privacy').hidden, false);
  assert.deepEqual(h.calls, ['list', 'privacy']);
});
test('Accesso negato non avvia letture; errore transitorio offre retry', async () => {
  const error = Object.assign(Error('Accesso negato'), { name: 'AdminAccessError' });
  const h = appHarness({ verifyAccess: async () => { throw error; } }); await tick();
  assert.equal(h.root.hidden, true); assert.equal(h.calls.length, 0); assert.equal(h.retry.hidden, true);
  const transient = appHarness({ verifyAccess: async () => { throw Error('Rete'); } }); await tick();
  assert.equal(transient.root.hidden, true); assert.equal(transient.retry.hidden, false);
});
test('Logout invalida risposte tardive senza riaprire UI o dati', async () => {
  const list = deferred(); const h = appHarness({ listProfessionals: () => list.promise }); await tick();
  h.auth('SIGNED_OUT', null); list.resolve([row('late')]); await tick();
  assert.equal(h.root.hidden, true); assert.equal(h.gate.hidden, false);
  assert.equal(h.renders.some(r => r !== 'cleared' && r.professionals.rows.some(p => p.professional_id === 'late')), false);
});
test('Scadenza della sessione dal backend blocca anche la lettura privacy parallela', async () => {
  const error = Object.assign(Error('Sessione scaduta'), { name: 'AdminAccessError' });
  const h = appHarness({ listProfessionals: async () => { throw error; } }); await tick();
  assert.equal(h.root.hidden, true); assert.equal(h.message.textContent, 'Sessione scaduta');
});
test('Errore elenco conserva privacy disponibile e non diventa elenco vuoto', async () => {
  const h = appHarness({ listProfessionals: async () => { throw Error('Elenco non disponibile'); } }); await tick();
  const last = h.renders.at(-1);
  assert.equal(h.root.hidden, false); assert.equal(last.professionals.phase, 'error');
  assert.equal(last.privacy.phase, 'ready'); assert.equal(last.consents.phase, 'unavailable');
});
test('Ritorno alla pagina ricontrolla ruolo e invalida dati precedenti', async () => {
  let permitted = true;
  const h = appHarness({ verifyAccess: async () => { if (!permitted) throw Object.assign(Error('Revocato'), { name: 'AdminAccessError' }); return { user: { id: 'auth-admin' }, profile: admin }; } });
  await tick(); permitted = false; h.doc.visibilityState = 'visible'; h.doc.fire('visibilitychange'); await tick();
  assert.equal(h.root.hidden, true); assert.equal(h.message.textContent, 'Revocato');
});

test('HTML protetto dal primo paint, script separati e moduli di scrittura disabilitati', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'admin2.html'), 'utf8');
  assert.match(html, /<div class="pro2 admin2" hidden>/);
  assert.ok(!/src="(?:auth-guard|admin-privacy|auth|privacy|sw)\.js/.test(html));
  assert.ok(!/home-demo\.js|pages-demo\.js|example\.com|Dashboard demo/.test(html));
  assert.match(html, /data-admin-invite-open disabled/);
  assert.match(html, /name="defaultLimit"[^>]* disabled/);
  assert.equal((html.match(/type="submit" disabled/g) || []).length, 2);
  assert.match(html, /data-admin-kpi="total">—</);
  const servicesSource = source('admin-services.js');
  assert.ok(!/\b(document|innerHTML|createClient)\b|\.\s*(insert|update|upsert|delete|upload|remove)\s*\(/.test(servicesSource));
  assert.ok(!/serviceWorker|unregister|<style|\.style\b|localStorage/.test(source('admin-app.js') + source('admin-views.js')));
});

test('Stati vuoti, errori e caricamento producono testi distinti senza dati inventati', () => {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) {
      const e = new Element(); e.value = selector.includes('filter') ? 'all' : ''; e.innerHTML = ''; e.replaceChildren = () => { e.innerHTML = ''; };
      nodes.set(selector, e);
    }
    return nodes.get(selector);
  };
  const root = new Element(); root.querySelector = node;
  root.querySelectorAll = () => [];
  const view = views.create(root);
  const s = stateFor([]); s.privacy.document = null;
  view.render(s);
  assert.match(node('[data-admin-professional-list]').innerHTML, /Nessun professionista presente/);
  assert.equal(node('[data-admin-kpi="total"]').textContent, '0');
  assert.equal(node('[data-admin-privacy-title]').textContent, 'Nessuna informativa pubblicata');
  assert.equal(node('[data-admin-privacy-preview]').disabled, true);
  s.professionals = { phase: 'loading', rows: [] };
  view.render(s);
  assert.match(node('[data-admin-professional-list]').innerHTML, /Caricamento professionisti/);
  assert.equal(node('[data-admin-kpi="total"]').textContent, '—');
  s.professionals = { phase: 'error', rows: [], message: 'Rete non disponibile' };
  view.render(s);
  assert.match(node('[data-admin-professional-list]').innerHTML, /Rete non disponibile/);
  assert.equal(node('[data-admin-data-retry]').hidden, false);
  s.professionals = { phase: 'ready', rows: [row('1')] }; s.privacy.document = documentRow;
  view.render(s); view.clear();
  assert.equal(node('[data-admin-professional-list]').innerHTML, '');
  assert.equal(node('[data-admin-kpi="total"]').textContent, '—');
  assert.equal(node('[data-admin-privacy-title]').textContent, 'Caricamento informativa…');
});
