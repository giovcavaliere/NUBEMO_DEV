(() => {
  'use strict';

  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

  const diaryDays={
    '2026-10-10':{
      title:'Sabato 10 ottobre',status:'Giornata in corso · 3 pasti su 5',weight:'106,6 kg',kcal:'1.650 kcal',confidence:'Buona',confidenceClass:'good',
      meals:[
        ['☕','Colazione','Yogurt greco, 45 g muesli, banana','410 kcal'],
        ['🍎','Spuntino mattina','Mela e 15 g mandorle','175 kcal'],
        ['🍝','Pranzo','Pasta al pomodoro, tonno e insalata','620 kcal'],
        ['·','Spuntino pomeriggio','Non ancora compilato','—',true],
        ['·','Cena','Non ancora compilata','—',true]
      ]
    },
    '2026-10-09':{
      title:'Venerdì 9 ottobre',status:'Giornata completa · 5 pasti su 5',weight:'106,8 kg',kcal:'1.720 kcal',confidence:'Buona',confidenceClass:'good',
      meals:[
        ['☕','Colazione','Latte, pane tostato e marmellata','390 kcal'],
        ['🍎','Spuntino mattina','Yogurt e frutta','180 kcal'],
        ['🍝','Pranzo','Riso, pollo e verdure','610 kcal'],
        ['🍎','Spuntino pomeriggio','Frutta secca','160 kcal'],
        ['🍽','Cena','Pesce, patate e verdure','380 kcal']
      ]
    },
    '2026-10-08':{
      title:'Giovedì 8 ottobre',status:'Diario parziale · 4 pasti su 5',weight:'107,1 kg',kcal:'1.480 kcal',confidence:'Media',confidenceClass:'medium',
      meals:[
        ['☕','Colazione','Cappuccino e biscotti','360 kcal'],
        ['🍎','Spuntino mattina','Banana','105 kcal'],
        ['🍝','Pranzo','Pasta al ragù e insalata','650 kcal'],
        ['🍎','Spuntino pomeriggio','Yogurt greco','130 kcal'],
        ['·','Cena','Non compilata','—',true]
      ]
    },
    '2026-10-07':{
      title:'Mercoledì 7 ottobre',status:'Giornata completa · 5 pasti su 5',weight:'107,4 kg',kcal:'1.805 kcal',confidence:'Buona',confidenceClass:'good',
      meals:[
        ['☕','Colazione','Yogurt greco, avena e frutta','420 kcal'],
        ['🍎','Spuntino mattina','Pera e noci','180 kcal'],
        ['🍝','Pranzo','Pasta integrale e verdure','640 kcal'],
        ['🍎','Spuntino pomeriggio','Crackers e bresaola','165 kcal'],
        ['🍽','Cena','Tacchino, pane e verdure','400 kcal']
      ]
    }
  };

  const favoriteMeals={
    breakfast:[
      'Yogurt greco 150 g + muesli 45 g + 1 banana',
      'Latte 250 ml + 4 fette biscottate + marmellata',
      'Porridge con avena 50 g + yogurt + frutti di bosco'
    ],
    snack1:[
      '1 mela + 15 g mandorle',
      'Yogurt greco + 1 frutto',
      '1 banana'
    ],
    lunch:[
      'Pasta al pomodoro 80 g + tonno 100 g + insalata',
      'Riso basmati 80 g + pollo 150 g + verdure',
      'Pasta integrale 80 g + verdure + parmigiano'
    ],
    snack2:[
      'Yogurt greco + frutta',
      '20 g frutta secca + 1 frutto',
      'Crackers + bresaola'
    ],
    dinner:[
      'Pesce 180 g + patate 250 g + verdure',
      'Pollo 160 g + pane 70 g + verdure',
      '2 uova + pane 60 g + verdure'
    ]
  };

  const mealCalories={breakfast:410,snack1:175,lunch:620,snack2:165,dinner:380};

  function detailMarkup(day){
    return '<header>'+
      '<div><span class="patient-view-eyebrow">Giornata selezionata</span><h3>'+day.title+'</h3><p>'+day.status+'</p></div>'+
      '<button class="link-button" type="button" data-patient-diary-mode="add">Modifica →</button>'+
    '</header>'+
    '<div class="diary2-detail-metrics">'+
      '<div><span>Peso</span><strong>'+day.weight+'</strong></div>'+
      '<div><span>Calorie <small>(stima)</small></span><strong>'+day.kcal+'</strong></div>'+
      '<div><span>Attendibilità</span><strong class="diary2-confidence '+day.confidenceClass+'">'+day.confidence+'</strong></div>'+
    '</div>'+
    '<div class="diary2-meal-list">'+day.meals.map(meal=>
      '<div class="'+(meal[4]?'pending':'')+'"><span class="diary2-meal-icon">'+meal[0]+'</span><span><strong>'+meal[1]+'</strong><small>'+meal[2]+'</small></span><b>'+meal[3]+'</b></div>'
    ).join('')+'</div>'+
    '<div class="diary2-detail-actions"><button class="patient-primary" type="button" data-patient-diary-mode="add">Modifica giornata</button><button class="patient-secondary" type="button" data-diary-duplicate>Duplica giornata</button></div>';
  }

  function selectDay(date){
    const day=diaryDays[date];
    if(!day)return;
    $$('.diary2-day').forEach(row=>row.classList.toggle('is-selected',row.dataset.diaryDay===date));
    const detail=$('#diary2Detail');
    if(detail)detail.innerHTML=detailMarkup(day);
  }

  function updateRange(button){
    $$('.diary2-range button').forEach(item=>item.classList.toggle('active',item===button));
    const label=button.dataset.diaryRange;
    const main=$('.diary2-summary-main small:last-child');
    if(main){
      main.textContent=label==='7d'?'ultimi 7 giorni · attendibilità buona':label==='30d'?'ultimi 30 giorni · attendibilità buona':'tutto il percorso · attendibilità buona';
    }
  }

  function updateCalories(){
    let total=0,filled=0;
    $$('[data-diary-meal-text]').forEach(field=>{
      const text=field.value.trim();
      const key=field.dataset.diaryMealText;
      const card=field.closest('.diary2-meal-entry');
      const state=card?.querySelector('header small');
      if(text){
        filled++;
        total+=mealCalories[key]||0;
        if(state)state.textContent='Compilato';
      }else if(state)state.textContent='Da compilare';
    });
    const value=$('#diary2Calories');
    const quality=$('#diary2Quality');
    if(value)value.textContent=filled?total.toLocaleString('it-IT')+' kcal':'—';
    if(quality)quality.textContent=filled>=4?'Stima buona':filled>=2?'Stima media':'Compila i pasti per la stima';
  }

  function toggleFavorite(button){
    const key=button.dataset.diaryFavoriteToggle;
    const field=$('[data-diary-meal-text="'+key+'"]');
    if(!field?.value.trim()){
      notify('Preferiti','Scrivi prima il pasto da salvare tra i preferiti.');
      return;
    }
    const active=!button.classList.contains('active');
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
    button.innerHTML=(active?'★':'☆')+' <span>Preferito</span>';
  }

  function openFavorites(type){
    document.querySelector('.diary2-favorites-overlay')?.remove();
    const rows=favoriteMeals[type]||[];
    const overlay=document.createElement('div');
    overlay.className='diary2-favorites-overlay';

    const render=list=>list.length
      ?list.map((text,index)=>'<button type="button" class="diary2-favorite-option" data-diary-favorite-index="'+index+'"><span>★</span><strong>'+text+'</strong><b>Usa</b></button>').join('')
      :'<div class="diary2-favorites-empty">Nessun preferito trovato.</div>';

    overlay.innerHTML='<div class="diary2-favorites-modal">'+
      '<div class="diary2-favorites-head"><div><span class="patient-view-eyebrow">Pasti preferiti</span><h3>Richiama preferito</h3><p>Nessuna caloria nella lista: scegli semplicemente il pasto da riutilizzare.</p></div><button class="diary2-favorites-close" type="button" aria-label="Chiudi">×</button></div>'+
      '<input class="diary2-favorites-search" type="search" placeholder="Cerca tra i preferiti…">'+
      '<div class="diary2-favorites-list">'+render(rows)+'</div>'+
    '</div>';

    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    $('.diary2-favorites-close',overlay)?.addEventListener('click',close);
    overlay.addEventListener('click',event=>{
      if(event.target===overlay)return close();
      const option=event.target.closest('[data-diary-favorite-index]');
      if(!option)return;
      const visible=$$('.diary2-favorite-option',overlay);
      const selected=visible[Number(option.dataset.diaryFavoriteIndex)]?.querySelector('strong')?.textContent;
      if(!selected)return;
      const field=$('[data-diary-meal-text="'+type+'"]');
      if(field){
        field.value=selected;
        field.dispatchEvent(new Event('input',{bubbles:true}));
      }
      close();
    });
    $('.diary2-favorites-search',overlay)?.addEventListener('input',event=>{
      const term=event.target.value.toLowerCase().trim();
      const filtered=rows.filter(text=>text.toLowerCase().includes(term));
      const list=$('.diary2-favorites-list',overlay);
      if(list)list.innerHTML=render(filtered);
    });
  }

  function notify(title,message){
    document.querySelector('.diary2-feedback')?.remove();
    const feedback=document.createElement('div');
    feedback.className='diary2-feedback';
    feedback.innerHTML='<strong>'+title+'</strong><span>'+message+'</span>';
    document.body.appendChild(feedback);
    setTimeout(()=>feedback.remove(),2600);
  }

  function duplicateDay(){
    const title=$('.diary2-entry-head h2');
    const date=$('.diary2-entry-metrics input[type="date"]');
    const weight=$('.diary2-entry-metrics input[inputmode="decimal"]');
    if(title)title.textContent='Duplica giornata';
    if(date)date.value='2026-10-11';
    if(weight)weight.value='';
    document.querySelector('[data-patient-diary-mode="add"]')?.click();
    notify('Copia rapida','Pasti e note copiati. Il peso è stato escluso, come nell’attuale NUBEMO.');
  }

  document.addEventListener('input',event=>{
    if(event.target.matches('[data-diary-meal-text]'))updateCalories();
  });

  document.addEventListener('click',event=>{
    const day=event.target.closest('[data-diary-day]');
    if(day){
      selectDay(day.dataset.diaryDay);
      return;
    }

    const range=event.target.closest('[data-diary-range]');
    if(range){
      updateRange(range);
      return;
    }

    const coffee=event.target.closest('[data-diary-coffee]');
    if(coffee){
      const value=$('#diary2Coffee');
      if(value){
        const next=Math.max(0,Math.min(12,Number(value.textContent||0)+Number(coffee.dataset.diaryCoffee||0)));
        value.textContent=String(next);
      }
      return;
    }

    const star=event.target.closest('[data-diary-favorite-toggle]');
    if(star){
      toggleFavorite(star);
      return;
    }

    const recall=event.target.closest('[data-diary-favorite-open]');
    if(recall){
      openFavorites(recall.dataset.diaryFavoriteOpen);
      return;
    }

    if(event.target.closest('[data-diary-save]')){
      notify('Giornata salvata','Salvataggio demo completato. Nessun dato reale è stato modificato.');
      return;
    }

    if(event.target.closest('[data-diary-duplicate]')){
      duplicateDay();
    }
  });

  updateCalories();
})();