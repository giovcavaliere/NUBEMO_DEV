// Calcolo calorie già presente in NUBEMO, riutilizzato senza modificare il layout demo.


function calorieNormalize(s){
 return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}
const PIZZA_STANDARD_GRAMS=300;
const PIZZA_TOPPING_STANDARD_GRAMS={salsiccia:50};
function calorieSegments(text){
 const base=String(text||'').replace(/\r/g,'').split(/\n|[;]+/).map(x=>x.trim()).filter(Boolean);
 const out=[];
 let pizzaGroupSeq=0;
 for(const rawSegment of base){
   // First preserve the user's natural composition. A pizza written with
   // "+" or "con" is one logical food for the review UI, while its parts
   // remain separate internally for the calorie calculation.
   const plusParts=rawSegment.split(/\s+\+\s+/).map(x=>x.trim()).filter(Boolean);
   const hasPizza=plusParts.some(x=>calorieNormalize(x).includes('pizza')) || calorieNormalize(rawSegment).includes('pizza');
   let parts=plusParts;
   if(hasPizza && plusParts.length===1 && /\s+con\s+/i.test(rawSegment)){
     parts=rawSegment.split(/\s+con\s+/i).map(x=>x.trim()).filter(Boolean);
   }
   if(hasPizza && parts.length>1){
     const groupId=`pizza-${++pizzaGroupSeq}`;
     parts.forEach((part,index)=>out.push({text:part,compositionGroup:groupId,compositionRole:index===0?'pizza':'topping'}));
   }else{
     parts.forEach(part=>out.push({text:part,compositionGroup:null,compositionRole:null}));
   }
 }
 return out;
}

