(() => {
 'use strict';
 const root=document.querySelector('.admin2');
 if(!root)return;
 const $=(q,r=root)=>r.querySelector(q);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const professionals=[
  {id:1,name:'Laura Rossi',email:'laura.rossi@example.com',account:'Attivo',state:'active',privacy:'Accettata',used:8,limit:10},
  {id:2,name:'Marco Bianchi',email:'marco.bianchi@example.com',account:'Attivo',state:'active',privacy:'Accettata',used:5,limit:10},
  {id:3,name:'Elena Verdi',email:'elena.verdi@example.com',account:'Invitato',state:'active',privacy:'In attesa',used:0,limit:10},
  {id:4,name:'Andrea Neri',email:'andrea.neri@example.com',account:'Attivo',state:'suspended',privacy:'Accettata',used:10,limit:10},
  {id:5,name:'Sara Conti',email:'sara.conti@example.com',account:'Invitato',state:'active',privacy:'In attesa',used:0,limit:10}
 ];
 function draw(){
  const query=($('[data-admin-professional-search]')?.value||'').trim().toLocaleLowerCase('it');
  const filter=$('[data-admin-professional-filter]')?.value||'all';
  const selected=professionals.filter(p=>(filter==='all'||p.state===filter)&&(p.name+' '+p.email).toLocaleLowerCase('it').includes(query));
  $('[data-admin-professional-list]').innerHTML=selected.length?selected.map(p=>
    '<div class="admin-prof-row"><div class="admin-prof-person"><strong>'+esc(p.name)+'</strong><small>'+esc(p.email)+'</small></div>'+
    '<div data-label="Account"><span class="admin-status '+(p.account==='Attivo'?'positive':'warning')+'">'+esc(p.account)+'</span></div>'+
    '<div data-label="Stato NUBEMO"><span class="admin-status '+(p.state==='active'?'positive':'warning')+'">'+(p.state==='active'?'Attivo':'Sospeso')+'</span></div>'+
    '<div data-label="Privacy"><span class="admin-status '+(p.privacy==='Accettata'?'positive':'neutral')+'">'+esc(p.privacy)+'</span></div>'+
    '<div data-label="Pazienti"><strong>'+p.used+' / '+p.limit+'</strong></div>'+
    '<div class="admin-row-actions"><button type="button" data-admin-prof-detail="'+p.id+'">Gestisci</button>'+
    (p.account==='Invitato'?'<button type="button" data-admin-prof-resend="'+p.id+'">Reinvia</button>':'')+
    '<button type="button" data-admin-prof-toggle="'+p.id+'">'+(p.state==='active'?'Sospendi':'Riattiva')+'</button></div></div>').join(''):'<div class="admin-prof-empty">Nessun professionista corrisponde ai filtri.</div>';
 }
 function modal(title,body,onSave){
  const el=document.createElement('dialog');el.className='admin-modal';
  el.innerHTML='<h2>'+esc(title)+'</h2>'+body+'<footer><button class="admin-action-secondary" type="button" data-admin-close>Annulla</button><button class="admin-action-primary" type="submit" form="adminModalForm">Conferma (demo)</button></footer>';
  root.appendChild(el);
  el.querySelector('[data-admin-close]').addEventListener('click',()=>el.close());
  el.addEventListener('close',()=>el.remove(),{once:true});
  $('#adminModalForm',el)?.addEventListener('submit',e=>{e.preventDefault();if(e.target.reportValidity()&&onSave(el)!==false)el.close();});
  el.showModal();return el;
 }
 function detail(p){
  modal('Gestisci professionista','<form id="adminModalForm" class="admin-form"><p>'+esc(p.name)+' · '+esc(p.email)+'</p><label>Limite massimo di pazienti<input name="limit" type="number" min="1" max="100000" step="1" required value="'+p.limit+'"></label><p>Attualmente utilizzati: '+p.used+'. Ridurre il limite non elimina pazienti già presenti.</p></form>',el=>{
   const n=Number($('#adminModalForm',el).elements.limit.value);if(!Number.isSafeInteger(n)||n<1||n>100000)return false;
   p.limit=n;draw();
  });
 }
 function notice(title,message){const el=modal(title,'<form id="adminModalForm"><p>'+esc(message)+'</p></form>',()=>{});return el;}
 root.addEventListener('input',e=>{if(e.target.matches('[data-admin-professional-search]'))draw();});
 root.addEventListener('change',e=>{if(e.target.matches('[data-admin-professional-filter]'))draw();});
 root.addEventListener('click',e=>{
  if(e.target.closest('[data-admin-invite-open]')){
   modal('Invita professionista','<form id="adminModalForm" class="admin-form"><label>Nome<input name="firstName" required maxlength="70"></label><label>Cognome<input name="lastName" required maxlength="70"></label><label>Email<input type="email" name="email" required maxlength="140"></label></form>',el=>{
    const f=$('#adminModalForm',el).elements;
    const email=f.email.value.trim().toLowerCase();if(professionals.some(p=>p.email.toLowerCase()===email)){alert('Email già presente nella demo.');return false;}
    professionals.push({id:Date.now(),name:f.firstName.value.trim()+' '+f.lastName.value.trim(),email,account:'Invitato',state:'active',privacy:'In attesa',used:0,limit:Number($('[name="defaultLimit"]').value)||10});draw();
   });return;
  }
  const detailBtn=e.target.closest('[data-admin-prof-detail]');
  if(detailBtn){const p=professionals.find(x=>String(x.id)===detailBtn.dataset.adminProfDetail);if(p)detail(p);return;}
  const toggle=e.target.closest('[data-admin-prof-toggle]');
  if(toggle){const p=professionals.find(x=>String(x.id)===toggle.dataset.adminProfToggle);if(!p)return;
   modal(p.state==='active'?'Sospendi professionista':'Riattiva professionista','<form id="adminModalForm"><p>Confermi la modifica dello stato NUBEMO di '+esc(p.name)+'? Nessuna modifica reale sarà effettuata.</p></form>',()=>{p.state=p.state==='active'?'suspended':'active';draw();});return;}
  const resend=e.target.closest('[data-admin-prof-resend]');
  if(resend){const p=professionals.find(x=>String(x.id)===resend.dataset.adminProfResend);if(p)notice('Invito demo','Nessuna email è stata inviata a '+p.email+'.');return;}
  if(e.target.closest('[data-admin-privacy-preview]')){notice('Informativa demo','Il documento iniziale è un riferimento fittizio. Per consultare un PDF occorrerà collegare la versione reale; nessun documento clinico è presente.');return;}
 });
 $('[data-admin-privacy-form]')?.addEventListener('submit',e=>{
  e.preventDefault();const f=e.target;if(!f.reportValidity())return;
  const file=f.elements.file.files[0];if(!file||!(file.type==='application/pdf'||/\.pdf$/i.test(file.name))){alert('Seleziona un PDF valido.');return;}
  if(file.size>10*1024*1024){alert('Il PDF non deve superare 10 MB.');return;}
  modal('Conferma nuova informativa','<form id="adminModalForm"><p>Vuoi rendere attiva la versione '+esc(f.elements.version.value)+'? Questa è una simulazione: non verranno aggiornati consensi o documenti reali.</p></form>',()=>{
   $('[data-admin-privacy-title]').textContent=f.elements.title.value.trim();
   $('[data-admin-privacy-version]').textContent='Versione '+f.elements.version.value.trim()+' · Demo non pubblicata';
   $('[data-admin-privacy-preview]').textContent='Visualizza documento demo';
   f.reset();
  });
 });
 $('[data-admin-settings-form]')?.addEventListener('submit',e=>{
  e.preventDefault();if(!e.target.reportValidity())return;
  const n=Number(e.target.elements.defaultLimit.value);
  if(!Number.isSafeInteger(n)||n<1||n>100000)return;
  notice('Impostazioni salvate (demo)','Limite predefinito '+n+' pazienti. Valore utilizzato soltanto per nuovi inviti della sessione.');
 });
 draw();
})();