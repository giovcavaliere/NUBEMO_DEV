const KEY='diario-pro-patient-main-v1';
const PROFILE_KEY='diario-pro-profile-main-v1';
const MEASURE_KEY='diario-pro-measures-main-v1';
const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
const ACCOUNT_KEY='diario-pro-accounts-v1';
const ACTIVE_PATIENT_KEY='diario-pro-active-patient-v1';
const PENDING_LABS_KEY='diario-pro-pending-labs-v1';
let page='home';
let editDate=null;
let coffee=0;
let trendDays=30;
let duplicateDraft=null;
let duplicateSource=null;
let importText='';
let importPreview=null;
let historySearch='';
let showMovingAverage=false;
let bmiDays=30;
let measuresCompleteOnly=false;

const $=s=>document.querySelector(s);
const rawExtraPatients=()=>{try{return JSON.parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]')}catch(e){return []}};
const activePatientId=()=>localStorage.getItem(ACTIVE_PATIENT_KEY)||'';
const activeExtraPatient=()=>rawExtraPatients().find(p=>p.id===activePatientId())||null;
const accountMap=()=>{try{return JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'{}')||{}}catch(e){return {}}};
const load=()=>{
 const id=activePatientId();if(id&&id!=='main'){const p=activeExtraPatient();return Array.isArray(p?.diary)?JSON.parse(JSON.stringify(p.diary)):[]}
 return JSON.parse(localStorage.getItem(KEY)||'[]');
};
const save=d=>{
 const id=activePatientId();if(id&&id!=='main'){const arr=rawExtraPatients(),i=arr.findIndex(p=>p.id===id);if(i<0)return;arr[i]={...arr[i],diary:d,weights:d.filter(x=>x.weight!==''&&x.weight!=null).map(x=>[x.date,Number(x.weight)])};localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(arr));return}
 localStorage.setItem(KEY,JSON.stringify(d));
};
const loadProfile=()=>{
 let p={},id=activePatientId();
 if(id&&id!=='main')p=activeExtraPatient()||{};else{try{p=JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')||{}}catch(e){p={}}}
 const num=k=>p[k]===undefined||p[k]===null||p[k]===''?'':Number(p[k]);
 let first=p.firstName||p.name||'',surname=p.surname||'';
 if(id&&id!=='main'&&!p.firstName&&p.name){const parts=String(p.name).trim().split(/\s+/);first=parts.shift()||'';surname=surname||parts.join(' ')}
 return {name:first,surname,birth:p.birth||'',height:num('height'),sex:p.sex||'',goal:num('goal'),nextVisit:p.nextVisit||'',minWeight:num('minWeight'),maxWeight:num('maxWeight'),reasonableWeight:num('reasonableWeight'),work:p.work||'',activity:p.activity||'',activityFactor:p.activityFactor||'',smoking:p.smoking||'',alcohol:p.alcohol||'',diagnosis:p.diagnosis||'',theoreticalWeight:num('theoreticalWeight'),bowel:p.bowel||'',metabolism:p.metabolism||'',feeg:p.feeg||'',impedance:p.impedance||'',famObesity:!!p.famObesity,famDiabetes:!!p.famDiabetes,famHypertension:!!p.famHypertension,famCardiovascular:!!p.famCardiovascular,famDyslipidemia:!!p.famDyslipidemia,famThyroid:!!p.famThyroid,famGestational:!!p.famGestational,previousDiets:p.previousDiets||'',allergies:p.allergies||'',medications:p.medications||'',giIssues:p.giIssues||'',pastConditions:p.pastConditions||'',observations:p.observations||'',objectives:p.objectives||'',showEnergyValues:p.showEnergyValues!==false,readOnly:!!p.readOnly};
};
const saveProfile=p=>{
 const clean={...(p||{})}; delete clean.nextVisit;
 const id=activePatientId();
 if(id&&id!=='main'){
   const arr=rawExtraPatients(),i=arr.findIndex(x=>x.id===id);if(i<0)return;
   arr[i]={...arr[i],...clean,firstName:clean.name??arr[i].firstName??'',surname:clean.surname??arr[i].surname??''};
   arr[i].name=[arr[i].firstName,arr[i].surname].filter(Boolean).join(' ');delete arr[i].nextVisit;
   localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(arr));return;
 }
 let current={};try{current=JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')||{}}catch(e){}
 const merged={...current,...clean};delete merged.nextVisit;
 localStorage.setItem(PROFILE_KEY,JSON.stringify(merged));
};
const loadMeasures=()=>{const id=activePatientId();if(id&&id!=='main'){const p=activeExtraPatient();return Array.isArray(p?.measures)?JSON.parse(JSON.stringify(p.measures)):[]}try{return JSON.parse(localStorage.getItem(MEASURE_KEY)||'[]')}catch(e){return []}};
const saveMeasures=d=>{const id=activePatientId();if(id&&id!=='main'){const arr=rawExtraPatients(),i=arr.findIndex(p=>p.id===id);if(i<0)return;arr[i]={...arr[i],measures:d};localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(arr));return}localStorage.setItem(MEASURE_KEY,JSON.stringify(d))};
const isoToday=()=>{let d=new Date(),z=d.getTimezoneOffset()*60000;return new Date(d-z).toISOString().slice(0,10)};
const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const fmtShort=d=>new Date(d+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
const kg=v=>Number.isFinite(+v)&&v!==''?`${(+v).toFixed(1).replace('.',',')} kg`:'—';

function isoToItalianDate(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:''}
function italianDateToIso(v){const m=String(v||'').trim().match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);if(!m)return '';const iso=`${m[3]}-${m[2]}-${m[1]}`,d=new Date(iso+'T12:00:00');return !Number.isNaN(d.getTime())&&d.getFullYear()==+m[3]&&d.getMonth()+1==+m[2]&&d.getDate()==+m[1]?iso:''}

const PATIENT_CALORIE_FOODS=[
 {names:['yogurt greco 0%','yogurt greco zero'],k100:59,portionKcal:74},
 {names:['yogurt greco'],k100:90,portionKcal:113,generic:{vasetto:125,vasetti:125}},
 {names:['yogurt bianco','yogurt'],k100:70,portionKcal:88,generic:{vasetto:125,vasetti:125}},
 {names:['latte scremato'],k100:35},
 {names:['latte parzialmente scremato','zymil'],k100:46},
 {names:['latte intero','latte'],k100:64},
 {names:['cappuccino'],portionKcal:70},
 {names:['mozzarella'],k100:250},
 {names:['ricotta'],k100:174},
 {names:['fiocchi di latte','fiocchi'],k100:100},
 {names:['parmigiano','grana padano','grana'],k100:398},

 {names:['pan bauletto'],k100:265,generic:{fetta:25,fette:25}},
 {names:['pane integrale'],k100:247,generic:{fetta:30,fette:30}},
 {names:['pane'],k100:265,generic:{fetta:30,fette:30}},
 {names:['pasta integrale'],k100:345},
 {names:['pasta'],k100:350},
 {names:['riso basmati'],k100:350},
 {names:['riso'],k100:360},
 {names:['cous cous','couscous'],k100:360},
 {names:['farro'],k100:335},
 {names:['orzo'],k100:354},
 {names:['avena'],k100:389},
 {names:['cereali'],k100:370},
 {names:['corn flakes','cornflakes'],k100:357},
 {names:['fette biscottate'],k100:410},
 {names:['crackers','cracker'],k100:430},
 {names:['grissini','grissino'],k100:430},
 {names:['piadina'],k100:330},

 {names:['gocciole'],k100:470},
 {names:['biscotti','biscotto'],k100:450},
 {names:['crostata'],k100:400},
 {names:['torta'],k100:360},
 {names:['cioccolato fondente'],k100:550},
 {names:['cioccolato al latte'],k100:535},
 {names:['cioccolato'],k100:540},
 {names:['barretta cereali','barretta ai cereali','barretta','barrette'],portionKcal:110},

 {names:['petto di pollo','pollo'],k100:165},
 {names:['petto di tacchino','tacchino'],k100:135},
 {names:['manzo magro','manzo'],k100:180},
 {names:['vitello'],k100:172},
 {names:['maiale'],k100:242},
 {names:['hamburger di manzo','hamburger'],k100:250},
 {names:['bresaola'],k100:150},
 {names:['prosciutto crudo'],k100:270},
 {names:['prosciutto cotto'],k100:215},
 {names:['prosciutto'],k100:220},
 {names:['mortadella'],k100:317},
 {names:['salame'],k100:400},

 {names:['sgombro al naturale','sgombro'],k100:205},
 {names:['tonno al naturale'],k100:116},
 {names:['tonno sott olio','tonno sottolio'],k100:190},
 {names:['tonno'],k100:190},
 {names:['salmone'],k100:210},
 {names:['merluzzo'],k100:82},
 {names:['orata'],k100:121},
 {names:['branzino','spigola'],k100:124},
 {names:['sogliola'],k100:86},
 {names:['gamberi','gambero'],k100:99},
 {names:['cozze'],k100:85},
 {names:['vongole'],k100:74},
 {names:['polpo'],k100:82},
 {names:['calamari','calamaro'],k100:92},

 {names:['uova','uovo'],portionKcal:78},

 {names:['piselli'],k100:81},
 {names:['ceci'],k100:164},
 {names:['lenticchie'],k100:116},
 {names:['fagioli cannellini','cannellini'],k100:90},
 {names:['fagioli borlotti','borlotti'],k100:102},
 {names:['fagioli'],k100:100},

 {names:['carote','carota'],k100:41},
 {names:['zucchine','zucchina'],k100:17},
 {names:['melanzane','melanzana'],k100:25},
 {names:['peperoni','peperone'],k100:31},
 {names:['broccoli','broccolo'],k100:34},
 {names:['cavolfiore'],k100:25},
 {names:['spinaci','spinacio'],k100:23},
 {names:['bietole','bietola'],k100:19},
 {names:['finocchi','finocchio'],k100:31},
 {names:['cetrioli','cetriolo'],k100:15},
 {names:['iceberg'],k100:14},
 {names:['lattuga'],k100:15},
 {names:['insalata'],k100:20},
 {names:['pomodorini','pomodoro','pomodori'],k100:18},
 {names:['funghi'],k100:22},
 {names:['patate lesse','patate bollite'],k100:87},
 {names:['patate al forno'],k100:149},
 {names:['patate'],k100:77},
 {names:['verdure'],k100:35},

 {names:['banana','banane'],portionKcal:90},
 {names:['mela','mele'],portionKcal:80},
 {names:['pera','pere'],portionKcal:85},
 {names:['arancia','arance'],portionKcal:70},
 {names:['kiwi'],portionKcal:45},
 {names:['fragole'],k100:32},
 {names:['anguria','cocomero'],k100:30},
 {names:['melone'],k100:34},
 {names:['pesca','pesche'],portionKcal:60},
 {names:['uva'],k100:69},
 {names:['ananas'],k100:50},

 {names:['mandorle'],k100:579},
 {names:['noci'],k100:654},
 {names:['nocciole'],k100:628},
 {names:['pistacchi'],k100:562},

 {names:['olio extravergine','olio evo','olio'],k100:884,generic:{cucchiaino:5,cucchiaini:5,cucchiaio:10,cucchiai:10}},
 {names:['burro'],k100:717},
 {names:['maionese'],k100:680},

 {names:['succo di frutta','succo'],portionKcal:90},
 {names:['birra'],k100:43},
 {names:['vino rosso','vino bianco','vino'],k100:83},

 {names:['pizza margherita','margherita'],k100:270},
 {names:['pizza'],k100:270}
,
 {names:["rucola", "ruchetta"],k100:28},
 {names:["albicocche", "albicocca"],k100:48,generic:{"pezzo": 35, "pezzi": 35}},
 {names:["skyr"],k100:63,portionKcal:79,generic:{"vasetto": 125, "vasetti": 125}},
 {names:["kefir"],k100:60,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte di soia"],k100:40,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte di mandorla"],k100:35,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte di avena"],k100:46,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["mozzarella di bufala"],k100:288},
 {names:["mozzarella light"],k100:180},
 {names:["ricotta di pecora"],k100:157},
 {names:["pecorino romano", "pecorino"],k100:387},
 {names:["gorgonzola"],k100:324},
 {names:["taleggio"],k100:315},
 {names:["fontina"],k100:389},
 {names:["asiago"],k100:356},
 {names:["provolone"],k100:351},
 {names:["scamorza"],k100:334},
 {names:["caciotta"],k100:363},
 {names:["stracchino", "crescenza"],k100:300},
 {names:["robiola"],k100:333},
 {names:["mascarpone"],k100:455},
 {names:["formaggio spalmabile", "philadelphia"],k100:250},
 {names:["feta"],k100:264},
 {names:["pane di segale"],k100:259,generic:{"fetta": 30, "fette": 30}},
 {names:["pane ai cereali"],k100:260,generic:{"fetta": 30, "fette": 30}},
 {names:["rosetta", "michetta"],k100:280},
 {names:["ciabatta"],k100:270},
 {names:["baguette"],k100:275},
 {names:["pane azzimo"],k100:377},
 {names:["pasta fresca"],k100:288},
 {names:["pasta all'uovo", "tagliatelle"],k100:370},
 {names:["spaghetti"],k100:350},
 {names:["penne"],k100:350},
 {names:["fusilli"],k100:350},
 {names:["riso integrale"],k100:337},
 {names:["riso parboiled"],k100:349},
 {names:["cous cous integrale", "couscous integrale"],k100:350},
 {names:["grano saraceno"],k100:343},
 {names:["quinoa"],k100:368},
 {names:["amaranto"],k100:371},
 {names:["bulgur"],k100:342},
 {names:["polenta", "farina di mais"],k100:350},
 {names:["semolino"],k100:360},
 {names:["gnocchi di patate", "gnocchi"],k100:150},
 {names:["tortellini"],k100:307},
 {names:["ravioli"],k100:270},
 {names:["corn flakes", "cornflakes"],k100:357},
 {names:["muesli"],k100:370},
 {names:["granola"],k100:470},
 {names:["fette biscottate integrali"],k100:390,generic:{"fetta": 10, "fette": 10}},
 {names:["wafer"],k100:520},
 {names:["merendina"],k100:420},
 {names:["croissant vuoto", "cornetto vuoto", "brioche vuota"],k100:400},
 {names:["croissant", "cornetto", "brioche"],k100:420},
 {names:["panettone"],k100:360},
 {names:["pandoro"],k100:410},
 {names:["colomba"],k100:390},
 {names:["savoiardi"],k100:390},
 {names:["gelato alla crema"],k100:220},
 {names:["gelato alla frutta"],k100:160},
 {names:["gelato"],k100:200},
 {names:["sorbetto"],k100:130},
 {names:["coscia di pollo"],k100:210},
 {names:["coniglio"],k100:173},
 {names:["manzo magro"],k100:180},
 {names:["manzo"],k100:220},
 {names:["lonza di maiale", "lonza"],k100:190},
 {names:["maiale magro"],k100:180},
 {names:["hamburger di manzo", "hamburger"],k100:250,generic:{"pezzo": 100, "pezzi": 100}},
 {names:["salsiccia"],k100:330},
 {names:["wurstel"],k100:300},
 {names:["agnello"],k100:294},
 {names:["cavallo"],k100:133},
 {names:["prosciutto crudo sgrassato"],k100:180},
 {names:["prosciutto cotto sgrassato"],k100:145},
 {names:["fesa di tacchino"],k100:110},
 {names:["speck"],k100:300},
 {names:["coppa"],k100:400},
 {names:["pancetta"],k100:450},
 {names:["salmone affumicato"],k100:180},
 {names:["nasello"],k100:71},
 {names:["trota"],k100:148},
 {names:["pesce spada"],k100:172},
 {names:["sardine", "sarde"],k100:208},
 {names:["acciughe", "alici"],k100:131},
 {names:["gamberetti"],k100:85},
 {names:["seppie", "seppia"],k100:79},
 {names:["baccalà"],k100:122},
 {names:["albume d'uovo", "albume", "albumi"],k100:52},
 {names:["tuorlo d'uovo", "tuorlo", "tuorli"],k100:322},
 {names:["fagioli rossi"],k100:127},
 {names:["fagioli neri"],k100:132},
 {names:["fave"],k100:88},
 {names:["lupini"],k100:114},
 {names:["soia edamame", "edamame"],k100:121},
 {names:["cavolo cappuccio"],k100:25},
 {names:["cavolo nero"],k100:49},
 {names:["verza"],k100:27},
 {names:["radicchio"],k100:23},
 {names:["indivia"],k100:17},
 {names:["scarola"],k100:17},
 {names:["lattuga romana"],k100:17},
 {names:["asparagi", "asparago"],k100:20},
 {names:["carciofi", "carciofo"],k100:47},
 {names:["cipolla rossa", "cipolla bianca", "cipolla", "cipolle"],k100:40},
 {names:["aglio"],k100:149},
 {names:["sedano"],k100:16},
 {names:["porro", "porri"],k100:61},
 {names:["rapa", "rape"],k100:28},
 {names:["barbabietola", "barbabietole"],k100:43},
 {names:["zucca"],k100:26},
 {names:["patate dolci", "batata"],k100:86},
 {names:["mais dolce", "mais"],k100:86},
 {names:["germogli di soia"],k100:30},
 {names:["verdure grigliate"],k100:60},
 {names:["mandarino", "mandarini"],portionKcal:45},
 {names:["clementina", "clementine"],portionKcal:35},
 {names:["pompelmo"],k100:42},
 {names:["limone", "limoni"],k100:29},
 {names:["lamponi", "lampone"],k100:52},
 {names:["mirtilli", "mirtillo"],k100:57},
 {names:["more", "mora"],k100:43},
 {names:["ribes"],k100:56},
 {names:["nettarina", "nettarine"],k100:44},
 {names:["prugna", "prugne"],k100:46},
 {names:["susina", "susine"],k100:46},
 {names:["ciliegie", "ciliegia"],k100:63},
 {names:["mango"],k100:60},
 {names:["papaya"],k100:43},
 {names:["avocado"],k100:160},
 {names:["fico", "fichi"],k100:74},
 {names:["melograno"],k100:83},
 {names:["cachi", "caco"],k100:70},
 {names:["datteri", "dattero"],k100:282},
 {names:["fichi secchi"],k100:249},
 {names:["uvetta", "uva passa"],k100:299},
 {names:["anacardi"],k100:553},
 {names:["arachidi"],k100:567},
 {names:["pinoli"],k100:673},
 {names:["semi di chia"],k100:486},
 {names:["semi di lino"],k100:534},
 {names:["semi di zucca"],k100:559},
 {names:["semi di girasole"],k100:584},
 {names:["margarina"],k100:717},
 {names:["maionese light"],k100:330,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["ketchup"],k100:112,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["senape"],k100:66,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["pesto genovese", "pesto"],k100:460,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["hummus"],k100:166,generic:{"cucchiaio": 20, "cucchiai": 20}},
 {names:["succo d'arancia", "succo arancia"],k100:45,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["spremuta d'arancia", "spremuta"],k100:45,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["coca cola zero", "cola zero"],k100:0,generic:{"lattina": 330, "lattine": 330}},
 {names:["coca cola", "cola"],k100:42,generic:{"lattina": 330, "lattine": 330}},
 {names:["tè freddo", "the freddo"],k100:35,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["birra analcolica"],k100:25,generic:{"bottiglia": 330, "bottiglie": 330}},
 {names:["prosecco"],k100:75,generic:{"bicchiere": 100, "bicchieri": 100}},
 {names:["pizza marinara", "marinara"],k100:240},
 {names:["pizza diavola", "diavola"],k100:300},
 {names:["pizza quattro formaggi"],k100:330},
 {names:["pizza capricciosa"],k100:290},
 {names:["pizza prosciutto e funghi"],k100:280},
 {names:["focaccia"],k100:300},
 {names:["bruschetta"],k100:250},
 {names:["pasta al pomodoro"],k100:145},
 {names:["pasta al pesto"],k100:220},
 {names:["pasta alla carbonara", "carbonara"],k100:300},
 {names:["pasta all'amatriciana", "amatriciana"],k100:240},
 {names:["pasta aglio olio e peperoncino"],k100:260},
 {names:["risotto ai funghi"],k100:160},
 {names:["risotto alla milanese"],k100:180},
 {names:["risotto"],k100:170},
 {names:["minestrone"],k100:55},
 {names:["passato di verdure"],k100:45},
 {names:["vellutata di verdure", "vellutata"],k100:70},
 {names:["insalata di riso"],k100:180},
 {names:["insalata di pollo"],k100:140},
 {names:["insalata caprese", "caprese"],k100:170},
 {names:["parmigiana di melanzane", "parmigiana"],k100:220},
 {names:["cotoletta alla milanese", "cotoletta"],k100:280},
 {names:["polpette"],k100:220},
 {names:["frittata"],k100:180},
 {names:["omelette"],k100:160},
 {names:["purè di patate", "pure di patate", "purè", "pure"],k100:110},
 {names:["patatine fritte"],k100:312},
 {names:["crocchette di patate", "crocchette"],k100:210},
 {names:["arancino", "arancina"],k100:250},
 {names:["supplì", "suppli"],k100:240},
 {names:["tofu"],k100:76},
 {names:["seitan"],k100:140},
 {names:["tempeh"],k100:193},
 {names:["proteine in polvere", "whey"],k100:390},
 {names:["miele"],k100:304,generic:{"cucchiaino": 7, "cucchiaini": 7, "cucchiaio": 20, "cucchiai": 20}},
 {names:["marmellata", "confettura"],k100:250,generic:{"cucchiaino": 10, "cucchiaini": 10, "cucchiaio": 20, "cucchiai": 20}},
 {names:["nutella", "crema spalmabile alle nocciole"],k100:539,generic:{"cucchiaino": 10, "cucchiaini": 10, "cucchiaio": 20, "cucchiai": 20}},
 {names:["zucchero"],k100:400,generic:{"cucchiaino": 5, "cucchiaini": 5, "cucchiaio": 12, "cucchiai": 12}},
 {names:["mela golden"],k100:57},
 {names:["mela granny smith"],k100:52},
 {names:["mela fuji"],k100:63},
 {names:["pera abate"],k100:57},
 {names:["pera williams"],k100:57},
 {names:["pesca noce"],k100:44},
 {names:["uva bianca"],k100:69},
 {names:["uva nera"],k100:69},
 {names:["frutti di bosco"],k100:45},
 {names:["mirtilli rossi", "cranberry"],k100:46},
 {names:["cocco fresco", "cocco"],k100:354},
 {names:["castagne"],k100:213},
 {names:["castagne bollite"],k100:120},
 {names:["nespole"],k100:47},
 {names:["litchi", "lychee"],k100:66},
 {names:["passion fruit", "frutto della passione"],k100:97},
 {names:["guava"],k100:68},
 {names:["pitaya", "dragon fruit"],k100:60},
 {names:["carambola"],k100:31},
 {names:["kumquat"],k100:71},
 {names:["banana essiccata"],k100:346},
 {names:["mela essiccata"],k100:243},
 {names:["prugne secche"],k100:240},
 {names:["albicocche secche"],k100:241},
 {names:["cicoria"],k100:23},
 {names:["catalogna"],k100:23},
 {names:["puntarelle"],k100:20},
 {names:["valeriana", "songino"],k100:21},
 {names:["misticanza"],k100:20},
 {names:["cime di rapa"],k100:32},
 {names:["friarielli"],k100:32},
 {names:["broccoletti"],k100:34},
 {names:["cavoletti di bruxelles"],k100:43},
 {names:["cavolo rosso"],k100:31},
 {names:["cavolo verza"],k100:27},
 {names:["cavolo cinese", "pak choi"],k100:13},
 {names:["cavolo rapa"],k100:27},
 {names:["rape rosse"],k100:43},
 {names:["ravanelli", "ravanello"],k100:16},
 {names:["topinambur"],k100:73},
 {names:["cardi", "cardo"],k100:17},
 {names:["okra"],k100:33},
 {names:["taccole"],k100:42},
 {names:["fagiolini"],k100:31},
 {names:["agretti", "barba di frate"],k100:17},
 {names:["fiori di zucca"],k100:12},
 {names:["pomodori secchi"],k100:258},
 {names:["pomodori pelati"],k100:24},
 {names:["pomodoro cuore di bue"],k100:18},
 {names:["pomodoro datterino", "datterini"],k100:20},
 {names:["cipollotto"],k100:32},
 {names:["scalogno"],k100:72},
 {names:["zenzero"],k100:80},
 {names:["rafano"],k100:48},
 {names:["finocchietto"],k100:31},
 {names:["prezzemolo"],k100:36},
 {names:["basilico"],k100:23},
 {names:["salvia"],k100:315},
 {names:["rosmarino"],k100:131},
 {names:["melanzane grigliate"],k100:35},
 {names:["zucchine grigliate"],k100:30},
 {names:["peperoni grigliati"],k100:40},
 {names:["spinaci cotti"],k100:23},
 {names:["broccoli cotti"],k100:35},
 {names:["cavolfiore cotto"],k100:23},
 {names:["ceci in scatola"],k100:120},
 {names:["lenticchie in scatola"],k100:92},
 {names:["fagioli cannellini"],k100:90},
 {names:["fagioli borlotti"],k100:102},
 {names:["fagioli azuki"],k100:128},
 {names:["cicerchie"],k100:315},
 {names:["piselli surgelati"],k100:72},
 {names:["lenticchie rosse"],k100:350},
 {names:["lenticchie verdi"],k100:350},
 {names:["farina di ceci"],k100:387},
 {names:["cernia"],k100:92},
 {names:["dentice"],k100:100},
 {names:["rombo"],k100:81},
 {names:["rana pescatrice", "coda di rospo"],k100:63},
 {names:["palombo"],k100:130},
 {names:["triglia"],k100:123},
 {names:["anguilla"],k100:184},
 {names:["aringa"],k100:158},
 {names:["sardine sott'olio"],k100:208},
 {names:["acciughe sott'olio"],k100:210},
 {names:["tonno fresco"],k100:144},
 {names:["salmone selvaggio"],k100:182},
 {names:["gamberoni"],k100:99},
 {names:["scampi"],k100:85},
 {names:["ostriche"],k100:68},
 {names:["capesante"],k100:88},
 {names:["surimi"],k100:99},
 {names:["pesce persico"],k100:91},
 {names:["tilapia"],k100:96},
 {names:["pangasio"],k100:92},
 {names:["pollo arrosto"],k100:190},
 {names:["pollo alla griglia"],k100:165},
 {names:["sovracoscia di pollo"],k100:209},
 {names:["ali di pollo"],k100:203},
 {names:["tacchino arrosto"],k100:160},
 {names:["macinato di manzo"],k100:250},
 {names:["filetto di manzo"],k100:190},
 {names:["roast beef"],k100:170},
 {names:["bistecca di manzo", "bistecca"],k100:230},
 {names:["fettina di vitello"],k100:170},
 {names:["arista di maiale", "arista"],k100:200},
 {names:["costine di maiale", "costine"],k100:290},
 {names:["braciola di maiale", "braciola"],k100:240},
 {names:["anatra"],k100:337},
 {names:["fegato di vitello"],k100:135},
 {names:["fegato di pollo"],k100:119},
 {names:["trippa"],k100:108},
 {names:["carne macinata"],k100:240},
 {names:["culatello"],k100:290},
 {names:["prosciutto di parma"],k100:270},
 {names:["prosciutto san daniele"],k100:270},
 {names:["salame ungherese"],k100:405},
 {names:["salame felino"],k100:420},
 {names:["soppressata"],k100:400},
 {names:["nduja", "'nduja"],k100:500},
 {names:["lardo"],k100:890},
 {names:["guanciale"],k100:655},
 {names:["porchetta"],k100:330},
 {names:["pancetta affumicata"],k100:460},
 {names:["burrata"],k100:330},
 {names:["stracciatella"],k100:300},
 {names:["bufala", "mozzarella bufala"],k100:288},
 {names:["emmental", "emmentaler"],k100:380},
 {names:["edamer"],k100:357},
 {names:["cheddar"],k100:403},
 {names:["brie"],k100:334},
 {names:["camembert"],k100:300},
 {names:["caprino"],k100:300},
 {names:["primo sale"],k100:250},
 {names:["quartirolo"],k100:300},
 {names:["montasio"],k100:371},
 {names:["bitto"],k100:410},
 {names:["casera"],k100:370},
 {names:["provola"],k100:350},
 {names:["formaggio light"],k100:180},
 {names:["yogurt alla frutta"],k100:95,generic:{"vasetto": 125, "vasetti": 125}},
 {names:["yogurt proteico"],k100:65,generic:{"vasetto": 150, "vasetti": 150}},
 {names:["budino proteico"],k100:80,generic:{"vasetto": 200, "vasetti": 200}},
 {names:["panna da cucina"],k100:292},
 {names:["panna montata"],k100:340},
 {names:["riso venere"],k100:360},
 {names:["riso rosso"],k100:350},
 {names:["riso jasmine"],k100:350},
 {names:["riso selvatico"],k100:357},
 {names:["riso soffiato"],k100:380},
 {names:["farina 00"],k100:364},
 {names:["farina 0"],k100:364},
 {names:["farina integrale"],k100:340},
 {names:["farina di avena"],k100:389},
 {names:["farina di riso"],k100:366},
 {names:["semola rimacinata"],k100:350},
 {names:["pane pugliese"],k100:270},
 {names:["pane di semola"],k100:270},
 {names:["pane toscano"],k100:265},
 {names:["pane carasau"],k100:380},
 {names:["pane arabo"],k100:275},
 {names:["pane pita", "pita"],k100:275},
 {names:["pane proteico"],k100:260},
 {names:["pane senza glutine"],k100:270},
 {names:["toast"],k100:270,generic:{"fetta": 25, "fette": 25}},
 {names:["pancarrè", "pan carre"],k100:270,generic:{"fetta": 25, "fette": 25}},
 {names:["frisella", "frisa"],k100:350},
 {names:["taralli"],k100:450},
 {names:["gallette di riso"],k100:387,generic:{"pezzo": 8, "pezzi": 8}},
 {names:["gallette di mais"],k100:380,generic:{"pezzo": 8, "pezzi": 8}},
 {names:["gallette"],k100:385,generic:{"pezzo": 8, "pezzi": 8}},
 {names:["wrap", "tortilla"],k100:310},
 {names:["pasta di legumi"],k100:340},
 {names:["pasta di ceci"],k100:350},
 {names:["pasta di lenticchie"],k100:340},
 {names:["pasta di piselli"],k100:340},
 {names:["pasta senza glutine"],k100:350},
 {names:["noodles"],k100:350},
 {names:["spaghetti di riso"],k100:360},
 {names:["udon"],k100:130},
 {names:["ramen"],k100:440},
 {names:["cannelloni"],k100:180},
 {names:["pasta ripiena"],k100:280},
 {names:["cappelletti"],k100:300},
 {names:["agnolotti"],k100:280},
 {names:["orecchiette"],k100:350},
 {names:["trofie"],k100:350},
 {names:["biscotti integrali"],k100:430,generic:{"biscotto": 10, "biscotti": 10}},
 {names:["biscotti digestive", "digestive"],k100:480,generic:{"biscotto": 14, "biscotti": 14}},
 {names:["biscotti frollini", "frollini"],k100:460,generic:{"biscotto": 10, "biscotti": 10}},
 {names:["biscotti al cioccolato"],k100:480,generic:{"biscotto": 12, "biscotti": 12}},
 {names:["biscotti senza zucchero"],k100:420,generic:{"biscotto": 10, "biscotti": 10}},
 {names:["pavesini"],k100:390,generic:{"biscotto": 2.2, "biscotti": 2.2}},
 {names:["oro saiwa"],k100:430,generic:{"biscotto": 7, "biscotti": 7}},
 {names:["plumcake"],k100:410},
 {names:["muffin"],k100:400},
 {names:["pancake"],k100:227},
 {names:["crepes", "crêpes"],k100:224},
 {names:["waffle"],k100:291},
 {names:["tiramisu", "tiramisù"],k100:300},
 {names:["panna cotta"],k100:240},
 {names:["cheesecake"],k100:320},
 {names:["cannolo siciliano", "cannolo"],k100:350},
 {names:["babà", "baba"],k100:250},
 {names:["sfogliatella"],k100:380},
 {names:["bignè", "bigne"],k100:300},
 {names:["millefoglie"],k100:350},
 {names:["profiteroles"],k100:330},
 {names:["amaretti"],k100:430},
 {names:["cantucci"],k100:440},
 {names:["torrone"],k100:480},
 {names:["burro di arachidi"],k100:588,generic:{"cucchiaino": 10, "cucchiaini": 10, "cucchiaio": 20, "cucchiai": 20}},
 {names:["burro di mandorle"],k100:614,generic:{"cucchiaino": 10, "cucchiaini": 10, "cucchiaio": 20, "cucchiai": 20}},
 {names:["crema di pistacchio"],k100:560},
 {names:["tahina", "tahin"],k100:595},
 {names:["noci pecan"],k100:691},
 {names:["noci brasiliane"],k100:659},
 {names:["macadamia"],k100:718},
 {names:["olio di semi"],k100:884,generic:{"cucchiaino": 5, "cucchiaini": 5, "cucchiaio": 10, "cucchiai": 10}},
 {names:["olio di cocco"],k100:892,generic:{"cucchiaino": 5, "cucchiaini": 5, "cucchiaio": 10, "cucchiai": 10}},
 {names:["aceto balsamico"],k100:88,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["aceto"],k100:18,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["salsa di soia"],k100:53,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["salsa barbecue"],k100:170,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["salsa yogurt"],k100:120,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["guacamole"],k100:150,generic:{"cucchiaio": 20, "cucchiai": 20}},
 {names:["caffè espresso", "caffe espresso", "espresso"],k100:2,generic:{"tazzina": 30, "tazzine": 30}},
 {names:["caffè americano", "caffe americano"],k100:2,generic:{"tazza": 240, "tazze": 240}},
 {names:["caffè macchiato", "caffe macchiato"],k100:20},
 {names:["latte macchiato"],k100:55,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["orzo solubile", "caffè d'orzo", "caffe d'orzo"],k100:20},
 {names:["cioccolata calda"],k100:90,generic:{"tazza": 200, "tazze": 200}},
 {names:["acqua di cocco"],k100:19,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["energy drink"],k100:45,generic:{"lattina": 250, "lattine": 250}},
 {names:["pasta cacio e pepe", "cacio e pepe"],k100:280},
 {names:["pasta alla norma", "pasta alla norma"],k100:190},
 {names:["pasta puttanesca", "puttanesca"],k100:190},
 {names:["pasta arrabbiata", "arrabbiata"],k100:170},
 {names:["pasta tonno e pomodoro"],k100:180},
 {names:["pasta e fagioli"],k100:130},
 {names:["pasta e ceci"],k100:140},
 {names:["pasta e lenticchie"],k100:135},
 {names:["pasta al ragù", "pasta al ragu"],k100:200},
 {names:["ragù alla bolognese", "ragu alla bolognese", "ragù", "ragu"],k100:150},
 {names:["lasagne al ragù", "lasagne al ragu"],k100:180},
 {names:["risotto alla zucca"],k100:150},
 {names:["risotto ai frutti di mare"],k100:160},
 {names:["riso alla cantonese"],k100:190},
 {names:["paella"],k100:180},
 {names:["cous cous di verdure"],k100:140},
 {names:["cous cous di pollo"],k100:170},
 {names:["polenta concia"],k100:250},
 {names:["polenta e funghi"],k100:140},
 {names:["gnocchi al pomodoro"],k100:140},
 {names:["gnocchi al pesto"],k100:210},
 {names:["gnocchi al ragù", "gnocchi al ragu"],k100:190},
 {names:["insalata greca"],k100:150},
 {names:["insalata nizzarda"],k100:140},
 {names:["panzanella"],k100:120},
 {names:["vitello tonnato"],k100:220},
 {names:["carpaccio di manzo"],k100:130},
 {names:["tartare di manzo"],k100:150},
 {names:["tartare di salmone"],k100:190},
 {names:["pollo al curry"],k100:160},
 {names:["pollo alla cacciatora"],k100:150},
 {names:["spezzatino di manzo"],k100:170},
 {names:["brasato"],k100:190},
 {names:["arrosto di vitello"],k100:180},
 {names:["melanzane alla parmigiana"],k100:220},
 {names:["zucchine ripiene"],k100:130},
 {names:["peperoni ripieni"],k100:150},
 {names:["pomodori ripieni"],k100:120},
 {names:["frittata di zucchine"],k100:160},
 {names:["frittata di patate"],k100:190},
 {names:["uova strapazzate"],k100:170},
 {names:["uovo alla coque"],portionKcal:78},
 {names:["uovo al tegamino"],portionKcal:90},
 {names:["toast prosciutto e formaggio"],k100:280},
 {names:["panino prosciutto"],k100:260},
 {names:["panino bresaola"],k100:230},
 {names:["panino tonno"],k100:250},
 {names:["hamburger completo"],k100:260},
 {names:["kebab"],k100:220},
 {names:["sushi"],k100:150},
 {names:["sashimi"],k100:130},
 {names:["poke"],k100:150},
 {names:["minestrone surgelato"],k100:40},
 {names:["verdure surgelate"],k100:35},
 {names:["spinaci surgelati"],k100:23},
 {names:["bastoncini di pesce"],k100:220},
 {names:["sofficini"],k100:230},
 {names:["pizza surgelata"],k100:240},
 {names:["patate surgelate"],k100:150},
 {names:["acerola"],k100:32},
 {names:["annona"],k100:75},
 {names:["bergamotto"],k100:36},
 {names:["cedro"],k100:32},
 {names:["fichi d'india", "fico d'india"],k100:41},
 {names:["giuggiole", "giuggiola"],k100:79},
 {names:["mangostano"],k100:73},
 {names:["rabarbaro"],k100:21},
 {names:["sambuco bacche"],k100:73},
 {names:["tamarindo"],k100:239},
 {names:["amarene", "amarena"],k100:50},
 {names:["visciole", "visciola"],k100:50},
 {names:["uva spina"],k100:44},
 {names:["cetriolini sottaceto", "cetriolini"],k100:12},
 {names:["cipolline sottaceto", "cipolline"],k100:30},
 {names:["crauti"],k100:19},
 {names:["kimchi"],k100:15},
 {names:["alghe wakame", "wakame"],k100:45},
 {names:["alghe nori", "nori"],k100:306},
 {names:["alghe kombu", "kombu"],k100:43},
 {names:["avocado hass"],k100:167},
 {names:["bambù", "germogli di bambù"],k100:27},
 {names:["crescione"],k100:32},
 {names:["dragoncello"],k100:295},
 {names:["erba cipollina"],k100:30},
 {names:["menta"],k100:44},
 {names:["origano fresco"],k100:45},
 {names:["peperoncino fresco"],k100:40},
 {names:["peperoncino secco"],k100:282},
 {names:["timo"],k100:101},
 {names:["curcuma fresca"],k100:65},
 {names:["zucca butternut"],k100:45},
 {names:["zucca delica"],k100:40},
 {names:["zucca mantovana"],k100:40},
 {names:["patata viola"],k100:80},
 {names:["patate novelle"],k100:70},
 {names:["funghi pleurotus", "pleurotus"],k100:33},
 {names:["funghi shiitake", "shiitake"],k100:34},
 {names:["funghi chiodini", "chiodini"],k100:22},
 {names:["funghi finferli", "finferli"],k100:38},
 {names:["fagioli mung"],k100:105},
 {names:["fagioli dall'occhio"],k100:116},
 {names:["piselli spezzati"],k100:341},
 {names:["soia gialla"],k100:446},
 {names:["soia verde"],k100:347},
 {names:["proteine di soia"],k100:330},
 {names:["miglio"],k100:378},
 {names:["teff"],k100:367},
 {names:["sorgo"],k100:329},
 {names:["kamut", "grano khorasan"],k100:337},
 {names:["grano duro"],k100:339},
 {names:["grano tenero"],k100:340},
 {names:["segale"],k100:338},
 {names:["crusca d'avena"],k100:246},
 {names:["crusca di frumento"],k100:216},
 {names:["fiocchi d'avena"],k100:370},
 {names:["fiocchi di farro"],k100:350},
 {names:["fiocchi di mais"],k100:357},
 {names:["fiocchi di riso"],k100:370},
 {names:["quinoa cotta"],k100:120},
 {names:["riso basmati cotto"],k100:121},
 {names:["riso bianco cotto"],k100:130},
 {names:["riso integrale cotto"],k100:123},
 {names:["farro cotto"],k100:127},
 {names:["orzo cotto"],k100:123},
 {names:["cous cous cotto", "couscous cotto"],k100:112},
 {names:["pane di altamura"],k100:270},
 {names:["pane di matera"],k100:270},
 {names:["pane cafone"],k100:270},
 {names:["pane casereccio"],k100:270},
 {names:["pane nero"],k100:250},
 {names:["pane multicereali"],k100:260},
 {names:["pane con semi"],k100:280},
 {names:["pane alle noci"],k100:320},
 {names:["pane all'olio"],k100:310},
 {names:["pane al latte"],k100:300},
 {names:["panino al latte"],k100:300},
 {names:["panino integrale"],k100:250},
 {names:["panino ai cereali"],k100:260},
 {names:["pane hamburger", "burger bun"],k100:280},
 {names:["hot dog bun", "pane hot dog"],k100:280},
 {names:["focaccia genovese"],k100:330},
 {names:["focaccia barese"],k100:280},
 {names:["schiacciata toscana"],k100:310},
 {names:["crescentina", "tigella"],k100:330},
 {names:["gnocco fritto"],k100:420},
 {names:["erbazzone"],k100:250},
 {names:["farinata di ceci", "farinata"],k100:210},
 {names:["panelle"],k100:250},
 {names:["pinsa romana", "pinsa"],k100:250},
 {names:["pizza bianca"],k100:300},
 {names:["pizza rossa"],k100:250},
 {names:["pizza napoletana"],k100:270},
 {names:["pizza ortolana"],k100:260},
 {names:["pizza tonno e cipolla"],k100:285},
 {names:["pizza wurstel"],k100:300},
 {names:["pizza prosciutto"],k100:280},
 {names:["pizza funghi"],k100:260},
 {names:["pizza bufala"],k100:290},
 {names:["pasta cotta"],k100:158},
 {names:["pasta integrale cotta"],k100:149},
 {names:["spaghetti cotti"],k100:158},
 {names:["pasta fresca ripiena"],k100:280},
 {names:["ravioli ricotta e spinaci"],k100:250},
 {names:["tortellini in brodo"],k100:110},
 {names:["tortelloni"],k100:280},
 {names:["pizzoccheri"],k100:340},
 {names:["strozzapreti"],k100:350},
 {names:["malloreddus"],k100:350},
 {names:["bucatini"],k100:350},
 {names:["linguine"],k100:350},
 {names:["paccheri"],k100:350},
 {names:["rigatoni"],k100:350},
 {names:["farfalle"],k100:350},
 {names:["conchiglie pasta"],k100:350},
 {names:["sugo al pomodoro", "sugo di pomodoro"],k100:50},
 {names:["sugo all'arrabbiata"],k100:70},
 {names:["sugo ai funghi"],k100:90},
 {names:["sugo alle olive"],k100:100},
 {names:["sugo tonno"],k100:110},
 {names:["besciamella"],k100:120},
 {names:["salsa tartara"],k100:520},
 {names:["salsa rosa"],k100:350},
 {names:["salsa tzatziki", "tzatziki"],k100:120},
 {names:["salsa teriyaki"],k100:90},
 {names:["salsa piccante"],k100:60},
 {names:["filetto di pollo"],k100:165},
 {names:["pollo lesso"],k100:170},
 {names:["pollo impanato"],k100:240},
 {names:["pollo fritto"],k100:260},
 {names:["pollo allo spiedo"],k100:200},
 {names:["tacchino alla griglia"],k100:135},
 {names:["fesa di tacchino arrosto"],k100:150},
 {names:["hamburger di pollo"],k100:200},
 {names:["hamburger di tacchino"],k100:180},
 {names:["hamburger vegetale"],k100:180},
 {names:["polpettone"],k100:220},
 {names:["polpette di pollo"],k100:190},
 {names:["polpette di tacchino"],k100:180},
 {names:["polpette al sugo"],k100:180},
 {names:["carne salada"],k100:140},
 {names:["tagliata di manzo"],k100:210},
 {names:["entrecote"],k100:250},
 {names:["controfiletto"],k100:220},
 {names:["fiorentina"],k100:250},
 {names:["scottona"],k100:240},
 {names:["bollito di manzo"],k100:210},
 {names:["lesso di manzo"],k100:210},
 {names:["ossobuco"],k100:180},
 {names:["stinco di maiale"],k100:240},
 {names:["stinco di vitello"],k100:190},
 {names:["coniglio arrosto"],k100:200},
 {names:["coniglio in umido"],k100:180},
 {names:["merluzzo surgelato"],k100:82},
 {names:["merluzzo al vapore"],k100:90},
 {names:["merluzzo impanato"],k100:200},
 {names:["salmone al forno"],k100:210},
 {names:["salmone alla griglia"],k100:210},
 {names:["orata al forno"],k100:130},
 {names:["branzino al forno"],k100:130},
 {names:["spigola al forno"],k100:130},
 {names:["trota salmonata"],k100:160},
 {names:["trota affumicata"],k100:180},
 {names:["tonno scottato"],k100:150},
 {names:["filetti di sgombro"],k100:205},
 {names:["filetti di alici"],k100:130},
 {names:["insalata di mare"],k100:100},
 {names:["fritto misto di pesce"],k100:250},
 {names:["calamari fritti"],k100:250},
 {names:["gamberi alla griglia"],k100:110},
 {names:["polpo con patate"],k100:120},
 {names:["polpo alla griglia"],k100:90},
 {names:["cozze alla marinara"],k100:90},
 {names:["impepata di cozze"],k100:90},
 {names:["latte senza lattosio"],k100:46,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte alta digeribilità"],k100:46,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte proteico"],k100:55,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["bevanda di riso", "latte di riso"],k100:47,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["bevanda di cocco", "latte di cocco bevanda"],k100:25,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte condensato"],k100:321},
 {names:["yogurt senza lattosio"],k100:70,generic:{"vasetto": 125, "vasetti": 125}},
 {names:["yogurt di soia"],k100:55,generic:{"vasetto": 125, "vasetti": 125}},
 {names:["yogurt greco 2%"],k100:73,generic:{"vasetto": 150, "vasetti": 150}},
 {names:["yogurt greco 5%"],k100:97,generic:{"vasetto": 150, "vasetti": 150}},
 {names:["quark"],k100:70},
 {names:["quark magro"],k100:65},
 {names:["formaggio quark"],k100:70},
 {names:["ricotta light"],k100:130},
 {names:["mozzarella senza lattosio"],k100:250},
 {names:["mozzarella fior di latte", "fior di latte"],k100:250},
 {names:["caciocavallo"],k100:439},
 {names:["castelmagno"],k100:410},
 {names:["formaggio di capra"],k100:360},
 {names:["formaggio di pecora"],k100:380},
 {names:["formaggio di mucca"],k100:350},
 {names:["uova di quaglia", "uovo di quaglia"],k100:158},
 {names:["frittata di cipolle"],k100:170},
 {names:["frittata di spinaci"],k100:160},
 {names:["frittata di albumi"],k100:80},
 {names:["omelette prosciutto"],k100:190},
 {names:["omelette formaggio"],k100:220},
 {names:["uova in camicia", "uovo in camicia"],portionKcal:75},
 {names:["porridge"],k100:90},
 {names:["porridge proteico"],k100:110},
 {names:["overnight oats"],k100:120},
 {names:["cereali integrali"],k100:360},
 {names:["cereali fitness"],k100:370},
 {names:["cereali ripieni"],k100:430},
 {names:["riso soffiato al cioccolato"],k100:400},
 {names:["granola proteica"],k100:430},
 {names:["granola senza zucchero"],k100:400},
 {names:["barretta al cioccolato"],k100:480},
 {names:["barretta di frutta secca"],k100:450},
 {names:["barretta energetica"],k100:400},
 {names:["chips di patate", "patatine in busta"],k100:530},
 {names:["popcorn"],k100:387},
 {names:["popcorn al burro"],k100:500},
 {names:["nachos"],k100:500},
 {names:["salatini"],k100:450},
 {names:["pretzel"],k100:380},
 {names:["taralli integrali"],k100:430},
 {names:["grissini integrali"],k100:410},
 {names:["cracker senza sale"],k100:420},
 {names:["cracker di riso"],k100:400},
 {names:["cracker di segale"],k100:390},
 {names:["biscotti al burro"],k100:500},
 {names:["biscotti avena"],k100:450},
 {names:["biscotti di riso"],k100:420},
 {names:["biscotti senza glutine"],k100:450},
 {names:["biscotti proteici"],k100:400},
 {names:["biscotti ripieni"],k100:480},
 {names:["torta di mele"],k100:250},
 {names:["torta al cioccolato"],k100:390},
 {names:["torta della nonna"],k100:350},
 {names:["torta paradiso"],k100:410},
 {names:["torta sacher", "sacher"],k100:380},
 {names:["brownie"],k100:466},
 {names:["cookies", "cookie"],k100:480},
 {names:["donut", "ciambella americana"],k100:420},
 {names:["ciambellone"],k100:370},
 {names:["budino al cioccolato"],k100:120},
 {names:["budino alla vaniglia"],k100:110},
 {names:["crema pasticcera"],k100:180},
 {names:["zabaione"],k100:250},
 {names:["semifreddo"],k100:250},
 {names:["granita"],k100:100},
 {names:["ghiacciolo"],k100:80},
 {names:["gelato proteico"],k100:130},
 {names:["yogurt gelato", "frozen yogurt"],k100:160},
 {names:["zuppa di legumi"],k100:90},
 {names:["zuppa di ceci"],k100:100},
 {names:["zuppa di lenticchie"],k100:90},
 {names:["zuppa di fagioli"],k100:100},
 {names:["zuppa di farro"],k100:90},
 {names:["zuppa d'orzo"],k100:80},
 {names:["ribollita"],k100:90},
 {names:["acquacotta"],k100:70},
 {names:["pappa al pomodoro"],k100:100},
 {names:["stracciatella in brodo"],k100:70},
 {names:["brodo vegetale"],k100:15},
 {names:["brodo di carne"],k100:30},
 {names:["pastina in brodo"],k100:80},
 {names:["riso in bianco"],k100:130},
 {names:["pasta in bianco"],k100:190},
 {names:["pasta burro e parmigiano"],k100:230},
 {names:["pasta ricotta e spinaci"],k100:190},
 {names:["pasta zucchine"],k100:160},
 {names:["pasta broccoli"],k100:160},
 {names:["pasta salmone"],k100:220},
 {names:["pasta vongole", "spaghetti alle vongole"],k100:180},
 {names:["spaghetti allo scoglio"],k100:180},
 {names:["risotto al parmigiano"],k100:190},
 {names:["risotto ai porcini"],k100:170},
 {names:["risotto al radicchio"],k100:160},
 {names:["risotto agli asparagi"],k100:155},
 {names:["risotto al pesce"],k100:165},
 {names:["riso pollo e verdure"],k100:160},
 {names:["riso basmati pollo"],k100:170},
 {names:["riso tonno"],k100:160},
 {names:["riso e piselli", "risi e bisi"],k100:130},
 {names:["piadina prosciutto e formaggio"],k100:300},
 {names:["piadina bresaola"],k100:260},
 {names:["piadina crudo e squacquerone"],k100:320},
 {names:["cassone romagnolo", "crescione romagnolo"],k100:250},
 {names:["arancino al ragù", "arancino al ragu"],k100:260},
 {names:["arancino al burro"],k100:270},
 {names:["panzerotto"],k100:280},
 {names:["calzone"],k100:280},
 {names:["calzone fritto"],k100:350},
 {names:["mozzarella in carrozza"],k100:300},
 {names:["olive ascolane"],k100:250},
 {names:["fiori di zucca fritti"],k100:220},
 {names:["falafel"],k100:333},
 {names:["shawarma"],k100:220},
 {names:["hummus di ceci"],k100:166},
 {names:["guacamole avocado"],k100:150},
 {names:["chili con carne"],k100:150},
 {names:["burrito"],k100:200},
 {names:["tacos"],k100:220},
 {names:["quesadilla"],k100:300},
 {names:["curry di ceci"],k100:140},
 {names:["curry di lenticchie", "dhal", "dal"],k100:130},
 {names:["riso al curry"],k100:160},
 {names:["pad thai"],k100:190},
 {names:["riso cantonese"],k100:190},
 {names:["involtini primavera"],k100:220},
 {names:["gyoza"],k100:200},
 {names:["tempura"],k100:250},
 {names:["sushi nigiri"],k100:160},
 {names:["sushi maki"],k100:150},
 {names:["uramaki"],k100:180},
 {names:["sushi salmone"],k100:170},
 {names:["burger di soia"],k100:180},
 {names:["burger di ceci"],k100:170},
 {names:["burger di lenticchie"],k100:170},
 {names:["burger di verdure"],k100:150},
 {names:["polpette vegetali"],k100:170},
 {names:["tofu affumicato"],k100:150},
 {names:["tofu al naturale"],k100:76},
 {names:["seitan alla piastra"],k100:150},
 {names:["bevanda proteica"],k100:60},
 {names:["crema 100% arachidi"],k100:588},
 {names:["crema 100% mandorle"],k100:614},
 {names:["crema 100% nocciole"],k100:628},
 {names:["crema di nocciole"],k100:550},
 {names:["crema di mandorle"],k100:614},
 {names:["crema di anacardi"],k100:590},
 {names:["sciroppo d'acero"],k100:260},
 {names:["sciroppo d'agave"],k100:310},
 {names:["melassa"],k100:290},
 {names:["mostarda"],k100:200},
 {names:["salsa verde"],k100:250},
 {names:["salsa tonnata"],k100:350},
 {names:["tè verde", "te verde"],k100:1,generic:{"tazza": 240, "tazze": 240}},
 {names:["tè nero", "te nero"],k100:1,generic:{"tazza": 240, "tazze": 240}},
 {names:["tisana"],k100:1,generic:{"tazza": 240, "tazze": 240}},
 {names:["camomilla"],k100:1,generic:{"tazza": 240, "tazze": 240}},
 {names:["caffè decaffeinato", "caffe decaffeinato"],k100:2},
 {names:["ginseng bevanda"],k100:60},
 {names:["succo di mela"],k100:46},
 {names:["succo di ananas"],k100:53},
 {names:["succo ace"],k100:45},
 {names:["smoothie frutta"],k100:60},
 {names:["frullato di frutta"],k100:70},
 {names:["frappè", "frappe"],k100:120},
 {names:["bresaola di tacchino"],k100:120},
 {names:["prosciutto di tacchino"],k100:120},
 {names:["affettato di pollo"],k100:110},
 {names:["salmone in scatola"],k100:140},
 {names:["sgombro in scatola"],k100:200},
 {names:["sardine in scatola"],k100:200},
 {names:["uova strapazzate con burro"],k100:190},
 {names:["albumi pastorizzati"],k100:46}];


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
 const s=calorieNormalize(segment);
 let matches=[];
 for(const food of PATIENT_CALORIE_FOODS){
   for(const name of food.names){
     const idx=s.indexOf(name);
     if(idx>=0)matches.push({...food,matchedName:name,matchIndex:idx});
   }
 }
 if(!matches.length)return null;
 matches.sort((a,b)=>a.matchIndex-b.matchIndex || b.matchedName.length-a.matchedName.length);
 return matches[0];
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
function estimateDiaryCalories(entry){const r=calorieEstimateDay(entry);return (r.calculated+r.genericQuantity)?r.calories:null}
function dayEstimatedCalories(entry){return estimateDiaryCalories(entry)}
function latestDiaryCalories(p){
 const a=(p.entries||p.diary||[]).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date)));
 for(let i=a.length-1;i>=0;i--){const r=calorieEstimateDay(a[i]);if(r.calculated)return {date:a[i].date,calories:r.calories,quality:r.quality,qualityLabel:r.qualityLabel}}
 return null;
}
function cleanLegacyCalories(items){
 return (items||[]).map(x=>{const y={...x};delete y.estimatedCalories;return y});
}
function sorted(){return cleanLegacyCalories(load()).sort((a,b)=>a.date.localeCompare(b.date))}
function weighted(){return sorted().filter(x=>Number.isFinite(+x.weight)&&x.weight!=='')}

