import test from "node:test";
import assert from "node:assert/strict";
import {analyzeCalorieText,normalizeCalorieText,segmentCalorieText,catalogFoodFromRow} from "../professional-v2/calorie-engine-v2.js";

const row=(name,{code=name,kcal=100,portion=100,aliases=[],generic={},protein=10,carbs=10,fat=10}={})=>({
  source:"CREA",source_code:code,name,names:[name,...aliases],kcal_100g:kcal,crea_portion_g:portion,nubemo_generic_units:generic,
  source_payload:{nutrients:[
    {name:"Proteine (g)",per_100g:protein},
    {name:"Carboidrati disponibili (g)",per_100g:carbs},
    {name:"Lipidi (g)",per_100g:fat}
  ]}
});

const catalog=[
  row("Pasta",{aliases:["pasta al pomodoro"]}),
  row("Petto di pollo",{aliases:["pollo"]}),
  row("Olio di oliva extra vergine",{code:"009210",kcal:899,portion:null,generic:{cucchiaio:10,cucchiaino:5},aliases:["olio","olio extravergine"]}),
  row("Olive da tavola conservate",{code:"008800",kcal:277,portion:30,aliases:["olive da tavola"]}),
  row("Olive, nere",{code:"008810",kcal:243,portion:30}),
  row("Olive, verdi",{code:"008820",kcal:148,portion:30}),
  row("Olive, verdi, in salamoia",{code:"008830",kcal:113,portion:30}),
  row("Yogurt greco",{generic:{vasetto:150},aliases:["yogurt"]}),
  row("Biscotti",{aliases:["biscotto"]}),
  row("Tonno",{portion:80,aliases:["tonno in scatola"]}),
  row("Pane",{generic:{fetta:30},aliases:["pane integrale"]}),
  row("Uovo",{portion:50,aliases:["uova"]}),
  row("Banana",{portion:120}),
  row("Mandorle",{portion:30}),
  row("Pizza margherita",{portion:300}),
  row("Salsiccia",{portion:50}),
  row("Insalata",{portion:null}),
  row("Pomodoro",{portion:null,aliases:["pomodori"]}),
  row("Cereali",{portion:null}),
  row("Toast",{portion:80}),
  row("Prosciutto",{portion:null}),
  row("Formaggio",{portion:null}),
  row("Patatine",{portion:null}),
  row("Riso",{portion:null,aliases:["riso basmati"]}),
  row("Verdure",{portion:null,aliases:["verdure saltate"]}),
  row("Latte parzialmente scremato",{aliases:["latte"]}),
  row("Bresaola"),
  row("Parmigiano"),
  row("Salmone affumicato"),
  row("Patate al forno"),
  row("Mozzarella"),
  row("Basilico",{portion:null}),
  row("Caffe",{portion:30}),
  row("Zucchero",{generic:{cucchiaino:5}}),
  row("Mela",{aliases:["mele"]})
];

const options={
  aliases:{"olive verdi":"olive verdi","olive nere":"olive nere","pomodori":"pomodoro","mele":"mela"},
  estimatedQuantities:{"una manciata":30,"qualche oliva":20,"un filo":5,"un piatto":100,"un po":50}
};

test("normalization handles accents, punctuation and compact gram units",()=>{
  assert.equal(normalizeCalorieText("30gr di Olivé, verdi"),"30 g di olive verdi");
});

test("CREA payload exposes macros without new database columns",()=>{
  const food=catalogFoodFromRow(row("Test",{protein:12.3,carbs:45.6,fat:7.8}));
  assert.deepEqual(food.macros100,{protein_g:12.3,carbs_g:45.6,fat_g:7.8});
});

test("natural separators produce independent components",()=>{
  assert.deepEqual(segmentCalorieText("80 g pasta, 120 g pollo + 10 g olio\n30 g olive"),["80 g pasta","120 g pollo","10 g olio","30 g olive"]);
});

test("explicit quantities calculate kcal and macros from catalog only",()=>{
  const result=analyzeCalorieText("80 g pasta + 120 g pollo + 10 g olio",catalog,options);
  assert.equal(result.coverage.calculated,3);
  assert.equal(result.components[0].quantity.grams,80);
  assert.equal(result.components[0].confidence,"high");
  assert.ok(result.totals.kcal>0);
  assert.ok(result.totals.protein_g>0);
});

