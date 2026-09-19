// NUBEMO — Storage documenti Paziente scorporato per percorso.
(() => {
  'use strict';
  const client=window.nubemoSupabase;
  const base=window.nubemoPatientServices;
  if(!client||!base)return;

  const BUCKET='patient-documents';
  const safeFileName=name=>String(name||'documento').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'documento';

  async function activePathwayId(){
    const fromContext=window.nubemoPatientContext?.activePathway?.id;
    if(fromContext)return fromContext;
    const {data,error}=await client.rpc('current_active_pathway_id');
    if(error)throw error;
    if(!data)throw new Error('Nessun percorso attivo.');
    return data;
  }

  async function uploadPatientDocument(patientId,userId,file,meta={}){
    const pathwayId=await activePathwayId();
    const dbSubCategory=meta.sub_category==='other'?'health_other':(meta.sub_category||null);
    const path=`${patientId}/${pathwayId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

    const upload=await client.storage.from(BUCKET).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(upload.error)throw upload.error;

    const {data,error}=await client.from('documents').insert({
      pathway_id:pathwayId,
      patient_id:patientId,
      category:meta.category||'health',
      sub_category:dbSubCategory,
      title:meta.title,
      document_date:meta.document_date||null,
      original_filename:file.name,
      mime_type:file.type||null,
      size_bytes:file.size,
      storage_bucket:BUCKET,
      storage_path:path,
      uploaded_by_user_id:userId
    }).select('*').single();

    if(error){
      await client.storage.from(BUCKET).remove([path]).catch(()=>{});
      throw error;
    }

    if(dbSubCategory==='blood_test'){
      const lab=await client.from('laboratory_reports').insert({
        pathway_id:pathwayId,
        patient_id:patientId,
        document_id:data.id,
        report_date:meta.document_date||null,
        title:meta.title,
        status:'pending_review',
        created_by_user_id:userId
      });
      if(lab.error)throw lab.error;
    }
    return data;
  }

  window.nubemoPatientServices=Object.freeze({...base,uploadPatientDocument});
})();
