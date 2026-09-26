// NUBEMO — Esami PRO su Supabase.
// Step 3B: hydration lazy per paziente.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const services=window.nubemoProfessionalServices;
  const context=window.nubemoProfessionalContext||{};
  if(!client||!services||!Array.isArray(context.patients))return;

  const LABS_KEY='diario-pro-labs-v1';
  const PENDING_LABS_KEY='diario-pro-pending-labs-v1';
  const {getItem:previousGetItem,setItem:previousSetItem,removeItem:previousRemoveItem}=window.NubemoRuntimeKit.capture();

  const memory=new Map();
  const confirmedByPatient=new Map();
  const pendingByKey=new Map();
  const hydratedPatients=new Set();
  const hydrationPromises=new Map();
  const replayClicks=new WeakSet();
  let queue=Promise.resolve();
  let installed=false;

  const fields=[['glucose','Glicemia'],['cholesterol','Colesterolo'],['hdl','HDL'],['ldl','LDL'],['triglycerides','Trigliceridi'],['got','GOT'],['gpt','GPT'],['uricAcid','Acido urico'],['creatinine','Creatinina'],['ggt','γGT']];
  const fieldKeys=new Set(fields.map(x=>x[0]));
  const parse=(v,f)=>{try{return JSON.parse(v)}catch(_){return f}};
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const aliases=new Map(fields.flatMap(([k,label])=>[[norm(k),k],[norm(label),k]]));

  function patientName(row){const p=row?.profile||{};return[p.first_name,p.last_name].filter(Boolean).join(' ').trim()||p.email||'Paziente';}
  function inferPatientId(){const title=document.querySelector('.patient-global-title')?.textContent||'';return context.patients.find(p=>title.includes(patientName(p)))?.id||'';}
  function valueFor(row){const key=aliases.get(norm(row.test_code))||aliases.get(norm(row.test_name));if(!key)return null;const value=row.value_text??(row.value_numeric??'');return[key,String(value??'')];}
  function legacyReport(report){const out={id:report.id,date:report.report_date||'',_remote:true};fields.forEach(([k])=>out[k]='');(report.values||[]).forEach(v=>{const pair=valueFor(v);if(pair)out[pair[0]]=pair[1];});return out;}
  function pendingKey(report){return`lab-${report.id}`;}

  async function pendingFilename(report){
    if(!report.document_id)return'Referto analisi';
    const result=await client.from('documents').select('original_filename,title').eq('id',report.document_id).maybeSingle();
    if(result.error)throw result.error;
    return result.data?.original_filename||result.data?.title||'Referto analisi';
  }

  function writePatientMemory(patientId,confirmed,pendingRows){
    const labsMap=parse(memory.get(LABS_KEY)||'{}',{});labsMap[patientId]=confirmed.map(legacyReport);memory.set(LABS_KEY,JSON.stringify(labsMap));
    const pendingMap=parse(memory.get(PENDING_LABS_KEY)||'{}',{});
    Object.keys(pendingMap).forEach(k=>{if(pendingMap[k]?.patientId===patientId)delete pendingMap[k];});
    pendingRows.forEach(item=>{pendingMap[item.key]=item;});
    memory.set(PENDING_LABS_KEY,JSON.stringify(pendingMap));
  }

  async function ensurePatient(patientId,force=false){
    if(!patientId)return;
    if(!force&&hydratedPatients.has(patientId))return;
    if(!force&&hydrationPromises.has(patientId))return hydrationPromises.get(patientId);
    const promise=(async()=>{
      const reports=await services.loadLaboratoryReports(patientId);
      const confirmed=(reports||[]).filter(r=>r.status==='confirmed');
      confirmedByPatient.set(patientId,confirmed);
      for(const [k,item] of [...pendingByKey.entries()])if(item.patientId===patientId)pendingByKey.delete(k);
      const pendingRows=[];
      for(const report of (reports||[]).filter(r=>r.status==='pending_review')){
        const key=pendingKey(report),values={date:report.report_date||''};fields.forEach(([k])=>values[k]='');(report.values||[]).forEach(v=>{const pair=valueFor(v);if(pair)values[pair[0]]=pair[1];});
        const item={key,reportId:report.id,documentId:report.document_id||null,patientId,filename:await pendingFilename(report),uploadedAt:report.created_at,status:'Da verificare',values,note:'Controlla e conferma i valori del referto.'};
        pendingByKey.set(key,item);pendingRows.push(item);
      }
      writePatientMemory(patientId,confirmed,pendingRows);
      hydratedPatients.add(patientId);
    })().finally(()=>hydrationPromises.delete(patientId));
    hydrationPromises.set(patientId,promise);return promise;
  }

  function rowsFromLegacy(lab){return fields.filter(([k])=>String(lab?.[k]??'').trim()!=='').map(([k,label])=>({test_code:k,test_name:label,value_text:String(lab[k]).trim(),value_numeric:Number.isFinite(Number(String(lab[k]).replace(',','.')))?Number(String(lab[k]).replace(',','.')):null}));}
  async function syncValues(reportId,lab){const current=await client.from('laboratory_values').select('id,test_code,test_name').eq('report_id',reportId);if(current.error)throw current.error;const existing=new Map((current.data||[]).map(v=>[aliases.get(norm(v.test_code))||aliases.get(norm(v.test_name)),v]).filter(x=>fieldKeys.has(x[0])));for(const[key,label]of fields){const raw=String(lab?.[key]??'').trim(),old=existing.get(key),payload={test_code:key,test_name:label,value_text:raw||null,value_numeric:raw!==''&&Number.isFinite(Number(raw.replace(',','.')))?Number(raw.replace(',','.')):null};if(old){const r=await client.from('laboratory_values').update(payload).eq('id',old.id);if(r.error)throw r.error;}else if(raw!==''){const r=await client.from('laboratory_values').insert({report_id:reportId,...payload});if(r.error)throw r.error;}}}
  async function createConfirmed(patientId,lab){const report=await services.createLaboratoryReport(patientId,{reportDate:lab.date||null,title:'Esami ematici',status:'pending_review'});try{const rows=rowsFromLegacy(lab).map(r=>({testCode:r.test_code,testName:r.test_name,valueText:r.value_text,valueNumeric:r.value_numeric}));if(rows.length)await services.saveLaboratoryValues(report.id,rows);return await services.confirmLaboratoryReport(report.id);}catch(error){await client.rpc('soft_delete_associated_laboratory_report',{p_report_id:report.id}).catch(()=>{});throw error;}}

  async function syncLabs(serialized){
    const incoming=parse(serialized,{});if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return;
    for(const patient of context.patients){
      if(!hydratedPatients.has(patient.id)||!Object.prototype.hasOwnProperty.call(incoming,patient.id))continue;
      const rows=Array.isArray(incoming[patient.id])?incoming[patient.id]:[],existing=confirmedByPatient.get(patient.id)||[],existingById=new Map(existing.map(r=>[r.id,r])),retained=new Set();
      for(const lab of rows){if(!lab?.date)continue;if(existingById.has(lab.id)){retained.add(lab.id);const rr=await client.from('laboratory_reports').update({report_date:lab.date,status:'confirmed'}).eq('id',lab.id);if(rr.error)throw rr.error;await syncValues(lab.id,lab);}else{const created=await createConfirmed(patient.id,lab);retained.add(created.id);}}
      for(const report of existing){if(!retained.has(report.id)){const r=await client.rpc('soft_delete_associated_laboratory_report',{p_report_id:report.id});if(r.error)throw r.error;}}
      await ensurePatient(patient.id,true);
    }
  }

  function install(){if(installed)return;installed=true;window.NubemoRuntimeKit.patch('professional-labs-supabase-bridge',{getItem:function(key){const k=String(key);if(this===window.nubemoProfessionalRuntimeStore.storage&&(k===LABS_KEY||k===PENDING_LABS_KEY))return memory.has(k)?memory.get(k):null;return previousGetItem.call(this,key);},setItem:function(key,value){const k=String(key);if(this!==window.nubemoProfessionalRuntimeStore.storage||(k!==LABS_KEY&&k!==PENDING_LABS_KEY))return previousSetItem.call(this,key,value);memory.set(k,String(value));if(k===LABS_KEY)queue=queue.then(()=>syncLabs(String(value))).catch(error=>{console.error('NUBEMO PRO Supabase sync (esami):',error);window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error',{detail:{domain:'esami',message:error?.message||String(error)}}));});},removeItem:function(key){const k=String(key);if(this===window.nubemoProfessionalRuntimeStore.storage&&(k===LABS_KEY||k===PENDING_LABS_KEY)){memory.delete(k);return;}return previousRemoveItem.call(this,key);}}, [LABS_KEY,PENDING_LABS_KEY]);}

  async function openPendingPdf(item){if(!item?.documentId)return alert('PDF non disponibile.');const result=await client.from('documents').select('storage_bucket,storage_path').eq('id',item.documentId).maybeSingle();if(result.error)throw result.error;if(!result.data)return alert('PDF non disponibile.');const signed=await client.storage.from(result.data.storage_bucket).createSignedUrl(result.data.storage_path,300);if(signed.error)throw signed.error;window.location.href=signed.data?.signedUrl||'#';}
  async function confirmPending(item){const date=(()=>{const v=String(document.getElementById('revDate')?.value||'').trim();const m=v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);return m?`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`:v;})();const lab={id:item.reportId,date};fields.forEach(([k])=>lab[k]=String(document.getElementById('rev'+k)?.value||'').trim());const reportUpdate=await client.from('laboratory_reports').update({report_date:date||null}).eq('id',item.reportId);if(reportUpdate.error)throw reportUpdate.error;await syncValues(item.reportId,lab);await services.confirmLaboratoryReport(item.reportId);await ensurePatient(item.patientId,true);window.reviewLabKey='';const nav=document.querySelector('[data-drawer-tab="labs"]')||document.querySelector('[data-patient-tab="labs"]');if(nav){nav.click();return;}document.getElementById('cancelLabReview')?.click();}
  async function deletePending(item){if(!item)return;if(!confirm(`Eliminare le analisi "${item.filename}"?\n\nIl file verrà rimosso anche dall'attesa del paziente.`))return;const reportDelete=await client.rpc('soft_delete_associated_laboratory_report',{p_report_id:item.reportId});if(reportDelete.error)throw reportDelete.error;if(item.documentId){const documentResult=await client.from('documents').select('storage_bucket,storage_path').eq('id',item.documentId).maybeSingle();if(documentResult.error)throw documentResult.error;const documentDelete=await client.rpc('soft_delete_associated_patient_document',{p_document_id:item.documentId});if(documentDelete.error)throw documentDelete.error;const doc=documentResult.data;if(doc?.storage_bucket&&doc?.storage_path){const removal=await client.storage.from(doc.storage_bucket).remove([doc.storage_path]);if(removal.error)console.error('NUBEMO PRO orphan lab document cleanup:',removal.error);}}await window.nubemoProfessionalDocumentsBridge?.refresh?.(item.patientId);await ensurePatient(item.patientId,true);window.reviewLabKey='';const labsTab=document.querySelector('[data-patient-tab="labs"]');if(labsTab)labsTab.click();else document.querySelector('[data-view="dashboard"]')?.click();}

  install();memory.set(LABS_KEY,'{}');memory.set(PENDING_LABS_KEY,'{}');

  document.addEventListener('click',event=>{
    const lazyTab=event.target?.closest?.('[data-patient-tab="labs"],[data-drawer-tab="labs"]');
    if(lazyTab&&!replayClicks.has(lazyTab)){
      const patientId=inferPatientId();
      if(patientId&&!hydratedPatients.has(patientId)){event.preventDefault();event.stopImmediatePropagation();void ensurePatient(patientId).then(()=>{replayClicks.add(lazyTab);lazyTab.click();}).catch(error=>{console.error('NUBEMO PRO labs lazy:',error);replayClicks.add(lazyTab);lazyTab.click();});return;}
    }else if(lazyTab)replayClicks.delete(lazyTab);

    const open=event.target?.closest?.('#openLabReviewPdf');if(open){event.preventDefault();event.stopImmediatePropagation();const item=pendingByKey.get(window.reviewLabKey);if(item)void openPendingPdf(item).catch(error=>{console.error('NUBEMO PRO open lab PDF:',error);alert('Non riesco ad aprire il PDF.');});return;}
    const remove=event.target?.closest?.('#deleteLabReview');if(remove){event.preventDefault();event.stopImmediatePropagation();const item=pendingByKey.get(window.reviewLabKey);if(item){remove.disabled=true;void deletePending(item).catch(error=>{console.error('NUBEMO PRO delete pending lab:',error);alert('Non è stato possibile eliminare le analisi.');remove.disabled=false;});}return;}
    const confirmButton=event.target?.closest?.('#confirmLabReview');if(confirmButton){event.preventDefault();event.stopImmediatePropagation();const item=pendingByKey.get(window.reviewLabKey);if(!item)return;confirmButton.disabled=true;void confirmPending(item).catch(error=>{console.error('NUBEMO PRO confirm lab:',error);alert('Non è stato possibile confermare gli esami.');confirmButton.disabled=false;});}
  },true);

  async function flush(){await Promise.all([...hydrationPromises.values()]);await queue;}
  window.nubemoProfessionalLabsBridge=Object.freeze({ready:Promise.resolve(),flush,ensurePatient,refresh:patientId=>ensurePatient(patientId||inferPatientId(),true)});
})();
