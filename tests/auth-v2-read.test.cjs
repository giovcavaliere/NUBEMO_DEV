const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const admin = { id:'p', auth_user_id:'u', role:'admin', status:'active' };
function harness(options = {}, timers = {}) {
 const calls = [];
 const client = {auth:{
  async getUser(){calls.push('getUser');return options.user || {data:{user:{id:'u',user_metadata:{role:'admin'}}}}},
  async signInWithPassword(args){calls.push(['signIn',args]);return options.login || {}},
  async signOut(args){calls.push(['signOut',args]);return options.logout || {}},
  onAuthStateChange(){return {data:{subscription:{}}}}
 },from(table){calls.push(table);const q={select(){return q},eq(column,value){calls.push([column,value]);return q},async single(){return options.profileResult || {data:{...admin,...options.profile}}}};return q}};
 const context={window:{},setTimeout,clearTimeout,...timers};
 vm.runInNewContext(fs.readFileSync(path.join(root,'auth-v2.js'),'utf8'),context);
 return {api:context.window.NubemoAuthV2.create(client),client,calls};
}
test('Restore verifica Auth server e profilo DB, senza credere al ruolo user_metadata',async()=>{
 const h=harness();assert.equal((await h.api.restore()).role,'admin');
 assert.deepEqual(h.calls,['getUser','profiles',['auth_user_id','u']]);
 for(const role of ['professional','patient'])assert.equal((await harness({profile:{role}}).api.restore()).role,role);
});
test('Sessione assente/scaduta torna al login; errore di rete resta errore',async()=>{
 for(const user of [{data:{user:null}},{error:{status:401}},{error:{name:'AuthSessionMissingError'}}])assert.equal(await harness({user}).api.restore(),null);
 await assert.rejects(harness({user:{error:{status:503}}}).api.restore(),/verificare la sessione/);
});
test('Stato sospeso/disabilitato, ruolo ignoto, identità incoerente e profilo mancante negati',async()=>{
 for(const profile of [{status:'suspended'},{status:'disabled'},{status:null},{role:'owner'},{auth_user_id:'other'}])await assert.rejects(harness({profile}).api.restore(),{code:'forbidden'});
 await assert.rejects(harness({profileResult:{error:{code:'PGRST116'}}}).api.restore(),/Profilo/);
});
test('Login valida i campi, conserva la password e verifica il ruolo dopo signInWithPassword',async()=>{
 const h=harness();
 await assert.rejects(h.api.login('invalid','password'),/email valido/);
 await assert.rejects(h.api.login('a@example.invalid',''),/password/);
 assert.equal(h.calls.length,0);
 assert.equal((await h.api.login(' admin@example.invalid ','  password  ')).role,'admin');
 assert.deepEqual(h.calls[0][0],'signIn');assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][1])),{email:'admin@example.invalid',password:'  password  '});
 assert.equal(h.calls[1],'getUser');
});
test('Credenziali errate e account non confermato: nessuna query profilo',async()=>{
 for(const login of [{error:{code:'invalid_credentials'}},{error:{message:'Invalid login credentials'}},{error:{code:'email_not_confirmed'}}]){
  const h=harness({login});await assert.rejects(h.api.login('a@example.invalid','bad'));assert.equal(h.calls.length,1);
 }
});
test('Logout locale sul client condiviso e timeout non consentono successi fittizi',async()=>{
 const h=harness();await h.api.signOut();assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[['signOut',{scope:'local'}]]);
 await assert.rejects(harness({logout:{error:{message:'offline'}}}).api.signOut(),/Disconnessione/);
 const timeout=harness({}, {setTimeout:fn=>setTimeout(fn,1)});timeout.client.auth.getUser=()=>new Promise(()=>{});
 await assert.rejects(timeout.api.restore(),/non risponde/);
});
test('Separazione pagine/servizi: niente DOM, nuova persistenza, vecchi redirect o worker',()=>{
 const auth=fs.readFileSync(path.join(root,'auth-v2.js'),'utf8');
 assert.ok(!/\b(document|createClient|localStorage|sessionStorage)\b|\.\s*(insert|update|upsert|delete|upload|remove)\s*\(/.test(auth));
 const app=fs.readFileSync(path.join(root,'login-v2-app.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'index2.html'),'utf8');
 assert.ok(!/admin\.html|pro2\.html|professional2\.html|patient2?\.html|privacy\.html|set-password\.html|auth\.js|password-visibility\.js|serviceWorker|<style|\.style\b/.test(app+html));
 assert.match(html,/href="login-v2.css/);assert.match(html,/src="supabase-client.js/);
 assert.match(html,/login-reset-password[^>]*disabled/);
 assert.match(app,/replace\('admin2.html'\)/);
 const adminHtml=fs.readFileSync(path.join(root,'admin2.html'),'utf8');assert.match(adminHtml,/href="index2.html"/);assert.ok(!adminHtml.includes('href="index.html"'));
});
