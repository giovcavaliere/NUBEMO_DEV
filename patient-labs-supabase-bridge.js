// NUBEMO recovery 3.98 — estrazione valori da referti Paziente.
// Mantiene il flusso 3.98: il PDF viene salvato su Supabase e, quando possibile,
// i valori riconosciuti vengono proposti al professionista per la verifica.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const base = window.nubemoPatientServices;
  if (!client || !base) return;

  let pdfPromise = null;
  const SPECS = [
    ['glucose',['glicemia','glucosio'],'Glicemia'],
    ['cholesterol',['colesterolo totale','colesterolo'],'Colesterolo'],
    ['hdl',['hdl'],'HDL'],
    ['ldl',['ldl'],'LDL'],
    ['triglycerides',['trigliceridi'],'Trigliceridi'],
    ['got',['got','ast'],'GOT'],
    ['gpt',['gpt','alt'],'GPT'],
    ['uricAcid',['acido urico','uricemia'],'Acido urico'],
    ['creatinine',['creatinina'],'Creatinina'],
    ['ggt',['gamma gt','ggt'],'γGT']
  ];

  function loadScript(src, check) {
    return new Promise((resolve,reject) => {
      if (check()) return resolve();
      const existing=[...document.scripts].find(x=>x.src===src);
      if (existing) {
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',()=>reject(new Error('Errore caricamento '+src)),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('Errore caricamento '+src));
      document.head.appendChild(s);
    });
  }

  async function pdfjs() {
    if (window.pdfjsLib && window.pdfjsWorker?.WorkerMessageHandler) return window.pdfjsLib;
    if (pdfPromise) return pdfPromise;
    const src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const worker='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfPromise=(async()=>{
      await loadScript(src,()=>!!window.pdfjsLib);
      await loadScript(worker,()=>!!window.pdfjsWorker?.WorkerMessageHandler);
      if (!window.pdfjsLib || !window.pdfjsWorker?.WorkerMessageHandler) throw new Error('Motore PDF non disponibile');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc=worker;
      return window.pdfjsLib;
    })();
    return pdfPromise;
  }

  async function extractText(file) {
    const lib=await pdfjs();
    const buffer=await file.arrayBuffer();
    const pdf=await lib.getDocument({data:new Uint8Array(buffer),enableScripting:false}).promise;
    let text='';
    for (let i=1;i<=pdf.numPages;i++) {
      const page=await pdf.getPage(i), content=await page.getTextContent();
      text+=' '+content.items.map(x=>x.str).join(' ');
    }
    return text.replace(/\s+/g,' ');
  }

  function parseValues(text) {
    const out=[];
    for (const [code,names,label] of SPECS) {
      let value='';
      for (const name of names) {
        const safe=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const match=text.match(new RegExp(safe+'[^0-9]{0,24}([0-9]+(?:[.,][0-9]+)?)','i'));
        if (match) { value=match[1].replace(',','.'); break; }
      }
      if (!value) continue;
      const numeric=Number(value);
      out.push({report_id:null,test_code:code,test_name:label,value_text:value,value_numeric:Number.isFinite(numeric)?numeric:null});
    }
    return out;
  }

  async function enrichPendingReport(documentId,file) {
    if (!documentId || !file || !/pdf/i.test(file.type || file.name || '')) return;
    try {
      const text=await extractText(file);
      const values=parseValues(text);
      if (!values.length) return;
      const reportResult=await client.from('laboratory_reports')
        .select('id,status').eq('document_id',documentId).is('deleted_at',null).maybeSingle();
      if (reportResult.error) throw reportResult.error;
      const report=reportResult.data;
      if (!report || report.status!=='pending_review') return;
      const payload=values.map(v=>({...v,report_id:report.id}));
      const inserted=await client.from('laboratory_values').insert(payload);
      if (inserted.error) throw inserted.error;
    } catch (error) {
      // Il referto rimane comunque correttamente caricato e verificabile a mano.
      console.error('NUBEMO Patient lab extraction:',error);
    }
  }

  const wrapped={...base};
  wrapped.uploadPatientDocument=async function(patientId,userId,file,meta) {
    const doc=await base.uploadPatientDocument(patientId,userId,file,meta);
    if (meta?.sub_category==='blood_test') void enrichPendingReport(doc?.id,file);
    return doc;
  };
  window.nubemoPatientServices=Object.freeze(wrapped);
})();
