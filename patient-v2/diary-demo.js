(() => {
  'use strict';

  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  const historyDays={
    '2026-10-09':{
      date:'venerdì 9 ottobre 2026',
      kcal:'1.720 kcal',
      confidence:'Buona',
      confidenceClass:'high',
      weight:'106,8 kg',
      status:'Giornata completa',
      meals:[
        ['☕','Colazione','Latte 250 ml + pane tostato + marmellata','390 kcal'],
        ['🍎','Spuntino mattina','Yogurt + frutta','180 kcal'],
        ['🍝','Pranzo','Riso basmati + pollo + verdure','610 kcal'],
        ['🍎','Spuntino pomeriggio','Frutta secca','160 kcal'],
        ['🍽','Cena','Pesce + patate + verdure','380 kcal']
      ]
    },
    '2026-10-08':{
      date:'giovedì 8 ottobre 2026',
      kcal:'1.480 kcal',
      confidence:'Media',
      confidenceClass:'medium',
      weight:'107,1 kg',
      status:'4 pasti su 5',
      meals:[
        ['☕','Colazione','Cappuccino + biscotti','360 kcal'],
        ['🍎','Spuntino mattina','Banana','105 kcal'],
        ['🍝','Pranzo','Pasta al ragù + insalata','650 kcal'],
        ['🍎','Spuntino pomeriggio','Yogurt greco','130 kcal'],
        ['🍽','Cena','Non compilata','—']
      ]
    },
    '2026-10-07':{
      date:'mercoledì 7 ottobre 2026',
      kcal:'1.805 kcal',
      confidence:'Buona',
      confidenceClass:'high',
      weight:'107,4 kg',
      status:'Giornata completa',
      meals:[
        ['☕','Colazione','Yogurt greco + avena + frutta','420 kcal'],
        ['🍎','Spuntino mattina','Pera + noci','180 kcal'],
        ['🍝','Pranzo','Pasta integrale + verdure','640 kcal'],
        ['🍎','Spuntino pomeriggio','Crackers + bresaola','165 kcal'],
        ['🍽','Cena','Tacchino + pane + verdure','400 kcal']
      ]
    },
    '2026-10-06':{
      date:'martedì 6 ottobre 2026',
      kcal:'1.610 kcal',
      confidence:'Buona',
      confidenceClass:'high',
      weight:'107,7 kg',
      status:'Giornata completa',
      meals:[
        ['☕','Colazione','Latte + cereali','360 kcal'],
        ['🍎','Spuntino mattina','Mela','90 kcal'],
        ['🍝','Pranzo','Pasta + pollo + verdure','610 kcal'],
        ['🍎','Spuntino pomeriggio','Yogurt','130 kcal'],
        ['🍽','Cena','Pesce + verdure + pane','420 kcal']
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

  const demoKcal={breakfast:410,snack1:175,lunch:620,snack2:165,dinner:380};

  function updateCalories(){
    let total=0;
    let filled=0;

    $$('[data-diary-meal-text]').forEach(field=>{
      const key=field.dataset.diaryMealText;
      const text=field.value.trim();
      const editor=field.closest('.patient-diary-meal-editor');
      const status=editor?.querySelector('header small');

      if(text){
        filled++;
        total+=demoKcal[key]||0;
        if(status)status.textContent='Compilato';
      }else if(status){
        status.textContent='Da compilare';
      }
    });

    const value=$('#patientDiaryCalories');
    const quality=$('#patientDiaryQuality');

    if(value)value.textContent=filled?total.toLocaleString('it-IT')+' kcal':'—';
    if(quality)quality.textContent=filled>=4?'Buona':filled>=2?'Media':'Non disponibile';
  }

  function toast(title,message){
    document.querySelector('.patient-diary-toast')?.remove();

    const el=document.createElement('div');
    el.className='patient-diary-toast';
    el.innerHTML='<strong>'+esc(title)+'</strong><span>'+esc(message)+'</span>';
    document.body.appendChild(el);

    setTimeout(()=>el.remove(),2400);
  }

  function toggleFavorite(button){
    const key=button.dataset.diaryFavoriteToggle;
    const field=$('[data-diary-meal-text="'+key+'"]');

    if(!field?.value.trim()){
      toast('Pasto preferito','Scrivi prima il pasto da salvare.');
      return;
    }

    const active=!button.classList.contains('active');
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
    button.textContent=active?'★':'☆';
    button.title=active?'Rimuovi dai preferiti':'Salva come preferito';

    toast('Pasto preferito',active?'Pasto aggiunto ai preferiti nella demo.':'Pasto rimosso dai preferiti nella demo.');
  }

  function openFavorites(type){
    document.querySelector('.patient-diary-favorites')?.remove();

    const rows=favoriteMeals[type]||[];
    const indexed=rows.map((text,index)=>({text,index}));
    const overlay=document.createElement('div');
    overlay.className='patient-diary-favorites';

    const render=list=>list.length
      ?list.map(item=>
        '<button type="button" class="patient-diary-favorite-option" data-favorite-index="'+item.index+'">'+
          '<span>★</span><strong>'+esc(item.text)+'</strong><b>Usa</b>'+
        '</button>'
      ).join('')
      :'<div class="patient-diary-favorites-empty">Nessun preferito trovato.</div>';

    overlay.innerHTML=
      '<div class="patient-diary-favorites-card">'+
        '<div class="patient-diary-favorites-head">'+
          '<div><span class="patient-view-eyebrow">Pasti preferiti</span><h3>Richiama preferito</h3><p>Scegli un pasto già salvato per questa tipologia.</p></div>'+
          '<button class="patient-diary-favorites-close" type="button" aria-label="Chiudi">×</button>'+
        '</div>'+
        '<input class="patient-diary-favorites-search" type="search" placeholder="Cerca tra i preferiti…">'+
        '<div class="patient-diary-favorites-list">'+render(indexed)+'</div>'+
      '</div>';

    document.body.appendChild(overlay);

    const close=()=>overlay.remove();
    $('.patient-diary-favorites-close',overlay)?.addEventListener('click',close);

    overlay.addEventListener('click',event=>{
      if(event.target===overlay){
        close();
        return;
      }

      const option=event.target.closest('[data-favorite-index]');
      if(!option)return;

      const text=rows[Number(option.dataset.favoriteIndex)];
      const field=$('[data-diary-meal-text="'+type+'"]');

      if(field&&text){
        field.value=text;
        field.dispatchEvent(new Event('input',{bubbles:true}));
      }

      close();
    });

    $('.patient-diary-favorites-search',overlay)?.addEventListener('input',event=>{
      const term=event.target.value.trim().toLowerCase();
      const filtered=indexed.filter(item=>item.text.toLowerCase().includes(term));
      const list=$('.patient-diary-favorites-list',overlay);
      if(list)list.innerHTML=render(filtered);
    });
  }

  function openHistory(date){
    const day=historyDays[date];
    if(!day)return;

    document.querySelector('.patient-diary-history-modal')?.remove();

    const overlay=document.createElement('div');
    overlay.className='patient-diary-history-modal';

    overlay.innerHTML=
      '<div class="patient-diary-history-card">'+
        '<section class="diary-detail">'+
          '<header class="diary-detail-head">'+
            '<div>'+
              '<span class="diary-detail-date">'+esc(day.date)+'</span>'+
              '<div class="diary-detail-value"><strong>'+esc(day.kcal)+'</strong><span class="diary-confidence diary-confidence-'+day.confidenceClass+'">'+esc(day.confidence)+'</span></div>'+
              '<p>'+esc(day.status)+' · peso '+esc(day.weight)+'</p>'+
            '</div>'+
            '<button class="patient-diary-history-close" type="button" aria-label="Chiudi">×</button>'+
          '</header>'+
          '<div class="diary-meals">'+
            day.meals.map(meal=>
              '<article class="diary-meal '+(meal[3]==='—'?'patient-diary-meal-empty':'')+'">'+
                '<header><span class="diary-meal-icon">'+meal[0]+'</span><div><strong>'+esc(meal[1])+'</strong><small>'+esc(meal[2])+'</small></div><strong class="diary-meal-total">'+esc(meal[3])+'</strong></header>'+
              '</article>'
            ).join('')+
          '</div>'+
        '</section>'+
      '</div>';

    document.body.appendChild(overlay);

    const close=()=>overlay.remove();
    $('.patient-diary-history-close',overlay)?.addEventListener('click',close);
    overlay.addEventListener('click',event=>{
      if(event.target===overlay)close();
    });
  }

  function duplicateDay(){
    const title=$('[data-diary-panel="add"] .diary-titlebar h2');
    const subtitle=$('[data-diary-panel="add"] .diary-titlebar p');
    const date=$('[data-diary-panel="add"] input[type="date"]');
    const weight=$('[data-diary-panel="add"] input[inputmode="decimal"]');

    if(title)title.textContent='Duplica giornata';
    if(subtitle)subtitle.textContent='Copia rapida dalla giornata corrente';
    if(date)date.value='2026-10-11';
    if(weight)weight.value='';

    $('[data-patient-diary-mode="add"]')?.click();
    toast('Copia rapida','Pasti e note copiati. Il peso è stato escluso.');
  }

  document.addEventListener('input',event=>{
    if(event.target.matches('[data-diary-meal-text]'))updateCalories();
  });

  document.addEventListener('click',event=>{
    const history=event.target.closest('[data-diary-history-date]');
    if(history){
      openHistory(history.dataset.diaryHistoryDate);
      return;
    }

    const coffee=event.target.closest('[data-diary-coffee]');
    if(coffee){
      const value=$('#patientDiaryCoffee');
      if(value){
        const next=Math.max(0,Math.min(12,Number(value.textContent||0)+Number(coffee.dataset.diaryCoffee||0)));
        value.textContent=String(next);
      }
      return;
    }

    const favorite=event.target.closest('[data-diary-favorite-toggle]');
    if(favorite){
      toggleFavorite(favorite);
      return;
    }

    const recall=event.target.closest('[data-diary-favorite-open]');
    if(recall){
      openFavorites(recall.dataset.diaryFavoriteOpen);
      return;
    }

    if(event.target.closest('[data-diary-save]')){
      toast('Giornata salvata','Salvataggio demo completato.');
      return;
    }

    if(event.target.closest('[data-diary-duplicate]')){
      duplicateDay();
    }
  });

  updateCalories();
})();