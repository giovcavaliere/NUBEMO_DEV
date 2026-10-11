// Test browser isolati: SDK controllato, client condiviso reale, nessuna chiamata al progetto.
// PLAYWRIGHT_MODULE_PATH e ADMIN2_BROWSER_PATH indicano dipendenze già installate.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'));
const root = path.resolve(__dirname, '..');
const sdk = `(() => {
 const c = window.testControl = {calls: [], factoryCount: 0, failList: false, failPrivacy: false, failLogout: false, holdLogout: false, role: 'admin', loggedOut: document.cookie.includes('test-signed-out=1')};
 const user = () => ({id:'auth-admin'});
 const admin = {id:'profile-admin',auth_user_id:'auth-admin',first_name:'Giovanni',last_name:'Cavaliere',role:'admin',status:'active'};
 const rows = [{professional_id:'1',profile_id:'p1',first_name:'Laura',last_name:'Rossi',email:'laura@example.invalid',account_status:'active',nubemo_status:'active',professional_status:'active'}, {professional_id:'2',profile_id:'p2',first_name:'Marco',last_name:'Verdi',email:'marco@example.invalid',account_status:'invited',nubemo_status:'suspended',professional_status:'suspended'}];
 window.supabase = {createClient() {
  c.factoryCount++;
  return {auth:{
   getUser:async()=>{c.calls.push('getUser');return {data:{user:c.loggedOut?null:user()}}},
   getSession:async()=>({data:{session:c.loggedOut?null:{access_token:'test-jwt'}}}),
   onAuthStateChange(fn){c.auth=fn;return {data:{subscription:{unsubscribe(){}}}}},
   async signOut(options){c.calls.push(['signOut',options]);if(c.holdLogout)await new Promise(r=>c.releaseLogout=r);if(c.failLogout)return {error:{message:'offline'}};c.loggedOut=true;document.cookie='test-signed-out=1; Path=/';c.auth('SIGNED_OUT',null);return {}}
  },functions:{async invoke(name,options){c.calls.push(['invoke',name,options.body.action]);return c.failList?{error:{message:'offline'}}:{data:{ok:true,professionals:rows}}}},
  from(table){c.calls.push(table);const q={};for(const key of ['select','eq','order','limit','in'])q[key]=()=>q;const result=()=> table==='profiles'?{data:{...admin,role:c.role}}: table==='privacy_documents'?c.failPrivacy?{error:{message:'offline'}}:{data:null}:{data:[]};q.single=q.maybeSingle=async()=>result();q.then=(a,b)=>Promise.resolve(result()).then(a,b);return q},
  storage:{from(){throw Error('No document in fixture')}}};
 }};
})();`;
let server, browser, origin;
const allowed = new Set(['admin2.html', 'config.js', 'supabase-client.js', 'professional-v2/home-design.css', 'admin-v2/home.css', 'admin-v2/pages.css', 'admin-v2/admin-app.js', 'admin-v2/admin-views.js', 'admin-v2/admin-services.js', 'assets/nubemo-brand-clean-v2.png', 'assets/nubemo-n-icon-192.png']);
test.before(async () => {
 server = http.createServer((req,res)=>{
  const name = new URL(req.url,'http://local').pathname.slice(1);
  res.setHeader('Cache-Control','no-store');
  if(name==='index.html'){res.setHeader('Content-Type','text/html');res.end('<h1>Login fixture</h1>');return;}
  if(!allowed.has(name)||!fs.existsSync(path.join(root,name))){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.ADMIN2_BROWSER_PATH,headless:true,args:['--no-sandbox']});
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function fixture(width=1280, before='') {
 const context = await browser.newContext({viewport:{width,height:900}});
 const page = await context.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({contentType:'text/javascript',body:sdk+before}));
 await page.goto(origin+'/admin2.html');
 await page.waitForFunction(()=>!document.querySelector('.admin2').hidden && document.querySelector('.admin2').getAttribute('aria-busy')==='false');
 return {context,page,errors};
}
const calls = page=>page.evaluate(()=>JSON.stringify(testControl.calls));
async function hiddenElements(page) {
 return page.evaluate(()=>Array.from(document.querySelectorAll('[hidden]')).filter(el=>getComputedStyle(el).display!=='none').map(el=>el.outerHTML.slice(0,160)));
}
test('Origine dedicata: nessun controller/registrazione, worker e vecchio Admin non serviti',async()=>{
 const h=await fixture();try{
 assert.deepEqual(await h.page.evaluate(async()=>({controller:navigator.serviceWorker.controller,registrations:(await navigator.serviceWorker.getRegistrations()).length})),{controller:null,registrations:0});
 for(const file of ['sw.js','admin.html'])assert.equal((await h.context.request.get(origin+'/'+file)).status(),404);
 assert.equal(await h.page.evaluate(()=>testControl.factoryCount),1);
 assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Cascata CSS: hidden rispettato, retry solo dopo errore e nascosto dopo successo',async()=>{
 const h=await fixture(1280,'testControl.failList=true;');try{
 const retry=h.page.locator('[data-admin-data-retry]');assert.equal(await retry.isVisible(),true);
 await h.page.evaluate(()=>{testControl.failList=false;});await retry.click();
 await h.page.waitForFunction(()=>document.querySelector('.admin2').getAttribute('aria-busy')==='false');
 assert.deepEqual(await retry.evaluate(el=>({hidden:el.hidden,display:getComputedStyle(el).display})),{hidden:true,display:'none'});
 assert.deepEqual(await hiddenElements(h.page),[]);
 await h.page.evaluate(()=>{testControl.failPrivacy=true;});
 // Richiede esplicitamente il retry già presente, senza refresh o polling applicativi.
 await h.page.evaluate(()=>document.querySelector('[data-admin-data-retry]').click());
 await h.page.waitForFunction(()=>!document.querySelector('[data-admin-data-retry]').hidden);
 assert.equal(await retry.isVisible(),true);
 await h.page.evaluate(()=>{testControl.failPrivacy=false;});await retry.click();
 await h.page.waitForFunction(()=>document.querySelector('[data-admin-data-retry]').hidden);
 assert.equal(await retry.isVisible(),false);assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Navigazione, ricerca, filtri e SIGNED_IN ripetuti: nessuna richiesta aggiuntiva',async()=>{
 const h=await fixture();try{
 const before=await calls(h.page);
 for(const name of ['professionisti','privacy','impostazioni','dashboard']){
  await h.page.locator('.side-nav [data-admin-route="'+name+'"]').click();
  await h.page.evaluate(()=>testControl.auth('SIGNED_IN',{user:{id:'auth-admin'}}));
 }
 await h.page.locator('.side-nav [data-admin-route="professionisti"]').click();
 await h.page.locator('[data-admin-professional-search]').fill('MARCO');
 assert.equal(await h.page.locator('.admin-prof-row').count(),1);
 await h.page.locator('[data-admin-professional-filter]').selectOption('active');
 assert.equal(await h.page.locator('.admin-prof-row').count(),0);
 assert.equal(await calls(h.page),before);assert.deepEqual(await hiddenElements(h.page),[]);
 }finally{await h.context.close();}
});
test('Ripresa e rinnovo token: verifica accesso accorpata, nessuna nuova lettura elenco/privacy',async()=>{
 const h=await fixture();try{
 const before=await h.page.evaluate(()=>testControl.calls.length);
 await h.page.evaluate(()=>{
  document.dispatchEvent(new Event('visibilitychange'));
  testControl.auth('SIGNED_IN',{user:{id:'auth-admin'}});
  testControl.auth('TOKEN_REFRESHED',{user:{id:'auth-admin'}});
 });
 await h.page.waitForFunction(()=>!document.querySelector('.admin2').hidden);
 assert.deepEqual(await h.page.evaluate(n=>testControl.calls.slice(n),before),['getUser','profiles']);
 await h.page.evaluate(()=>{testControl.role='patient';testControl.auth('TOKEN_REFRESHED',{user:{id:'auth-admin'}});});
 await h.page.waitForFunction(()=>document.querySelector('.admin2').hidden && document.querySelector('[data-admin-access-message]').textContent.includes('soltanto'));
 assert.equal(await h.page.locator('.admin-prof-row').count(),0);
 }finally{await h.context.close();}
});
test('Logout sul client condiviso controllato: dati nascosti immediatamente, errore/retry, redirect e indietro protetto',async()=>{
 const h=await fixture();try{
 await h.page.locator('.side-nav [data-admin-route="professionisti"]').click();
 await h.page.locator('.side-nav [data-admin-route="privacy"]').click();
 await h.page.evaluate(()=>{testControl.failLogout=true;testControl.holdLogout=true;});
 await h.page.locator('.side-user [data-admin-logout]').click();
 assert.equal(await h.page.locator('.admin2').isVisible(),false);
 assert.equal(await h.page.locator('.admin-prof-row').count(),0);
 await h.page.evaluate(()=>testControl.releaseLogout());
 await h.page.locator('.admin-access [data-admin-logout]').waitFor({state:'visible'});
 assert.equal(new URL(h.page.url()).pathname,'/admin2.html');
 await h.page.evaluate(()=>{testControl.failLogout=false;testControl.holdLogout=false;});
 await h.page.locator('.admin-access [data-admin-logout]').click();
 await h.page.waitForURL('**/index.html');
 await h.page.goBack();
 if(new URL(h.page.url()).pathname==='/admin2.html'){
  await h.page.waitForFunction(()=>document.querySelector('.admin2').hidden);
  assert.equal(await h.page.locator('.admin-prof-row').count(),0);
 }
 assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('BFCache: pagehide rimuove dati, pageshow verifica prima di mostrarli',async()=>{
 const h=await fixture();try{
 const before=await h.page.evaluate(()=>testControl.calls.length);
 await h.page.evaluate(()=>{
  window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
  if(!document.querySelector('.admin2').hidden)throw Error('Dati presenti dopo pagehide');
  testControl.role='patient';window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
 });
 await h.page.waitForFunction(()=>document.querySelector('[data-admin-access-message]').textContent.includes('soltanto'));
 assert.equal(await h.page.locator('.admin2').isVisible(),false);
 assert.deepEqual(await h.page.evaluate(n=>testControl.calls.slice(n),before),['getUser','profiles']);
 }finally{await h.context.close();}
});
test('Responsive 320–1920: hidden, overflow, navigazione, logout e dialogo',async()=>{
 for(const width of [320,375,720,768,1024,1280,1920]){
  const h=await fixture(width);try{
   assert.deepEqual(await hiddenElements(h.page),[],String(width));
   assert.ok(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));
   const nav=width<=720?'.admin-mobile-nav':'.side-nav';
   // La baseline nasconde la sidebar su tablet portrait: il test può navigare via hash.
   if(await h.page.locator(nav).isVisible())await h.page.locator(nav+' [data-admin-route="professionisti"]').click();
   else await h.page.evaluate(()=>location.hash='professionisti');
   await h.page.locator('[data-admin-prof-detail="1"]').click();
   assert.equal(await h.page.locator('dialog').isVisible(),true);
   const box=await h.page.locator('dialog').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=width+1,String(width));
   await h.page.locator('[data-admin-close]').click();
   await h.page.locator('dialog').waitFor({state:'detached'});
   assert.equal(await h.page.locator('dialog').count(),0);
   const logout=width<=720||!(await h.page.locator('.side').isVisible())?'.compact-brand [data-admin-logout]':'.side-user [data-admin-logout]';
   assert.equal(await h.page.locator(logout).isVisible(),true,String(width));
   assert.deepEqual(h.errors,[]);
   for(const route of ['privacy','impostazioni','dashboard']){
    await h.page.evaluate(name=>location.hash=name,route);
    await h.page.waitForFunction(name=>!document.querySelector('[data-admin-view="'+name+'"]').hidden,route);
    assert.deepEqual(await hiddenElements(h.page),[],width+' '+route);
    assert.ok(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+route);
   }
   if(process.env.ADMIN2_SCREENSHOT_DIR){fs.mkdirSync(process.env.ADMIN2_SCREENSHOT_DIR,{recursive:true});await h.page.screenshot({path:path.join(process.env.ADMIN2_SCREENSHOT_DIR,'admin2-'+width+'.png'),fullPage:true});}
  }finally{await h.context.close();}
 }
});
