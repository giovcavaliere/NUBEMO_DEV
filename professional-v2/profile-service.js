// Profilo Professional 2.0: dati autenticati, nessuna identità demo o scrittura sui campi Admin.
const client=window.nubemoSupabase;
const own=()=>window.NUBEMO_PRO2_PROFILE;
const fromTime=value=>String(value||'').slice(0,5);
const weekdays=n=>Array.from({length:n===6?6:5},(_,i)=>i+1);
export async function loadProfessionalProfile(model){
 const identity=own();
 if(!client||!identity?.id) throw new Error('Sessione professionista non disponibile.');
 const {data:record,error:recordError}=await client.from('professionals')
   .select('id,profile_id,qualification,display_name,tax_code,vat_number,phone,address,zip,city,province,logo_storage_path,status')
   .eq('profile_id',identity.id).single();
 if(recordError||!record||record.status!=='active')throw new Error('Profilo professionale non disponibile.');
 const {data:settings,error:settingsError}=await client.from('professional_settings')
   .select('professional_id,first_visit_duration_min,control_visit_duration_min,day_start,day_end,work_days,settings_json')
   .eq('professional_id',record.id).maybeSingle();
 if(settingsError)throw new Error('Impostazioni professionali non disponibili.');
 model.firstName=identity.first_name||'';
 model.surname=identity.last_name||'';
 model.email=identity.email||'';
 model.displayName=record.display_name||[model.firstName,model.surname].filter(Boolean).join(' ');
 model.qualification=record.qualification||'';
 model.taxCode=record.tax_code||'';
 model.vat=record.vat_number||'';
 model.phone=record.phone||'';
 model.address=record.address||'';
 model.zip=record.zip||'';
 model.city=record.city||'';
 model.province=record.province||'';
 model.firstVisit=settings?.first_visit_duration_min||60;
 model.controlVisit=settings?.control_visit_duration_min||30;
 model.dayStart=fromTime(settings?.day_start)||'08:00';
 model.dayEnd=fromTime(settings?.day_end)||'19:00';
 model.workDays=Array.isArray(settings?.work_days)&&settings.work_days.includes(6)?6:5;
 model.studios=Array.isArray(settings?.settings_json?.studios)&&settings.settings_json.studios.length?settings.settings_json.studios:[{id:'studio-main',name:'Studio principale',address:record.address||'',zip:record.zip||'',city:record.city||'',province:record.province||'',primary:true}];
 model.photoData='';
 model.logoData='';
 return {id:record.id, settings:settings||null};
}
async function awaitOwnProfessionalId(profileId){
 const {data,error}=await client.from('professionals').select('id').eq('profile_id',profileId).single();
 if(error||!data?.id)throw new Error('Identità professionale non disponibile.');
 return data.id;
}
export async function saveProfessionalProfile(model){
 const identity=own();
 if(!identity?.id)throw new Error('Sessione professionista non disponibile.');
 const id=await awaitOwnProfessionalId(identity.id);
 const update={
  qualification:String(model.qualification||'').trim(),display_name:String(model.displayName||'').trim(),
  tax_code:String(model.taxCode||'').trim(),vat_number:String(model.vat||'').trim(),
  phone:String(model.phone||'').trim()
 };
 const {error}=await client.from('professionals').update(update).eq('id',id);
 if(error)throw new Error('Non è stato possibile salvare i dati professionali.');
 const patch={
  first_visit_duration_min:Number(model.firstVisit),control_visit_duration_min:Number(model.controlVisit),
  day_start:model.dayStart,day_end:model.dayEnd,work_days:weekdays(Number(model.workDays)),
  settings_json:{studios:model.studios}
 };
 // Evita l'upsert: non sovrascrivere active_patient_limit gestito esclusivamente dall'Admin.
 const {data:existing,error:readError}=await client.from('professional_settings').select('professional_id,settings_json').eq('professional_id',id).maybeSingle();
 if(readError)throw new Error('Verifica impostazioni non riuscita.');
 patch.settings_json={...(existing?.settings_json||{}),studios:model.studios};
 const operation=existing?client.from('professional_settings').update(patch).eq('professional_id',id):client.from('professional_settings').insert({professional_id:id,...patch});
 const {error:saveError}=await operation;
 if(saveError)throw new Error('Dati professionali salvati, ma impostazioni agenda non confermate.');
}
