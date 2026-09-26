// NUBEMO — stato NUOVO/letto dei documenti lato Professionista.
// Preserva i badge e il comportamento corrente usando document_read_status come source of truth.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const context = window.nubemoProfessionalContext || {};
  if (!client || !context.profile?.id || !context.user?.id) return;

  const KEY='nubemo-documents-meta-v1';
  const {getItem:previousGetItem,setItem:previousSetItem,removeItem:previousRemoveItem}=window.NubemoRuntimeKit.capture();
  const unread=new Set();
  const replayClicks=new WeakSet();
  let readyDone=false;
  let queue=Promise.resolve();

  const parse=(v,f)=>{try{return JSON.parse(v)}catch(_){return f}};

  async function hydrate(){
    const ids=(context.patients||[]).map(p=>p.id);
    if(!ids.length){readyDone=true;return;}
    await window.nubemoProfessionalDocumentsBridge?.ready;
    const docs=parse(previousGetItem.call(window.nubemoProfessionalRuntimeStore.storage,KEY)||'[]',[]);
    const statuses=await client.from('document_read_status').select('document_id,read_at').eq('profile_id',context.profile.id);
    if(statuses.error)throw statuses.error;
    const readIds=new Set((statuses.data||[]).filter(x=>x.read_at).map(x=>x.document_id));
    unread.clear();
    for(const doc of Array.isArray(docs)?docs:[]) if(doc.uploadedBy!=='professional'&&!readIds.has(doc.id))unread.add(doc.id);
    readyDone=true;
  }

  function overlay(value){
    const rows=parse(value||'[]',[]);if(!Array.isArray(rows))return value;
    return JSON.stringify(rows.map(row=>({...row,unreadForProfessional:unread.has(row.id)})));
  }

  async function markRead(documentId){
    await ready;
    if(!documentId||!unread.has(documentId))return;
    const result=await client.from('document_read_status').upsert({document_id:documentId,profile_id:context.profile.id,read_at:new Date().toISOString()},{onConflict:'document_id,profile_id'});
    if(result.error)throw result.error;
    unread.delete(documentId);
  }

  async function persistReads(value){
    if(!readyDone)return;
    const rows=parse(value,[]);if(!Array.isArray(rows))return;
    for(const row of rows){
      if(!row?.id||row.unreadForProfessional!==false||!unread.has(row.id))continue;
      await markRead(row.id);
    }
  }

  window.NubemoRuntimeKit.patch('professional-document-read-supabase-bridge',{
    getItem:function(key){
      const value=previousGetItem.call(this,key);
      if(this===window.nubemoProfessionalRuntimeStore.storage&&String(key)===KEY&&readyDone)return overlay(value);
      return value;
    },
    setItem:function(key,value){
      previousSetItem.call(this,key,value);
      if(this!==window.nubemoProfessionalRuntimeStore.storage||String(key)!==KEY||!readyDone)return;
      const serialized=String(value);
      queue=queue.then(()=>persistReads(serialized)).catch(error=>console.error('NUBEMO PRO document read status:',error));
    },
    removeItem:function(key){return previousRemoveItem.call(this,key);}
  }, [KEY]);

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-open-pro-document]');
    if(!button)return;
    if(replayClicks.has(button)){replayClicks.delete(button);return;}
    const documentId=button.dataset.openProDocument||'';
    if(!documentId||!unread.has(documentId))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    queue=queue.then(()=>markRead(documentId)).then(()=>{
      replayClicks.add(button);
      button.click();
    }).catch(error=>{
      console.error('NUBEMO PRO document read status:',error);
      replayClicks.add(button);
      button.click();
    });
  },true);

  const ready=hydrate();
  window.nubemoProfessionalDocumentReadBridge=Object.freeze({ready,markRead,flush:async()=>{await ready;await queue;}});
})();
