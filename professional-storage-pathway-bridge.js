// NUBEMO — Storage documenti PRO scorporato per percorso.
(() => {
  'use strict';
  const client=window.nubemoSupabase;
  if(!client)return;

  let current=window.nubemoProfessionalServices||null;
  const safeFileName=name=>String(name||'documento').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'documento';

  function wrap(base){
    if(!base||base.__nubemoPathwayStorageWrapped)return base;

    async function uploadPatientDocument(patientId,file,meta={}){
      if(meta.category==='privacy')throw new Error('Le informative privacy sono gestite centralmente dall’Admin.');
      const {data:pathwayId,error:pathwayError}=await client.rpc('get_current_professional_active_pathway_id',{p_patient_id:patientId});
      if(pathwayError)throw pathwayError;
      if(!pathwayId)throw new Error('Nessun percorso attivo per questo paziente.');

      const userId=window.nubemoProfessionalContext?.user?.id || (await client.auth.getUser()).data?.user?.id;
      if(!userId)throw new Error('Utente professionista non disponibile.');

      const path=`${patientId}/${pathwayId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const upload=await client.storage.from('patient-documents').upload(path,file,{contentType:file.type||undefined,upsert:false});
      if(upload.error)throw upload.error;

      const row={
        pathway_id:pathwayId,
        patient_id:patientId,
        category:meta.category||'document',
        sub_category:meta.subCategory||null,
        title:meta.title||file.name,
        document_date:meta.documentDate||null,
        document_number:meta.documentNumber||null,
        valid_from:meta.validFrom||null,
        professional_note:meta.professionalNote||null,
        original_filename:file.name,
        mime_type:file.type||null,
        size_bytes:Number.isFinite(file.size)?file.size:null,
        storage_bucket:'patient-documents',
        storage_path:path,
        uploaded_by_user_id:userId
      };

      const {data,error}=await client.from('documents').insert(row).select('*').single();
      if(error){
        await client.storage.from('patient-documents').remove([path]).catch(()=>{});
        throw error;
      }
      return data;
    }

    return Object.freeze({...base,uploadPatientDocument,__nubemoPathwayStorageWrapped:true});
  }

  current=wrap(current);
  Object.defineProperty(window,'nubemoProfessionalServices',{
    configurable:true,
    enumerable:true,
    get(){return current;},
    set(value){current=wrap(value);}
  });
})();
