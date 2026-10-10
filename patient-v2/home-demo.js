(() => {
  'use strict';

  const NUBEMO_DAILY_QUOTES=['La costanza batte la giornata perfetta.', 'Oggi fai il tuo. Domani si vedrà.', 'La bilancia registra il peso, non tutto il lavoro che c’è dietro.', 'Non tutte le giornate devono essere memorabili. Devono solo esistere.', 'Un risultato lento resta un risultato.', 'Oggi niente imprese: fai semplicemente quello che avevi programmato.', 'La direzione conta più della velocità.', 'Una giornata storta non cancella quelle giuste.', 'Il corpo non legge il calendario: dagli tempo.', 'Non serve vincere ogni giorno per arrivare lontano.', 'La bilancia oggi ha un’opinione. Non necessariamente ragione.', 'Il piano perfetto? Quello che riesci a seguire anche martedì.', 'Se oggi va tutto liscio, bene. Se no, domani esiste ancora.', 'Il peso fa su e giù. Tu prova ad andare avanti.', 'NUBEMO non giudica. Al massimo fa i conti.', 'Una buona abitudine è noiosa solo finché non mostra i risultati.', 'Il percorso non richiede effetti speciali.', 'Oggi puoi anche non sentirti motivato. Il piano funziona lo stesso.', 'La perfezione è sopravvalutata. La continuità molto meno.', 'La bilancia non assegna voti.', 'Guarda la tendenza, non il singolo numero.', 'Quello che fai spesso conta più di quello che fai ogni tanto.', 'Un pasto non decide il percorso. Nemmeno una giornata.', 'Le abitudini lavorano anche quando non fanno rumore.', 'Misurare serve a capire, non a giudicare.', 'Il dato di oggi è un dato, non una sentenza.', 'Fai spazio ai risultati senza pretendere che arrivino in orario.', 'La routine è meno spettacolare della motivazione, ma dura di più.', 'Ripetere le cose semplici è una strategia.', 'Il cambiamento vero spesso sembra normale mentre accade.', 'Ci sono giorni in cui avanzare significa semplicemente non mollare.', 'Se oggi è difficile, riduci l’ambizione, non l’impegno.', 'Una giornata complicata non richiede una punizione domani.', 'Puoi essere stanco e continuare comunque con gentilezza.', 'Non devi recuperare ieri. Devi vivere bene oggi.', 'Quando il risultato tarda, il lavoro fatto non scompare.', 'Anche una settimana piatta fa parte di una linea che può scendere.', 'Non trasformare un numero inatteso in una storia che non conosci.', 'Il corpo può trattenere acqua. Tu non trattenere il buon senso.', 'Oggi potrebbe non essere il giorno del risultato. Può essere quello che lo prepara.', 'Ripartire non significa ricominciare da zero.', 'Hai già imparato cose che la prima volta non sapevi.', 'Un’interruzione cambia il ritmo, non necessariamente la destinazione.', 'Il prossimo passo non deve compensare nulla: deve solo essere quello giusto.', 'Ricominciare bene vale più che ricominciare forte.', 'Non aspettare il lunedì per fare una scelta utile.', 'Una deviazione non obbliga a cambiare strada.', 'Il percorso continua dal punto in cui sei, non da quello in cui vorresti essere.', 'Non serve cancellare una giornata: basta non trasformarla in una settimana.', 'Ogni ritorno alla routine è già progresso.', 'Concediti il tempo di accorgerti di quanto sei cambiato.', 'A volte il risultato arriva prima nelle abitudini e poi nei numeri.', 'La pazienza non è aspettare: è continuare mentre aspetti.', 'Non tutto ciò che migliora si vede subito.', 'Il lungo periodo è fatto di giornate molto normali.', 'Essere soddisfatti non significa aver finito.', 'Nota anche quello che oggi fai senza fatica e mesi fa sembrava difficile.', 'I progressi piccoli diventano evidenti quando smetti di guardarli con il microscopio.', 'Il tempo passa comunque. Tanto vale usarlo dalla tua parte.', 'Il risultato migliore è quello che riesci a mantenere.', 'Bevi, mangia, muoviti, dormi. A volte la strategia è meno misteriosa del previsto.', 'Fai la prossima scelta utile, non le prossime cento.', 'Se hai un piano, oggi devi solo seguirne un pezzo.', 'Controlla ciò che puoi controllare e lascia respirare il resto.', 'Prima la routine, poi le rifiniture.', 'Non cambiare strategia per colpa di un singolo dato.', 'Annotare bene oggi aiuta a capire meglio domani.', 'La regolarità rende leggibili anche i numeri.', 'Se qualcosa non funziona, si corregge. Non si processa.', 'Il percorso è anche imparare come risponde il tuo corpo.', 'Fatto è meglio di perfetto.', 'Oggi basta esserci.', 'Continua.', 'Un giorno alla volta è una misura sorprendentemente efficace.', 'Niente magie. Solo tempo e scelte ripetute.', 'Respira. Il trend ha più memoria della bilancia di stamattina.', 'Non devi dimostrare niente a nessuno.', 'Il prossimo dato arriverà. Nel frattempo vivi.', 'Meno rumore, più continuità.', 'Domani non ha bisogno di un oggi perfetto.'];
function dailyMotivationalQuote(date=new Date()){
 const start=new Date(2026,0,1);
 const day=new Date(date.getFullYear(),date.getMonth(),date.getDate());
 const index=((Math.floor((day-start)/86400000)%NUBEMO_DAILY_QUOTES.length)+NUBEMO_DAILY_QUOTES.length)%NUBEMO_DAILY_QUOTES.length;
 return NUBEMO_DAILY_QUOTES[index];
}

  const chartSets={
    '7d':{
      y:[110,109,108,107,106],
      points:[109.4,108.9,108.3,108.1,107.4,107.1,106.6],
      labels:['3 ott','6 ott','9 ott']
    },
    '1m':{
      y:[112,110,108,106,104],
      points:[111.2,110.7,109.9,109.4,108.7,108.2,107.7,107.1,106.8,106.6],
      labels:['10 set','24 set','9 ott']
    },
    '3m':{
      y:[116,113,110,107,104],
      points:[115.1,114.5,113.8,112.9,111.8,110.9,109.9,109.4,108.6,107.8,107.1,106.6],
      labels:['10 lug','25 ago','9 ott']
    },
    'all':{
      y:[120,116,112,108,104],
      points:[118.8,117.5,116.9,115.4,114.2,112.7,111.5,110.4,109.4,108.2,107.3,106.6],
      labels:['inizio','metà','oggi']
    }
  };

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

  function setDailyQuote(){
    const el=$('#patientDailyQuote');
    if(!el)return;
    el.textContent='“'+dailyMotivationalQuote(new Date())+'”';
  }

  function drawChart(key){
    const data=chartSets[key]||chartSets['7d'];
    const host=$('#patientWeightChart');
    if(!host)return;

    const left=46,right=454,top=34,bottom=225;
    const min=Math.min(...data.y),max=Math.max(...data.y);
    const x=i=>left+(i*(right-left)/(data.points.length-1));
    const y=v=>top+((max-v)*(bottom-top)/(max-min));
    const path=data.points.map((v,i)=>(i?'L ':'M ')+x(i).toFixed(2)+' '+y(v).toFixed(2)).join(' ');
    const area=path+' L '+right+' '+bottom+' L '+left+' '+bottom+' Z';
    const labelIndexes=[0,Math.floor((data.points.length-1)/2),data.points.length-1];

    host.innerHTML=
      '<div class="patient-chart-core" role="img" aria-label="Andamento peso demo">'+
        '<span class="patient-chart-axis-title">Peso (kg)</span>'+
        '<div class="patient-chart-plot">'+
          '<svg viewBox="46 34 408 191" preserveAspectRatio="none" aria-hidden="true">'+
            data.y.map(v=>'<line x1="46" x2="454" y1="'+y(v).toFixed(2)+'" y2="'+y(v).toFixed(2)+'" class="patient-chart-grid"/>').join('')+
            labelIndexes.map(i=>'<line x1="'+x(i).toFixed(2)+'" x2="'+x(i).toFixed(2)+'" y1="34" y2="225" class="patient-chart-grid patient-chart-grid-vertical"/>').join('')+
            '<path d="'+area+'" class="patient-chart-area"/>'+
            '<path d="'+path+'" class="patient-chart-line"/>'+
          '</svg>'+
          data.y.map(v=>'<span class="patient-chart-axis patient-chart-tick" style="--patient-y:'+y(v).toFixed(2)+'">'+v.toFixed(1).replace('.',',')+'</span>').join('')+
          data.points.map((v,i)=>'<span class="patient-chart-dot" style="--patient-x:'+x(i).toFixed(2)+';--patient-y:'+y(v).toFixed(2)+'" title="'+v.toFixed(1).replace('.',',')+' kg"></span>').join('')+
          labelIndexes.map((i,n)=>'<span class="patient-chart-axis patient-chart-date patient-chart-date-'+(n===0?'start':n===2?'end':'middle')+'" style="--patient-x:'+x(i).toFixed(2)+'">'+data.labels[n]+'</span>').join('')+
        '</div>'+
      '</div>'+
      '<div class="patient-chart-latest">'+
        '<span><i class="patient-chart-legend-dot"></i>Peso <strong>'+data.points.at(-1).toFixed(1).replace('.',',')+' kg</strong></span>'+
        '<span class="patient-chart-goal">Obiettivo 85,0 kg</span>'+
      '</div>';
  }

  function selectRange(key){
    $$('.patient-range [data-weight-range]').forEach(btn=>btn.classList.toggle('active',btn.dataset.weightRange===key));
    drawChart(key);
  }

  function setDiaryMode(mode='overview'){
    $$('[data-diary-panel]').forEach(panel=>{panel.hidden=panel.dataset.diaryPanel!==mode;});
  }

  function route(view,options={}){
    const target=['home','diary','plan','documents','profile'].includes(view)?view:'home';
    $$('[data-patient-view]').forEach(section=>{section.hidden=section.dataset.patientView!==target;});
    if(target==='diary')setDiaryMode(options.diaryMode||'overview');
    const banner=$('#patientHomeBanner');
    if(banner)banner.hidden=target!=='home';
    $$('[data-patient-route]').forEach(link=>{
      const active=link.dataset.patientRoute===target;
      link.classList.toggle('active',active);
      if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function modal(title,body){
    document.querySelector('.patient-demo-modal')?.remove();
    const wrap=document.createElement('div');
    wrap.className='patient-demo-modal';
    wrap.innerHTML='<div class="patient-demo-modal-card"><div class="patient-demo-modal-head"><div><span class="patient-view-eyebrow">Demo Patient 2.0</span><h2>'+esc(title)+'</h2></div><button type="button" class="patient-demo-modal-close" aria-label="Chiudi">×</button></div>'+body+'</div>';
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    $('.patient-demo-modal-close',wrap)?.addEventListener('click',close);
    wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
  }

  function openMeasureModal(){
    modal('Aggiungi misure',
      '<form class="patient-demo-form">'+
        '<label>Peso di oggi<input type="text" value="106,6 kg" readonly></label>'+
        '<label>Circonferenza vita<input type="text" placeholder="cm"></label>'+
        '<label>Circonferenza fianchi<input type="text" placeholder="cm"></label>'+
        '<label>Note<textarea placeholder="Facoltative"></textarea></label>'+
        '<button type="button" class="patient-primary" data-demo-save>Salva demo</button>'+
      '</form>');
    $('[data-demo-save]')?.addEventListener('click',()=>modal('Misure','<p class="patient-demo-message">Nella versione statica il salvataggio è simulato. La struttura della funzione è pronta per la successiva integrazione.</p>'));
  }

  function openAppointment(){
    modal('Prossima visita',
      '<div class="patient-demo-detail">'+
        '<div><span>Data</span><strong>15 ottobre 2026</strong></div>'+
        '<div><span>Ora</span><strong>18:30</strong></div>'+
        '<div><span>Tipo</span><strong>Controllo nutrizionale</strong></div>'+
        '<div><span>Professionista</span><strong>Dott.ssa Laura Bianchi</strong></div>'+
      '</div>');
  }

  function demoAction(kind){
    const copy={
      meal:['Dettaglio pasto','Questa interazione anticipa l’apertura/modifica del pasto nella futura vista Diario 2.0.'],
      favorite:['Pasti preferiti','Qui verrà richiamato l’elenco dei pasti preferiti già previsto nell’implementazione attuale, senza calorie nella lista.'],
      plan:['Piano alimentare','Questa azione aprirà il documento o il dettaglio del piano attivo quando collegheremo i dati reali.'],
      document:['Documento','Questa azione aprirà il documento reale quando collegheremo la Patient 2.0 a Supabase.'],
      'save-day':['Giornata salvata','Nella versione statica il salvataggio è simulato. La struttura della giornata corrente è pronta per il collegamento ai dati reali.']
    }[kind]||['Demo','Interazione demo'];
    modal(copy[0],'<p class="patient-demo-message">'+copy[1]+'</p>');
  }

  document.addEventListener('click',event=>{
    const range=event.target.closest('[data-weight-range]');
    if(range){selectRange(range.dataset.weightRange);return;}

    const diaryModeBtn=event.target.closest('[data-patient-diary-mode]');
    if(diaryModeBtn){
      event.preventDefault();
      const mode=diaryModeBtn.dataset.patientDiaryMode;
      const routeTarget=diaryModeBtn.dataset.patientRoute;
      if(routeTarget==='diary')route('diary',{diaryMode:mode});
      else setDiaryMode(mode);
      return;
    }

    const routeBtn=event.target.closest('[data-patient-route]');
    if(routeBtn){
      event.preventDefault();
      route(routeBtn.dataset.patientRoute);
      return;
    }

    const modalBtn=event.target.closest('[data-patient-modal]');
    if(modalBtn){
      if(modalBtn.dataset.patientModal==='measures')openMeasureModal();
      if(modalBtn.dataset.patientModal==='appointment')openAppointment();
      return;
    }

    const action=event.target.closest('[data-patient-demo-action]');
    if(action)demoAction(action.dataset.patientDemoAction);
  });

  setDailyQuote();
  selectRange('7d');
})();