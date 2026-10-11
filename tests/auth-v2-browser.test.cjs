// SDK Supabase UMD reale, richieste Auth/REST intercettate: nessun accesso al progetto.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'));
const sdk = fs.readFileSync(process.env.SUPABASE_UMD_PATH, 'utf8');
const root = path.resolve(__dirname, '..');
const uid='7e1cf5b8-20f8-44c1-b612-9e42b51ceed0';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'admin@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{role:'admin'}};
const jwt=()=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})).toString('base64url'),'fixture-signature'].join('.');
let server,browser,origin;
const allowed=new Set(['index.html','auth.js','password-visibility.js','index2.html','auth-v2.js','login-v2-app.js','auth-v2.css','login-v2.css','config.js','supabase-client.js','admin2.html','admin-v2/home.css','admin-v2/pages.css','admin-v2/admin-services.js','admin-v2/admin-views.js','admin-v2/admin-app.js','professional-v2/home-design.css','assets/nubemo-brand-clean-v2.png','assets/nubemo-n-icon-192.png','assets/nubemo-n-icon-180.png','assets/nubemo-pro2-breakfast.webp']);
test.before(async()=>{
 server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://local').pathname.slice(1);res.setHeader('Cache-Control','no-store');
  if(!allowed.has(name)||!fs.existsSync(path.join(root,name))){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.webp')?'image/webp':name.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.ADMIN2_BROWSER_PATH,headless:true,args:['--no-sandbox']});
});
test.after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:options.width||1280,height:900}});
 const state={active:false,role:'admin',status:'active',failLogout:false,failProfile:false,identityMismatch:false,...options};
 const requests=[],authCalls=[],errors=[];
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin){requests.push(url.pathname);return route.continue();}
  if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:sdk+'\nconst originalFactory=supabase.createClient;supabase.createClient=(...args)=>{window.clientCreations=(window.clientCreations||0)+1;return originalFactory(...args);};'});
  if(url.hostname!=='bggvwwjwzfskabgkynwp.supabase.co')return route.abort();
  authCalls.push({path:url.pathname,method:request.method(),scope:url.searchParams.get('scope')});
  const respond=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/auth/v1/token'){
   const args=request.postDataJSON();
   if(args.password!=='correct-password')return respond(400,{code:'invalid_credentials',error_code:'invalid_credentials',msg:'Invalid login credentials'});
   state.active=true;return respond(200,{access_token:jwt(),refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user});
  }
  if(url.pathname==='/auth/v1/user')return respond(state.active?200:401,state.active?user:{code:'bad_jwt',msg:'Session expired'});
  if(url.pathname==='/auth/v1/logout'){
   if(state.failLogout)return respond(400,{code:'fixture_error',msg:'Logout failed'});
   state.active=false;return route.fulfill({status:204});
  }
  if(url.pathname==='/rest/v1/profiles'){
   if(state.failProfile)return respond(406,{code:'PGRST116',message:'Profile not found'});
   return respond(200,{id:'profile-admin',auth_user_id:state.identityMismatch?'other':uid,first_name:'Giovanni',last_name:'Cavaliere',email:user.email,role:state.role,status:state.status});
  }
  if(url.pathname==='/functions/v1/swift-endpoint')return respond(200,{ok:true,professionals:[]});
  if(url.pathname==='/rest/v1/privacy_documents')return respond(200,null);
  throw Error('Unexpected API '+url.pathname);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/'+(options.legacy?'index.html':'index2.html'));
 await page.waitForFunction(()=>!document.querySelector('#login-submit').disabled);
 return {context,page,state,requests,authCalls,errors};
}
async function login(h,password='correct-password'){
 await h.page.locator('#login-email').fill('admin@example.invalid');await h.page.locator('#login-password').fill(password);await h.page.locator('#login-submit').click();
}
async function adminReady(h){await h.page.waitForURL('**/admin2.html');await h.page.waitForFunction(()=>!document.querySelector('.admin2').hidden&&document.querySelector('.admin2').getAttribute('aria-busy')==='false');}
function noLegacy(h){assert.ok(!h.requests.some(p=>['/admin.html','/privacy.html','/pro2.html','/professional2.html','/patient.html','/patient2.html','/auth.js','/sw.js'].includes(p)),JSON.stringify(h.requests));}
test('SDK reale: login Admin, cookie condivisi, ripristino sessione e logout verso index2',async()=>{
 const h=await fixture();try{
  await login(h);await adminReady(h);
  assert.equal(await h.page.evaluate(()=>clientCreations),1);
  const cookies=await h.context.cookies();assert.ok(cookies.some(c=>c.name.startsWith('nubemo-auth-')));
  assert.equal(await h.page.evaluate(()=>localStorage.length),0);
  await h.page.goto(origin+'/index2.html');await adminReady(h);
  await h.page.locator('.side-user [data-admin-logout]').click();await h.page.waitForURL('**/index2.html');
  await h.page.waitForFunction(()=>!document.querySelector('#login-submit').disabled);
  assert.equal((await h.context.cookies()).some(c=>c.name.startsWith('nubemo-auth-')),false);
  assert.ok(h.authCalls.some(c=>c.path==='/auth/v1/logout'&&c.scope==='local'));
  assert.equal(await h.page.locator('#login-view').isVisible(),true);noLegacy(h);assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('SDK reale: credenziali errate e validazione locale non aprono Admin',async()=>{
 const h=await fixture();try{
  await h.page.locator('#login-submit').click();await h.page.locator('#login-message').filter({hasText:'email valido'}).waitFor();
  assert.equal(h.authCalls.length,0);
  await login(h,'wrong-password');await h.page.locator('#login-message').filter({hasText:'Email o password non corretti'}).waitFor();
  assert.equal(new URL(h.page.url()).pathname,'/index2.html');assert.equal(h.authCalls.some(c=>c.path==='/rest/v1/profiles'),false);
  noLegacy(h);assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Ruoli professional/patient: stato esplicito, nessuna demo/privacy precedente e logout consentito',async()=>{
 for(const role of ['professional','patient']){
  const h=await fixture({role});try{
   await login(h);await h.page.locator('#login-success').waitFor({state:'visible'});
   assert.equal(new URL(h.page.url()).pathname,'/index2.html');assert.match(await h.page.locator('#login-success h2').innerText(),/non ancora disponibile/);
   assert.equal(await h.page.locator('#login-view').isVisible(),false);
   await h.page.goto(origin+'/admin2.html');
   await h.page.locator('[data-admin-access-message]').filter({hasText:'soltanto'}).waitFor();
   assert.equal(await h.page.locator('.admin2').isVisible(),false);
   await h.page.locator('.admin-access a').click();
   await h.page.locator('#login-success').waitFor({state:'visible'});
   await h.page.locator('#login-logout').click();await h.page.locator('#login-view').waitFor({state:'visible'});
   assert.equal(h.state.active,false);noLegacy(h);assert.deepEqual(h.errors,[]);
  }finally{await h.context.close();}
 }
});
test('Autorizzazione negativa: stati, ruolo, identità e profilo mancante restano su index2',async()=>{
 for(const options of [{status:'suspended'},{status:'disabled'},{role:'owner'},{identityMismatch:true},{failProfile:true}]){
  const h=await fixture(options);try{
   await login(h);await h.page.locator('#login-message.is-error').waitFor();
   assert.equal(new URL(h.page.url()).pathname,'/index2.html');assert.equal(await h.page.locator('#login-success').isVisible(),false);
   noLegacy(h);assert.deepEqual(h.errors,[]);
  }finally{await h.context.close();}
 }
});
test('Accesso Admin diretto senza sessione va a index2; dopo logout Back non mostra dati',async()=>{
 const h=await fixture();try{
  await h.page.goto(origin+'/admin2.html');await h.page.waitForURL('**/index2.html');
  await h.page.waitForFunction(()=>!document.querySelector('#login-submit').disabled);
  await login(h);await adminReady(h);
  await h.page.locator('.side-nav [data-admin-route="privacy"]').click();
  await h.page.locator('.side-nav [data-admin-route="dashboard"]').click();
  await h.page.locator('.side-user [data-admin-logout]').click();await h.page.waitForURL('**/index2.html');
  await h.page.goBack();
  assert.equal(await h.page.evaluate(()=>{const el=document.querySelector('.admin2');return !el||el.hidden;}),true);
  noLegacy(h);assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Logout fallito conserva il blocco Admin e riprova sullo stesso client',async()=>{
 const h=await fixture();try{
  await login(h);await adminReady(h);h.state.failLogout=true;
  await h.page.locator('.side-user [data-admin-logout]').click();await h.page.locator('.admin-access [data-admin-logout]').waitFor({state:'visible'});
  assert.equal(await h.page.locator('.admin2').isVisible(),false);assert.equal(h.state.active,true);
  h.state.failLogout=false;await h.page.locator('.admin-access [data-admin-logout]').click();await h.page.waitForURL('**/index2.html');noLegacy(h);
 }finally{await h.context.close();}
});
test('Login precedente: credenziali errate e redirect Admin originario invariati',async()=>{
 const h=await fixture({legacy:true});try{
  await login(h,'wrong-password');await h.page.locator('#login-message').filter({hasText:'Email o password non corretti'}).waitFor();
  await login(h);await h.page.waitForURL('**/admin.html');
  assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Responsive login 320–1920: niente overflow, password toggle e stato ruolo non disponibile',async()=>{
 for(const width of [320,375,720,768,1024,1280,1920]){
  const h=await fixture({width,role:'professional'});try{
   assert.ok(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));
   assert.equal(await h.page.locator('#login-email').isVisible(),true);
   await h.page.locator('#login-password').fill('example');await h.page.locator('#login-password-toggle').click();
   assert.equal(await h.page.locator('#login-password').getAttribute('type'),'text');
   await h.page.locator('#login-password-toggle').click();assert.equal(await h.page.locator('#login-password').getAttribute('type'),'password');
   assert.deepEqual(await h.page.evaluate(()=>Array.from(document.querySelectorAll('[hidden]')).filter(el=>getComputedStyle(el).display!=='none').map(el=>el.id)),[]);
   if(process.env.AUTH2_SCREENSHOT_DIR){fs.mkdirSync(process.env.AUTH2_SCREENSHOT_DIR,{recursive:true});await h.page.screenshot({path:path.join(process.env.AUTH2_SCREENSHOT_DIR,'login2-'+width+'.png'),fullPage:true});}
   await login(h);await h.page.locator('#login-success').waitFor({state:'visible'});
   assert.ok(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));
   assert.equal(await h.page.locator('#login-logout').isVisible(),true);
   if(process.env.AUTH2_SCREENSHOT_DIR)await h.page.screenshot({path:path.join(process.env.AUTH2_SCREENSHOT_DIR,'unavailable-'+width+'.png'),fullPage:true});
   noLegacy(h);assert.deepEqual(h.errors,[]);
  }finally{await h.context.close();}
 }
});
test('Test isolati: nessuna registrazione/controller Service Worker e sw.js non servito',async()=>{
 const h=await fixture();try{
  assert.deepEqual(await h.page.evaluate(async()=>({controller:navigator.serviceWorker.controller,registrations:(await navigator.serviceWorker.getRegistrations()).length})),{controller:null,registrations:0});
  assert.equal((await h.context.request.get(origin+'/sw.js')).status(),404);
  await login(h);await adminReady(h);
  assert.deepEqual(await h.page.evaluate(async()=>({controller:navigator.serviceWorker.controller,registrations:(await navigator.serviceWorker.getRegistrations()).length})),{controller:null,registrations:0});
 }finally{await h.context.close();}
});
