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
 if(!links?.length)return [];
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
     .select('id,first_name,last_name,email,phone').in('id',profileIds.slice(i,i+100));
   if(error)throw new Error('Impossibile leggere i profili dei pazienti.');
   profiles.push(...(data||[]));
 }
 const byPatient=new Map(patientRows.map(p=>[p.id,p]));
 const byProfile=new Map(profiles.map(p=>[p.id,p]));
 const today=new Date();
 return links.map(link=>{
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
   const status=link.status==='ended'?'terminated':draft?'draft':link.status==='pending'?'pending':'active';
   return {id:patient.id,first_name:person.first_name||'',last_name:person.last_name||'',
      email:person.email||'',phone:person.phone||'',age,
      status,created_at:patient.created_at||link.created_at,
      weight:null,weightDelta:null,nextVisit:null,unreadDocuments:null,avatar:null};
 }).filter(Boolean);
}
