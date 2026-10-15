// Logica del riepilogo di verifica recuperata da NUBEMO, per il Diario Patient 2.0.
function calorieIssueLabels(items,status){
 return [...new Set(
   (items||[])
     .filter(x=>x.status===status)
     .map(x=>String(x.label||x.segment||'').trim())
     .filter(Boolean)
 )];
}

export function calorieReviewMessage(estimate){
 const missing=calorieIssueLabels(estimate.items,'missingQuantity');
 const unknown=calorieIssueLabels(estimate.items,'unknown');
 const genericItems=estimate.items.filter(x=>x.status==='genericQuantity');
 const usableItems=estimate.items.filter(x=>x.status==='calculated'||x.status==='genericQuantity');
 const groupedPizzaIds=new Set(usableItems.filter(x=>x.compositionGroup&&x.compositionRole==='pizza').map(x=>x.compositionGroup));
 const groupedItemSet=new Set(usableItems.filter(x=>x.compositionGroup&&groupedPizzaIds.has(x.compositionGroup)));
 const standaloneGeneric=genericItems.filter(x=>!groupedItemSet.has(x));
 const standalonePizza=standaloneGeneric.filter(x=>x.quantity==='1 pizza');
 const generic=standaloneGeneric.filter(x=>x.quantity!=='1 pizza').map(x=>`${x.label} — ${x.quantity}`).filter(Boolean);
 const pizzaEstimates=[...groupedPizzaIds].map(id=>{
   const parts=usableItems.filter(x=>x.compositionGroup===id);
   const pizza=parts.find(x=>x.compositionRole==='pizza');
   const toppings=parts.filter(x=>x.compositionRole==='topping');
   if(!pizza)return '';
   const toppingText=toppings.map(x=>x.status==='calculated'?`${x.quantity} di ${x.label}`:`aggiunta di ${x.label}`);
   return `${pizza.quantity} ${pizza.label}${toppingText.length?' + '+toppingText.join(' + '):''}`;
 }).filter(Boolean);
 pizzaEstimates.push(...standalonePizza.map(x=>`${x.quantity} ${x.label}`));
 const genericNo=estimate.items.filter(x=>x.status==='genericQuantityNoEstimate').map(x=>`${x.label} — ${x.quantity}`).filter(Boolean);
 const lines=[];
 const usableRaw=estimate.calculated+estimate.genericQuantity;
 const groupedExtras=usableItems.filter(x=>x.compositionGroup&&x.compositionRole==='topping'&&groupedPizzaIds.has(x.compositionGroup)).length;
 const usable=Math.max(0,usableRaw-groupedExtras);

 if(estimate.quality==='good'){
   lines.push(`Stima giornata: ${estimate.calories} kcal`,`✓ ${usable} alimenti calcolati`,'Qualità stima: buona');
 }else if(estimate.quality==='partial'){
   lines.push(`Stima parziale: ${estimate.calories} kcal`,`✓ ${usable} alimenti calcolati`);
   if(unknown.length)lines.push(`⚠️ Alimenti non riconosciuti: ${unknown.join(', ')}`);
   if(missing.length)lines.push(`⚠️ Senza quantità: ${missing.join(', ')}`);
   if(pizzaEstimates.length)lines.push(`ℹ️ Quantità stimate: ${pizzaEstimates.join(', ')}`);
   if(generic.length)lines.push(`⚠️ Quantità generica: ${generic.join(', ')}`);
   if(genericNo.length)lines.push(`⚠️ Quantità generica non stimabile: ${genericNo.join(', ')}`);
 }else{
   lines.push('Stima calorie non disponibile.');
   if(unknown.length)lines.push(`⚠️ Alimenti non riconosciuti: ${unknown.join(', ')}`);
   if(missing.length)lines.push(`⚠️ Senza quantità: ${missing.join(', ')}`);
   if(genericNo.length)lines.push(`⚠️ Quantità generica non stimabile: ${genericNo.join(', ')}`);
 }
 return lines.join('\n');
}