function bmiFor(weight,heightCm){
  const w=Number(weight),h=Number(heightCm)/100;
  return Number.isFinite(w)&&h>0?w/(h*h):null;
}
function bmiLabel(v){
  if(!Number.isFinite(v))return '';
  if(v<18.5)return 'Sottopeso';
  if(v<25)return 'Normopeso';
  if(v<30)return 'Sovrappeso';
  if(v<35)return 'Obesità I';
  if(v<40)return 'Obesità II';
  return 'Obesità III';
}
function movingAverageSeries(items,windowSize=7){
  const w=items.filter(x=>x.weight!=='');
  return w.map((x,i)=>{
    const slice=w.slice(Math.max(0,i-windowSize+1),i+1);
    const avg=slice.reduce((s,r)=>s+Number(r.weight),0)/slice.length;
    return {...x,avg};
  });
}
function filteredByDays(items,days){
  let a=[...items];
  if(days&&a.length){
    const end=new Date(a.at(-1).date+'T12:00:00');
    const start=new Date(end); start.setDate(end.getDate()-(days-1));
    a=a.filter(x=>new Date(x.date+'T12:00:00')>=start);
  }
  return a;
}

function chart(items,days){
  let w=filteredByDays(items.filter(x=>x.weight!==''),days);
  if(!w.length)return '<p class="muted">Nessun peso registrato.</p>';

  const avgSeries=movingAverageSeries(items).filter(x=>w.some(y=>y.date===x.date));
  let vals=w.map(x=>+x.weight);
  if(showMovingAverage) vals.push(...avgSeries.map(x=>x.avg));
  let rawMin=Math.min(...vals),rawMax=Math.max(...vals);
  let pad=Math.max(.5,(rawMax-rawMin)*.12);
  let min=Math.floor((rawMin-pad)*2)/2;
  let max=Math.ceil((rawMax+pad)*2)/2;
  if(max===min)max=min+1;
  const range=max-min;

  const left=31,right=156,top=7,bottom=60,dateY=75;
  const xFor=(date)=>{
    const idx=w.findIndex(x=>x.date===date);
    return w.length===1?(left+right)/2:left+idx/(w.length-1)*(right-left);
  };
  const yFor=v=>bottom-((v-min)/range)*(bottom-top);
  const pts=w.map(x=>`${xFor(x.date).toFixed(2)},${yFor(+x.weight).toFixed(2)}`).join(' ');
  const avgPts=avgSeries.map(x=>`${xFor(x.date).toFixed(2)},${yFor(x.avg).toFixed(2)}`).join(' ');

  const ticks=Array.from({length:5},(_,i)=>max-(range/4)*i);
  const grid=ticks.map(v=>{
    const y=yFor(v);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-4}" y="${y}" text-anchor="end" dominant-baseline="middle" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
  }).join('');
  const startLabel=fmt(w[0].date).replace(/^[^ ]+ /,'');
  const endLabel=fmt(w.at(-1).date).replace(/^[^ ]+ /,'');

  return `<div class="chart-wrap"><svg class="chart responsive-chart" viewBox="0 0 160 80" preserveAspectRatio="none">${grid}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"/><polyline points="${pts}" class="chart-line" fill="none" vector-effect="non-scaling-stroke"/>${w.map(x=>`<circle cx="${xFor(x.date)}" cy="${yFor(+x.weight)}" r="0.8" class="chart-point" vector-effect="non-scaling-stroke"/>`).join('')}${showMovingAverage&&avgPts?`<polyline points="${avgPts}" class="chart-average" fill="none" vector-effect="non-scaling-stroke"/>`:''}<text x="${left}" y="${dateY}" text-anchor="start" class="chart-x-label">${startLabel}</text><text x="${right}" y="${dateY}" text-anchor="end" class="chart-x-label">${endLabel}</text></svg><span class="chart-unit-fixed">kg</span></div>`;
}

