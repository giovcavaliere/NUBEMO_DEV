(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const favorites={
    breakfast:['Yogurt greco 150 g + muesli 45 g + 1 banana','Latte 250 ml + 4 fette biscottate + marmellata'],
    snack1:['1 mela + 15 g mandorle','Yogurt greco + 1 frutto'],
    lunch:['Pasta al pomodoro 80 g + tonno 100 g + insalata','Riso basmati 80 g + pollo 150 g + verdure'],
    snack2:['Yogurt greco + frutta','20 g frutta secca + 1 frutto'],
    dinner:['Pesce 180 g + patate 250 g + verdure','Pollo 160 g + pane 70 g + verdure']
  };

  const history={
    '2026-10-09':{
      title:'Venerdì 9 ottobre',weight:'106,8',water:'1,8',coffee:2,sweetener:'Senza zucchero',notes:'Passeggiata serale.',
      kcal:'1.720 kcal',quality:'Buona',
      meals:['Latte 250 ml + pane tostato + marmellata','Yogurt + frutta','Riso basmati + pollo + verdure','Frutta secca','Pesce + patate + verdure']
    },
    '2026-10-08':{
      title:'Giovedì 8 ottobre',weight:'107,1',water:'1,4',coffee:3,sweetener:'Stevia',notes:'Giornata lavorativa intensa.',
      kcal:'1.480 kcal',quality:'Media',
      meals:['Cappuccino + biscotti','Banana','Pasta al ragù + insalata','Yogurt greco','']
    },
    '2026-10-07':{
      title:'Mercoledì 7 ottobre',weight:'107,4',water:'2,0',coffee:2,sweetener:'Senza zucchero',notes:'Allenamento leggero.',
      kcal:'1.805 kcal',quality:'Buona',
      meals:['Yogurt greco + avena + frutta','Pera + noci','Pasta integrale + verdure','Crackers + bresaola','Tacchino + pane + verdure']
    }
  };

  const kcal={breakfast:410,snack1:175,lunch:620,snack2:165,dinner:380};

  function toast(title,message){
    document.querySelector('.patient-diary-toast')?.remove();
    const el=document.createElement('div');
    el.className='patient-diary-toast';
    el.innerHTML='<strong>'+esc(title)+'</strong><span>'+esc(message)+'</span>';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2200);
  }

  function updateEnergy(){
    let total=0,filled=0;
    $$('[data-diary-meal-text]').forEach(field=>{
      const text=field.value.trim();
      if(text){filled++;total+=kcal[field.dataset.diaryMealText]||0;}
    });
    const value=$('#patientDiaryCalories');
    const quality=$('#patientDiaryQuality');
    if(value)value.textContent=filled?total.toLocaleString('it-IT')+' kcal':'—';
    if(quality)quality.textContent=filled>=3?'Buona':filled>=1?'Media':'—';
  }

  function dialog(title,subtitle,body){
    document.querySelector('.patient-diary-overlay')?.remove();
    const overlay=document.createElement('div');
    overlay.className='patient-diary-overlay';
    overlay.innerHTML='<div class="patient-diary-dialog"><div class="patient-diary-dialog-head"><div><h3>'+esc(title)+'</h3><p>'+esc(subtitle)+'</p></div><button type="button" class="patient-diary-dialog-close">×</button></div>'+body+'</div>';
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    $('.patient-diary-dialog-close',overlay)?.addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    return overlay;
  }

  function openFavorites(type){
    const rows=favorites[type]||[];
    const make=list=>list.length?list.map((text,i)=>'<button class="patient-diary-dialog-option" type="button" data-favorite-choice="'+i+'"><span>★</span><strong>'+esc(text)+'</strong><b>Usa</b></button>').join(''):'<p>Nessun preferito.</p>';
    const overlay=dialog('Richiama preferito','Scegli un pasto salvato per questa tipologia.','<input class="patient-diary-dialog-search" type="search" placeholder="Cerca…"><div class="patient-diary-dialog-list">'+make(rows)+'</div>');
    $('.patient-diary-dialog-search',overlay)?.addEventListener('input',e=>{
      const term=e.target.value.toLowerCase().trim();
      const filtered=rows.filter(x=>x.toLowerCase().includes(term));
      const list=$('.patient-diary-dialog-list',overlay);
      if(list)list.innerHTML=make(filtered);
    });
    overlay.addEventListener('click',e=>{
      const btn=e.target.closest('[data-favorite-choice]');
      if(!btn)return;
      const text=btn.querySelector('strong')?.textContent;
      const field=$('[data-diary-meal-text="'+type+'"]');
      if(field&&text){field.value=text;field.dispatchEvent(new Event('input',{bubbles:true}));}
      overlay.remove();
    });
  }

  function normalize(value){
    return String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }

  function filterHistory(term){
    const q=normalize(term);
    $('[data-diary-history-date]').forEach(row=>{
      const day=history[row.dataset.diaryHistoryDate];
      const haystack=day
        ?[row.dataset.diaryHistoryDate,day.title,day.weight,day.water,day.coffee,day.sweetener,day.notes,...day.meals].join(' ')
        :'';
      row.hidden=!!q&&!normalize(haystack).includes(q);
    });
  }

  function fillEditForm(date){
    const day=history[date];
    if(!day)return;

    const title=$('[data-diary-panel="edit"] .patient-diary-header h1');
    const subtitle=$('[data-diary-panel="edit"] .patient-diary-header p');
    if(title)title.textContent='Modifica giornata';
    if(subtitle)subtitle.textContent=day.title;

    $('[data-diary-edit-field="weight"]')?.setAttribute('value',day.weight||'');
    const weight=$('[data-diary-edit-field="weight"]'); if(weight)weight.value=day.weight||'';
    const water=$('[data-diary-edit-field="water"]'); if(water)water.value=day.water||'';
    const sweetener=$('[data-diary-edit-field="sweetener"]'); if(sweetener)sweetener.value=day.sweetener||'';
    const notes=$('[data-diary-edit-field="notes"]'); if(notes)notes.value=day.notes||'';
    const coffee=$('#patientDiaryCoffee'); if(coffee)coffee.textContent=String(day.coffee??0);

    const keys=['breakfast','snack1','lunch','snack2','dinner'];
    keys.forEach((key,index)=>{
      const field=$('[data-diary-meal-text="'+key+'"]');
      if(field)field.value=day.meals[index]||'';
    });
    updateEnergy();

    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.hidden=true;
    trigger.dataset.patientDiaryMode='edit';
    document.body.appendChild(trigger);
    trigger.click();
    trigger.remove();
  }

  function deleteHistoryDay(date){
    const day=history[date];
    if(!day)return;
    if(!confirm('Eliminare la giornata di '+day.title+'?'))return;
    delete history[date];
    document.querySelector('[data-diary-history-date="'+date+'"]')?.remove();
    document.querySelector('.patient-diary-overlay')?.remove();
    toast('Giornata eliminata','Eliminazione demo completata.');
  }

  function openHistory(date){
    const day=history[date];
    if(!day)return;
    const labels=['Colazione','Spuntino mattina','Pranzo','Spuntino pomeriggio','Cena'];

    const overlay=dialog(
      day.title,
      day.weight+' kg · '+day.kcal+' · attendibilità '+day.quality,
      '<div class="patient-diary-history-detail">'+
        day.meals.map((meal,i)=>'<article><strong>'+labels[i]+'</strong><small>'+(meal?esc(meal):'Non compilato')+'</small></article>').join('')+
      '</div>'+
      '<div class="patient-diary-history-actions">'+
        '<button class="patient-secondary" type="button" data-diary-history-edit="'+date+'">Modifica</button>'+
        '<button class="patient-secondary patient-diary-danger" type="button" data-diary-history-delete="'+date+'">Elimina</button>'+
      '</div>'
    );

    overlay.addEventListener('click',e=>{
      const edit=e.target.closest('[data-diary-history-edit]');
      if(edit){
        overlay.remove();
        fillEditForm(edit.dataset.diaryHistoryEdit);
        return;
      }
      const del=e.target.closest('[data-diary-history-delete]');
      if(del)deleteHistoryDay(del.dataset.diaryHistoryDelete);
    });
  }

  document.addEventListener('input',e=>{
    if(e.target.matches('[data-diary-meal-text]'))updateEnergy();
    if(e.target.matches('[data-diary-history-search]'))filterHistory(e.target.value);
  });

  document.addEventListener('click',e=>{
    const coffee=e.target.closest('[data-diary-coffee]');
    if(coffee){
      const value=$('#patientDiaryCoffee');
      if(value)value.textContent=String(Math.max(0,Number(value.textContent||0)+Number(coffee.dataset.diaryCoffee||0)));
      return;
    }

    const star=e.target.closest('[data-diary-favorite-toggle]');
    if(star){
      const field=$('[data-diary-meal-text="'+star.dataset.diaryFavoriteToggle+'"]');
      if(!field?.value.trim()){toast('Preferito','Scrivi prima il pasto.');return;}
      const active=!star.classList.contains('active');
      star.classList.toggle('active',active);
      star.setAttribute('aria-pressed',String(active));
      star.textContent=active?'★':'☆';
      return;
    }

    const recall=e.target.closest('[data-diary-favorite-open]');
    if(recall){openFavorites(recall.dataset.diaryFavoriteOpen);return;}

    const row=e.target.closest('[data-diary-history-date]');
    if(row){openHistory(row.dataset.diaryHistoryDate);return;}

    if(e.target.closest('[data-diary-save]')){toast('Giornata salvata','Salvataggio demo completato.');}
  });

  updateEnergy();
})();