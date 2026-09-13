// NUBEMO — impedisce al sync legacy degli appuntamenti di trattare i draft come patient_id reali.
(() => {
  'use strict';
  const client=window.nubemoSupabase;
  const context=window.nubemoProfessionalContext||{};
  const KEY='diario-pro-appts-recovery-v1';
  const draftIds=new Set();
  const proto=Object.getPrototypeOf(window.localStorage);
  if(proto.setItem?.__nubemoDraftSanitizer)return;
  const previousSet=proto.setItem;
  const wrapped=function(key,value){
    if(key===KEY){
      try{
        const rows=JSON.parse(value);
        if(Array.isArray(rows)){
          const clean=rows.map(row=>{
            const patientId=String(row?.patientId||'');
            return patientId&&draftIds.has(patientId)?{...row,patientId:null}:row;
          });
          return previousSet.call(this,key,JSON.stringify(clean));
        }
      }catch(_){ }
    }
    return previousSet.call(this,key,value);
  };
  wrapped.__nubemoDraftSanitizer=true;
  proto.setItem=wrapped;

  const ready=(async()=>{
    if(!client||!context.professional?.id)return;
    const {data,error}=await client.from('professional_patient_drafts').select('id').eq('professional_id',context.professional.id).eq('status','draft');
    if(error)throw error;(data||[]).forEach(row=>draftIds.add(row.id));
  })().catch(error=>console.error('NUBEMO draft sanitizer hydrate:',error));
  window.nubemoDraftStorageSanitizer={ready,isDraft:id=>draftIds.has(id)};
})();
