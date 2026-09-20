// NUBEMO — regressioni finali PRO: storico documenti mobile + privacy profilo lazy.
(() => {
  'use strict';

  const app=document.getElementById('proApp');
  if(!app)return;

  let privacyLoading=false;

  function hasScript(fragment){
    return [...document.scripts].some(script=>String(script.src||'').includes(fragment));
  }

  function ensureProfessionalPrivacy(){
    if(document.body.dataset.proView!=='settings')return;
    if(hasScript('professional-profile-privacy-supabase-bridge.js')||privacyLoading)return;
    const ctx=window.nubemoProfessionalContext||{};
    if(!ctx.profile?.id||!ctx.professional?.id)return;

    privacyLoading=true;
    const script=document.createElement('script');
    script.src='professional-profile-privacy-supabase-bridge.js?v=nubemo-pathway19fix16';
    script.onload=()=>{privacyLoading=false;};
    script.onerror=()=>{
      privacyLoading=false;
      console.error('NUBEMO privacy professionista: caricamento modulo non riuscito.');
    };
    document.body.appendChild(script);
  }

  function fixHistoryDocumentsMobile(){
    const modal=document.getElementById('nubemoPathwayHistoryModal');
    if(!modal)return;
    const details=[...modal.querySelectorAll('details')].find(node=>
      String(node.querySelector('summary')?.textContent||'').trim().startsWith('Documenti')
    );
    if(!details)return;
    const content=[...details.children].find(node=>node.tagName==='DIV');
    if(!content||content.dataset.mobileHorizontalScroll==='1')return;

    content.dataset.mobileHorizontalScroll='1';
    content.style.overflowX='auto';
    content.style.webkitOverflowScrolling='touch';
    content.style.maxWidth='100%';
    [...content.children].forEach(section=>{
      if(section.tagName==='SECTION')section.style.minWidth='560px';
    });
  }

  function patch(){
    ensureProfessionalPrivacy();
    fixHistoryDocumentsMobile();
  }

  const observer=new MutationObserver(()=>queueMicrotask(patch));
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-pro-view']});
  patch();
})();