function bmiChart(items,days){
  const profile=loadProfile();
  if(!profile.height)return '<p class="muted">Inserisci l’altezza nel Profilo per calcolare il BMI.</p>';
  let data=items.filter(x=>x.weight!=='').map(x=>({...x,bmi:bmiFor(x.weight,profile.height)})).filter(x=>Number.isFinite(x.bmi));
  data=filteredByDays(data,days);
  if(!data.length)return '<p class="muted">Nessun dato BMI disponibile.</p>';

  const vals=data.map(x=>x.bmi);
  const rawMin=Math.min(...vals),rawMax=Math.max(...vals);
  const pad=Math.max(.4,(rawMax-rawMin)*.12);
  let min=Math.floor((rawMin-pad)*2)/2;
  let max=Math.ceil((rawMax+pad)*2)/2;
  if(max===min)max=min+1;
  const range=max-min,left=31,right=156,top=7,bottom=60,dateY=75;
  const xFor=i=>data.length===1?(left+right)/2:left+i/(data.length-1)*(right-left);
  const yFor=v=>bottom-((v-min)/range)*(bottom-top);
  const pts=data.map((x,i)=>`${xFor(i).toFixed(2)},${yFor(x.bmi).toFixed(2)}`).join(' ');
  const ticks=Array.from({length:5},(_,i)=>max-(range/4)*i);
  const grid=ticks.map(v=>{
    const y=yFor(v);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-4}" y="${y}" text-anchor="end" dominant-baseline="middle" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
  }).join('');
  const startLabel=fmt(data[0].date).replace(/^[^ ]+ /,'');
  const endLabel=fmt(data.at(-1).date).replace(/^[^ ]+ /,'');
  return `<div class="chart-wrap"><svg class="chart responsive-chart" viewBox="0 0 160 80" preserveAspectRatio="none">${grid}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"/><polyline points="${pts}" class="chart-bmi-line" fill="none" vector-effect="non-scaling-stroke"/>${data.map((x,i)=>`<circle cx="${xFor(i)}" cy="${yFor(x.bmi)}" r="0.8" class="chart-bmi-point" vector-effect="non-scaling-stroke"/>`).join('')}<text x="${left}" y="${dateY}" text-anchor="start" class="chart-x-label">${startLabel}</text><text x="${right}" y="${dateY}" text-anchor="end" class="chart-x-label">${endLabel}</text></svg><span class="chart-unit-fixed">BMI</span></div>`;
}


