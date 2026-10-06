const number=value=>{
  const parsed=typeof value==="string"?Number(value.replace(",",".")):Number(value);
  return Number.isFinite(parsed)?parsed:null;
};

const round=(value,digits=1)=>{
  if(!Number.isFinite(value)) return null;
  const factor=10**digits;
  return Math.round(value*factor)/factor;
};

export function normalizeCalorieText(value){
  return String(value??"")
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[’‘]/g,"'")
    .replace(/(\d)\s*(grammi|grammo|gr)\b/g,"$1 g")
    .replace(/(\d)\s*(millilitri|millilitro)\b/g,"$1 ml")
    .replace(/[,.:()\[\]{}]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

const withoutLeadingQuantity=value=>normalizeCalorieText(value)
  .replace(/^\s*(?:\d+(?:[.,]\d+)?|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s*(?:g|ml|fetta|fette|cucchiaino|cucchiaini|cucchiaio|cucchiai|vasetto|vasetti|porzione|porzioni|pezzo|pezzi|bicchiere|bicchieri|bottiglia|bottiglie|lattina|lattine|biscotto|biscotti|tazzina|tazzine|tazza|tazze|scatoletta|scatolette)?\s*(?:di\s+)?/,"")
  .replace(/^(?:un|una)\s+(?:po'?|filo|piatto|manciata)\s+(?:di\s+|d')?/,"")
  .replace(/^qualche\s+/,"")
  .trim();

const words={un:1,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10};
const quantityNumber=value=>{
  const normalized=normalizeCalorieText(value);
  const match=normalized.match(/^(\d+(?:[.,]\d+)?|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/);
  if(!match) return null;
  return words[match[1]]??number(match[1]);
};

const singularVariants=value=>{
  const base=normalizeCalorieText(value);
  const parts=base.split(" ");
  const last=parts.at(-1);
  const variants=new Set([base]);
  const swap=replacement=>variants.add([...parts.slice(0,-1),replacement].join(" "));
  if(last?.endsWith("i")&&last.length>3) swap(last.slice(0,-1)+"o");
  if(last?.endsWith("e")&&last.length>3) swap(last.slice(0,-1)+"a");
  return [...variants];
};

function nutrientFromPayload(payload,patterns){
  const nutrients=Array.isArray(payload?.nutrients)?payload.nutrients:[];
  const found=nutrients.find(item=>patterns.some(pattern=>normalizeCalorieText(item?.name).startsWith(pattern)));
  return number(found?.per_100g);
}

export function catalogFoodFromRow(row){
  const names=[row?.name,...(Array.isArray(row?.names)?row.names:[])].filter(Boolean);
  const aliases=[...new Set(names.flatMap(name=>singularVariants(name)))];
  const payload=row?.source_payload??row?.sourcePayload??null;
  return {
    source:row?.source??"NUBEMO",
    sourceCode:row?.source_code??row?.sourceCode??row?.id??null,
    label:row?.name??names[0]??"",
    aliases,
    kcal100:number(row?.kcal_100g??row?.kcal100),
    portionGrams:number(row?.crea_portion_g??row?.portionGrams),
    portionKcal:number(row?.crea_portion_kcal??row?.nubemo_portion_kcal??row?.portionKcal),
    genericUnits:row?.nubemo_generic_units??row?.genericUnits??{},
    macros100:{
      protein_g:number(row?.protein_g??row?.protein100)??nutrientFromPayload(payload,["proteine"]),
      carbs_g:number(row?.carbs_g??row?.carbs100)??nutrientFromPayload(payload,["carboidrati disponibili","carboidrati"]),
      fat_g:number(row?.fat_g??row?.fat100)??nutrientFromPayload(payload,["lipidi","grassi"])
    }
  };
}

const defaultFamilies=[
  {key:"olive",aliases:["oliva","olive"],preferred:["olive da tavola conservate"],terms:["olive","oliva"]}
];

const explicitAliases={
  "olio extravergine":"olio di oliva extra vergine",
  "olio extravergine di oliva":"olio di oliva extra vergine",
  "evo":"olio di oliva extra vergine",
  "mele":"mela",
  "pomodori":"pomodoro",
  "uova":"uovo"
};

function buildIndex(rows,{aliases={},families=defaultFamilies}={}){
  const foods=rows.map(catalogFoodFromRow).filter(food=>food.label);
  const exact=new Map();
  for(const food of foods){
    for(const alias of food.aliases){
      if(!exact.has(alias)) exact.set(alias,[]);
      exact.get(alias).push(food);
    }
  }
  const aliasMap=new Map(Object.entries({...explicitAliases,...aliases}).map(([from,to])=>[normalizeCalorieText(from),normalizeCalorieText(to)]));
  return {foods,exact,aliasMap,families};
}

function uniqueFood(items){
  const map=new Map();
  for(const item of items) map.set(item.sourceCode??`${item.source}:${item.label}`,item);
  return [...map.values()];
}

function exactFood(index,key){
  const found=uniqueFood(index.exact.get(key)??[]);
  return found.length===1?found[0]:null;
}

function findByContains(index,key){
  const candidates=[];
  for(const food of index.foods){
    for(const alias of food.aliases){
      if(alias.length<4) continue;
      if(key===alias||key.includes(alias)||alias.includes(key)){
        candidates.push({food,alias,score:key===alias?100:Math.min(key.length,alias.length)/Math.max(key.length,alias.length)*80});
      }
    }
  }
  candidates.sort((a,b)=>b.score-a.score||b.alias.length-a.alias.length);
  if(!candidates.length) return null;
  if(candidates[1]&&Math.abs(candidates[0].score-candidates[1].score)<2&&candidates[0].food.sourceCode!==candidates[1].food.sourceCode) return null;
  return candidates[0].score>=62?candidates[0].food:null;
}

export function resolveCalorieFood(segment,rows,options={}){
  const index=options.index??buildIndex(rows,options);
  const raw=withoutLeadingQuantity(segment);
  if(!raw) return {food:null,matchType:"unresolved",query:""};

  for(const variant of singularVariants(raw)){
    const direct=exactFood(index,variant);
    if(direct) return {food:direct,matchType:"exact",query:variant};
  }

  const aliasTarget=index.aliasMap.get(raw);
  if(aliasTarget){
    const food=exactFood(index,aliasTarget)??findByContains(index,aliasTarget);
    if(food) return {food,matchType:"alias",query:aliasTarget};
  }

  for(const family of index.families){
    const aliases=family.aliases.map(normalizeCalorieText);
    if(!aliases.includes(raw)) continue;
    const preferred=family.preferred.map(normalizeCalorieText);
    const food=index.foods.find(item=>item.aliases.some(alias=>preferred.includes(alias)))
      ??index.foods.find(item=>item.aliases.some(alias=>family.terms.some(term=>alias.includes(normalizeCalorieText(term)))));
    if(food) return {food:{...food,familyKey:family.key},matchType:"family",query:raw};
  }

  const contained=findByContains(index,raw);
  if(contained) return {food:contained,matchType:"fuzzy",query:raw};
  return {food:null,matchType:"unresolved",query:raw};
}

const householdUnits={
  fetta:["fetta","fette"],cucchiaino:["cucchiaino","cucchiaini"],cucchiaio:["cucchiaio","cucchiai"],
  vasetto:["vasetto","vasetti"],porzione:["porzione","porzioni"],pezzo:["pezzo","pezzi"],
  bicchiere:["bicchiere","bicchieri"],bottiglia:["bottiglia","bottiglie"],lattina:["lattina","lattine"],
  biscotto:["biscotto","biscotti"],tazzina:["tazzina","tazzine"],tazza:["tazza","tazze"],scatoletta:["scatoletta","scatolette"]
};
const unitCanonical=new Map(Object.entries(householdUnits).flatMap(([canonical,forms])=>forms.map(form=>[form,canonical])));

function genericGrams(food,unit){
  const generic=food?.genericUnits??{};
  for(const [key,value] of Object.entries(generic)){
    if(unitCanonical.get(normalizeCalorieText(key))===unit||normalizeCalorieText(key)===unit) return number(value);
  }
  return null;
}

export function resolveCalorieQuantity(segment,food,{estimatedQuantities={}}={}){
  const raw=normalizeCalorieText(segment);
  let match=raw.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/);
  if(match){
    const value=number(match[1]);
    return {value,unit:match[2],grams:value,origin:"explicit"};
  }

  match=raw.match(/^(\d+(?:[.,]\d+)?|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s+(?:di\s+)?(fetta|fette|cucchiaino|cucchiaini|cucchiaio|cucchiai|vasetto|vasetti|porzione|porzioni|pezzo|pezzi|bicchiere|bicchieri|bottiglia|bottiglie|lattina|lattine|biscotto|biscotti|tazzina|tazzine|tazza|tazze|scatoletta|scatolette)\b/);
  if(match){
    const count=words[match[1]]??number(match[1]);
    const unit=unitCanonical.get(match[2])??match[2];
    const perUnit=genericGrams(food,unit);
    if(perUnit) return {value:count,unit,grams:round(count*perUnit,1),origin:"conversion"};
    if(food?.portionGrams&&["porzione","pezzo","vasetto","scatoletta"].includes(unit)) return {value:count,unit,grams:round(count*food.portionGrams,1),origin:"standard"};
    if(food?.portionKcal) return {value:count,unit,grams:null,origin:"standard",portionCalories:round(count*food.portionKcal,1)};
    return {value:count,unit,grams:null,origin:"unresolved"};
  }

  const count=quantityNumber(raw);
  if(count&&count<=10){
    if(food?.portionGrams) return {value:count,unit:"porzione",grams:round(count*food.portionGrams,1),origin:"standard"};
    if(food?.portionKcal) return {value:count,unit:"porzione",grams:null,origin:"standard",portionCalories:round(count*food.portionKcal,1)};
  }

  const estimatedKey=Object.keys(estimatedQuantities).find(key=>raw.includes(normalizeCalorieText(key)));
  if(estimatedKey){
    const grams=number(estimatedQuantities[estimatedKey]);
    if(grams) return {value:1,unit:estimatedKey,grams,origin:"estimated"};
  }

  return null;
}

function calculateNutrients(food,quantity){
  if(!food||!quantity) return null;
  if(Number.isFinite(quantity.portionCalories)&&!Number.isFinite(quantity.grams)){
    return {kcal:round(quantity.portionCalories,0),protein_g:null,carbs_g:null,fat_g:null};
  }
  if(!Number.isFinite(quantity.grams)) return null;
  const factor=quantity.grams/100;
  const nutrient=value=>Number.isFinite(value)?round(value*factor,1):null;
  return {
    kcal:Number.isFinite(food.kcal100)?round(food.kcal100*factor,0):null,
    protein_g:nutrient(food.macros100?.protein_g),
    carbs_g:nutrient(food.macros100?.carbs_g),
    fat_g:nutrient(food.macros100?.fat_g)
  };
}

function componentConfidence(matchType,quantity){
  if(matchType==="unresolved") return "unresolved";
  if(matchType==="family"||quantity?.origin==="estimated") return "low";
  if(quantity?.origin==="explicit"&&["exact","alias"].includes(matchType)) return "high";
  if(quantity?.origin==="conversion"||quantity?.origin==="standard") return "medium";
  return "low";
}

export function segmentCalorieText(text){
  const protectedText=String(text??"").replace(/\r/g,"");
  const first=protectedText.split(/\n|;|\s+\+\s+/).map(item=>item.trim()).filter(Boolean);
  const output=[];
  for(const item of first){
    const commaParts=item.split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
    for(const commaPart of commaParts){
      const conjunctions=commaPart.split(/\s+(?:con|e)\s+/i).map(x=>x.trim()).filter(Boolean);
      output.push(...conjunctions);
    }
  }
  return output;
}

function totalsFromComponents(components){
  const keys=["kcal","protein_g","carbs_g","fat_g"];
  const totals={};
  for(const key of keys){
    const values=components.map(item=>item.nutrients?.[key]).filter(Number.isFinite);
    totals[key]=values.length?round(values.reduce((sum,value)=>sum+value,0),key==="kcal"?0:1):null;
  }
  return totals;
}

function overallConfidence(components){
  if(!components.length||components.every(item=>item.confidence==="unresolved")) return "none";
  const resolved=components.filter(item=>item.confidence!=="unresolved");
  if(components.some(item=>item.confidence==="unresolved")) return "low";
  if(resolved.some(item=>item.confidence==="low")) return "low";
  if(resolved.some(item=>item.confidence==="medium")) return "medium";
  if(resolved.every(item=>item.confidence==="high")) return "high";
  return "low";
}

export function analyzeCalorieText(text,rows,options={}){
  const index=buildIndex(rows,options);
  const segments=segmentCalorieText(text);
  const components=segments.map(originalText=>{
    const resolved=resolveCalorieFood(originalText,rows,{...options,index});
    if(!resolved.food) return {originalText,food:null,quantity:null,nutrients:null,confidence:"unresolved",status:"unresolved"};
    const quantity=resolveCalorieQuantity(originalText,resolved.food,options);
    const nutrients=calculateNutrients(resolved.food,quantity);
    const confidence=componentConfidence(resolved.matchType,quantity);
    return {
      originalText,
      food:{source:resolved.food.source,sourceCode:resolved.food.sourceCode,label:resolved.food.label,matchType:resolved.matchType,familyKey:resolved.food.familyKey??null},
      quantity,
      nutrients,
      confidence,
      status:nutrients?.kcal!=null?"calculated":quantity?"recognized-quantity":"recognized-no-quantity"
    };
  });
  const resolved=components.filter(item=>item.food).length;
  const calculated=components.filter(item=>item.nutrients?.kcal!=null).length;
  return {
    originalText:String(text??""),
    components,
    totals:totalsFromComponents(components),
    coverage:{resolved,calculated,unresolved:components.length-resolved,total:components.length},
    confidence:overallConfidence(components),
    approximate:components.some(item=>["family","fuzzy"].includes(item.food?.matchType)||["conversion","standard","estimated"].includes(item.quantity?.origin))
  };
}

export function createCalorieEngine(rows,options={}){
  const safeRows=Array.isArray(rows)?rows:[];
  return {
    analyze:text=>analyzeCalorieText(text,safeRows,options),
    resolveFood:text=>resolveCalorieFood(text,safeRows,options),
    segment:segmentCalorieText
  };
}
