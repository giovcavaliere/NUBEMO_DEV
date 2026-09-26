(function(){
'use strict';
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
const android=()=>/android/i.test(navigator.userAgent);
const mobile=()=>ios()||android()||matchMedia('(max-width:760px)').matches;
const prefix=()=>document.body.dataset.assetPrefix||'';
let deferredInstall=null;
let guideSeen=false;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e});
function make(html,kind=''){const o=document.createElement('div');o.className='monubi-overlay '+kind;o.innerHTML='<section class="monubi-modal">'+html+'</section>';document.body.appendChild(o);return o}
function steps(){if(ios())return '<div class="install-steps"><div><b>1</b><span>Apri NUBEMO in <strong>Safari</strong>.</span></div><div><b>2</b><span>Tocca <strong>Condividi</strong> <i>⇧</i>.</span></div><div><b>3</b><span>Scegli <strong>Aggiungi alla schermata Home</strong>.</span></div></div>';if(android())return '<div class="install-steps"><div><b>1</b><span>Apri il menu del browser <strong>⋮</strong>.</span></div><div><b>2</b><span>Scegli <strong>Installa app</strong> o <strong>Aggiungi a schermata Home</strong>.</span></div><div><b>3</b><span>Conferma l’installazione.</span></div></div>';return '<p class="monubi-modal-lead">Dal menu del browser scegli <strong>Installa app</strong> oppure <strong>Aggiungi alla schermata Home</strong>.</p>'}
function installGuide(manual=false){if(standalone()&&!manual)return;if(guideSeen&&!manual)return;guideSeen=true;const o=make('<button class="monubi-x">×</button><div class="modal-brand"><img src="'+prefix()+'assets/nubemo-brand-clean-v2.png"><div><strong>NUBEMO</strong><span>Il tuo percorso, ogni giorno.</span></div></div><div class="modal-kicker">PORTALA CON TE</div><h2>NUBEMO sul dispositivo,<br>come una vera app.</h2><p class="monubi-modal-lead">Nessun download dallo store: la aggiungi alla Home e continui a usare gli stessi dati.</p>'+steps()+'<div class="modal-actions">'+(deferredInstall?'<button class="primary monubi-install-now">Installa NUBEMO</button>':'')+'<button class="secondary monubi-close">Ho capito</button></div>','install');const close=()=>o.remove();o.querySelector('.monubi-x').onclick=o.querySelector('.monubi-close').onclick=close;o.querySelector('.monubi-install-now')?.addEventListener('click',async()=>{try{deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;o.remove()}catch(e){}})}
window.showNubemoInstallGuide=()=>installGuide(true);
window.showMonubiInstallGuide=window.showNubemoInstallGuide;
function nudge(){if(!mobile()||standalone()||guideSeen)return;setTimeout(()=>installGuide(),1700)}
document.addEventListener('DOMContentLoaded',()=>{setTimeout(nudge,600)})
})();