const PLAN_META_KEY='diario-pro-plan-meta-v1',PLAN_DB='diario-pro-documents-v1',PLAN_STORE='plans';
function planMetaMap(){try{return JSON.parse(localStorage.getItem(PLAN_META_KEY)||'{}')||{}}catch(e){return {}}}
function patientPlanDocuments(){
 const pid=activePatientId()||'main';
 return documentMetaList().filter(d=>d.patientId===pid&&d.category==='plan').sort((a,b)=>String(b.validFrom||b.documentDate||b.uploadedAt).localeCompare(String(a.validFrom||a.documentDate||a.uploadedAt)));
}
function legacyPatientPlanMeta(){
 const pid=activePatientId()||'main',m=planMetaMap()[pid]||null;
 return m?{...m,id:'legacy-plan',patientId:pid,category:'plan',title:documentTitleFromFile(m.filename||'Piano alimentare'),validFrom:m.planDate||'',legacy:true}:null;
}
function mainPlanMeta(){
 const todayIso=isoToday();
 const valid=patientPlanDocuments().filter(d=>d.validFrom&&d.validFrom<=todayIso).sort((a,b)=>String(b.validFrom).localeCompare(String(a.validFrom)));
 return valid[0]||legacyPatientPlanMeta();
}function openPlanDb(){return new Promise((res,rej)=>{const r=indexedDB.open(PLAN_DB,3);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PLAN_STORE))r.result.createObjectStore(PLAN_STORE);if(!r.result.objectStoreNames.contains('labUploads'))r.result.createObjectStore('labUploads');if(!r.result.objectStoreNames.contains('privacy'))r.result.createObjectStore('privacy');if(!r.result.objectStoreNames.contains('documents'))r.result.createObjectStore('documents')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}async function readPlanPdf(id='main'){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction(PLAN_STORE,'readonly').objectStore(PLAN_STORE).get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}window.openPatientPlan=async planId=>{
 const pid=activePatientId()||'main';
 const meta=planId?(planId==='legacy-plan'?legacyPatientPlanMeta():documentMetaList().find(d=>d.id===planId&&d.patientId===pid&&d.category==='plan')):mainPlanMeta();
 if(!meta)return alert('Piano alimentare non disponibile.');
 try{
   let blob=null;
   if(meta.legacy){
     const d=await readPlanPdf(pid);if(d)blob=new Blob([d],{type:'application/pdf'});
   }else{
     blob=await readDocumentBlob(meta.fileId);
     if(meta.unreadForPatient===true){
       const items=documentMetaList(),stored=items.find(d=>d.id===meta.id);
       if(stored){stored.unreadForPatient=false;saveDocumentMetaList(items)}
     }
   }
   if(!blob)return alert('Piano alimentare non disponibile.');
   const u=URL.createObjectURL(blob);location.href=u;setTimeout(()=>URL.revokeObjectURL(u),120000);
 }catch(err){console.error(err);alert('Non riesco ad aprire il piano alimentare.')}
};

const PATIENT_APPT_KEY='diario-pro-appts-recovery-v1';
function patientAppointments(){
  try{
    const a=JSON.parse(localStorage.getItem(PATIENT_APPT_KEY)||'[]');
    return Array.isArray(a)?a:[];
  }catch(e){return []}
}
function nextPatientVisit(){
  const todayIso=isoToday();
  const future=patientAppointments()
    .filter(a=>a&&a.patientId===(activePatientId()||'main')&&a.type!=='personal'&&a.date>=todayIso)
    .sort((a,b)=>String((a.date||'')+(a.time||'')).localeCompare(String((b.date||'')+(b.time||''))));
  return future[0]||null;
}


