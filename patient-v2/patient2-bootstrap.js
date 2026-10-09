(() => {
  'use strict';
  const client=window.nubemoSupabase;
  const back=()=>window.location.replace('index.html');
  const privacy=()=>window.location.replace('privacy.html');

  async function requiresPrivacy(profileId){
    const docResult=await client.from('privacy_documents')
      .select('id').eq('document_type','nubemo').eq('active',true)
      .order('published_at',{ascending:false,nullsFirst:false})
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(docResult.error)throw docResult.error;
    if(!docResult.data?.id)return false;
    const accResult=await client.from('privacy_acceptances')
      .select('status').eq('profile_id',profileId)
      .eq('privacy_document_id',docResult.data.id).maybeSingle();
    if(accResult.error)throw accResult.error;
    return accResult.data?.status!=='accepted';
  }

  async function logout(){
    try{await client.auth.signOut();}finally{back();}
  }

  async function start(){
    try{
      if(!client||!window.nubemoPatientServices||!window.NUBEMO_PATIENT2)throw new Error('Servizi Patient 2.0 non disponibili.');
      const sessionResult=await client.auth.getSession();
      if(sessionResult.error)throw sessionResult.error;
      if(!sessionResult.data.session)return back();

      const context=await window.nubemoPatientServices.loadContext();
      if(await requiresPrivacy(context.profile.id))return privacy();
      if((context.pendingPathways||[]).length)return window.location.replace('patient.html');
      if(!context.activePathway?.id)return window.location.replace('patient.html');

      window.nubemoPatientContext=context;
      window.patient2Logout=logout;
      await window.NUBEMO_PATIENT2.init(context);
    }catch(error){
      console.error('NUBEMO Patient 2.0 bootstrap:',error);
      document.body.innerHTML='<main class="patient2-loading"><div><b>Area paziente non disponibile.</b><span>'+String(error?.message||'Errore di avvio.')+'</span><br><br><button class="patient2-secondary" id="patient2Back">Torna al login</button></div></main>';
      document.getElementById('patient2Back')?.addEventListener('click',back);
    }
  }
  start();
})();