function findCalorieFood(segment){
 const crea=window.nubemoFoodCatalog.findCrea(segment);
 const s=calorieNormalize(segment);
 let matches=[];
 for(const food of PATIENT_CALORIE_FOODS){
   for(const name of food.names){
     const idx=s.indexOf(name);
     if(idx>=0)matches.push({...food,matchedName:name,matchIndex:idx});
   }
 }
 matches.sort((a,b)=>a.matchIndex-b.matchIndex || b.matchedName.length-a.matchedName.length);
 const nubemo=matches[0]||null;
 return crea && window.nubemoFoodCatalog.canUseCrea(segment,crea,nubemo) ? crea : nubemo;
}
function parseSegmentCalories(segment){
 const raw=calorieNormalize(segment),food=findCalorieFood(raw);
 if(!food)return {segment,status:'unknown',calories:0,label:segment};

 // Precise units: grams / ml
 let m=raw.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grammi|ml)\b/i);
 if(m){
   const qty=Number(m[1].replace(',','.'));
   if(Number.isFinite(qty)&&qty>0&&food.k100)
     return {segment,status:'calculated',calories:Math.round(qty*food.k100/100),label:food.matchedName,quantity:`${qty} ${m[2]}`};
 }

 // Household/generic units: slices, spoons, jars...
 m=raw.match(/(\d+(?:[.,]\d+)?)\s*(fetta|fette|cucchiaino|cucchiaini|cucchiaio|cucchiai|vasetto|vasetti|porzione|porzioni|pezzo|pezzi|bicchiere|bicchieri|bottiglia|bottiglie|lattina|lattine|biscotto|biscotti|tazzina|tazzine|tazza|tazze)\b/i);
 if(m){
   const qty=Number(m[1].replace(',','.'));
   const unit=m[2].toLowerCase();
   if(Number.isFinite(qty)&&qty>0){
     if(food.generic && food.generic[unit] && food.k100){
       const grams=qty*food.generic[unit];
       return {
         segment,
         status:'genericQuantity',
         calories:Math.round(grams*food.k100/100),
         label:food.matchedName,
         quantity:`${qty} ${unit}`,
         assumedGrams:Math.round(grams)
       };
     }
     // Quantity exists but we do not know a safe conversion for this food.
     return {segment,status:'genericQuantityNoEstimate',calories:0,label:food.matchedName,quantity:`${qty} ${unit}`};
   }
 }

 // Countable foods such as 1 banana, 2 uova, 1 yogurt.
 m=raw.match(/^(\d+(?:[.,]\d+)?)\s+(?:di\s+)?/i);
 if(m&&!/\b(g|gr|grammi|ml)\b/i.test(raw)){
   const qty=Number(m[1].replace(',','.'));
   if(Number.isInteger(qty)&&qty>0&&qty<=10&&food.portionKcal)
     return {segment,status:'genericQuantity',calories:Math.round(qty*food.portionKcal),label:food.matchedName,quantity:`${qty} porz.`};
   if(qty>=10&&food.k100)
     return {segment,status:'calculated',calories:Math.round(qty*food.k100/100),label:food.matchedName,quantity:`${qty} g*`};
 }

 // Pizza is normally recorded as a whole item, not weighed. When no
 // quantity is supplied, use a transparent standard weight. Explicit grams
 // above always take precedence.
 if(food.names.some(name=>name.startsWith('pizza')) && food.k100){
   return {segment,status:'genericQuantity',calories:Math.round(PIZZA_STANDARD_GRAMS*food.k100/100),label:food.matchedName,quantity:'1 pizza',assumedGrams:PIZZA_STANDARD_GRAMS};
 }
 // Standard topping quantity, currently used for natural pizza additions.
 const toppingGrams=PIZZA_TOPPING_STANDARD_GRAMS[food.matchedName];
 if(toppingGrams&&food.k100){
   return {segment,status:'genericQuantity',calories:Math.round(toppingGrams*food.k100/100),label:food.matchedName,quantity:'1 aggiunta',assumedGrams:toppingGrams};
 }

 return {segment,status:'missingQuantity',calories:0,label:food.matchedName};
}
function calorieEstimateText(text){
 const items=calorieSegments(text).map(part=>({...parseSegmentCalories(part.text),compositionGroup:part.compositionGroup,compositionRole:part.compositionRole}));
 return {
   calories:items.reduce((s,x)=>s+x.calories,0),
   calculated:items.filter(x=>x.status==='calculated').length,
   genericQuantity:items.filter(x=>x.status==='genericQuantity').length,
   genericQuantityNoEstimate:items.filter(x=>x.status==='genericQuantityNoEstimate').length,
   missingQuantity:items.filter(x=>x.status==='missingQuantity').length,
   unknown:items.filter(x=>x.status==='unknown').length,
   total:items.length,
   items
 };
}
function calorieEstimateDay(entry){
 const results=['breakfast','snack1','lunch','snack2','dinner'].map(k=>calorieEstimateText(entry?.[k]||''));
 const r={
   calories:results.reduce((s,x)=>s+x.calories,0),
   calculated:results.reduce((s,x)=>s+x.calculated,0),
   genericQuantity:results.reduce((s,x)=>s+x.genericQuantity,0),
   genericQuantityNoEstimate:results.reduce((s,x)=>s+x.genericQuantityNoEstimate,0),
   missingQuantity:results.reduce((s,x)=>s+x.missingQuantity,0),
   unknown:results.reduce((s,x)=>s+x.unknown,0),
   total:results.reduce((s,x)=>s+x.total,0),
   items:results.flatMap(x=>x.items)
 };
 const usable=r.calculated+r.genericQuantity;
 if(!r.total||!usable){r.quality='none';r.qualityLabel='Non disponibile'}
 else if(r.unknown===0&&r.missingQuantity===0&&r.genericQuantity===0&&r.genericQuantityNoEstimate===0){r.quality='good';r.qualityLabel='Buona'}
 else{r.quality='partial';r.qualityLabel='Parziale'}
 return r;
}

export {calorieEstimateDay,calorieEstimateText};
