// NUBEMO recovery 3.98 — Esami PRO su Supabase.
// Mantiene rendering e flussi 3.98; virtualizza LABS/PENDING in memoria.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const services = window.nubemoProfessionalServices;
  const context = window.nubemoProfessionalContext || {};
  if (!client || !services || !Array.isArray(context.patients)) return;

  const LABS_KEY='diario-pro-labs-v1';
  const PENDING_LABS_KEY='diario-pro-pending-labs-v1';
  const storageProto=Object.getPrototypeOf(window.localStorage);
  const previousGetItem=storageProto.getItem;
  const previousSetItem=storageProto.setItem;
  const previousRemoveItem=storageProto.removeItem;

  const memory=new Map();
  const confirmedByPatient=new Map();
  const pendingByKey=new Map();
  let queue=Promise.resolve();
  let installed=false;

  const fields=[
    ['glucose','Glicemia'],['cholesterol','Colesterolo'],['hdl','HDL'],['ldl','LDL'],
    ['triglycerides','Trigliceridi'],['got','GOT'],['gpt','GPT'],['uricAcid','Acido urico'],
    ['creatinine','Creatinina'],['ggt','γGT']
  ];
  const fieldKeys=new Set(fields.map(x=>x[0]));
  const parse=(v,f)=>{try{return JSON.parse(v)}catch(_){return f}};
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const aliases=new Map(fields.flatMap(([k,label])=>[[norm(k),k],[norm(label),k]]));

  function valueFor(row){
    const key=aliases.get(norm(row.test_code))||aliases.get(norm(row.test_name));
    if(!key)return null;
    const value=row.value_text ?? (row.value_numeric ?? '');
    return [key,String(value ?? '')];
  }

  function legacyReport(report){
    const out={id:report.id,date:report.report_date||'',_remote:true};
    fields.forEach(([k])=>out[k]='');
    (report.values||[]).forEach(v=>{const pair=valueFor(v);if(pair)out[pair[0]]=pair[1];});
    return out;
  }

  function pendingKey(report){return `lab-${report.id}`;}

  async function hydrate(){
    const all=await Promise.all(context.patients.map(async p=>[p.id,await services.loadLaboratoryReports(p.id)]));
    const labsMap={};
    const pendingMap={};
    confirmedByPatient.clear();
    pendingByKey.clear();

    for(const [patientId,reports] of all){
      const confirmed=(reports||[]).filter(r=>r.status==='confirmed');
      confirmedByPatient.set(patientId,confirmed);
      labsMap[patientId]=confirmed.map(legacyReport);

      for(const report of (reports||[]).filter(r=>r.status==='pending_review')){
        const key=pendingKey(report);
        const values={date:report.report_date||''};
        fields.forEach(([k])=>values[k]='');
        (report.values||[]).forEach(v=>{const pair=valueFor(v);if(pair)values[pair[0]]=pair[1];});
        let filename='Referto analisi';
        if(report.document_id){
          const docs=await services.loadPatientDocuments(patientId);
          const doc=docs.find(d=>d.id===report.document_id);
          if(doc)filename=doc.original_filename||doc.title||filename;
        }
        pendingMap[key]={key,reportId:report.id,documentId:report.document_id||null,patientId,filename,uploadedAt:report.created_at,status:'Da verificare',values,note:'Controlla e conferma i valori del referto.'};
        pendingByKey.set(key,pendingMap[key]);
      }
    }

    memory.set(LABS_KEY,JSON.stringify(labsMap));
    memory.set(PENDING_LABS_KEY,JSON.stringify(pendingMap));
  }

  function rowsFromLegacy(lab){
    return fields.filter(([k])=>String(lab?.[k]??'').trim()!=='').map(([k,label])=>({
      test_code:k,
      test_name:label,
      value_text:String(lab[k]).trim(),
      value_numeric:Number.isFinite(Number(String(lab[k]).replace(',','.')))?Number(String(lab[k]).replace(',','.')):null
    }));
  }

  async function syncValues(reportId,lab){
    const current=await client.from('laboratory_values').select('id,test_code,test_name').eq('report_id',reportId);
    if(current.error)throw current.error;
    const existing=new Map((current.data||[]).map(v=>[aliases.get(norm(v.test_code))||aliases.get(norm(v.test_name)),v]).filter(x=>fieldKeys.has(x[0])));
    for(const [key,label] of fields){
      const raw=String(lab?.[key]??'').trim();
      const old=existing.get(key);
      const payload={test_code:key,test_name:label,value_text:raw||null,value_numeric:raw!==''&&Number.isFinite(Number(raw.replace(',','.')))?Number(raw.replace(',','.')):null};
      if(old){const r=await client.from('laboratory_values').update(payload).eq('id',old.id);if(r.error)throw r.error;}
      else if(raw!==''){const r=await client.from('laboratory_values').insert({report_id:reportId,...payload});if(r.error)throw r.error;}
    }
  }

  async function createConfirmed(patientId,lab){
    const report=await services.createLaboratoryReport(patientId,{reportDate:lab.date||null,title:'Esami ematici',status:'pending_review'});
    try{
      const rows=rowsFromLegacy(lab).map(r=>({testCode:r.test_code,testName:r.test_name,valueText:r.value_text,valueNumeric:r.value_numeric}));
      if(rows.length)await services.saveLaboratoryValues(report.id,rows);
      const done=await services.confirmLaboratoryReport(report.id);
      return done;
    }catch(error){
      await client.rpc('soft_delete_associated_laboratory_report',{p_report_id:report.id}).catch(()=>{});
      throw error;
    }
  }

  async function syncLabs(serialized){
    const incoming=parse(serialized,{});
    if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return;

    for(const patient of context.patients){
      const rows=Array.isArray(incoming[patient.id])?incoming[patient.id]:[];
      const existing=confirmedByPatient.get(patient.id)||[];
      const existingById=new Map(existing.map(r=>[r.id,r]));
      const retained=new Set();

      for(const lab of rows){
        if(!lab?.date)continue;
        if(existingById.has(lab.id)){
          retained.add(lab.id);
          const rr=await client.from('laboratory_reports').update({report_date:lab.date,status:'confirmed'}).eq('id',lab.id);
          if(rr.error)throw rr.error;
          await syncValues(lab.id,lab);
        }else{
          const created=await createConfirmed(patient.id,lab);
          retained.add(created.id);
        }
      }

      for(const report of existing){
        if(!retained.has(report.id)){
          const r=await client.rpc('soft_delete_associated_laboratory_report',{p_report_id:report.id});
          if(r.error)throw r.error;
        }
      }
    }
    await hydrate();
  }

  function install(){
    if(installed)return;installed=true;
    storageProto.getItem=function(key){
      const k=String(key);
      if(this===window.localStorage&&(k===LABS_KEY||k===PENDING_LABS_KEY))return memory.has(k)?memory.get(k):null;
      return previousGetItem.call(this,key);
    };
    storageProto.setItem=function(key,value){
      const k=String(key);
      if(this!==window.localStorage||(k!==LABS_KEY&&k!==PENDING_LABS_KEY))return previousSetItem.call(this,key,value);
      memory.set(k,String(value));
      if(k===LABS_KEY)queue=queue.then(()=>syncLabs(String(value))).catch(error=>{console.error('NUBEMO PRO Supabase sync (esami):',error);window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error',{detail:{domain:'esami',message:error?.message||String(error)}}));});
    };
    storageProto.removeItem=function(key){
      const k=String(key);if(this===window.localStorage&&(k===LABS_KEY||k===PENDING_LABS_KEY)){memory.delete(k);return;}return previousRemoveItem.call(this,key);
    };
  }

  async function openPendingPdf(item){
    if(!item?.documentId)return alert('PDF non disponibile.');
    const result=await client.from('documents').select('storage_bucket,storage_path').eq('id',item.documentId).maybeSingle();
    if(result.error)throw result.error;if(!result.data)return alert('PDF non disponibile.');
    const signed=await client.storage.from(result.data.storage_bucket).createSignedUrl(result.data.storage_path,300);
    if(signed.error)throw signed.error;
    window.location.href=signed.data?.signedUrl||'#';
  }

  async function confirmPending(item){
    const date=(()=>{const v=String(document.getElementById('revDate')?.value||'').trim();const m=v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);return m?`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`:v;})();
    const lab={id:item.reportId,date};fields.forEach(([k])=>lab[k]=String(document.getElementById('rev'+k)?.value||'').trim());
    const reportUpdate=await client.from('laboratory_reports').update({report_date:date||null}).eq('id',item.reportId);if(reportUpdate.error)throw reportUpdate.error;
    await syncValues(item.reportId,lab);
    await services.confirmLaboratoryReport(item.reportId);
    await hydrate();
    window.reviewLabKey='';
    const labsNavigation=document.querySelector('[data-drawer-tab="labs"]')||document.querySelector('[data-patient-tab="labs"]');
    if(labsNavigation){labsNavigation.click();return;}
    document.getElementById('cancelLabReview')?.click();
  }

  async function deletePending(item){
    if(!item)return;
    if(!confirm(`Eliminare le analisi "${item.filename}"?\n\nIl file verrà rimosso anche dall'attesa del paziente.`))return;
    const reportDelete=await client.rpc('soft_delete_associated_laboratory_report',{p_report_id:item.reportId});
    if(reportDelete.error)throw reportDelete.error;

    if(item.documentId){
      const documentResult=await client.from('documents').select('storage_bucket,storage_path').eq('id',item.documentId).maybeSingle();
      if(documentResult.error)throw documentResult.error;
      const documentDelete=await client.rpc('soft_delete_associated_patient_document',{p_document_id:item.documentId});
      if(documentDelete.error)throw documentDelete.error;
      const doc=documentResult.data;
      if(doc?.storage_bucket&&doc?.storage_path){
        const removal=await client.storage.from(doc.storage_bucket).remove([doc.storage_path]);
        if(removal.error)console.error('NUBEMO PRO orphan lab document cleanup:',removal.error);
      }
    }

    await window.nubemoProfessionalDocumentsBridge?.refresh?.();
    await hydrate();
    window.reviewLabKey='';
    const labsTab=document.querySelector('[data-patient-tab="labs"]');
    if(labsTab)labsTab.click();
    else document.querySelector('[data-view="dashboard"]')?.click();
  }

  document.addEventListener('click',event=>{
    const open=event.target?.closest?.('#openLabReviewPdf');
    if(open){event.preventDefault();event.stopImmediatePropagation();const item=pendingByKey.get(window.reviewLabKey);if(item)void openPendingPdf(item).catch(error=>{console.error('NUBEMO PRO open lab PDF:',error);alert('Non riesco ad aprire il PDF.');});return;}
    const remove=event.target?.closest?.('#deleteLabReview');
    if(remove){event.preventDefault();event.stopImmediatePropagation();const item=pendingByKey.get(window.reviewLabKey);if(item){remove.disabled=true;void deletePending(item).catch(error=>{console.error('NUBEMO PRO delete pending lab:',error);alert('Non è stato possibile eliminare le analisi.');remove.disabled=false;});}return;}
    const confirmButton=event.target?.closest?.('#confirmLabReview');
    if(confirmButton){event.preventDefault();event.stopImmediatePropagation();const item=pendingByKey.get(window.reviewLabKey);if(!item)return;confirmButton.disabled=true;void confirmPending(item).catch(error=>{console.error('NUBEMO PRO confirm lab:',error);alert('Non è stato possibile confermare gli esami.');confirmButton.disabled=false;});}
  },true);

  const ready=(async()=>{await hydrate();install();})();
  async function flush(){await ready;await queue;}
  window.nubemoProfessionalLabsBridge=Object.freeze({ready,flush,refresh:hydrate});
})();