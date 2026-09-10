// NUBEMO recovery 3.98 — stato NUOVO/letto dei documenti lato Paziente.
// Preserva badge e comportamento 3.98 usando document_read_status.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const context=window.nubemoPatientContext;
  if(!client||!context?.profile?.id||!context?.user?.id||!context?.patient?.id)return;

  const KEY='nubemo-documents-meta-v1';
  const storageProto=Object.getPrototypeOf(window.localStorage);
  const previousGetItem=storageProto.getItem;
  const previousSetItem=storageProto.setItem;
  const previousRemoveItem=storageProto.removeItem;
  const unread=new Set();
  let readyDone=false;
  let queue=Promise.resolve();

  const parse=(v,f)=>{try{return JSON.parse(v)}catch(_){return f}};

  async function hydrate(){
    const [docs,statuses]=await Promise.all([
      client.from('documents').select('id,uploaded_by_user_id').eq('patient_id',context.patient.id).is('deleted_at',null),
      client.from('document_read_status').select('document_id,read_at').eq('profile_id',context.profile.id)
    ]);
    if(docs.error)throw docs.error;if(statuses.error)throw statuses.error;
    const readIds=new Set((statuses.data||[]).filter(x=>x.read_at).map(x=>x.document_id));
    unread.clear();
    for(const doc of docs.data||[])if(doc.uploaded_by_user_id!==context.user.id&&!readIds.has(doc.id))unread.add(doc.id);
    readyDone=true;
  }

  function overlay(value){
    const rows=parse(value||'[]',[]);if(!Array.isArray(rows))return value;
    return JSON.stringify(rows.map(row=>({...row,unreadForPatient:unread.has(row.id)})));
  }

  async function persistReads(value){
    if(!readyDone)return;
    const rows=parse(value,[]);if(!Array.isArray(rows))return;
    for(const row of rows){
      if(!row?.id||row.unreadForPatient!==false||!unread.has(row.id))continue;
      const result=await client.from('document_read_status').upsert({document_id:row.id,profile_id:context.profile.id,read_at:new Date().toISOString()},{onConflict:'document_id,profile_id'});
      if(result.error)throw result.error;
      unread.delete(row.id);
    }
  }

  storageProto.getItem=function(key){
    const value=previousGetItem.call(this,key);
    if(this===window.localStorage&&String(key)===KEY&&readyDone)return overlay(value);
    return value;
  };
  storageProto.setItem=function(key,value){
    previousSetItem.call(this,key,value);
    if(this!==window.localStorage||String(key)!==KEY||!readyDone)return;
    const serialized=String(value);
    queue=queue.then(()=>persistReads(serialized)).catch(error=>console.error('NUBEMO Patient document read status:',error));
  };
  storageProto.removeItem=function(key){return previousRemoveItem.call(this,key);};

  const ready=hydrate();
  window.nubemoPatientDocumentReadBridge=Object.freeze({ready,flush:async()=>{await ready;await queue;}});
})();
