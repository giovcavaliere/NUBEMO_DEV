import {bindHomeActions,updateHomeActions} from "./patient-home-actions.js?v=home-buttons-20261015";
import {dailyMotivationalQuote} from "./daily-quotes.js?v=quotes-fixed-20261015";
// Patient 2.0 Home — approved demo markup; live Supabase-only figures.
const db=()=>window.nubemoSupabase;
const el=(q)=>document.querySelector("#patientHomeView "+q);
const fmt=v=>v==null?"—":Number(v).toLocaleString("it-IT",{minimumFractionDigits:1,maximumFractionDigits:1});
const num=v=>v==null||v===""?null:Number.isFinite(Number(v))?Number(v):null;
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
const date=val=>new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"short"}).format(new Date(val+"T12:00:00"));
const query=async q=>{const {data,error}=await q;if(error)throw error;return data||[];};
let chartPoints=[],currentRange="7d";
const setText=(q,value)=>{const n=el(q);if(n)n.textContent=value;};
const metric=(i,value,note)=>{const card=el(".patient-kpi-grid .kpi-card:nth-child("+i+")");if(!card)return;card.querySelector("strong").textContent=value;if(note!=null)card.querySelector("small").textContent=note;};
function drawChart(){
 const host=el("#patientWeightChart");if(!host)return;
 const limits={"7d":7,"1m":30,"3m":90,all:null};const span=limits[currentRange];
 const end=new Date(today()+"T12:00:00"),start=span?new Date(end.getTime()-(span-1)*86400000):null;
 const points=chartPoints.filter(x=>!start||new Date(x.day+"T12:00:00")>=start);
 el(".patient-range")?.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.weightRange===currentRange));
 if(!points.length){host.innerHTML='<p class="agenda-note">Nessuna rilevazione del peso in questo periodo.</p>';return;}
 if(points.length===1){host.innerHTML='<div class="patient-chart-latest"><span>Peso <strong>'+fmt(points[0].weight)+' kg</strong></span><span>'+date(points[0].day)+'</span></div>';return;}
 const left=46,right=454,top=34,bottom=225;
 const nums=points.map(p=>p.weight),low=Math.min(...nums),high=Math.max(...nums),pad=Math.max(1,(high-low)*.25),min=low-pad,max=high+pad;
 const x=i=>left+(i*(right-left)/(points.length-1)),y=v=>top+(max-v)*(bottom-top)/(max-min);
 const coords=points.map((p,i)=>[x(i),y(p.weight)]),path=coords.map(([x,y],i)=>(i?"L ":"M ")+x.toFixed(2)+" "+y.toFixed(2)).join(" ");
 const area=path+" L "+right+" "+bottom+" L "+left+" "+bottom+" Z";
 const selected=points.length>=5&&host.clientWidth>=380?[0,Math.floor((points.length-1)/2),points.length-1]:[0,points.length-1];
 host.innerHTML='<div class="patient-chart-core" role="img" aria-label="Andamento reale del peso"><span class="patient-chart-axis-title">Peso (kg)</span><div class="patient-chart-plot"><svg viewBox="46 34 408 191" preserveAspectRatio="none" aria-hidden="true">'+
 Array.from({length:5},(_,i)=>{const v=min+(max-min)*i/4,yy=y(v);return '<line x1="46" x2="454" y1="'+yy+'" y2="'+yy+'" class="patient-chart-grid"/>';}).join("")+
 '<path d="'+area+'" class="patient-chart-area"/><path d="'+path+'" class="patient-chart-line"/></svg>'+
 Array.from({length:5},(_,i)=>{const v=min+(max-min)*i/4;return '<span class="patient-chart-axis patient-chart-tick" style="--patient-y:'+y(v).toFixed(2)+'">'+fmt(v)+'</span>';}).join("")+
 coords.map(([xx,yy],i)=>'<span class="patient-chart-dot" style="--patient-x:'+xx.toFixed(2)+';--patient-y:'+yy.toFixed(2)+'" title="'+fmt(points[i].weight)+' kg"></span>').join("")+
 selected.map((index,i)=>'<span class="patient-chart-axis patient-chart-date patient-chart-date-'+(i===0?"start":i===selected.length-1?"end":"middle")+'" style="--patient-x:'+x(index).toFixed(2)+'">'+date(points[index].day)+'</span>').join("")+'</div></div>'+
 '<div class="patient-chart-latest"><span><i class="patient-chart-legend-dot"></i>Peso <strong>'+fmt(points.at(-1).weight)+' kg</strong></span></div>';
}
let bound=false;
export async function mountPatientHome(ctx){
 const root=document.querySelector("#patientHomeView");if(!root)return;
 if(!bound){bound=true;root.addEventListener("click",e=>{const b=e.target.closest("[data-weight-range]");if(b){currentRange=b.dataset.weightRange;drawChart();}

 });}
 const patientId=ctx.patient.id;
 const now=today();
 const {data:active,error:activeError}=await db().rpc("current_active_pathway_id");if(activeError)throw activeError;
 const requests=[
  db().from("patient_measurements").select("measured_at,weight_kg").eq("patient_id",patientId).is("deleted_at",null).not("weight_kg","is",null).order("measured_at"),
  db().from("diary_entries").select("entry_date,weight_kg,breakfast,morning_snack,lunch,afternoon_snack,dinner,total_kcal,calorie_quality").eq("patient_id",patientId).is("deleted_at",null).order("entry_date",{ascending:false}).limit(365),
  db().from("patient_clinical_profiles").select("goal_weight_kg").eq("patient_id",patientId).eq("pathway_id",active||"00000000-0000-0000-0000-000000000000").maybeSingle(),
  db().from("nutrition_plans").select("id,title,valid_from,pathway_id,status").eq("patient_id",patientId).is("deleted_at",null).order("valid_from",{ascending:false}).limit(50),
  db().from("documents").select("id,category,uploaded_by_user_id").eq("patient_id",patientId).is("deleted_at",null).limit(500),
  db().from("document_read_status").select("document_id,read_at").eq("profile_id",ctx.profile.id).limit(500),
  db().from("appointment_patients").select("appointment_id").eq("patient_id",patientId)
 ];
 const results=await Promise.allSettled(requests);
 const sources=["misurazioni","diario","obiettivo","piano","documenti","letture","agenda"];
 const values=results.map((result,i)=>{
  if(result.status==="rejected"){console.error("Home Patient: "+sources[i],result.reason);return null;}
  if(result.value.error){console.error("Home Patient: "+sources[i],result.value.error);return null;}
  return result.value.data;
 });
 const [measurements,diary,clinical,plans,docs,reads,appointmentLinks]=values;
 const map=new Map();
 for(const d of diary||[])if(num(d.weight_kg)>0)map.set(d.entry_date,{day:d.entry_date,weight:num(d.weight_kg),priority:0});
 for(const m of measurements||[])if(num(m.weight_kg)>0)map.set(m.measured_at,{day:m.measured_at,weight:num(m.weight_kg),priority:1});
 chartPoints=[...map.values()].sort((a,b)=>a.day.localeCompare(b.day));
 const first=chartPoints[0]?.weight??null,last=chartPoints.at(-1)?.weight??null,goal=num(clinical?.goal_weight_kg),diff=first!=null&&last!=null?last-first:null;
 const dateFormat=new Intl.DateTimeFormat("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 const h=new Date();const greeting=h.getHours()<12?"Buongiorno":h.getHours()<18?"Buon pomeriggio":"Buonasera";
 setText(".patient-welcome h1",greeting+", "+([ctx.profile.first_name,ctx.profile.last_name].filter(Boolean).join(" ").trim()||"Paziente")+" 👋");
 const welcome=el(".patient-welcome p");if(welcome)welcome.textContent=dateFormat.format(h)+" · Ecco come sta andando il tuo percorso";
 setText("#patientDailyQuote","“"+dailyMotivationalQuote(h)+"”");
 metric(1,last==null?"—":fmt(last)+" kg",diff==null?"Nessun confronto":(diff>0?"+":"")+fmt(diff)+" kg dall'inizio");
 const height=num(ctx.patient.height_cm);metric(2,last&&height?fmt(last/((height/100)**2)):"—",height?"calcolato sull'ultimo peso":"Altezza non disponibile");
 metric(3,goal==null?"—":fmt(goal)+" kg",goal==null?"Obiettivo non impostato":"definito con il professionista");
 const todayEntry=(diary||[]).find(d=>d.entry_date===now),meals=["breakfast","morning_snack","lunch","afternoon_snack","dinner"],done=meals.filter(k=>String(todayEntry?.[k]||"").trim()).length;
 metric(4,done+" / 5",done===1?"pasto registrato":"pasti registrati oggi");
 const progress=el(".patient-progress-card");
 if(progress){
  const showWeight=value=>value==null?"—":fmt(value)+" kg";
  progress.querySelector("[data-goal-start]").textContent=showWeight(first);
  progress.querySelector("[data-goal-target]").textContent=showWeight(goal);
  progress.querySelector("[data-goal-current]").textContent=showWeight(last);
  const change=first==null||last==null?null:last-first;
  const changeElement=progress.querySelector("[data-goal-change]");
  changeElement.textContent=change==null?"—":(change>0?"+":change<0?"−":"")+showWeight(Math.abs(change));
  const changeIcon=progress.querySelector(".patient-progress-metric:nth-child(2) .patient-progress-metric-icon");
  if(changeIcon){
   changeIcon.classList.toggle("is-increase",change!=null&&change>0);
   changeIcon.classList.toggle("is-decrease",change!=null&&change<0);
   const arrow=changeIcon.querySelector("svg");
   if(arrow)arrow.style.transform=change!=null&&change>0?"rotate(180deg)":"";
  }
  progress.querySelector("[data-goal-remaining]").textContent=goal==null||last==null?"—":showWeight(Math.max(0,last-goal));
  const ratio=first!=null&&last!=null&&goal!=null&&first>goal?Math.max(0,Math.min(100,(first-last)/(first-goal)*100)):null;
  const ring=progress.querySelector(".patient-progress-ring");
  ring.style.setProperty("--progress",ratio??0);
  ring.querySelector("strong").textContent=ratio==null?"—":fmt(ratio)+"%";
  ring.querySelector("span").textContent=ratio==null?"Obiettivo assente":"completato";
 }
 setText(".patient-calorie-value",todayEntry?.total_kcal==null?"—":Math.round(todayEntry.total_kcal).toLocaleString("it-IT")+" kcal");
 setText(".patient-calorie-status",todayEntry?.calorie_quality==="good"?"Stima buona":todayEntry?.calorie_quality==="partial"?"Stima parziale":"Stima non disponibile");
 const birth=ctx.patient.birth_date,sex=String(ctx.patient.sex||"").toLowerCase();
 let bmr=null;
 if(last!=null&&height&&birth){
  const b=new Date(birth+"T12:00:00");
  let age=h.getFullYear()-b.getFullYear();
  if(h.getMonth()<b.getMonth()||(h.getMonth()===b.getMonth()&&h.getDate()<b.getDate()))age--;
  const adjustment=["m","male","maschio"].includes(sex)?5:["f","female","femmina"].includes(sex)?-161:null;
  if(age>0&&age<125&&adjustment!==null)bmr=Math.round(10*last+6.25*height-5*age+adjustment);
 }
 setText(".patient-calorie-bmr strong",bmr==null?"—":bmr.toLocaleString("it-IT")+" kcal");
 drawChart();
 const measuresAction=el("[data-patient-home-measures]");
 
 const appointmentAction=el("[data-patient-home-appointment]");
 
 const diaryCard=el(".patient-diary-summary")?.closest(".module");
 if(diaryCard){const p=diaryCard.querySelector(".agenda-note");if(p)p.textContent=done+" pasti su 5 registrati oggi";}
 el(".patient-diary-summary")?.querySelectorAll(".patient-meal-status").forEach((node,i)=>{const filled=!!String(todayEntry?.[meals[i]]||"").trim();node.classList.toggle("pending",!filled);node.querySelector("span").textContent=filled?"✓":"·";});
 const currentPlan=(plans||[]).find(p=>p.status==="active"&&p.pathway_id===active);
 const plan=[...document.querySelectorAll("#patientHomeView .patient-quick-list")][0]?.querySelector(".patient-quick-row");
 if(plan){plan.querySelector("strong").textContent=currentPlan?.title||"Nessun piano attivo";plan.querySelector("small").textContent=currentPlan?.valid_from?"In vigore dal "+date(currentPlan.valid_from):"Consulta la sezione Piano";}
 const seen=new Set((reads||[]).filter(x=>x.read_at).map(x=>x.document_id));
 const unread=(docs||[]).filter(d=>d.category!=="plan"&&d.uploaded_by_user_id!==ctx.user.id&&!seen.has(d.id)).length;
 const quick=[...document.querySelectorAll("#patientHomeView .patient-quick-list")].at(-1);
 if(quick){const rows=quick.querySelectorAll(".patient-quick-row");if(rows[1])rows[1].querySelector("small").textContent=unread?unread+" documenti da leggere":"Nessun documento da leggere";}
 const apIds=(appointmentLinks||[]).map(x=>x.appointment_id);
 let next=null;if(apIds.length){const appointments=await query(db().from("appointments").select("starts_at,appointment_type").in("id",apIds).is("deleted_at",null).gte("starts_at",new Date().toISOString()).order("starts_at").limit(1));next=appointments[0]||null;}
 const textNext=next?new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"}).format(new Date(next.starts_at)):"Nessuna visita programmata";
 setText(".patient-welcome-badge",next?"Prossima visita · "+textNext:textNext);
 if(quick){const rows=quick.querySelectorAll(".patient-quick-row");if(rows[0])rows[0].querySelector("small").textContent=textNext;}
 bindHomeActions({home:root,activePathway:active,nextAppointment:next,currentWeight:last,refresh:()=>mountPatientHome(ctx)});
 updateHomeActions(root,{nextAppointment:next,currentWeight:last,refresh:()=>mountPatientHome(ctx)});
}
