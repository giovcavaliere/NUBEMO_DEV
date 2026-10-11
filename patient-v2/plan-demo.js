(() => {
  'use strict';
  const root=document.querySelector('[data-patient-plan-content]');
  if(!root)return;
  // Dati dimostrativi isolati. Integrazione reale da fare solo dopo approvazione.
  const plans=[
    {id:'ottobre',current:true,name:'Piano alimentare ottobre',from:'1 ottobre 2026',to:'',note:'Segui le indicazioni del piano e cerca di mantenere regolarità negli orari dei pasti.',filename:'piano-alimentare-ottobre.pdf'},
    {id:'settembre',current:false,name:'Piano alimentare settembre',from:'1 settembre 2026',to:'30 settembre 2026',note:'Continua a curare la regolarità dei pasti e l’idratazione quotidiana.',filename:'piano-alimentare-settembre.pdf'},
    {id:'agosto',current:false,name:'Piano alimentare agosto',from:'1 agosto 2026',to:'31 agosto 2026',note:'Piano iniziale di adattamento alle nuove abitudini alimentari.',filename:'piano-alimentare-agosto.pdf'}
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function details(plan){
    return '<div class="patient-plan-note"><strong>Nota del nutrizionista</strong><p>'+esc(plan.note||'Nessuna nota inserita.')+'</p></div>'+
      '<div class="patient-plan-file">'+
        '<span class="patient-plan-file-icon"><svg class="icon"><use href="#icon-document"/></svg></span>'+
        '<div class="patient-plan-file-info"><strong>'+esc(plan.filename)+'</strong><small>PDF di esempio · demo statica</small></div>'+
        '<div class="patient-plan-file-actions"><button class="patient-secondary" type="button" data-patient-plan-pdf="'+esc(plan.id)+'" data-patient-plan-download="false">Apri PDF</button>'+
        '<button class="patient-secondary" type="button" data-patient-plan-pdf="'+esc(plan.id)+'" data-patient-plan-download="true">Scarica</button></div>'+
      '</div>';
  }
  const current=plans.find(plan=>plan.current);
  const history=plans.filter(plan=>!plan.current);
  root.innerHTML='<div class="patient-plan-stack">'+
    '<section aria-labelledby="patient-plan-current-heading"><h2 class="patient-plan-section-title" id="patient-plan-current-heading">Piano in vigore</h2>'+
    (current?'<article class="module patient-plan-card"><div class="patient-plan-card-header"><div><h3>'+esc(current.name)+'</h3><p class="patient-plan-dates">Dal '+esc(current.from)+'</p></div><span class="pill green">Attivo</span></div>'+details(current)+'</article>':
      '<div class="module patient-plan-empty">Non è ancora disponibile un piano alimentare in vigore.</div>')+'</section>'+
    '<section aria-labelledby="patient-plan-history-heading"><h2 class="patient-plan-section-title" id="patient-plan-history-heading">Piani conclusi</h2>'+
    (history.length?'<div class="patient-plan-history">'+history.map(plan=>
      '<details class="module patient-plan-card"><summary><span><strong>'+esc(plan.name)+'</strong><small>'+esc(plan.from)+' – '+esc(plan.to)+'</small></span><span class="patient-plan-chevron" aria-hidden="true">⌄</span></summary>'+
      '<div class="patient-plan-history-body">'+details(plan)+'</div></details>').join('')+'</div>':
      '<div class="module patient-plan-empty">Nessun piano concluso.</div>')+'</section></div>';

  // PDF dimostrativo valido: nessun allegato clinico o dato reale.
  function pdfBlob(plan){
    const safe=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'').replace(/[()\\]/g,'');
    const lines=['NUBEMO - DOCUMENTO DIMOSTRATIVO',plan.name,plan.current?'Piano in vigore':'Piano concluso','Questo PDF contiene soltanto dati fittizi.'];
    const stream='BT /F1 17 Tf 50 780 Td '+lines.map((line,i)=>(i?'0 -35 Td ':'')+'('+safe(line)+') Tj ').join('')+'ET';
    const objects=[
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'
    ];
    let pdf='%PDF-1.4\n',offsets=[0];
    objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
    const xref=pdf.length;
    pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
    return new Blob([pdf],{type:'application/pdf'});
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-patient-plan-pdf]');
    if(!button)return;
    const plan=plans.find(p=>p.id===button.dataset.patientPlanPdf);
    if(!plan)return;
    const url=URL.createObjectURL(pdfBlob(plan));
    const link=document.createElement('a');
    link.href=url;
    link.target=button.dataset.patientPlanDownload==='true'?'_self':'_blank';
    link.rel='noopener';
    if(button.dataset.patientPlanDownload==='true')link.download=plan.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  });
})();
