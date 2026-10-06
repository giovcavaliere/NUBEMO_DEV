const finite=value=>typeof value==="number"&&Number.isFinite(value);
const formatKcal=value=>finite(value)?`${new Intl.NumberFormat("it-IT",{maximumFractionDigits:0}).format(value)} kcal`:"—";
const confidenceRank={none:0,low:1,medium:2,high:3};

const mealLabels={
  breakfast:"Colazione",
  snack1:"Spuntino mattina",
  lunch:"Pranzo",
  snack2:"Spuntino pomeriggio",
  dinner:"Cena"
};

const normalizeConfidence=value=>["high","medium","low","none"].includes(value)?value:"none";

function deriveMeal(meal={}){
  const components=Array.isArray(meal.components)?meal.components:[];
  const calculated=components.filter(item=>finite(item.kcal));
  const unresolved=components.filter(item=>item.status==="unresolved"||item.resolved===false);
  const estimated=components.filter(item=>["medium","low"].includes(normalizeConfidence(item.confidence)));
  const kcal=finite(meal.kcal)?meal.kcal:calculated.length?calculated.reduce((sum,item)=>sum+item.kcal,0):null;
  const confidences=components.map(item=>normalizeConfidence(item.confidence)).filter(value=>value!=="none");
  let confidence=normalizeConfidence(meal.confidence);
  if(confidence==="none"&&confidences.length) confidence=confidences.sort((a,b)=>confidenceRank[a]-confidenceRank[b])[0];
  return {
    ...meal,
    label:meal.label||mealLabels[meal.key]||"Pasto",
    kcal,
    confidence,
    components,
    unresolvedCount:unresolved.length,
    estimatedCount:estimated.length
  };
}

function deriveDay(day={}){
  const meals=(Array.isArray(day.meals)?day.meals:[]).map(deriveMeal);
  const mealKcal=meals.filter(item=>finite(item.kcal));
  const kcal=finite(day.kcal)?day.kcal:mealKcal.length?mealKcal.reduce((sum,item)=>sum+item.kcal,0):null;
  const unresolvedCount=meals.reduce((sum,item)=>sum+item.unresolvedCount,0);
  const estimatedCount=meals.reduce((sum,item)=>sum+item.estimatedCount,0);
  const calculatedMeals=meals.filter(item=>finite(item.kcal)).length;
  let confidence=normalizeConfidence(day.confidence);
  if(confidence==="none"){
    if(!calculatedMeals) confidence="none";
    else if(unresolvedCount) confidence="low";
    else if(meals.some(item=>item.confidence==="low")) confidence="low";
    else if(meals.some(item=>item.confidence==="medium")) confidence="medium";
    else confidence="high";
  }
  const valid=day.valid!==false&&meals.length>0;
  return {...day,meals,kcal,confidence,unresolvedCount,estimatedCount,calculatedMeals,valid};
}

function noteForDay(day){
  if(!day.valid||!finite(day.kcal)) return "Dati insufficienti";
  if(day.unresolvedCount===0&&day.estimatedCount===0) return "Tutti gli alimenti riconosciuti";
  const notes=[];
  if(day.estimatedCount) notes.push(`${day.estimatedCount} ${day.estimatedCount===1?"alimento stimato":"alimenti stimati"}`);
  if(day.unresolvedCount) notes.push(`${day.unresolvedCount} ${day.unresolvedCount===1?"alimento non interpretato":"alimenti non interpretati"}`);
  return notes.join(" · ");
}

export function getDiaryViewModel(data,{selectedDate=null}={}){
  const rawDays=Array.isArray(data?.diary?.days)?data.diary.days:[];
  const days=rawDays.map(deriveDay).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const selected=days.find(item=>item.date===selectedDate)||days.find(item=>item.valid)||days[0]||null;
  const withCalories=days.filter(item=>finite(item.kcal));
  const average=withCalories.length?Math.round(withCalories.reduce((sum,item)=>sum+item.kcal,0)/withCalories.length):null;
  const confidenceValues=withCalories.map(item=>confidenceRank[item.confidence]??0);
  const averageConfidence=confidenceValues.length?confidenceValues.reduce((sum,value)=>sum+value,0)/confidenceValues.length:0;
  const confidence=averageConfidence>=2.7?"high":averageConfidence>=1.7?"medium":averageConfidence>0?"low":"none";
  const dates=days.map(item=>item.date).filter(Boolean).sort();
  return {
    days:days.map(day=>({...day,note:noteForDay(day),kcalText:formatKcal(day.kcal)})),
    selected:selected?{...selected,note:noteForDay(selected),kcalText:formatKcal(selected.kcal)}:null,
    summary:{
      average,
      averageText:average==null?"—":`≈ ${formatKcal(average)}`,
      daysCount:withCalories.length,
      confidence
    },
    range:dates.length?{from:dates[0],to:dates.at(-1)}:null
  };
}