async function storeLabPdf(key,b){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction('labUploads','readwrite');tx.objectStore('labUploads').put(b,key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
function pendingLabMap(){try{return JSON.parse(localStorage.getItem(PENDING_LABS_KEY)||'{}')||{}}catch(e){return {}}}
function parseLabValues(text){
 const c=String(text||'').replace(/\s+/g,' '),out={};
 const specs=[['glucose',['glicemia','glucosio']],['cholesterol',['colesterolo totale','colesterolo']],['hdl',['hdl']],['ldl',['ldl']],['triglycerides',['trigliceridi']],['got',['got','ast']],['gpt',['gpt','alt']],['uricAcid',['acido urico','uricemia']],['creatinine',['creatinina']],['ggt',['gamma gt','ggt']]];
 for(const [k,names] of specs)for(const n of names){const safe=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),m=c.match(new RegExp(safe+'[^0-9]{0,24}([0-9]+(?:[.,][0-9]+)?)','i'));if(m){out[k]=m[1].replace(',','.');break}}
 const dm=c.match(/\b([0-3]?\d)[\/.-]([01]?\d)[\/.-](20\d{2})\b/);out.date=dm?`${dm[3]}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}`:isoToday();return out;
}
let pdfJsCompatPromise=null;
function loadExternalScriptOnce(src,globalCheck){
 return new Promise((resolve,reject)=>{
   if(globalCheck())return resolve();
   const existing=[...document.scripts].find(x=>x.src===src);
   if(existing){
     existing.addEventListener('load',()=>resolve(),{once:true});
     existing.addEventListener('error',()=>reject(new Error('Errore caricamento '+src)),{once:true});
     return;
   }
   const s=document.createElement('script');
   s.src=src;
   s.async=false;
   s.onload=()=>resolve();
   s.onerror=()=>reject(new Error('Errore caricamento '+src));
   document.head.appendChild(s);
 });
}
function loadPdfJsCompat(){
 if(window.pdfjsLib && window.pdfjsWorker?.WorkerMessageHandler)return Promise.resolve(window.pdfjsLib);
 if(pdfJsCompatPromise)return pdfJsCompatPromise;

 const PDF_SRC='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
 const WORKER_SRC='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

 pdfJsCompatPromise=(async()=>{
   await loadExternalScriptOnce(PDF_SRC,()=>!!window.pdfjsLib);
   if(!window.pdfjsLib)throw new Error('PDF.js non disponibile');

   // Su iOS/PWA carichiamo anche il worker come normale script.
   // In questo modo PDF.js può usare WorkerMessageHandler sul main thread
   // (fake worker) se la creazione del Web Worker non è disponibile/affidabile.
   await loadExternalScriptOnce(WORKER_SRC,()=>!!window.pdfjsWorker?.WorkerMessageHandler);

   if(!window.pdfjsWorker?.WorkerMessageHandler)
     throw new Error('Motore PDF worker non disponibile');

   window.pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER_SRC;
   return window.pdfjsLib;
 })();

 return pdfJsCompatPromise;
}
async function extractPdfText(file){
 const pdfjs=await loadPdfJsCompat();
 const buffer=await file.arrayBuffer();
 const pdf=await pdfjs.getDocument({data:new Uint8Array(buffer),enableScripting:false}).promise;
 let t='';
 for(let i=1;i<=pdf.numPages;i++){
   const p=await pdf.getPage(i),c=await p.getTextContent();
   t+=' '+c.items.map(x=>x.str).join(' ');
 }
 return t;
}
async function queueBloodTestForReview(file,{documentId=null,patientId=null,documentDate=null}={}){
 const id=patientId||activePatientId()||'main';
 const key='lab-'+id+'-'+Date.now();
 let values={},note='';

 try{
   const extracted=await extractPdfText(file);
   values=parseLabValues(extracted);
   if(documentDate)values.date=documentDate;
   const recognized=Object.keys(values).filter(k=>k!=='date'&&values[k]!==''&&values[k]!=null).length;
   note=recognized
     ? `PDF letto correttamente: ${recognized} valori riconosciuti.`
     : 'PDF letto, ma nessun valore ematico è stato riconosciuto automaticamente.';
 }catch(e){
   console.error('PDF extraction error',e);
   values={date:documentDate||isoToday()};
   note='Lettura automatica non riuscita: il professionista potrà completare i valori manualmente.';
 }

 const m=pendingLabMap();
 m[key]={
   key,documentId,patientId:id,filename:file.name,
   uploadedAt:new Date().toISOString(),
   status:'Da verificare',values,note
 };
 localStorage.setItem(PENDING_LABS_KEY,JSON.stringify(m));
 return key;
}

// Compatibilità legacy: non più esposta in Dashboard.
window.uploadBloodTests=async input=>{if(readOnlyBlocked())return;
 const f=input.files?.[0];
 if(!f)return;
 if(f.type!=='application/pdf'&&!f.name.toLowerCase().endsWith('.pdf'))return alert('Seleziona un PDF.');
 const key=await queueBloodTestForReview(f);
 await storeLabPdf(key,await f.arrayBuffer());
 input.value='';
 alert('Analisi inviate al professionista per la verifica.');
 render();
};
function bloodUploadCard(){const id=activePatientId()||'main',n=Object.values(pendingLabMap()).filter(x=>x.patientId===id&&x.status==='Da verificare').length;return `<section class="card"><div class="section-head"><h2>Analisi del sangue</h2><span class="pill">${n?n+' in verifica':'PDF'}</span></div><p class="muted">Carica il referto. I valori riconosciuti vengono proposti al professionista, che deve confermarli.</p><label class="secondary upload-button">Carica analisi PDF<input type="file" accept="application/pdf,.pdf" onchange="uploadBloodTests(this)" hidden></label></section>`}

const NUBEMO_DAILY_QUOTES=['La costanza batte la giornata perfetta.', 'Oggi fai il tuo. Domani si vedrà.', 'La bilancia registra il peso, non tutto il lavoro che c’è dietro.', 'Non tutte le giornate devono essere memorabili. Devono solo esistere.', 'Un risultato lento resta un risultato.', 'Oggi niente imprese: fai semplicemente quello che avevi programmato.', 'La direzione conta più della velocità.', 'Una giornata storta non cancella quelle giuste.', 'Il corpo non legge il calendario: dagli tempo.', 'Non serve vincere ogni giorno per arrivare lontano.', 'La bilancia oggi ha un’opinione. Non necessariamente ragione.', 'Il piano perfetto? Quello che riesci a seguire anche martedì.', 'Se oggi va tutto liscio, bene. Se no, domani esiste ancora.', 'Il peso fa su e giù. Tu prova ad andare avanti.', 'NUBEMO non giudica. Al massimo fa i conti.', 'Una buona abitudine è noiosa solo finché non mostra i risultati.', 'Il percorso non richiede effetti speciali.', 'Oggi puoi anche non sentirti motivato. Il piano funziona lo stesso.', 'La perfezione è sopravvalutata. La continuità molto meno.', 'La bilancia non assegna voti.', 'Guarda la tendenza, non il singolo numero.', 'Quello che fai spesso conta più di quello che fai ogni tanto.', 'Un pasto non decide il percorso. Nemmeno una giornata.', 'Le abitudini lavorano anche quando non fanno rumore.', 'Misurare serve a capire, non a giudicare.', 'Il dato di oggi è un dato, non una sentenza.', 'Fai spazio ai risultati senza pretendere che arrivino in orario.', 'La routine è meno spettacolare della motivazione, ma dura di più.', 'Ripetere le cose semplici è una strategia.', 'Il cambiamento vero spesso sembra normale mentre accade.', 'Ci sono giorni in cui avanzare significa semplicemente non mollare.', 'Se oggi è difficile, riduci l’ambizione, non l’impegno.', 'Una giornata complicata non richiede una punizione domani.', 'Puoi essere stanco e continuare comunque con gentilezza.', 'Non devi recuperare ieri. Devi vivere bene oggi.', 'Quando il risultato tarda, il lavoro fatto non scompare.', 'Anche una settimana piatta fa parte di una linea che può scendere.', 'Non trasformare un numero inatteso in una storia che non conosci.', 'Il corpo può trattenere acqua. Tu non trattenere il buon senso.', 'Oggi potrebbe non essere il giorno del risultato. Può essere quello che lo prepara.', 'Ripartire non significa ricominciare da zero.', 'Hai già imparato cose che la prima volta non sapevi.', 'Un’interruzione cambia il ritmo, non necessariamente la destinazione.', 'Il prossimo passo non deve compensare nulla: deve solo essere quello giusto.', 'Ricominciare bene vale più che ricominciare forte.', 'Non aspettare il lunedì per fare una scelta utile.', 'Una deviazione non obbliga a cambiare strada.', 'Il percorso continua dal punto in cui sei, non da quello in cui vorresti essere.', 'Non serve cancellare una giornata: basta non trasformarla in una settimana.', 'Ogni ritorno alla routine è già progresso.', 'Concediti il tempo di accorgerti di quanto sei cambiato.', 'A volte il risultato arriva prima nelle abitudini e poi nei numeri.', 'La pazienza non è aspettare: è continuare mentre aspetti.', 'Non tutto ciò che migliora si vede subito.', 'Il lungo periodo è fatto di giornate molto normali.', 'Essere soddisfatti non significa aver finito.', 'Nota anche quello che oggi fai senza fatica e mesi fa sembrava difficile.', 'I progressi piccoli diventano evidenti quando smetti di guardarli con il microscopio.', 'Il tempo passa comunque. Tanto vale usarlo dalla tua parte.', 'Il risultato migliore è quello che riesci a mantenere.', 'Bevi, mangia, muoviti, dormi. A volte la strategia è meno misteriosa del previsto.', 'Fai la prossima scelta utile, non le prossime cento.', 'Se hai un piano, oggi devi solo seguirne un pezzo.', 'Controlla ciò che puoi controllare e lascia respirare il resto.', 'Prima la routine, poi le rifiniture.', 'Non cambiare strategia per colpa di un singolo dato.', 'Annotare bene oggi aiuta a capire meglio domani.', 'La regolarità rende leggibili anche i numeri.', 'Se qualcosa non funziona, si corregge. Non si processa.', 'Il percorso è anche imparare come risponde il tuo corpo.', 'Fatto è meglio di perfetto.', 'Oggi basta esserci.', 'Continua.', 'Un giorno alla volta è una misura sorprendentemente efficace.', 'Niente magie. Solo tempo e scelte ripetute.', 'Respira. Il trend ha più memoria della bilancia di stamattina.', 'Non devi dimostrare niente a nessuno.', 'Il prossimo dato arriverà. Nel frattempo vivi.', 'Meno rumore, più continuità.', 'Domani non ha bisogno di un oggi perfetto.'];
function dailyMotivationalQuote(date=new Date()){
 const start=new Date(2026,0,1);
 const day=new Date(date.getFullYear(),date.getMonth(),date.getDate());
 const index=((Math.floor((day-start)/86400000)%NUBEMO_DAILY_QUOTES.length)+NUBEMO_DAILY_QUOTES.length)%NUBEMO_DAILY_QUOTES.length;
 return NUBEMO_DAILY_QUOTES[index];
}

function home(){
  const profile=loadProfile();
  let visitHtml='';
  const effectiveNextVisit=nextPatientVisit();
  if(effectiveNextVisit?.date){
    const d=new Date(effectiveNextVisit.date+'T12:00:00');
    if(!Number.isNaN(d.getTime())){
      const visitDate=d.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'});
      const visitTime=effectiveNextVisit.time?` · ${escapeHtml(effectiveNextVisit.time)}`:'';
      visitHtml=`<section class="card next-visit-card"><div class="next-visit-icon">📅</div><div><div class="muted">Prossima visita</div><b>${visitDate}${visitTime}</b></div></section>`;
    }
  }
  let w=weighted(),last=w.at(-1),first=w[0];
  let delta=last&&first?(+last.weight)-(+first.weight):null;
  let deltaClass=delta<0?'good':delta>0?'up':'';
  const currentBmi=last&&profile.height?bmiFor(last.weight,profile.height):null;
  let goalHtml='';
  if(first&&last&&profile.goal&&Number(profile.goal)!==Number(first.weight)){
    const startWeight=Number(first.weight);
    const currentWeight=Number(last.weight);
    const goalWeight=Number(profile.goal);
    const direction=goalWeight>startWeight?1:-1;
    const totalJourney=Math.abs(goalWeight-startWeight);
    const completedJourney=(currentWeight-startWeight)*direction;
    const pct=totalJourney>0
      ? Math.round(Math.max(0,Math.min(1,completedJourney/totalJourney))*100)
      : 0;
    const remainingJourney=Math.max(0,(goalWeight-currentWeight)*direction);
    goalHtml=`<section class="card goal-card"><div class="section-head"><h2>Obiettivo</h2><span class="pill">${pct}%</span></div><div class="goal-row"><b>${kg(startWeight)}</b><span>→</span><b>${kg(goalWeight)}</b></div><div class="progress"><span style="width:${pct}%"></span></div><p class="muted">Peso attuale: ${kg(currentWeight)} · ${remainingJourney.toFixed(1).replace('.',',')} kg al traguardo</p></section>`;
  }
  const readOnlyNotice=patientReadOnly()?`<section class="card patient-readonly-notice"><div class="eyebrow">SOLA CONSULTAZIONE</div><h2>Percorso concluso</h2><p>NUBEMO è disponibile in modalità di sola consultazione. Puoi continuare ad accedere ai dati del tuo percorso.</p></section>`:'';
  return `<div class="hero-title"><div><div class="eyebrow">IL MIO PERCORSO</div><h1>${profile.name?`Il percorso di ${escapeHtml([profile.name,profile.surname].filter(Boolean).join(' '))}`:'Il mio percorso'}</h1></div><div class="hero-brand-chip"><img src="assets/nubemo-brand-clean-v2.png" alt=""></div></div>
  ${readOnlyNotice}
  <section class="daily-quote" aria-label="Pensiero del giorno">
    <span class="daily-quote-label">PENSIERO DEL GIORNO</span>
    <p>“${escapeHtml(dailyMotivationalQuote())}”</p>
  </section>
  <div class="patient-dashboard-daily-row">
    <section class="card highlight"><div class="muted caps">ULTIMA RILEVAZIONE</div>${last?`<div class="weight">${(+last.weight).toFixed(1).replace('.',',')} <small>kg</small></div><div class="delta ${deltaClass}">${delta>0?'+':''}${delta.toFixed(1).replace('.',',')} kg dall'inizio</div>${currentBmi?`<div class="bmi-now"><span>BMI</span><b>${currentBmi.toFixed(1).replace('.',',')}</b><small>${bmiLabel(currentBmi)}</small></div>`:''}<p class="muted">${fmt(last.date)}</p>`:'<p class="muted">Inserisci la prima giornata per iniziare.</p>'}</section>
    <div class="patient-dashboard-summary-wrap">${patientEnergyValuesVisible()?patientDiaryCalorieSummary():''}</div>
  </div>
  <div class="patient-dashboard-care-grid">
    <div class="patient-dashboard-goal">${goalHtml}</div>
    <div class="patient-dashboard-secondary">
      <div class="patient-dashboard-plan">${(()=>{const pm=mainPlanMeta();return pm?`<section class="card plan-card plan-card-current"><div class="plan-card-icon">📄</div><div class="plan-card-copy"><div class="plan-card-kicker">PIANO ALIMENTARE IN VIGORE</div><h2>Il mio piano alimentare</h2><b class="plan-card-file">${escapeHtml(pm.title||documentTitleFromFile(pm.filename||'Piano alimentare'))}</b><span class="plan-card-date">${pm.validFrom?'Valido dal '+fmtShort(pm.validFrom):pm.planDate?'Valido dal '+fmtShort(pm.planDate):'Pubblicato dal professionista'}</span></div><button class="secondary plan-card-open" onclick="openPatientPlan()">Apri PDF</button></section>`:''})()}</div>
      <div class="patient-dashboard-visit">${visitHtml}</div>
    </div>
  </div>
  <section class="card chart-card"><div class="section-head"><h2>Ultimi 7 giorni</h2><span class="pill">Peso</span></div>${chart(w,7)}</section>
  <div class="grid actions">${patientReadOnly()?'':'<button class="primary" onclick="newDay()">＋ Aggiungi giornata</button>'}<button class="secondary" onclick="go('trend')">📈 Andamento</button></div>`;
}
function formDataFromDOM(){
  let weight=$('#weight')?.value.trim().replace(',','.')??'';
  return {
    date:italianDateToIso($('#dateText')?.value)||$('#datePicker')?.value||editDate||isoToday(),
    weight:weight===''?'':Number(weight),
    water:(()=>{const v=($('#water')?.value||'').trim().replace(',','.');return v===''?'':Number(v)})(),
    coffee,
    sweetener:$('#sweetener')?.value.trim()||'',
    ...Object.fromEntries(['breakfast','snack1','lunch','snack2','dinner','notes'].map(k=>[k,$('#'+k)?.value.trim()||'']))
  };
}

function add(){
  let existing=editDate?load().find(x=>x.date===editDate):null;
  let data=duplicateDraft||existing||{};
  coffee=Number(data.coffee||0);
  let isEdit=!!existing&&!duplicateDraft;
  let targetDate=data.date||editDate||isoToday();
  let targetExists=duplicateDraft&&load().some(x=>x.date===targetDate);
  return `<div class="page-title"><button class="back" onclick="cancelEdit()">‹</button><div><div class="eyebrow">${duplicateDraft?'COPIA RAPIDA':isEdit?'REGISTRAZIONE':'NUOVA REGISTRAZIONE'}</div><h1>${duplicateDraft?'Duplica giornata':isEdit?'Modifica giornata':'Aggiungi giornata'}</h1></div>${isEdit?'<button class="mini danger-text" onclick="deleteDay()">Elimina</button>':''}</div>
  ${duplicateDraft?`<div class="notice">Stai copiando <b>${fmtShort(duplicateSource)}</b>. Peso escluso: modifica quello che vuoi e salva con una nuova data.</div>`:''}
  <section class="card form-card"><label>Data</label><div class="date-entry"><input id="dateText" type="text" inputmode="numeric" placeholder="GG-MM-AAAA" value="${isoToItalianDate(targetDate)}" onblur="manualDateChanged(this.value)"><label class="date-picker-btn" title="Apri calendario">📅<input id="datePicker" type="date" value="${targetDate}" onchange="pickerDateChanged(this.value)"></label></div>${targetExists?'<div class="warning">Questa data è già registrata. Scegline un’altra per evitare duplicati.</div>':''}
  ${patientEnergyValuesVisible()?(()=>{
    const ce=calorieEstimateDay(data);
    const bmr=patientBmr();
    return `<div class="diary-top-metrics">
      <div>
        <span>Calorie stimate</span>
        <b id="liveDiaryCalories">${ce.calculated?ce.calories+' kcal':'—'}</b>
        <small id="liveDiaryCaloriesQuality">${ce.calculated?'Stima '+ce.qualityLabel.toLowerCase():'Compila i pasti per la stima'}</small>
      </div>
      <div>
        <span>BMR a riposo</span>
        <b>${bmr?Math.round(bmr)+' kcal/giorno':'—'}</b>
        <small>${bmr?'Metabolismo basale stimato':'Completa peso, altezza, nascita e sesso'}</small>
      </div>
    </div>
    <p class="calorie-writing-tip-single">Per una stima più accurata indica <b>quantità + alimento</b>, separandoli con <b>+</b> o andando a capo. Esempio: <b>150 g yogurt greco + 45 g biscotti</b>.</p>`;
  })():''}
  <label>Peso (kg)</label><input id="weight" inputmode="decimal" placeholder="es. 115,6" value="${data.weight??''}">
  <div class="water-entry">
    <div class="water-entry-icon">💧</div>
    <div class="water-entry-field"><label>Acqua bevuta (litri)</label><input id="water" inputmode="decimal" placeholder="es. 1,5" value="${data.water??''}"><small>Facoltativo · indica il totale bevuto nella giornata.</small></div>
  </div>
  <label>Caffè</label><div class="coffee"><button onclick="setCoffee(-1)">−</button><strong id="coffee">${coffee}</strong><button onclick="setCoffee(1)">＋</button></div><label>Zucchero / dolcificante</label><input id="sweetener" value="${escapeHtml(data.sweetener||'')}" placeholder="es. senza zucchero, 1 cucchiaino, stevia…">
  ${[['breakfast','Colazione','🥐'],['snack1','Spuntino mattina','🍎'],['lunch','Pranzo','🍝'],['snack2','Spuntino pomeriggio','🍎'],['dinner','Cena','🍽️'],['notes','Sport / Note','🏃']].map(([k,l,i])=>`<label>${i} ${l}</label><textarea id="${k}" placeholder="Scrivi liberamente…">${data[k]||''}</textarea>`).join('')}
  <div class="form-actions"><button class="primary" onclick="saveDay()" ${targetExists?'disabled':''}>${duplicateDraft?'Salva copia':isEdit?'Aggiorna giornata':'Salva giornata'}</button>${isEdit?`<button class="secondary" onclick="startDuplicate()">⧉ Duplica giornata</button>`:''}</div></section>`;
}


function nubemoDeviceInfo(){
 const ua=navigator.userAgent||'';
 let device=/iPhone/i.test(ua)?'iPhone':/iPad/i.test(ua)?'iPad':/Android/i.test(ua)?'Android':/Windows/i.test(ua)?'Windows PC':/Macintosh/i.test(ua)?'Mac':'Dispositivo non identificato';
 let browser=/Edg\//.test(ua)?'Edge':/CriOS\//.test(ua)?'Chrome iOS':/Chrome\//.test(ua)?'Chrome':/FxiOS\//.test(ua)?'Firefox iOS':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Browser non identificato';
 return `${device} · ${browser} · ${innerWidth}×${innerHeight}`;
}
function patientSupportPage(){
 return `<div class="page-title"><button class="back" onclick="go('profile')">‹</button><div><div class="eyebrow">SUPPORTO TECNICO</div><h1>Assistenza NUBEMO</h1></div></div>
 <section class="card support-card">
   <h2>Segnala un problema</h2>
   <p>Hai riscontrato un problema tecnico nell'app? Descrivilo qui sotto: NUBEMO preparerà una mail per l'assistenza con alcune informazioni tecniche utili.</p>
   <div class="support-tech-info"><span>Area</span><b>Paziente</b><span>Versione</span><b>3.89</b><span>Dispositivo</span><b>${escapeHtml(nubemoDeviceInfo())}</b></div>
   <label>Area dell'app</label>
   <select id="patientSupportArea">
     <option value="Dashboard">Dashboard</option>
     <option value="Aggiungi giornata">Aggiungi giornata</option>
     <option value="Andamento">Andamento</option>
     <option value="Misure">Misure</option>
     <option value="Documenti">Documenti</option>
     <option value="Profilo">Profilo</option>
     <option value="Altro">Altro</option>
   </select>
   <label>Descrivi cosa è successo</label>
   <textarea id="patientSupportMessage" rows="6" placeholder="Es. Ho aperto la giornata del 21/08, ho premuto Duplica..."></textarea>
   <button class="primary support-send" type="button" onclick="sendPatientSupport()">Prepara email all'assistenza</button>
   <p class="muted support-privacy">Vengono inserite nella mail solo informazioni tecniche e il testo che scrivi. Peso, diario, dati clinici e documenti non vengono allegati automaticamente.</p>
 </section>
 <section class="card support-care-note"><b>Per questioni sul tuo percorso alimentare</b><p>Contatta direttamente il tuo professionista. Questa sezione è dedicata esclusivamente ai problemi tecnici di NUBEMO.</p></section>`;
}
window.sendPatientSupport=()=>{
 const msg=($('#patientSupportMessage')?.value||'').trim();
 if(!msg)return alert('Descrivi brevemente il problema prima di continuare.');
 const supportArea=$('#patientSupportArea')?.value||'Altro';
 const subject='NUBEMO - Segnalazione problema Area Paziente';
 const body=`Segnalazione problema NUBEMO

Versione: 3.89
Area: Paziente
Sezione selezionata: ${supportArea}
Pagina tecnica: ${page}
Dispositivo / browser: ${nubemoDeviceInfo()}

Descrizione:
${msg}

---
Messaggio generato da NUBEMO. Nessun dato clinico è stato allegato automaticamente.`;
 location.href=`mailto:giov.cavaliere@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

function profilePage(){
  const p=loadProfile();
  const last=weighted().at(-1);
  const currentBmi=p.height&&last?bmiFor(last.weight,p.height):null;
  const sexLabel=p.sex==='M'?'Maschile':p.sex==='F'?'Femminile':p.sex==='X'?'Altro / preferisco non specificare':'—';

  return `<div class="page-title"><button class="back" onclick="go('home')">‹</button><div><div class="eyebrow">DATI PERSONALI</div><h1>Profilo</h1></div></div>

  <section class="card support-entry-card">
    <div><div class="eyebrow">SUPPORTO TECNICO</div><h2>Assistenza NUBEMO</h2><p class="muted">Problemi con l'app? Segnalali direttamente al servizio NUBEMO, senza passare dal professionista.</p></div>
    <button class="secondary" type="button" onclick="go('support')">Segnala un problema</button>
  </section>

  <section class="card">
    <div class="section-head"><h2>Profilo gestito dal professionista</h2></div>
    <p class="muted">I dati anagrafici e i parametri del percorso sono gestiti dal professionista. Se qualcosa non è corretto, segnalalo durante la visita.</p>
  </section>

  <section class="card">
    <h2>Dati personali</h2>
    <div class="profile-read-grid">
      <div><span>Nome</span><b>${escapeHtml(p.name||'—')}</b></div>
      <div><span>Cognome</span><b>${escapeHtml(p.surname||'—')}</b></div>
      <div><span>Data di nascita</span><b>${p.birth?fmtShort(p.birth):'—'}</b></div>
      <div><span>Sesso</span><b>${sexLabel}</b></div>
      <div><span>Altezza</span><b>${p.height?p.height+' cm':'—'}</b></div>
      <div><span>Peso obiettivo</span><b>${p.goal?p.goal+' kg':'—'}</b></div>
      <div><span>Prossima visita</span><b>${(()=>{const a=nextPatientVisit();return a?.date?`${fmtShort(a.date)}${a.time?` · ${escapeHtml(a.time)}`:''}`:'—'})()}</b></div>
    </div>
  </section>

  <section class="card">
    <h2>Storia del peso</h2>
    <div class="profile-read-grid">
      <div><span>Peso minimo storico</span><b>${p.minWeight?p.minWeight+' kg':'—'}</b></div>
      <div><span>Peso massimo storico</span><b>${p.maxWeight?p.maxWeight+' kg':'—'}</b></div>
      <div><span>Peso ragionevole / concordato</span><b>${p.reasonableWeight?p.reasonableWeight+' kg':'—'}</b></div>
      <div><span>BMI attuale</span><b>${currentBmi?currentBmi.toFixed(1).replace('.',','):'—'}</b></div>
    </div>
  </section>

  <section class="card">
    <h2>Stile di vita</h2>
    <div class="profile-read-grid">
      <div><span>Attività lavorativa</span><b>${escapeHtml(p.work||'—')}</b></div>
      <div><span>Attività fisica abituale</span><b>${escapeHtml(p.activity||'—')}</b></div>
      <div><span>Fumo</span><b>${escapeHtml(p.smoking||'—')}</b></div>
      <div><span>Alcol</span><b>${escapeHtml(p.alcohol||'—')}</b></div>
    </div>
  </section><details class="patient-section"><summary>Anamnesi e obiettivi</summary><div class="profile-read-grid section-body"><div><span>Diagnosi / motivo</span><b>${escapeHtml(p.diagnosis||'—')}</b></div><div><span>Alvo</span><b>${escapeHtml(p.bowel||'—')}</b></div><div><span>Diete pregresse</span><b>${escapeHtml(p.previousDiets||'—')}</b></div><div><span>Allergie / intolleranze</span><b>${escapeHtml(p.allergies||'—')}</b></div><div><span>Farmaci</span><b>${escapeHtml(p.medications||'—')}</b></div><div><span>Disturbi gastrointestinali</span><b>${escapeHtml(p.giIssues||'—')}</b></div><div><span>Patologie / interventi</span><b>${escapeHtml(p.pastConditions||'—')}</b></div><div><span>Osservazioni</span><b>${escapeHtml(p.observations||'—')}</b></div><div><span>Obiettivi</span><b>${escapeHtml(p.objectives||'—')}</b></div></div></details>`;
}
function mergedMeasures(){
  const diary=sorted();
  const measures=loadMeasures();
  const dates=new Set([
    ...diary.filter(x=>x.weight!=='').map(x=>x.date),
    ...measures.map(x=>x.date)
  ]);
  return [...dates].sort().map(date=>{
    const d=diary.find(x=>x.date===date)||{};
    const m=measures.find(x=>x.date===date)||{};
    return {
      date,
      weight:d.weight??'',
      waist:m.waist??'',
      hips:m.hips??'',
      notes:m.notes??''
    };
  });
}

function visibleMeasures(){
  const rows=mergedMeasures();
  return measuresCompleteOnly ? rows.filter(r=>r.waist!==''&&r.hips!=='') : rows;
}

function measuresPage(){
  const p=loadProfile();
  const allRows=mergedMeasures();
  const completeCount=allRows.filter(r=>r.waist!==''&&r.hips!=='').length;
  const weightCount=allRows.filter(r=>r.weight!=='').length;
  const rows=visibleMeasures().slice().reverse();

  return `<div class="hero-title"><div><div class="eyebrow">EVOLUZIONE CORPOREA</div><h1>Misurazioni</h1></div><button class="pdf-btn" onclick="exportMeasuresPDF()">PDF</button></div>
  ${patientReadOnly()?'':`<section class="card">
    <div class="section-head"><h2>Nuova misurazione</h2><span class="pill">Facoltativa</span></div>
    <label>Data</label><div class="date-entry"><input id="measureDate" inputmode="numeric" placeholder="GG-MM-AAAA" value="${isoToItalianDate(isoToday())}"><label class="date-picker-btn">📅<input id="measureDatePicker" type="date" value="${isoToday()}" onchange="document.getElementById('measureDate').value=isoToItalianDate(this.value)"></label></div>
    <div class="measure-grid">
      <div><label>Vita (cm)</label><input id="measureWaist" inputmode="decimal" placeholder="es. 105"></div>
      <div><label>Fianchi (cm)</label><input id="measureHips" inputmode="decimal" placeholder="es. 112"></div>
    </div>
    <label>Note</label><textarea id="measureNotes" rows="2" placeholder="Note sulla misurazione"></textarea>
    <div class="measure-actions">
      <button class="secondary" id="deleteMeasureBtn" onclick="deleteMeasureForm()" style="display:none">Elimina misurazione</button>
      <button class="primary" onclick="saveMeasureForm()">Salva misurazione</button>
    </div>
    <p class="muted measure-note">Il peso non si inserisce qui: viene recuperato automaticamente dal Diario della stessa data. Se correggi il peso nel Diario, si aggiorna anche qui.</p>
  </section>`}

  <section class="card">
    <div class="section-head"><h2>Storico misurazioni</h2><span class="pill">${completeCount} complete · ${weightCount} pesate</span></div>
    <label class="measure-filter">
      <input type="checkbox" ${measuresCompleteOnly?'checked':''} onchange="measuresCompleteOnly=this.checked;render()">
      <span>Visualizza solo misurazioni complete</span>
    </label>
    <p class="muted filter-help">${measuresCompleteOnly?'Sono mostrate solo le date con Vita e Fianchi compilati. Anche il PDF userà questo filtro.':'Sono mostrate tutte le pesate e le eventuali circonferenze. Anche il PDF userà questa vista.'}</p>
    <div class="measure-table-wrap">
      <table class="measure-table">
        <thead><tr><th>Data</th><th>Peso</th><th>BMI</th><th>Vita</th><th>Fianchi</th><th>Note</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr ${patientReadOnly()?'':`onclick="editMeasure('${r.date}')"`}><td>${fmtShort(r.date)}</td><td>${r.weight!==''?kg(r.weight):'—'}</td><td>${r.weight!==''&&p.height?bmiFor(r.weight,p.height).toFixed(1).replace('.',','):'—'}</td><td>${r.waist!==''?String(r.waist).replace('.',',')+' cm':'—'}</td><td>${r.hips!==''?String(r.hips).replace('.',',')+' cm':'—'}</td><td>${escapeHtml(r.notes||'')}</td></tr>`).join('') || `<tr><td colspan="6" class="empty-cell">Nessuna misurazione da mostrare.</td></tr>`}
        </tbody>
      </table>
    </div>
  </section>`;
}
window.saveMeasureForm=()=>{if(readOnlyBlocked())return;
  const date=italianDateToIso($('#measureDate')?.value);
  if(!date)return alert('Inserisci la data.');
  const parse=id=>{
    const v=($(id)?.value||'').trim().replace(',','.');
    return v===''?'':Number(v);
  };
  const waist=parse('#measureWaist');
  const hips=parse('#measureHips');
  const notes=($('#measureNotes')?.value||'').trim();
  if(waist!==''&&(!Number.isFinite(waist)||waist<30||waist>250))return alert('Controlla la circonferenza vita.');
  if(hips!==''&&(!Number.isFinite(hips)||hips<30||hips>250))return alert('Controlla la circonferenza fianchi.');
  let arr=loadMeasures().filter(x=>x.date!==date);
  arr.push({date,waist,hips,notes});
  saveMeasures(arr.sort((a,b)=>a.date.localeCompare(b.date)));
  render();
  alert('Misurazione salvata.');
};

window.editMeasure=date=>{
  const m=loadMeasures().find(x=>x.date===date)||{};
  $('#measureDate').value=isoToItalianDate(date);
  $('#measureWaist').value=m.waist??'';
  $('#measureHips').value=m.hips??'';
  $('#measureNotes').value=m.notes??'';
  const btn=$('#deleteMeasureBtn');
  if(btn)btn.style.display='inline-flex';
  scrollTo({top:0,behavior:'smooth'});
};

function makeMeasuresPdfBlob(){
  const p=loadProfile();
  const rows=visibleMeasures().map(r=>[
    fmtShort(r.date),
    r.weight!==''&&r.weight!=null?Number(r.weight).toFixed(1).replace('.',','):'',
    r.weight!==''&&p.height?bmiFor(r.weight,p.height).toFixed(1).replace('.',','):'',
    r.waist!==''&&r.waist!=null?Number(r.waist).toFixed(1).replace('.',','):'',
    r.hips!==''&&r.hips!=null?Number(r.hips).toFixed(1).replace('.',','):'',
    r.notes||''
  ]);

  const headers=['Data','Peso (kg)','BMI','Vita (cm)','Fianchi (cm)','Note'];
  const widths=[70,70,60,75,85,390];
  const x0=22,pageW=842,pageH=595,top=525,bottom=28;
  const fontSize=7,lineH=9,pad=4;
  let pages=[],current=[],y=top;

  function prepareRow(cells,isHeader=false){
    const wrapped=cells.map((c,i)=>wrapCell(c,Math.max(4,Math.floor((widths[i]-pad*2)/(fontSize*.50)))));
    const lines=Math.max(...wrapped.map(a=>a.length));
    const h=Math.max(isHeader?23:19,lines*lineH+pad*2);
    return {wrapped,h,isHeader};
  }

  const head=prepareRow(headers,true);
  function newPage(){
    current=[];
    pages.push(current);
    y=top;
    current.push({...head,y:y-head.h});
    y-=head.h;
  }

  newPage();
  rows.forEach(row=>{
    const pr=prepareRow(row,false);
    if(y-pr.h<bottom)newPage();
    current.push({...pr,y:y-pr.h});
    y-=pr.h;
  });

  let objects=[];
  const add=o=>{objects.push(o);return objects.length};
  const fontRegular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesObj=add('PAGES_PLACEHOLDER');
  let pageIds=[];

  pages.forEach((items,pageIndex)=>{
    let stream='';
    const title=p.name?`Misurazioni - ${p.name}`:'Misurazioni';
    const filterLabel=measuresCompleteOnly?'Solo misurazioni complete':'Tutte le rilevazioni';
    const detail=[
      p.height?`Altezza: ${p.height} cm`:'',
      p.goal?`Obiettivo: ${Number(p.goal).toFixed(1).replace('.',',')} kg`:'',
      rows.length?`Periodo: ${rows[0][0]} / ${rows.at(-1)[0]}`:'',
      filterLabel
    ].filter(Boolean).join('   ');

    stream+=`BT /F2 13 Tf 22 566 Td (${pdfEscape(title)}) Tj ET\n`;
    if(detail)stream+=`BT /F1 7 Tf 22 550 Td (${pdfEscape(detail)}) Tj ET\n`;

    items.forEach(item=>{
      let x=x0,yBottom=item.y;
      item.wrapped.forEach((cellLines,i)=>{
        const w=widths[i];
        if(item.isHeader)stream+=`0.91 0.96 0.96 rg ${x} ${yBottom} ${w} ${item.h} re f 0 0 0 rg\n`;
        stream+=`0.72 G 0.35 w ${x} ${yBottom} ${w} ${item.h} re S 0 G\n`;
        cellLines.forEach((line,li)=>{
          const ty=yBottom+item.h-pad-fontSize-li*lineH;
          if(ty>yBottom+1)stream+=`BT /${item.isHeader?'F2':'F1'} ${fontSize} Tf ${x+pad} ${ty} Td (${pdfEscape(line)}) Tj ET\n`;
        });
        x+=w;
      });
    });

    stream+=`BT /F1 6 Tf 760 12 Td (Pagina ${pageIndex+1}/${pages.length}) Tj ET\n`;
    const contentId=add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    const pageId=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesObj-1]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`;
  const catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  let pdf='%PDF-1.4\n%Measurements\n',offsets=[0];
  objects.forEach((obj,i)=>{
    offsets[i+1]=pdf.length;
    pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;
  });

  const xref=pdf.length;
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf],{type:'application/pdf'});
}


