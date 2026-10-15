import {loadRealAgenda} from "./agenda-live-service.js";
const db=()=>window.nubemoSupabase;
const dateKey=(d)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
async function rows(query,label){const {data,error}=await query;if(error)throw Error(label+": "+error.message);return data||[];}
export async function loadProfessionalDashboard(patients){
 const now=new Date(),today=dateKey(now),month=today.slice(0,7);
 const real=patients.filter(p=>!p.isQuickDraft);
 const active=real.filter(p=>p.status==="active");
 const activeIds=active.map(p=>p.id);
 const [events,drafts]=await Promise.all([loadRealAgenda(patients),rows(db().from("professional_patient_drafts").select("id").eq("status","draft"),"Bozze")]);
 const todays=events.filter(e=>e.date===today);
 const kpis={
  active:active.length,
  newMonth:real.filter(p=>String(p.created_at||"").startsWith(month)).length,
  first:todays.filter(e=>e.type==="first").length,
  control:todays.filter(e=>e.type==="control").length
 };
 const start=new Date(now.getTime()),in2=new Date(now.getTime()+120*60000),in4=new Date(now.getTime()+240*60000);
 const timed=events.filter(e=>e.date===today).map(e=>({...e,when:new Date(e.date+"T"+e.start+":00")})).filter(e=>e.when>=start).sort((a,b)=>a.when-b.when);
 let next=timed.filter(e=>e.when<=in2);
 let windowHours=2;
 if(!next.length){next=timed.filter(e=>e.when<=in4);windowHours=4;}
 const unreadDocs=activeIds.length?await rows(db().from("documents").select("id,patient_id,uploaded_by_user_id,created_at").in("patient_id",activeIds).is("deleted_at",null),"Documenti"): [];
 const uid=(await db().auth.getUser()).data.user?.id;
 const patientDocs=unreadDocs.filter(d=>d.uploaded_by_user_id!==uid);
 const readRows=patientDocs.length?await rows(db().from("document_read_status").select("document_id,read_at").in("document_id",patientDocs.map(d=>d.id)).eq("profile_id",window.NUBEMO_PRO2_PROFILE?.id),"Letture documenti"):[];
 const readIds=new Set(readRows.filter(r=>r.read_at).map(r=>r.document_id));
 const unread=patientDocs.filter(d=>!readIds.has(d.id)).length;
 const since=dateKey(new Date(now.getTime()-7*86400000));
 const recentDiary=activeIds.length?await rows(db().from("diary_entries").select("patient_id").in("patient_id",activeIds).gte("entry_date",since).lte("entry_date",today).is("deleted_at",null),"Diario"):[];
 const withDiary=new Set(recentDiary.map(d=>d.patient_id));
 return {kpis,next,windowHours,remaining:Math.max(0,timed.length-next.length),priorities:{
   documents:unread,noDiary:activeIds.filter(id=>!withDiary.has(id)).length,
   invites:real.filter(p=>p.status==="pending").length,drafts:drafts.length
 }};
}
