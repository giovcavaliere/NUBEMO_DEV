(() => {
  'use strict';
  const root=document.querySelector('[data-patient-documents-content]');
  if(!root)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[char]));
  const icon=name=>'<svg class="icon" aria-hidden="true"><use href="#icon-'+name+'"/></svg>';
  const categories={analysis:'Analisi',report:'Referti',other:'Altro'};
  const filters=[['all','Tutti'],['analysis','Analisi'],['report','Referti'],['other','Altro']];
  const docs=[
    {id:'demo-referto',title:'Referto ematochimico',fileName:'referto-ottobre.pdf',category:'report',date:'2026-10-08',uploadedBy:'professional',unread:true,file:null},
    {id:'demo-analisi',title:'Analisi del sangue',fileName:'analisi-settembre.pdf',category:'analysis',date:'2026-09-22',uploadedBy:'patient',unread:false,file:null},
    {id:'demo-documento',title:'Documento condiviso',fileName:'documento-agosto.pdf',category:'other',date:'2026-08-15',uploadedBy:'professional',unread:false,file:null}
  ];
  const ui={filter:'all',unreadOnly:false};
  const fmtDate=date=>new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00'));
  const status=doc=>doc.uploadedBy==='patient'?'Caricato':doc.unread?'Da leggere':'Letto';
  const statusTone=doc=>doc.uploadedBy==='patient'?'registered':doc.unread?'unread':'read';
  function render(){
    const inCategory=docs.filter(d=>ui.filter==='all'||d.category===ui.filter);
    const visible=inCategory.filter(d=>!ui.unreadOnly||d.unread&&d.uploadedBy==='professional').sort((a,b)=>b.date.localeCompare(a.date));
    root.innerHTML='<div class="documents-view">'+
      '<header class="documents-head"><div class="documents-head-copy"><span class="documents-head-icon">'+icon('document')+'</span><div><h2>Documenti</h2><p>Visualizza e carica i documenti del tuo percorso.</p></div></div>'+
      '<button class="documents-upload" type="button" data-patient-document-upload>'+icon('plus')+'<span>Carica documento</span></button></header>'+
      '<div class="documents-toolbar"><div class="documents-filter-wrap"><nav class="documents-filters" aria-label="Filtra documenti">'+filters.map(([key,label])=>'<button type="button" data-patient-document-filter="'+key+'" class="'+(ui.filter===key?'active':'')+'" aria-pressed="'+(ui.filter===key)+'">'+label+'</button>').join('')+'</nav>'+
      '<button type="button" class="documents-unread-filter '+(ui.unreadOnly?'active':'')+'" data-patient-document-unread aria-label="Mostra solo documenti da leggere" title="Solo da leggere" aria-pressed="'+ui.unreadOnly+'">'+icon('document')+(inCategory.some(d=>d.unread&&d.uploadedBy==='professional')?'<span class="documents-unread-dot" aria-hidden="true"></span>':'')+'</button></div><span class="documents-sort">Data più recente</span></div>'+
      '<section class="documents-table"><div class="documents-table-head"><span>Documento</span><span>Caricato da</span><span>Data</span><span>Stato</span><span>Azioni</span></div><div class="documents-list">'+
      (visible.length?visible.map(doc=>'<article class="documents-row '+(doc.unread?'is-unread':'')+'"><div class="documents-file"><span class="documents-file-icon">'+icon('document')+'</span><div><strong>'+esc(doc.title)+'</strong><small>'+esc(doc.fileName)+' · '+esc(categories[doc.category])+'</small></div></div>'+
        '<div class="documents-cell documents-category-cell"><small>Caricato da</small><span class="documents-category documents-category-'+esc(doc.category)+'">'+(doc.uploadedBy==='patient'?'Paziente':'Professionista')+'</span></div>'+
        '<div class="documents-cell documents-date-cell"><small>Data</small><time datetime="'+esc(doc.date)+'">'+fmtDate(doc.date)+'</time></div>'+
        '<div class="documents-cell documents-status-cell"><small>Stato</small><span class="documents-status documents-status-'+statusTone(doc)+'">'+status(doc)+'</span></div>'+
        '<div class="documents-actions"><button class="documents-action" type="button" data-patient-document-open="'+esc(doc.id)+'" title="Apri documento" aria-label="Apri documento">'+icon('eye')+'</button>'+
        (doc.uploadedBy==='patient'?'<button class="documents-action documents-action-delete" type="button" data-patient-document-delete="'+esc(doc.id)+'" title="Elimina documento" aria-label="Elimina documento">'+icon('trash')+'</button>':'')+'</div></article>').join(''):'<div class="documents-empty">'+(ui.unreadOnly?'Nessun documento da leggere in questa categoria.':'Nessun documento in questa categoria.')+'</div>')+
      '</div></section><p class="patient-documents-demo-note">Anteprima dimostrativa: i file iniziali sono esempi; i documenti caricati restano disponibili solo in questa sessione.</p></div>';
  }
  function dialog(markup,onSubmit){
    const el=document.createElement('dialog');el.className='detail-dialog documents-upload-dialog';
    el.innerHTML=markup;document.body.appendChild(el);
    el.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>el.close()));
    el.addEventListener('close',()=>el.remove(),{once:true});
    el.querySelector('form').addEventListener('submit',event=>{event.preventDefault();onSubmit(el);});
    el.showModal();return el;
  }
  root.addEventListener('click',event=>{
    const filter=event.target.closest('[data-patient-document-filter]');
    if(filter){ui.filter=filter.dataset.patientDocumentFilter;render();return;}
    if(event.target.closest('[data-patient-document-unread]')){ui.unreadOnly=!ui.unreadOnly;render();return;}
    if(event.target.closest('[data-patient-document-upload]')){
      const today=new Date().toISOString().slice(0,10);
      const el=dialog('<form><header><h2>Carica documento</h2><button type="button" data-close aria-label="Chiudi">×</button></header><div class="documents-upload-form">'+
        '<label class="documents-wide">File PDF o immagine<input type="file" name="file" accept=".pdf,application/pdf,image/*" required></label>'+
        '<label>Categoria<select name="category"><option value="analysis">Analisi</option><option value="report">Referti</option><option value="other">Altro</option></select></label>'+
        '<label>Data documento<input type="date" name="date" value="'+today+'" required></label>'+
        '<label class="documents-wide">Titolo<input name="title" type="text" required maxlength="120"></label></div>'+
        '<footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Carica documento</button></footer></form>',modal=>{
          const form=modal.querySelector('form');if(!form.reportValidity())return;
          const file=form.elements.file.files[0];if(!file)return;
          const category=form.elements.category.value;
          if(!Object.hasOwn(categories,category))return;
          docs.push({id:'upload-'+Date.now(),title:form.elements.title.value.trim(),fileName:file.name,category,date:form.elements.date.value,uploadedBy:'patient',unread:false,file});
          modal.close();ui.filter='all';ui.unreadOnly=false;render();
        });
      el.querySelector('input[type="file"]').addEventListener('change',e=>{const title=el.querySelector('input[name="title"]');if(!title.value&&e.target.files[0])title.value=e.target.files[0].name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');});return;
    }
    const open=event.target.closest('[data-patient-document-open]');
    if(open){
      const doc=docs.find(d=>d.id===open.dataset.patientDocumentOpen);if(!doc)return;
      if(doc.file instanceof Blob){const url=URL.createObjectURL(doc.file);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);if(doc.uploadedBy==='professional'&&doc.unread){doc.unread=false;render();}}
      else alert('Questo è un documento di esempio. I file caricati durante la sessione sono apribili.');
      return;
    }
    const del=event.target.closest('[data-patient-document-delete]');
    if(del){
      const doc=docs.find(d=>d.id===del.dataset.patientDocumentDelete);
      if(!doc||doc.uploadedBy!=='patient')return;
      dialog('<form><header><h2>Elimina documento</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Vuoi eliminare “'+esc(doc.title)+'”? L’operazione non può essere annullata.</p><footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Elimina</button></footer></form>',modal=>{
        const index=docs.findIndex(d=>d.id===doc.id&&d.uploadedBy==='patient');
        if(index>=0)docs.splice(index,1);
        modal.close();render();
      });
    }
  });
  render();
})();