test("olive variants resolve specific CREA rows despite official punctuation",()=>{
  const green=analyzeCalorieText("30gr olive verdi",catalog,options);
  const black=analyzeCalorieText("30 grammi di olive nere",catalog,options);
  const brine=analyzeCalorieText("olive verdi in salamoia 30 g",catalog,options);
  assert.equal(green.components[0].food.sourceCode,"008820");
  assert.equal(black.components[0].food.sourceCode,"008810");
  assert.equal(brine.components[0].food.sourceCode,"008830");
  assert.equal(green.components[0].confidence,"high");
});

test("generic olives use the explicit family fallback and remain low confidence",()=>{
  const result=analyzeCalorieText("30 g olive",catalog,options);
  assert.equal(result.components[0].food.matchType,"family");
  assert.equal(result.components[0].food.sourceCode,"008800");
  assert.equal(result.components[0].confidence,"low");
  assert.equal(result.approximate,true);
});

test("unknown components do not invalidate calculated components",()=>{
  const result=analyzeCalorieText("80 g pasta + 120 g pollo + salsa della nonna",catalog,options);
  assert.equal(result.coverage.calculated,2);
  assert.equal(result.coverage.unresolved,1);
  assert.ok(result.totals.kcal>0);
  assert.equal(result.components[2].status,"unresolved");
});

test("household units only calculate when a documented conversion exists",()=>{
  const oil=analyzeCalorieText("1 cucchiaio di olio extravergine",catalog,options);
  const bread=analyzeCalorieText("2 fette di pane",catalog,options);
  assert.equal(oil.components[0].quantity.origin,"conversion");
  assert.equal(oil.components[0].quantity.grams,10);
  assert.equal(bread.components[0].quantity.grams,60);
  assert.equal(oil.components[0].confidence,"medium");
});

test("unconfigured vague quantities never invent grams",()=>{
  const withoutRules=analyzeCalorieText("una manciata di mandorle",catalog,{});
  assert.equal(withoutRules.components[0].quantity,null);
  assert.equal(withoutRules.components[0].nutrients,null);
  const configured=analyzeCalorieText("una manciata di mandorle",catalog,options);
  assert.equal(configured.components[0].quantity.origin,"estimated");
  assert.equal(configured.components[0].confidence,"low");
});

test("multi-food natural phrases keep recognizable parts instead of all-or-nothing failure",()=>{
  const result=analyzeCalorieText("insalata con 100 g tonno, pomodori, 10 g olio e 30 g olive verdi",catalog,options);
  assert.equal(result.coverage.resolved,5);
  assert.equal(result.coverage.calculated,3);
  assert.equal(result.coverage.unresolved,0);
  assert.equal(result.components.at(-1).food.sourceCode,"008820");
});


test("identical exact names from CREA and NUBEMO resolve deterministically to CREA",()=>{
  const duplicate=[
    row("Tonno",{code:"CREA-TONNO"}),
    {...row("Tonno",{code:"NUBEMO-TONNO"}),source:"NUBEMO"}
  ];
  const result=analyzeCalorieText("100 g tonno",duplicate,{});
  assert.equal(result.components[0].food.source,"CREA");
  assert.equal(result.components[0].food.sourceCode,"CREA-TONNO");
});

test("catalog-aware analysis preserves an exact composite food before splitting conjunctions",()=>{
  const composite=[row("toast prosciutto e formaggio",{portion:100}),row("toast"),row("prosciutto"),row("formaggio")];
  const result=analyzeCalorieText("due toast prosciutto e formaggio",composite,{});
  assert.equal(result.components.length,1);
  assert.equal(result.components[0].food.label,"toast prosciutto e formaggio");
});

test("one unresolved component downgrades the overall confidence without discarding valid totals",()=>{
  const result=analyzeCalorieText("80 g pasta + 120 g pollo + salsa della nonna",catalog,options);
  assert.equal(result.confidence,"low");
  assert.equal(result.coverage.calculated,2);
  assert.ok(result.totals.kcal>0);
});
