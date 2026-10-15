// Elenco pazienti Professional 2.0: esclusivamente relazioni autorizzate da RLS.
const client=window.nubemoSupabase;
export async function loadOwnPatients(){
 const identity=window.NUBEMO_PRO2_PROFILE;
 if(!identity?.id || !client)throw new Error('Sessione professionista non disponibile.');
 const {data:professional,error:professionalError}=await client.from('professionals')
   .select('id').eq('profile_id',identity.id).single();
 if(professionalError||!professional)throw new Error('Impossibile identificare il professionista.');
 const {data:links,error:linksError}=await client.from('professional_patients')
   .select('patient_id,status,created_at').eq('professional_id',professional.id);
 if(linksError)throw new Error('Impossibile caricare i pazienti associati.');
 const {data:quickDrafts,error:draftError}=await client.from("professional_patient_drafts")
   .select("id,first_name,last_name,phone,status,created_at")
   .eq("professional_id",professional.id).eq("status","draft");
 if(draftError)throw new Error("Impossibile caricare i Draft rapidi.");
 const quickDraftRecords=(quickDrafts||[]).map(item=>({
   id:item.id,first_name:item.first_name||"",last_name:item.last_name||"",
   phone:item.phone||"",email:"",age:null,status:"draft",isQuickDraft:true,
   created_at:item.created_at,weight:null,weightDelta:null,nextVisit:null,
   unreadDocuments:null,avatar:null
 }));
 if(!links?.length)return quickDraftRecords;
 const ids=[...new Set(links.map(link=>link.patient_id).filter(Boolean))];
 const patientRows=[];
 for(let i=0;i<ids.length;i+=100){
   const {data,error}=await client.from('patients')
     .select('id,profile_id,status,birth_date,created_at').in('id',ids.slice(i,i+100));
   if(error)throw new Error('Impossibile leggere le anagrafiche dei pazienti.');
   patientRows.push(...(data||[]));
 }
 const profileIds=[...new Set(patientRows.map(row=>row.profile_id).filter(Boolean))];
 const profiles=[];
 for(let i=0;i<profileIds.length;i+=100){
   const {data,error}=await client.from('profiles')
     .select('id,first_name,last_name,email,phone,auth_user_id,activation_completed_at,patient_avatar_path').in('id',profileIds.slice(i,i+100));
   if(error)throw new Error('Impossibile leggere i profili dei pazienti.');
   profiles.push(...(data||[]));
 }
 const futureFrom=new Date().toISOString();
 const {data:futureAppointments,error:appointmentsError}=await client.from("appointments")
   .select("id,starts_at").is("deleted_at",null).gte("starts_at",futureFrom)
   .order("starts_at",{ascending:true}).limit(500);
 if(appointmentsError)throw new Error("Impossibile leggere i prossimi appuntamenti.");
 const futureIds=(futureAppointments||[]).map(a=>a.id);
 const futureLinks=[];
 for(let i=0;i<futureIds.length;i+=100){
   const {data,error}=await client.from("appointment_patients")
     .select("appointment_id,patient_id").in("appointment_id",futureIds.slice(i,i+100));
   if(error)throw new Error("Impossibile leggere le associazioni degli appuntamenti.");
   futureLinks.push(...(data||[]));
 }
 const appointmentsById=new Map((futureAppointments||[]).map(a=>[a.id,a]));
 const nextByPatient=new Map();
 for(const link of futureLinks){
   const appointment=appointmentsById.get(link.appointment_id);
   if(!link.patient_id||!appointment||nextByPatient.has(link.patient_id))continue;
   nextByPatient.set(link.patient_id,new Intl.DateTimeFormat("it-IT",{
     day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"
   }).format(new Date(appointment.starts_at)));
 }
 // Count only documents uploaded by the patient and still unread by this professional.
 const patientAuthById=new Map(patientRows.map(patient=>[
   patient.id,profiles.find(profile=>profile.id===patient.profile_id)?.auth_user_id||null
 ]));
 const unreadByPatient=new Map();
 const eligibleDocs=[];
 for(let i=0;i<ids.length;i+=100){
   const {data,error}=await client.from("documents")
     .select("id,patient_id,uploaded_by_user_id").in("patient_id",ids.slice(i,i+100))
     .is("deleted_at",null);
   if(error)throw new Error("Impossibile verificare i documenti da leggere.");
   eligibleDocs.push(...(data||[]).filter(d=>patientAuthById.get(d.patient_id)!=null&&d.uploaded_by_user_id===patientAuthById.get(d.patient_id)));
 }
 if(eligibleDocs.length){
   const docIds=eligibleDocs.map(d=>d.id);
   const readIds=new Set();
   for(let i=0;i<docIds.length;i+=100){
     const {data,error}=await client.from("document_read_status")
       .select("document_id").eq("profile_id",identity.id).not("read_at","is",null)
       .in("document_id",docIds.slice(i,i+100));
     if(error)throw new Error("Impossibile verificare lo stato di lettura.");
     (data||[]).forEach(row=>readIds.add(row.document_id));
   }
   eligibleDocs.forEach(d=>{if(!readIds.has(d.id))unreadByPatient.set(d.patient_id,(unreadByPatient.get(d.patient_id)||0)+1);});
 }
 const byPatient=new Map(patientRows.map(p=>[p.id,p]));
 const byProfile=new Map(profiles.map(p=>[p.id,p]));
 const today=new Date();
 const fullRecords=links.map(link=>{
   const patient=byPatient.get(link.patient_id);
   const person=patient&&byProfile.get(patient.profile_id);
   if(!patient||!person)return null;
   const birthday=patient.birth_date?new Date(patient.birth_date+'T12:00:00'):null;
   let age=null;
   if(birthday&&!Number.isNaN(birthday.getTime())){
     age=today.getFullYear()-birthday.getFullYear();
     if(today.getMonth()<birthday.getMonth()||(today.getMonth()===birthday.getMonth()&&today.getDate()<birthday.getDate()))age--;
   }
   const draft=patient.status==='draft';
   const invitationPending=Boolean(person.auth_user_id&&!person.activation_completed_at);
   const status=link.status==='ended'?'terminated':draft?'draft':link.status==='pending'||invitationPending?'pending':'active';
   return {id:patient.id,first_name:person.first_name||'',last_name:person.last_name||'',
      email:person.email||'',phone:person.phone||'',age,
      status,created_at:patient.created_at||link.created_at,
      weight:null,weightDelta:null,nextVisit:nextByPatient.get(patient.id)||null,unreadDocuments:unreadByPatient.get(patient.id)||0,avatarPath:person.patient_avatar_path||null,avatar:null};
 }).filter(Boolean);
 await Promise.all(fullRecords.filter(item=>item.avatarPath).map(async item=>{
  const signed=await client.storage.from("patient-avatars").createSignedUrl(item.avatarPath,1800);
  if(!signed.error&&signed.data?.signedUrl)item.avatar=signed.data.signedUrl;
 }));
 return [...fullRecords,...quickDraftRecords];
}