window.deleteMeasureForm=()=>{if(readOnlyBlocked())return;
  const date=$('#measureDate')?.value;
  if(!date)return alert('Seleziona prima una misurazione da eliminare.');
  const existing=loadMeasures().find(x=>x.date===date);
  if(!existing)return alert('Per questa data non ci sono misurazioni da eliminare.');
  if(!confirm(`Eliminare la misurazione del ${fmtShort(date)}?`))return;
  const arr=loadMeasures().filter(x=>x.date!==date);
  saveMeasures(arr);
  render();
  alert('Misurazione eliminata.');
};

window.exportMeasuresPDF=()=>{
  const rows=visibleMeasures();
  if(!rows.length)return alert(measuresCompleteOnly?'Nessuna misurazione completa da esportare.':'Nessuna misurazione da esportare.');
  const blob=makeMeasuresPdfBlob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`Misurazioni_${rows[0].date}_${rows.at(-1).date}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
};


function patientEnergyValuesVisible(){return loadProfile().showEnergyValues!==false}
function patientReadOnly(){return loadProfile().readOnly===true}
function readOnlyBlocked(){if(!patientReadOnly())return false;alert('NUBEMO è in modalità di sola consultazione. Puoi consultare ed esportare i dati del tuo percorso, ma non modificarli.');return true}

function patientAgeYears(birth){
  if(!birth)return null;
  const b=new Date(birth+'T12:00:00'),n=new Date();
  if(Number.isNaN(b.getTime()))return null;
  let a=n.getFullYear()-b.getFullYear();
  if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))a--;
  return a;
}
function patientBmr(){
  const p=loadProfile(),last=weighted().at(-1);
  const w=last?Number(last.weight):null,h=Number(p.height),a=patientAgeYears(p.birth);
  if(!w||!h||a==null||!['M','F'].includes(p.sex))return null;
  return 10*w+6.25*h-5*a+(p.sex==='M'?5:-161);
}

function patientDiaryCalorieSummary(){
  const calorieDays=sorted().map(x=>({date:x.date,estimate:calorieEstimateDay(x)})).filter(x=>(x.estimate.calculated+x.estimate.genericQuantity)>0);
  const last=calorieDays.at(-1),bmr=patientBmr();
  return `<section class="card diary-calorie-card"><div class="section-head"><h2>Oggi in sintesi</h2><span class="pill">Stima</span></div><div class="calorie-summary-grid">
  <div><span>Calorie stimate</span><b>${last?last.estimate.calories+' kcal':'—'}</b><small>${last?fmtShort(last.date)+' · '+last.estimate.qualityLabel:'Nessun dato interpretabile'}</small></div>
  <div><span>BMR a riposo</span><b>${bmr?Math.round(bmr)+' kcal/giorno':'—'}</b><small>${bmr?'Metabolismo basale stimato':'Servono peso, altezza, nascita e sesso'}</small></div></div>
  <p class="muted calorie-disclaimer">Le calorie sono una stima del diario; le quantità generiche o gli alimenti non riconosciuti riducono la precisione.</p></section>`;
}

function trend(){
  let all=weighted(),first=all[0],last=all.at(-1),delta=first&&last?(+last.weight)-(+first.weight):null;
  const p=loadProfile();
  const currentBmi=last&&p.height?bmiFor(last.weight,p.height):null;
  const q=historySearch.trim().toLowerCase();
  const history=sorted().reverse().filter(x=>!q||[x.date,x.breakfast,x.snack1,x.lunch,x.snack2,x.dinner,x.notes,x.sweetener,String(x.weight),String(x.water),String(x.coffee)].join(' ').toLowerCase().includes(q));
  return `<div class="hero-title"><div><div class="eyebrow">STATISTICHE</div><h1>Andamento</h1></div><button class="pdf-btn" onclick="exportPDF()">PDF</button></div>
  
  <section class="card chart-card"><div class="section-head"><h2>Peso</h2><label class="toggle"><input type="checkbox" ${showMovingAverage?'checked':''} onchange="showMovingAverage=this.checked;render()"><span>Media 7 gg</span></label></div><div class="tabs">${[[7,'7 giorni'],[30,'30 giorni'],[90,'3 mesi'],[0,'Tutto']].map(([n,l])=>`<button class="${trendDays===n?'active':''}" onclick="trendDays=${n};render()">${l}</button>`).join('')}</div>${chart(all,trendDays)}</section>
  <section class="card summary"><div class="section-head"><h2>Riepilogo peso</h2><span class="pill">Totale</span></div>${first?`<div class="stats"><div><span>Peso iniziale</span><b>${kg(first.weight)}</b></div><div><span>Ultimo peso</span><b>${kg(last.weight)}</b></div><div><span>Variazione</span><b class="${delta<0?'good':delta>0?'up':''}">${delta>0?'+':''}${delta.toFixed(1).replace('.',',')} kg</b></div></div>`:'<p class="muted">Nessun dato.</p>'}</section>
  <section class="card chart-card"><div class="section-head"><h2>BMI</h2>${currentBmi?`<span class="pill">${currentBmi.toFixed(1).replace('.',',')} · ${bmiLabel(currentBmi)}</span>`:'<span class="pill">Profilo</span>'}</div><div class="tabs">${[[7,'7 giorni'],[30,'30 giorni'],[90,'3 mesi'],[0,'Tutto']].map(([n,l])=>`<button class="${bmiDays===n?'active':''}" onclick="bmiDays=${n};render()">${l}</button>`).join('')}</div>${bmiChart(all,bmiDays)}</section>
  <section class="card"><div class="section-head"><h2>Storico</h2><div class="head-actions">${patientReadOnly()?'':'<button class="mini" onclick="showImport()">↑ Importa storico</button>'}<button class="mini" onclick="exportBackup()">↓ Backup</button>${patientReadOnly()?'':'<button class="mini" onclick="document.getElementById(\'backupFile\').click()">↑ Ripristina</button><input id="backupFile" type="file" accept=".json,application/json" style="display:none" onchange="restoreBackup(event)">'}<button class="mini" onclick="exportPDF()">↓ Esporta PDF</button></div></div>
  <div class="search-wrap"><input id="historySearch" type="search" placeholder="Cerca nello storico…" value="${escapeHtml(historySearch)}" oninput="historySearch=this.value;renderPreserveSearch()"></div>
  ${history.map(x=>`<div class="listitem" ${patientReadOnly()?'':`onclick="edit('${x.date}')"`}><span><b>${fmtShort(x.date)}</b><small>${fmt(x.date).split(' ')[0]}</small></span><div class="history-right"><b>${kg(x.weight)}</b>${x.water!==''&&x.water!=null?`<small>💧 ${Number(x.water).toFixed(1).replace('.',',')} L acqua</small>`:''}${p.height&&x.weight!==''?`<small>BMI ${bmiFor(x.weight,p.height).toFixed(1).replace('.',',')}</small>`:''}${patientEnergyValuesVisible()?(()=>{const ce=calorieEstimateDay(x);return (ce.calculated+ce.genericQuantity)>0?`<small>${ce.calories} kcal · stima ${ce.qualityLabel.toLowerCase()}</small>`:''})():''}</div></div>`).join('')||'<p class="muted">Nessuna giornata trovata.</p>'}</section>`;
}
window.renderPreserveSearch=()=>{
  const pos=document.scrollingElement?.scrollTop||0;
  const val=$('#historySearch')?.value||historySearch;
  historySearch=val;
  render();
  requestAnimationFrame(()=>{window.scrollTo(0,pos);const el=$('#historySearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}});
};


function showImport(){
  importText='';
  importPreview=null;
  page='import';
  render();
  scrollTo(0,0);
}

function importPage(){
  const preview=importPreview;
  return `<div class="page-title"><button class="back" onclick="cancelImport()">‹</button><div><div class="eyebrow">CARICAMENTO DATI</div><h1>Importa storico</h1></div></div>
  <section class="card import-card">
    <p class="muted import-help">Apri le Note iOS, seleziona e copia tutta la tabella del diario, poi incollala qui sotto. Puoi includere anche la riga delle intestazioni.</p>
    <label for="historyImport">Storico da Note iOS</label>
    <textarea id="historyImport" class="import-textarea" placeholder="Incolla qui tutto lo storico…">${escapeHtml(importText)}</textarea>
    <div class="import-actions"><button class="secondary" onclick="analyzeImport()">Analizza dati</button>${preview&&preview.validRows.length?'<button class="primary" onclick="confirmImport()">Importa '+preview.validRows.length+' giornate</button>':''}</div>
    ${preview?importPreviewHtml(preview):''}
  </section>
  <section class="card"><h2>Come vengono gestiti i dati</h2><p class="muted import-help">Il simbolo <b>/</b> diventa un campo vuoto. Le giornate senza peso vengono conservate. Se una data esiste già, viene aggiornata anziché duplicata. La colonna +/- non viene importata perché il Diario ricalcola automaticamente la variazione.</p></section>`;
}

function escapeHtml(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function parseHistoryText(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n').map(x=>x.trimEnd()).filter(x=>x.trim());
  let start=0;
  if(lines[0] && (/^Giorno[\t;]/i.test(lines[0]) || /^Giorno\s+/i.test(lines[0]))) start=1;
  const validRows=[];
  const errors=[];
  const clean=v=>{v=(v??'').trim();return v==='/'?'':v;};

  for(let i=start;i<lines.length;i++){
    let cols=lines[i].split('\t');
    if(cols.length<10) cols=lines[i].split(';');
    if(cols.length<10){
      errors.push(`Riga ${i+1}: non riconosco le colonne. Verifica che la riga sia stata copiata insieme alla tabella.`);
      continue;
    }
    let [d,weekday,weight,delta,coffee,breakfast,snack1,lunch,snack2,dinner,...notesParts]=cols;
    d=clean(d);
    const m=d.match(/^(\d{1,2})-(\d{1,2})$/);
    if(!m){errors.push(`Riga ${i+1}: data "${d}" non valida.`);continue;}
    let day=+m[1], month=+m[2];
    // Correzione concordata per lo storico 2026: le tre righe finali erano state digitate come settembre.
    if(month===9 && [7,8,9].includes(day)) month=8;
    if(month<1||month>12||day<1||day>31){errors.push(`Riga ${i+1}: data "${d}" non valida.`);continue;}
    const date=`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const w=clean(weight).replace(',','.');
    const c=clean(coffee);
    const row={
      date,
      weight:w===''?'':Number(w),
      coffee:c===''?0:(Number(c)||0),
      breakfast:clean(breakfast),
      snack1:clean(snack1),
      lunch:clean(lunch),
      snack2:clean(snack2),
      dinner:clean(dinner),
      notes:clean(notesParts.join('\t'))
    };
    if(w!==''&&!Number.isFinite(row.weight)){errors.push(`Riga ${i+1}: peso "${weight}" non valido.`);continue;}
    validRows.push(row);
  }
  validRows.sort((a,b)=>a.date.localeCompare(b.date));
  return {validRows,errors,totalLines:Math.max(0,lines.length-start)};
}

