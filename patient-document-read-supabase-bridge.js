// NUBEMO — stato NUOVO/letto dei documenti lato Paziente.
// Supabase conserva lo stato di lettura; il runtime store espone i badge alla UI.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const context=window.nubemoPatientContext;
  const runtime=window.nubemoPatientRuntimeStore;
  if(!client||!context?.profile?.id||!context?.user?.id||!context?.patient?.id||!runtime?.storage)return;

  const KEY='nubemo-documents-meta-v1';
  const unread=new Set();
  const replayClicks=new WeakSet();
  let queue=Promise.resolve();

  const parse=(v,f)=>{try{return JSON.parse(v)}catch(_){return f}};

  function applyOverlay(){
    const current=runtime.storage.getItem(KEY);
    const rows=parse(current||'[]',[]);
    if(!Array.isArray(rows))return;
    runtime.storage.setItem(KEY,JSON.stringify(rows.map(row=>({...row,unreadForPatient:unread.has(row.id)}))));
  }

  async function hydrate(){
    const [docs,statuses]=await Promise.all([
      client.from('documents').select('id,uploaded_by_user_id').eq('pathway_id',context.activePathway.id).is('deleted_at',null),
      client.from('document_read_status').select('document_id,read_at').eq('profile_id',context.profile.id)
    ]);
    if(docs.error)throw docs.error;
    if(statuses.error)throw statuses.error;
    const readIds=new Set((statuses.data||[]).filter(x=>x.read_at).map(x=>x.document_id));
    unread.clear();
    for(const doc of docs.data||[])if(doc.uploaded_by_user_id!==context.user.id&&!readIds.has(doc.id))unread.add(doc.id);
    applyOverlay();
  }

  async function markRead(documentId){
    await ready;
    if(!documentId||!unread.has(documentId))return;
    const result=await client.from('document_read_status').upsert({document_id:documentId,profile_id:context.profile.id,read_at:new Date().toISOString()},{onConflict:'document_id,profile_id'});
    if(result.error)throw result.error;
    unread.delete(documentId);
    applyOverlay();
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-open-patient-document],[data-open-patient-plan],[data-open-generic-document]');
    if(!button)return;
    if(replayClicks.has(button)){replayClicks.delete(button);return;}
    const documentId=button.dataset.openPatientDocument||button.dataset.openPatientPlan||button.dataset.openGenericDocument||'';
    if(!documentId||!unread.has(documentId))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    queue=queue.then(()=>markRead(documentId)).then(()=>{
      replayClicks.add(button);
      button.click();
    }).catch(error=>{
      console.error('NUBEMO Patient document read status:',error);
      replayClicks.add(button);
      button.click();
    });
  },true);

  const ready=hydrate();
  window.nubemoPatientDocumentReadBridge=Object.freeze({
    ready,
    markRead,
    refresh:async()=>{await ready;applyOverlay();},
    flush:async()=>{await ready;await queue;}
  });
})();
