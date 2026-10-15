// Motore PDF della NUBEMO 1.0, isolato senza le sue dipendenze applicative.
export function parseLabValues(text){
 const c=String(text||'').replace(/\s+/g,' '),out={};
 const specs=[['glucose',['glicemia','glucosio']],['cholesterol',['colesterolo totale','colesterolo']],['hdl',['hdl']],['ldl',['ldl']],['triglycerides',['trigliceridi']],['got',['got','ast']],['gpt',['gpt','alt']],['uricAcid',['acido urico','uricemia']],['creatinine',['creatinina']],['ggt',['gamma gt','ggt']],['tsh',['tsh']],['vitaminD',['25-oh vitamina d','25 oh vitamina d','25(oh)d','vitamina d']]];
 for(const [k,names] of specs)for(const n of names){const safe=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),m=c.match(new RegExp(safe+'[^0-9]{0,24}([0-9]+(?:[.,][0-9]+)?)','i'));if(m){out[k]=m[1].replace(',','.');break}}
 const dm=c.match(/\b([0-3]?\d)[\/.-]([01]?\d)[\/.-](20\d{2})\b/);out.date=dm?`${dm[3]}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}`:new Date().toISOString().slice(0,10);return out;
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
export async function extractPdfText(file){
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