function importPreviewHtml(p){
  if(!p.validRows.length){
    return `<div class="import-result bad"><b>Nessuna giornata riconosciuta.</b><span>${p.errors[0]||'Controlla il testo incollato.'}</span></div>`;
  }
  const first=p.validRows[0],last=p.validRows.at(-1);
  return `<div class="import-result ok"><b>${p.validRows.length} giornate riconosciute</b><span>Dal ${fmtShort(first.date)} al ${fmtShort(last.date)}</span><span>${p.validRows.filter(x=>x.weight!=='').length} rilevazioni di peso</span>${p.errors.length?`<span class="import-warn">${p.errors.length} righe da controllare</span>`:'<span>Nessun errore rilevato</span>'}</div>${p.errors.length?`<details class="import-errors"><summary>Mostra righe non riconosciute</summary>${p.errors.slice(0,12).map(x=>`<div>${escapeHtml(x)}</div>`).join('')}</details>`:''}`;
}

window.analyzeImport=()=>{
  const box=$('#historyImport');
  importText=box?box.value:'';
  importPreview=parseHistoryText(importText);
  render();
  setTimeout(()=>$('#historyImport')?.focus(),0);
};

window.confirmImport=()=>{if(readOnlyBlocked())return;
  if(!importPreview||!importPreview.validRows.length)return alert('Prima analizza i dati da importare.');
  const current=load();
  const byDate=new Map(current.map(x=>[x.date,x]));
  let inserted=0,updated=0;
  for(const row of importPreview.validRows){
    if(byDate.has(row.date))updated++;else inserted++;
    byDate.set(row.date,row);
  }
  const merged=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const ok=confirm(`Importare ${importPreview.validRows.length} giornate?\n\nNuove: ${inserted}\nDa aggiornare: ${updated}\nTotale dopo l'importazione: ${merged.length}`);
  if(!ok)return;
  save(merged);
  importText='';importPreview=null;
  page='trend';editDate=null;duplicateDraft=null;duplicateSource=null;
  render();scrollTo(0,0);
  alert(`Importazione completata. ${merged.length} giornate presenti nel Diario.`);
};

window.cancelImport=()=>{importText='';importPreview=null;page='trend';render();scrollTo(0,0)};


