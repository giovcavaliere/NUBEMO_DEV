import {renderDiary,bindDiary} from "./patient-diary-view.js?v=live-icons-20261015";
import {getDiaryViewModel} from "./patient-diary-model.js";
import {loadLivePatientDiary} from "./patient-diary-live-service.js";
import {renderLivePatientOverview} from "./patient-detail-view.js";
const selectedDates=new Map();
export async function renderLivePatientDiary(root,overview){
 const patientId=overview.patient.id;
 const days=await loadLivePatientDiary(patientId,overview.pathways);
 renderLivePatientOverview(root,overview,"diario",{});
 const content=root.querySelector(".detail-content");
 function draw(){
  const model=getDiaryViewModel({diary:{days}},{selectedDate:selectedDates.get(patientId)||null});
  content.innerHTML=renderDiary(model);
  bindDiary(content,model,date=>{selectedDates.set(patientId,date);draw();});
 }
 draw();
}
