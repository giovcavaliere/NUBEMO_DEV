// SDK Supabase reale, Auth intercettata e origine locale dedicata. Nessun invito/email reale.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const sdk=fs.readFileSync(process.env.SUPABASE_UMD_PATH,'utf8'),root=path.resolve(__dirname,'..');
const uid='40000000-0000-4000-8000-000000000001';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'professional@example.invalid',email_confirmed_at:'2026-10-12T00:00:00Z',created_at:'2026-10-12T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{intended_role:'professional'}};
const jwt=()=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})).toString('base64url'),'fixture-signature'].join('.');
let server,browser,origin;
const allowed=new Set(['set-password2.html','set-password2.js','set-password2-view.js','login-v2.css','auth-v2.css','config.js','supabase-client.js','index2.html','auth-v2.js','login-v2-app.js','assets/nubemo-brand-clean-v2.png','assets/nubemo-n-icon-192.png','assets/nubemo-pro2-breakfast.webp']);
test.before(async()=>{
 server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://local').pathname.slice(1);res.setHeader('Cache-Control','no-store');
  if(!allowed.has(name)||!fs.existsSync(path.join(root,name))){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'text/html');
  res.end(fs.readFileSync(path.join(root,name)));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.ADMIN2_BROWSER_PATH,headless:true,args:['--no-sandbox']});
});
test.after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:options.width||1280,height:900}});
 const state={active:true,failUpdate:false,failUser:false,holdUser:false,...options},calls=[],resources=[],errors=[];
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin){resources.push(url.pathname);return route.continue();}
  if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:sdk+'\nconst factory=supabase.createClient;supabase.createClient=(...args)=>{window.clientCount=(window.clientCount||0)+1;return factory(...args);};'});
  if(url.hostname!=='bggvwwjwzfskabgkynwp.supabase.co')return route.abort();
  calls.push({path:url.pathname,method:request.method(),body:request.postDataJSON()});
  const respond=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/auth/v1/user'){
   if(request.method()==='GET'){
    if(state.holdUser)await new Promise(resolve=>state.releaseUser=resolve);
    return respond(state.failUser||!state.active?401:200,state.failUser||!state.active?{code:'bad_jwt',msg:'Session expired'}:user);
   }
   if(state.holdUpdate)await new Promise(resolve=>state.releaseUpdate=resolve);
   return respond(state.failUpdate?400:200,state.failUpdate?{code:'weak_password',msg:'Password non accettata dal servizio.'}:user);
  }
  if(url.pathname==='/auth/v1/logout'){state.active=false;return route.fulfill({status:204});}
  throw Error('API inattesa: '+url.pathname);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const suffix=options.entry==='none'?'':options.entry==='expired'?'#error=access_denied&error_code=otp_expired&error_description=Link+expired':options.entry==='waiting'?'?type=invite':
  '#access_token='+jwt()+'&refresh_token=fixture-refresh&expires_in=3600&token_type=bearer&type=invite';
 await page.goto(origin+'/set-password2.html'+suffix);
 return{context,page,state,calls,resources,errors};
}
const ready=h=>h.page.locator('#set-password-view').waitFor({state:'visible'});
async function fill(h,a='secure-password-123',b=a){await h.page.locator('#new-password').fill(a);await h.page.locator('#confirm-password').fill(b);}
const updates=h=>h.calls.filter(c=>c.path==='/auth/v1/user'&&c.method==='PUT');
async function hidden(page){return page.evaluate(()=>[...document.querySelectorAll('[hidden]')].filter(el=>getComputedStyle(el).display!=='none').map(el=>el.id||el.tagName));}
test('Flusso invariato: SDK condiviso DEV, password impostata, signOut e index2',async()=>{
 const h=await fixture();try{
  await ready(h);assert.equal(await h.page.evaluate(()=>clientCount),1);
  await fill(h);await h.page.locator('#set-password-submit').click();await h.page.locator('#set-password-success').waitFor({state:'visible'});
  assert.equal(updates(h).length,1);assert.equal(updates(h)[0].body.password,'secure-password-123');
  assert.equal(h.calls.filter(c=>c.path==='/auth/v1/logout').length,1);
  assert.equal(await h.page.locator('#new-password').inputValue(),'');assert.equal(await h.page.locator('#confirm-password').inputValue(),'');
  assert.match(await h.page.locator('#set-password-success').innerText(),/Password impostata correttamente. Puoi ora accedere a NUBEMO./);
  await h.page.locator('#set-password-login').click();await h.page.waitForURL('**/index2.html');
  assert.ok(!h.resources.some(p=>['/admin.html','/index.html','/sw.js','/password-visibility.js','/style.css'].includes(p)));assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Password breve e non coincidenti non chiamano updateUser',async()=>{
 const h=await fixture();try{
  await ready(h);await fill(h,'short');await h.page.locator('#set-password-submit').click();
  await h.page.locator('#set-password-message').filter({hasText:'almeno 8'}).waitFor();
  await fill(h,'secure-password-123','another-password');await h.page.locator('#set-password-submit').click();
  await h.page.locator('#set-password-message').filter({hasText:'non coincidono'}).waitFor();
  assert.equal(updates(h).length,0);assert.equal(await h.page.locator('#set-password-submit').innerText(),'Attiva account');assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Caricamento iniziale e attivazione in corso mostrano stati corretti',async()=>{
 const h=await fixture({holdUser:true});try{
  await h.page.locator('#set-password-loading').waitFor({state:'visible'});
  assert.equal(await h.page.locator('#set-password-view').isVisible(),false);
  while(!h.state.releaseUser)await new Promise(r=>setTimeout(r,10));
  h.state.holdUser=false;h.state.releaseUser();await ready(h);
  h.state.holdUpdate=true;await fill(h);await h.page.locator('#set-password-submit').click();
  await h.page.waitForFunction(()=>document.querySelector('#set-password-submit').disabled);
  assert.equal(await h.page.locator('#set-password-submit').innerText(),'Attivazione…');
  while(!h.state.releaseUpdate)await new Promise(r=>setTimeout(r,10));
  h.state.holdUpdate=false;h.state.releaseUpdate();await h.page.locator('#set-password-success').waitFor({state:'visible'});assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Errore Auth mantiene form e possibilità di riprovare; nessun falso successo',async()=>{
 const h=await fixture({failUpdate:true});try{
  await ready(h);await fill(h);await h.page.locator('#set-password-submit').click();
  await h.page.locator('#set-password-message').filter({hasText:'non accettata'}).waitFor();
  assert.equal(await h.page.locator('#set-password-success').isVisible(),false);
  assert.equal(await h.page.locator('#set-password-submit').isEnabled(),true);
  assert.equal(await h.page.locator('#set-password-submit').innerText(),'Attiva account');assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Link assente, scaduto e senza sessione: form nascosto, login2 e zero updateUser',async()=>{
 for(const entry of ['none','expired','waiting']){
  const h=await fixture({entry});try{
   await h.page.locator('#set-password-invalid').waitFor({state:'visible'});
   assert.equal(await h.page.locator('#set-password-view').isVisible(),false);assert.equal(updates(h).length,0);
   if(entry!=='none')assert.match(await h.page.locator('#set-password-invalid-message').innerText(),/nuovo invito/);
   assert.deepEqual(await hidden(h.page),[]);await h.page.locator('#set-password-back-login').click();await h.page.waitForURL('**/index2.html');assert.deepEqual(h.errors,[]);
  }finally{await h.context.close();}
 }
});
test('Entrambi i controlli visibilità sono statici, accessibili e indipendenti',async()=>{
 const h=await fixture();try{
  await ready(h);
  for(const id of ['new-password','confirm-password']){
   const toggle=h.page.locator('[data-password-toggle="'+id+'"]');await toggle.click();
   assert.equal(await h.page.locator('#'+id).getAttribute('type'),'text');assert.equal(await toggle.getAttribute('aria-pressed'),'true');
   await toggle.click();assert.equal(await h.page.locator('#'+id).getAttribute('type'),'password');
  }
  assert.equal(await h.page.locator('style').count(),0);assert.deepEqual(await hidden(h.page),[]);assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});
test('Responsive 320–1920: due colonne desktop, stati entro viewport, asset approvati, zero worker',async()=>{
 for(const width of [320,375,620,768,980,1024,1280,1920]){
  const h=await fixture({width});try{
   await ready(h);assert.ok(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));assert.deepEqual(await hidden(h.page),[]);
   const hero=await h.page.locator('.login-hero').boundingBox(),card=await h.page.locator('.login-side').boundingBox();
   assert.ok(width>980?card.x>=hero.width:card.y>=hero.y+hero.height-1,JSON.stringify({width,hero,card}));
   assert.equal(await h.page.evaluate(async()=>navigator.serviceWorker.controller===null&&(await navigator.serviceWorker.getRegistrations()).length===0),true);
   if(process.env.PASSWORD2_SCREENSHOT_DIR){fs.mkdirSync(process.env.PASSWORD2_SCREENSHOT_DIR,{recursive:true});await h.page.screenshot({path:path.join(process.env.PASSWORD2_SCREENSHOT_DIR,'password2-'+width+'.png'),fullPage:true});}
   await fill(h);await h.page.locator('#set-password-submit').click();await h.page.locator('#set-password-success').waitFor({state:'visible'});
   assert.ok(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));assert.deepEqual(await hidden(h.page),[]);assert.deepEqual(h.errors,[]);
  }finally{await h.context.close();}
 }
});
test('Email preparata: markup per client email, variabili conservate e anteprima responsive',async()=>{
 const template=fs.readFileSync(path.join(root,'supabase/templates/invite.html'),'utf8');
 assert.equal((template.match(/href="{{ \.ConfirmationURL }}"/g)||[]).length,1);
 assert.ok(template.includes('{{ if eq .Data.intended_role "professional" }}'));
 assert.ok(template.includes('{{ .Email }}'));assert.ok(template.includes('{{ .Data.first_name }}'));
 assert.ok(!/<script|<link|display:\s*(grid|flex)|\.webp/i.test(template));
 assert.ok(template.includes('<!--[if mso]>'));assert.ok(template.includes('role="presentation"'));
 const preview=template.replace(/{{ if \.Data.first_name }}([\s\S]*?){{ end }}/g,'$1')
  .replace(/{{ if eq \.Data.intended_role "professional" }}([\s\S]*?){{ else }}[\s\S]*?{{ end }}/g,'$1')
  .replaceAll('{{ .Data.first_name }}','Laura')
  .replaceAll('{{ .Email }}','professional@example.invalid')
  .replaceAll('{{ .ConfirmationURL }}','https://bggvwwjwzfskabgkynwp.supabase.co/auth/v1/verify?token=fixture&type=invite&redirect_to=https%3A%2F%2Fnubemo-pro-2.pages.dev%2Fset-password2.html');
 assert.ok(!preview.includes('{{'));
 for(const width of [320,768,1920]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  try{
   await context.route('**/*',route=>route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(root,'assets/nubemo-brand-clean-v2.png'))}));
   await page.setContent(preview);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));
   assert.equal(await page.locator('h1').innerText(),'Benvenuto in NUBEMO');
   assert.equal(await page.locator('a').innerText(),'Attiva il tuo account');
   assert.match(await page.locator('body').innerText(),/Hai ricevuto un invito per accedere all’area professionale di NUBEMO/);
   if(process.env.PASSWORD2_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.PASSWORD2_SCREENSHOT_DIR,'invite-email-'+width+'.png'),fullPage:true});
  }finally{await context.close();}
 }
});