function exportBackup(){
  const entries=load();
  const payload={
    app:"Diario",
    version:1,
    exportedAt:new Date().toISOString(),
    profile:(()=>{const p={...loadProfile()};delete p.nextVisit;return p;})(),
    measurements:loadMeasures(),
    entries:entries
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  const today=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download=`diario-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function restoreBackup(event){
  const file=event.target.files && event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const entries=Array.isArray(parsed)?parsed:parsed.entries;
      const profile=Array.isArray(parsed)?null:parsed.profile;
      const measurements=Array.isArray(parsed)?null:parsed.measurements;
      if(!Array.isArray(entries))throw new Error("Formato backup non valido");
      const valid=entries.every(x=>x && typeof x.date==="string");
      if(!valid)throw new Error("Il file non contiene giornate valide");
      const ok=confirm(`Ripristinare ${entries.length} giornate?\n\nI dati attualmente presenti nel Diario verranno sostituiti.`);
      if(!ok)return;
      save(entries.sort((a,b)=>a.date.localeCompare(b.date)));
      if(profile&&typeof profile==='object')saveProfile(profile);
      if(Array.isArray(measurements))saveMeasures(measurements);
      editDate=null;
      duplicateDraft=null;
      duplicateSource=null;
      page="trend";
      render();
      alert(`Ripristino completato: ${entries.length} giornate caricate.`);
    }catch(err){
      alert("Impossibile ripristinare il backup: "+err.message);
    }finally{
      event.target.value="";
    }
  };
  reader.readAsText(file);
}


const DOCUMENT_META_KEY='nubemo-documents-meta-v1';
const DOCUMENT_STORE='documents';
const DOCUMENT_MAX_BYTES=10*1024*1024;

function documentMetaList(){
  try{return JSON.parse(localStorage.getItem(DOCUMENT_META_KEY)||'[]')||[]}
  catch(e){return []}
}
function saveDocumentMetaList(items){localStorage.setItem(DOCUMENT_META_KEY,JSON.stringify(items))}

function hasUnreadPatientDocuments(){
  return documentMetaList().some(d=>d.patientId===activePatientId()&&d.unreadForPatient===true);
}
function markPatientDocumentsRead(){
  const items=documentMetaList();let changed=false;
  items.forEach(d=>{if(d.patientId===activePatientId()&&d.unreadForPatient===true){d.unreadForPatient=false;changed=true}});
  if(changed)saveDocumentMetaList(items);
}
function patientDocuments(subCategory='other'){
  const pid=activePatientId();
  return documentMetaList()
    .filter(d=>d.patientId===pid&&d.category==='health'&&d.subCategory===subCategory)
    .sort((a,b)=>String(b.documentDate||b.uploadedAt).localeCompare(String(a.documentDate||a.uploadedAt)));
}
function patientBloodTestDocuments(){return patientDocuments('blood_test')}
function patientOtherHealthDocuments(){return patientDocuments('other')}
function patientAccountingDocuments(){
  const pid=activePatientId();
  return documentMetaList()
    .filter(d=>d.patientId===pid&&d.category==='accounting')
    .sort((a,b)=>String(b.documentDate||b.uploadedAt).localeCompare(String(a.documentDate||a.uploadedAt)));
}
function documentTitleFromFile(name=''){
  return String(name).replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
}
function documentId(prefix='doc'){
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}
async function writeDocumentBlob(fileId,file){
  const db=await openPlanDb();
  return new Promise((res,rej)=>{
    const tx=db.transaction(DOCUMENT_STORE,'readwrite');
    tx.objectStore(DOCUMENT_STORE).put(file,fileId);
    tx.oncomplete=()=>res();
    tx.onerror=()=>rej(tx.error);
  });
}
async function readDocumentBlob(fileId){
  const db=await openPlanDb();
  return new Promise((res,rej)=>{
    const r=db.transaction(DOCUMENT_STORE,'readonly').objectStore(DOCUMENT_STORE).get(fileId);
    r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error);
  });
}
async function openStoredDocument(id){
  const items=documentMetaList();
  const meta=items.find(d=>d.id===id&&d.patientId===activePatientId());
  if(!meta)return alert('Documento non trovato.');
  const blob=await readDocumentBlob(meta.fileId);
  if(!blob)return alert('File non disponibile.');

  if(meta.unreadForPatient===true){
    meta.unreadForPatient=false;
    saveDocumentMetaList(items);
  }

  const url=URL.createObjectURL(blob);
  window.location.href=url;
  setTimeout(()=>URL.revokeObjectURL(url),120000);
}
function documentsPage(){
  const blood=patientBloodTestDocuments(),other=patientOtherHealthDocuments(),accounting=patientAccountingDocuments();
  const legacy=legacyPatientPlanMeta(),plans=patientPlanDocuments(),planRows=[...plans],current=mainPlanMeta();
  if(legacy&&!plans.some(x=>x.filename===legacy.filename&&x.validFrom===legacy.validFrom))planRows.push(legacy);
  planRows.sort((a,b)=>String(b.validFrom||'').localeCompare(String(a.validFrom||'')));
  const row=d=>`<div class="document-row ${d.unreadForPatient===true?'document-row-unread':''}"><div><b>${escapeHtml(d.title)}${d.unreadForPatient===true?'<span class="document-new-badge">NUOVO</span>':''}</b><span>${d.documentDate?fmtShort(d.documentDate):'Data non indicata'} · ${escapeHtml(d.fileName||'Documento')}</span></div><button class="secondary compact" data-open-patient-document="${d.id}">Apri</button></div>`;
  return `<div class="page-title"><button class="back" onclick="go('home')">‹</button><div><div class="eyebrow">ARCHIVIO PAZIENTE</div><h1>Documenti</h1></div></div>
  <section class="card"><div class="section-head"><h2>Documenti contabili</h2><span class="pill">${accounting.length}</span></div><p class="muted">Fatture e documenti contabili pubblicati dal professionista. Sono disponibili in sola consultazione.</p>${accounting.length?`<div class="document-list">${accounting.map(d=>`<div class="document-row ${d.unreadForPatient===true?'document-row-unread':''}"><div><b>${escapeHtml(d.title)}${d.unreadForPatient===true?'<span class="document-new-badge">NUOVO</span>':''}</b><span>${d.documentNumber?'N. '+escapeHtml(d.documentNumber)+' · ':''}${d.documentDate?fmtShort(d.documentDate):'Data non indicata'} · ${escapeHtml(d.fileName||'Documento')}</span></div><button class="secondary compact" data-open-patient-document="${d.id}">Apri</button></div>`).join('')}</div>`:'<p class="muted">Nessun documento contabile pubblicato.</p>'}</section>
  <section class="card"><div class="section-head"><h2>Piani alimentari</h2><span class="pill">${planRows.length}</span></div><p class="muted">Il piano in vigore resta disponibile anche in Dashboard. Qui trovi lo storico pubblicato dal professionista.</p>${planRows.length?`<div class="document-list">${planRows.map(d=>`<div class="document-row ${d.unreadForPatient===true?'document-row-unread':''}"><div><b>${escapeHtml(d.title||documentTitleFromFile(d.filename||'Piano alimentare'))}${d.unreadForPatient===true?'<span class="document-new-badge">NUOVO</span>':''}${current&&d.id===current.id?'<span class="plan-status-badge">IN VIGORE</span>':''}</b><span>${d.validFrom?'Valido dal '+fmtShort(d.validFrom):'Decorrenza non indicata'} · ${escapeHtml(d.fileName||d.filename||'Piano alimentare')}</span></div><button class="secondary compact" data-open-patient-plan="${d.id}">Apri</button></div>`).join('')}</div>`:'<p class="muted">Nessun piano alimentare pubblicato.</p>'}</section>
  ${patientReadOnly()?`<section class="card"><div class="section-head"><h2>Analisi del sangue</h2><span class="pill">${blood.length}</span></div>${blood.length?`<div class="document-list">${blood.map(row).join('')}</div>`:'<p class="muted">Nessun referto analisi caricato.</p>'}</section>`:`<section class="card"><div class="section-head"><h2>Analisi del sangue</h2><span class="pill">${blood.length}</span></div><p class="muted">Carica il referto PDF delle analisi. Il professionista lo ritroverà anche nella sezione Esami.</p><button class="primary" id="chooseBloodTestDocument">＋ Carica analisi</button>${blood.length?`<div class="document-list">${blood.map(row).join('')}</div>`:'<p class="muted">Nessun referto analisi caricato.</p>'}</section>`}
  <section class="card"><div class="section-head"><h2>Altri documenti sanitari</h2><span class="pill">${other.length}</span></div><p class="muted">Referti o documenti sanitari senza elaborazione specifica.</p><button class="secondary" id="chooseOtherHealthDocument">＋ Carica documento</button>${other.length?`<div class="document-list">${other.map(row).join('')}</div>`:'<p class="muted">Nessun altro documento sanitario caricato.</p>'}</section>
  <input id="patientDocumentFile" type="file" accept=".pdf,application/pdf,image/*" hidden>
  <section class="card document-form-card" id="patientDocumentForm" hidden><div class="section-head"><h2 id="patientDocumentFormHeading">Nuovo documento</h2></div><label>File</label><div class="document-file-name" id="patientDocumentFileName"></div><label>Titolo documento</label><input id="patientDocumentTitle"><label>Data documento</label><div class="date-entry"><input id="patientDocumentDate" inputmode="numeric" placeholder="GG-MM-AAAA" value="${isoToItalianDate(isoToday())}"><label class="date-picker-btn">📅<input id="patientDocumentDatePicker" type="date" value="${isoToday()}"></label></div><div class="form-actions"><button class="primary" id="savePatientDocument">Salva documento</button><button class="secondary" id="cancelPatientDocument">Annulla</button></div></section>`;
}
function bindDocumentsPage(){
  const input=$('#patientDocumentFile'),form=$('#patientDocumentForm');
  let selectedFile=null,selectedSubCategory='other';
  const startUpload=subCategory=>{if(readOnlyBlocked())return;selectedSubCategory=subCategory;input.value='';input.click()};
  $('#chooseBloodTestDocument')?.addEventListener('click',()=>startUpload('blood_test'));
  $('#chooseOtherHealthDocument')?.addEventListener('click',()=>startUpload('other'));
  if(input)input.onchange=()=>{
    const f=input.files?.[0];if(!f)return;
    if(f.size>DOCUMENT_MAX_BYTES){input.value='';return alert('Il documento supera il limite di 10 MB previsto per la demo.')}
    selectedFile=f;$('#patientDocumentFileName').textContent=f.name;$('#patientDocumentTitle').value=documentTitleFromFile(f.name);$('#patientDocumentFormHeading').textContent=selectedSubCategory==='blood_test'?'Nuove analisi del sangue':'Nuovo documento sanitario';form.hidden=false;form.scrollIntoView({behavior:'smooth',block:'start'});
  };
  const picker=$('#patientDocumentDatePicker');if(picker)picker.onchange=()=>{$('#patientDocumentDate').value=isoToItalianDate(picker.value)};
  $('#cancelPatientDocument')?.addEventListener('click',()=>{input.value='';selectedFile=null;form.hidden=true});
  $('#savePatientDocument')?.addEventListener('click',async()=>{if(readOnlyBlocked())return;
    if(!selectedFile)return alert('Seleziona un file.');
    const title=($('#patientDocumentTitle').value||'').trim(),date=italianDateToIso($('#patientDocumentDate').value||'');
    if(!title)return alert('Inserisci il titolo del documento.');if(!date)return alert('Inserisci la data nel formato GG-MM-AAAA.');
    const id=documentId(),fileId=documentId('file');
    try{await writeDocumentBlob(fileId,selectedFile);const items=documentMetaList();items.push({id,patientId:activePatientId(),category:'health',subCategory:selectedSubCategory,title,documentDate:date,fileId,fileName:selectedFile.name,mimeType:selectedFile.type||'application/octet-stream',fileSize:selectedFile.size,uploadedBy:'patient',uploadedAt:new Date().toISOString(),unreadForProfessional:true,unreadForPatient:false,documentNumber:null,validFrom:null});saveDocumentMetaList(items);if(selectedSubCategory==='blood_test')await queueBloodTestForReview(selectedFile,{documentId:id,patientId:activePatientId(),documentDate:date});render()}catch(e){console.error(e);alert('Non riesco a salvare il documento.')}
  });
  document.querySelectorAll('[data-open-patient-plan]').forEach(b=>b.onclick=()=>openPatientPlan(b.dataset.openPatientPlan));
  document.querySelectorAll('[data-open-patient-document]').forEach(b=>b.onclick=()=>openStoredDocument(b.dataset.openPatientDocument));
}
function loginPage(){const hasAccounts=Object.keys(accountMap()).length>0;return `<div class="login-shell"><section class="card login-card"><div class="login-brand-mark"><img src="assets/nubemo-brand-clean-v2.png" alt=""><div><b>NUBEMO</b><span>Area Paziente · Demo</span></div></div><div class="eyebrow">ACCESSO PAZIENTE</div><h1>Il tuo percorso inizia qui.</h1><p class="muted">${hasAccounts?'Usa le credenziali create dal professionista.':'Prima crea le credenziali dalla scheda paziente nell’Area Professionista.'}</p><label>Username</label><input id="loginUser" autocomplete="username" ${hasAccounts?'':'disabled'}><label>Password</label><input id="loginPass" type="password" autocomplete="current-password" ${hasAccounts?'':'disabled'}><button class="primary" onclick="patientLogin()" ${hasAccounts?'':'disabled'}>Accedi a NUBEMO</button></section></div>`}
window.patientLogin=()=>{const u=($('#loginUser')?.value||'').trim().toLowerCase(),pw=$('#loginPass')?.value||'';const f=Object.entries(accountMap()).find(([id,a])=>a&&a.active!==false&&String(a.username||'').toLowerCase()===u&&String(a.password||'')===pw);if(!f)return alert('Credenziali non valide.');localStorage.setItem(ACTIVE_PATIENT_KEY,f[0]);page='home';render()};
window.patientLogout=()=>{localStorage.removeItem(ACTIVE_PATIENT_KEY);page='home';render()};

function syncAndroidLandscapeClass(){
 const ua=navigator.userAgent||'';
 const android=/Android/i.test(ua);
 const landscape=window.matchMedia&&window.matchMedia('(orientation: landscape)').matches;
 const phoneLike=Math.min(window.screen?.width||innerWidth,window.screen?.height||innerHeight)<=600;
 document.body.classList.toggle('android-phone-landscape',android&&landscape&&phoneLike);
}
window.addEventListener('resize',syncAndroidLandscapeClass,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(syncAndroidLandscapeClass,80),{passive:true});

function render(){
  syncAndroidLandscapeClass();
  document.body.dataset.page=page;
  const ac=accountMap(),id=activePatientId();const logoutBtn=document.getElementById('patientLogoutBtn');if(!id||!ac[id]||ac[id].active===false){if(logoutBtn)logoutBtn.style.display='none';document.body.dataset.page='login';$('#app').innerHTML=loginPage();return}
  if(logoutBtn)logoutBtn.style.display='inline-flex';
  $('#app').innerHTML=page==='home'?home():page==='add'?add():page==='import'?importPage():page==='profile'?profilePage():page==='support'?patientSupportPage():page==='measures'?measuresPage():page==='documents'?documentsPage():trend();
  const appRoot=$('#app');
  if(!document.getElementById('patient-profile-read-style')){
    const st=document.createElement('style');
    st.id='patient-profile-read-style';
    st.textContent='.profile-read-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.profile-read-grid>div{padding:12px;border:1px solid #e5ecee;border-radius:14px;background:#fff}.profile-read-grid span,.profile-read-grid b{display:block}.profile-read-grid span{font-size:12px;color:#71818a}.profile-read-grid b{margin-top:4px}@media(max-width:650px){.profile-read-grid{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }
  if(page==='documents')bindDocumentsPage();
  const docNav=document.querySelector('nav button[data-page="documents"]');
  if(docNav){
    docNav.querySelector('.document-alert-badge')?.remove();
    if(page!=='documents'&&hasUnreadPatientDocuments()){
      docNav.insertAdjacentHTML('beforeend','<span class="document-alert-badge" aria-label="Nuovi documenti">!</span>');
    }
  }
}

function go(p){
  page=p;
  if(p!=='add'){editDate=null;duplicateDraft=null;duplicateSource=null;} if(p!=='import'){importText='';importPreview=null;}
  render();scrollTo(0,0);
}
window.go=go;
window.newDay=()=>{if(readOnlyBlocked())return;editDate=isoToday();duplicateDraft=null;duplicateSource=null;page='add';render();scrollTo(0,0)};
window.cancelEdit=()=>{editDate=null;duplicateDraft=null;duplicateSource=null;page='home';render();scrollTo(0,0)};
window.setCoffee=n=>{coffee=Math.max(0,coffee+n);$('#coffee').textContent=coffee};
window.dateChanged=d=>{
  if(duplicateDraft){duplicateDraft={...formDataFromDOM(),date:d,weight:$('#weight').value.trim()===''?'':Number($('#weight').value.trim().replace(',','.'))};render();return;}
  editDate=d;render();
};
window.manualDateChanged=v=>{const iso=italianDateToIso(v);if(!iso)return alert('Inserisci la data nel formato GG-MM-AAAA.');dateChanged(iso)};
window.pickerDateChanged=iso=>dateChanged(iso);
window.edit=d=>{editDate=d;duplicateDraft=null;duplicateSource=null;page='add';render();scrollTo(0,0)};

window.startDuplicate=()=>{if(readOnlyBlocked())return;
  let src=formDataFromDOM();
  duplicateSource=src.date;
  let target=isoToday();
  if(target===src.date){let d=new Date(src.date+'T12:00:00');d.setDate(d.getDate()+1);target=d.toISOString().slice(0,10)}
  duplicateDraft={...src,date:target,weight:''};
  editDate=null;
  page='add';render();scrollTo(0,0);
};


window.updateDiaryCaloriePreview=()=>{
 const out=$('#liveDiaryCalories');
 if(!out)return;
 const draft={};
 ['breakfast','snack1','lunch','snack2','dinner'].forEach(k=>draft[k]=$('#'+k)?.value||'');
 const ce=calorieEstimateDay(draft);
 out.textContent=ce.calculated?ce.calories+' kcal':'—';
 const q=$('#liveDiaryCaloriesQuality');
 if(q)q.textContent=ce.calculated?'Stima '+ce.qualityLabel.toLowerCase():'Compila i pasti per la stima';
};
document.addEventListener('input',e=>{
 if(['breakfast','snack1','lunch','snack2','dinner'].includes(e.target?.id)){
   window.updateDiaryCaloriePreview();
 }
});


function calorieIssueLabels(items,status){
 return [...new Set(
   (items||[])
     .filter(x=>x.status===status)
     .map(x=>String(x.label||x.segment||'').trim())
     .filter(Boolean)
 )];
}

function calorieReviewMessage(estimate){
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

function showCalorieSaveReview(estimate,onRegister){
 const old=document.getElementById('calorieSaveReview');if(old)old.remove();
 const modal=document.createElement('div');
 modal.id='calorieSaveReview';
 modal.className='calorie-review-overlay';
 modal.innerHTML=`<div class="calorie-review-modal">
   <h3>Controllo calorie</h3>
   <div class="calorie-review-message">${calorieReviewMessage(estimate).replace(/\n/g,'<br>')}</div>
   <div class="calorie-review-actions">
     <button type="button" class="secondary" id="calorieReviewCorrect">Correggi</button>
     <button type="button" class="primary" id="calorieReviewRegister">Registra</button>
   </div>
 </div>`;
 document.body.appendChild(modal);
 document.getElementById('calorieReviewCorrect').onclick=()=>modal.remove();
 document.getElementById('calorieReviewRegister').onclick=()=>{modal.remove();onRegister()};
}
window.saveDay=()=>{if(readOnlyBlocked())return;
 let obj=formDataFromDOM(),date=obj.date;
 if(!date)return alert('Seleziona una data.');
 if(obj.water!==''&&(!Number.isFinite(Number(obj.water))||Number(obj.water)<0||Number(obj.water)>20))return alert('Controlla la quantità di acqua inserita.');
 delete obj.estimatedCalories;
 const estimate=calorieEstimateDay(obj);
 let a=load(),i=a.findIndex(x=>x.date===date);
 if(duplicateDraft&&i>=0)return alert('Questa data è già registrata. Scegli una data diversa.');

 const register=()=>{
   // Rilegge i campi al momento della registrazione: se l'utente ha corretto,
   // il salvataggio successivo userà sempre il testo aggiornato.
   obj=formDataFromDOM();delete obj.estimatedCalories;date=obj.date;
   if(obj.water!==''&&(!Number.isFinite(Number(obj.water))||Number(obj.water)<0||Number(obj.water)>20))return alert('Controlla la quantità di acqua inserita.');
   a=load();i=a.findIndex(x=>x.date===date);
   if(i>=0)a[i]=obj;else a.push(obj);
   save(a);
   editDate=null;duplicateDraft=null;duplicateSource=null;page='home';render();
 };

 // Il controllo degli alimenti riconosciuti è visibile solo se il professionista
 // ha abilitato calorie e valori energetici per il paziente.
 if(patientEnergyValuesVisible()&&estimate.total)showCalorieSaveReview(estimate,register);
 else register();
};

window.deleteDay=()=>{if(readOnlyBlocked())return;
  if(!confirm('Eliminare questa giornata?'))return;
  save(load().filter(x=>x.date!==editDate));editDate=null;duplicateDraft=null;duplicateSource=null;page='home';render();
};

function ascii(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E]/g,' ')}
function pdfEscape(s){return ascii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function wrapCell(text,maxChars){
  let t=ascii(text).replace(/\s+/g,' ').trim();
  if(!t)return [''];
  let words=t.split(' '),lines=[],line='';
  words.forEach(w=>{let next=line?line+' '+w:w;if(next.length>maxChars&&line){lines.push(line);line=w}else line=next});
  if(line)lines.push(line);
  return lines;
}
function pdfTableData(){
  return sorted().map(x=>[
    fmtShort(x.date),
    x.weight===''||x.weight==null?'':Number(x.weight).toFixed(1).replace('.',','),
    x.water===''||x.water==null?'':Number(x.water).toFixed(1).replace('.',','),
    x.coffee===''||x.coffee==null?'':String(x.coffee),
    x.sweetener||'',
    x.breakfast||'',x.snack1||'',x.lunch||'',x.snack2||'',x.dinner||'',x.notes||''
  ]);
}
function makePdfBlob(){
  return window.NubemoDiaryPdf.create({rows:pdfTableData(),origin:'patient'});
}
window.exportPDF=()=>{
  const days=sorted();if(!days.length)return alert('Non ci sono giornate da esportare.');
  try{
    const blob=makePdfBlob(),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`Diario_${days[0].date}_${days.at(-1).date}.pdf`;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(err){console.error('PDF diario paziente',err);alert('Non riesco a generare il PDF del diario.');}
};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  if(b.dataset.page==='add')newDay();else go(b.dataset.page);
});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
window.addEventListener('pageshow',e=>{
  if(e.persisted){
    render();
  }
});
render();
