// Cartella PDF Professional 2.0: adapter dal modello DEV reale al generatore approvato.
import {loadLivePatientProfile,clinicalFields} from "./patient-profile-live-service.js";
import {loadLiveMeasurements} from "./patient-measurements-live-service.js";
import {loadDocuments} from "./patient-documents-live-service.js";
import {loadLivePatientDiary} from "./patient-diary-live-service.js?v=food-breakdown-20261015";
const num=v=>v==null||v===""?null:Number.isFinite(Number(v))?Number(v):null;
const byDate=(a,b)=>String(a.date||"").localeCompare(String(b.date||""));
const checked=async(query,label)=>{const {data,error}=await query;if(error)throw Error(label+": "+error.message);return data||[];};
function clinicalAnamnesis(row){
 if(!row)return {};
 const fields={};
 for(const [key,column] of Object.entries(clinicalFields)){
  if(key.startsWith("family."))continue;
  fields[key]=row[column]??null;
 }
 fields.family=Object.fromEntries(Object.entries(clinicalFields).filter(([key])=>key.startsWith("family.")).map(([key,column])=>[key.slice(7),row[column]===true]));
 return fields;
}
export async function loadLiveClinicalPdfData(overview,{diaryMode="none"}={}){
 const patientId=overview.patient.id;
 const paths=overview.pathways||[];
 const active=paths.find(p=>p.status==="active")||null;
 const [profile,records,documents]=await Promise.all([
  loadLivePatientProfile(patientId,overview),
  Promise.all(paths.map(p=>loadLiveMeasurements(patientId,p.id))).then(groups=>groups.flat().sort(byDate)),
  loadDocuments(patientId,paths)
 ]);
 const days=diaryMode==="none"?[]:await loadLivePatientDiary(patientId,paths);
 const latest=profile.record;
 const person=profile.profile;
 const allPaths=paths.map(p=>({
  id:p.id,status:p.status,startedAt:p.pathway_start_date||p.started_at||"",
  proposedAt:p.created_at||"",endedAt:p.ended_at||"",
  objectiveLabel:p.objective_key||"",customObjective:p.custom_objective||"",
  objectiveNote:p.objective_note||""
 }));
 const diary=days.map(day=>({
  date:day.date,valid:day.valid,weight:null,water:null,
  meals:(day.meals||[]).map(m=>({key:m.key,time:"",originalText:m.originalText||""}))
 }));
 return {
  identity:{id:patientId,firstName:person.first_name||overview.patient.first_name||"",
    lastName:person.last_name||overview.patient.last_name||"",
    birthDate:latest.birth_date||"",sex:latest.sex||"",height:num(latest.height_cm),
    phone:person.phone||"",email:person.email||""},
  profile:{anamnesis:clinicalAnamnesis(profile.clinical)},
  pathways:{items:allPaths},
  measurements:records,
  laboratoryReports:documents.laboratoryReports||[],
  diary:{days:diary}
 };
}
