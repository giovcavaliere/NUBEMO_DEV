const tabs=[
  ["panoramica","Panoramica"],["profilo","Profilo"],["visite","Visite"],
  ["misure","Misure"],["andamento","Andamento"],["diario","Diario"],
  ["documenti","Documenti"],["piano","Piano"],["note","Note"]
];

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const fmtNumber=(value,digits=1)=>value==null?"—":new Intl.NumberFormat("it-IT",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const fmtDate=(value,options={day:"numeric",month:"short",year:"numeric"})=>value?new Intl.DateTimeFormat("it-IT",options).format(new Date(value.length===10?`${value}T12:00:00`:value)):"—";
const icon=(name)=>`<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const route=(id,tab)=>`#patient/${encodeURIComponent(id)}/${tab}`;
const field=(label,value)=>`<div class="detail-field"><dt>${label}</dt><dd>${escapeHtml(value||"—")}</dd></div>`;
const sectionHeading=(symbol,title,subtitle="")=>`<div class="detail-section-heading"><span class="detail-symbol">${icon(symbol)}</span><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:""}</div></div>`;

function renderHeader(model){
  const {data,age,kpis,firstVisit,lastControl}=model,{identity,journey}=data;
  const change=kpis.change;
  const status={active:"Attivo",pending:"In attesa",draft:"Bozza",terminated:"Terminato"}[identity.status]||identity.status;
  return `<header class="detail-hero">
    <div class="detail-person">
      <img class="detail-avatar" src="${escapeHtml(identity.avatar)}" alt="">
      <div class="detail-person-copy">
        <div class="detail-name-line"><h1>${escapeHtml(identity.firstName)} ${escapeHtml(identity.lastName)}</h1><span class="detail-status">${escapeHtml(status)}</span></div>
        <p class="detail-demographics">${age!=null?`${escapeHtml(age)} anni`:"Età non disponibile"}<span>·</span>${escapeHtml(identity.sex||"Sesso non indicato")}<span>·</span>${journey.startedAt?`Dal ${fmtDate(journey.startedAt)}`:"Inizio non registrato"}</p>
        <p class="detail-journey-meta">${firstVisit?`Prima visita ${fmtDate(firstVisit.date)}`:"Prima visita non registrata"}<span>·</span>${lastControl?`Ultimo controllo ${fmtDate(lastControl.date)}`:"Nessun controllo registrato"}</p>
        <p class="detail-summary">${icon("document")}${escapeHtml(journey.summary||"Il percorso non ha ancora una sintesi.")}</p>
      </div>
    </div>
    <div class="detail-hero-kpis" aria-label="Dati sintetici del percorso">
      <div><strong>${kpis.completedVisits}</strong><span>visite completate</span></div>
      <div><strong>${model.journeyDays??"—"}</strong><span>giorni di percorso</span></div>
      <div><strong>${change==null?"—":`${change>0?"+":""}${fmtNumber(change)} kg`}</strong><span>rispetto all’inizio</span></div>
    </div>
  </header>`;
}

function renderKpis(model){
  const {kpis}=model;
  const cards=[
    ["Peso iniziale",kpis.initialWeight==null?"—":`${fmtNumber(kpis.initialWeight)} kg`,"Prima misurazione valida","calendar"],
    ["Peso attuale",kpis.currentWeight==null?"—":`${fmtNumber(kpis.currentWeight)} kg`,"Ultima misurazione valida","chart"],
    ["Variazione",kpis.change==null?"—":`${kpis.change>0?"+":""}${fmtNumber(kpis.change)} kg`,kpis.changePercent==null?"Nessun confronto":`${kpis.changePercent>0?"+":""}${fmtNumber(kpis.changePercent)}% dall’inizio`,"leaf"],
    ["Aderenza diario",`${kpis.adherence.percentage}%`,`${kpis.adherence.completed} giorni su ${kpis.adherence.considered}`,"check"],
    ["Visite completate",String(kpis.completedVisits),"Visite salvate","patients"],
    ["Prossimo appuntamento",kpis.nextAppointment?fmtDate(kpis.nextAppointment.startsAt,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—",kpis.nextAppointment?.title||"Nessun appuntamento", "calendar"]
  ];
  return `<section class="detail-kpis" aria-label="Indicatori del percorso">${cards.map(([label,value,note,symbol])=>`<article class="detail-kpi"><span class="detail-kpi-icon">${icon(symbol)}</span><span class="detail-kpi-label">${label}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("")}</section>`;
}

function renderTimeline(model){
  return `<section class="detail-panel detail-timeline-panel">${sectionHeading("leaf","Percorso in sintesi","I momenti chiave del percorso.")}
    ${model.timeline.length?`<ol class="detail-timeline">${model.timeline.map(event=>`<li class="${event.status}"><span class="detail-timeline-dot" aria-hidden="true">${event.status==="completed"?"✓":""}</span><strong>${escapeHtml(event.title)}</strong><time datetime="${escapeHtml(event.date)}">${fmtDate(event.date)}</time><p>${escapeHtml(event.description)}</p></li>`).join("")}</ol>`:`<p class="detail-empty">Il percorso non ha ancora eventi registrati.</p>`}
  </section>`;
}

function renderFocus(model){
  return `<section class="detail-panel">${sectionHeading("check","Focus della settimana","Le attenzioni più utili ora.")}
    ${model.focus.length?`<div class="detail-focus-list">${model.focus.map(item=>`<a class="detail-focus ${item.severity}" href="${route(model.data.identity.id,item.targetRoute)}"><span class="detail-focus-mark" aria-hidden="true">${item.severity==="success"?"✓":item.severity==="warning"?"!":"·"}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span><span aria-hidden="true">›</span></a>`).join("")}</div>`:`<p class="detail-empty">Nessuna attenzione particolare questa settimana.</p>`}
  </section>`;
}

function renderWeightChart(series){
  if(!series.length) return `<p class="detail-empty">Nessuna misurazione del peso disponibile.</p>`;
  if(series.length===1) return `<div class="detail-single-weight"><strong>${fmtNumber(series[0].value)} kg</strong><span>Prima rilevazione · ${fmtDate(series[0].date)}</span></div>`;
  const width=640,height=205,left=42,right=18,top=20,bottom=35;
  const values=series.map(p=>p.value),min=Math.min(...values),max=Math.max(...values);
  const pad=Math.max(1,(max-min)*.25),lo=Math.floor(min-pad),hi=Math.ceil(max+pad);
  const x=i=>left+i*(width-left-right)/(series.length-1);
  const y=value=>top+(hi-value)*(height-top-bottom)/(hi-lo||1);
  const points=series.map((p,i)=>[x(i),y(p.value)]);
  const path=points.map(([px,py],i)=>`${i?"L":"M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area=`${path} L${points.at(-1)[0]} ${height-bottom} L${left} ${height-bottom} Z`;
  const ticks=Array.from({length:4},(_,i)=>lo+(hi-lo)*i/3);
  return `<div class="detail-chart" role="img" aria-label="Peso da ${fmtNumber(series[0].value)} a ${fmtNumber(series.at(-1).value)} chilogrammi, ${series.length} rilevazioni">
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><linearGradient id="detail-weight-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#98c7a3" stop-opacity=".35"/><stop offset="1" stop-color="#98c7a3" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(t=>`<line x1="${left}" x2="${width-right}" y1="${y(t)}" y2="${y(t)}" class="detail-grid-line"/><text x="${left-9}" y="${y(t)+4}" text-anchor="end" class="detail-axis-label">${fmtNumber(t,0)}</text>`).join("")}
      <path d="${area}" fill="url(#detail-weight-fill)"/><path d="${path}" class="detail-chart-line"/>
      ${points.filter((_,i)=>series.length<=12||i===0||i===series.length-1).map(([px,py])=>`<circle cx="${px}" cy="${py}" r="4" class="detail-chart-dot"/>`).join("")}
      <text x="${left}" y="${height-8}" class="detail-axis-label">${fmtDate(series[0].date,{day:"numeric",month:"short"})}</text>
      <text x="${width-right}" y="${height-8}" text-anchor="end" class="detail-axis-label">${fmtDate(series.at(-1).date,{day:"numeric",month:"short"})}</text>
    </svg>
  </div>`;
}

function renderComposition(model){
  const {values,lastBiaDate}=model.composition;
  const definitions=[["weight","Peso"],["bodyFat","FM%"],["muscleMass","MM%"],["bcm","BCM%"]];
  return `<section class="detail-panel">${sectionHeading("chart","Misure e composizione",lastBiaDate?`Ultima BIA ${fmtDate(lastBiaDate)}`:"Ultimi valori disponibili")}
    ${Object.values(values).some(item=>item.value!=null)?`<div class="detail-measures">${definitions.map(([key,label])=>{const item=values[key];return `<div><span>${label}</span><strong>${item.value==null?"—":`${fmtNumber(item.value)} ${item.unit}`}</strong><small>${item.delta==null?"Nessun confronto":`${item.delta>0?"+":""}${fmtNumber(item.delta)} ${item.unit==="%"?"pp":item.unit} dalla precedente`}</small></div>`}).join("")}</div>`:`<p class="detail-empty">Nessuna misura disponibile. Puoi aggiungerla dalla tab Misure.</p>`}
    ${!lastBiaDate && values.weight.value!=null?`<p class="detail-note">Composizione corporea non ancora rilevata.</p>`:""}
  </section>`;
}

function renderOverview(model){
  const actions=[["Apri visita","visite","calendar"],["Leggi referti","documenti","document"],["Controlla diario","diario","check"],["Aggiungi misure","misure","chart"]];
  return `<div class="detail-overview">${renderKpis(model)}
    <div class="detail-overview-top">${renderTimeline(model)}${renderFocus(model)}</div>
    <div class="detail-overview-lower">
      <section class="detail-panel">${sectionHeading("chart","Andamento recente","Peso nelle ultime rilevazioni.")}${renderWeightChart(model.weightSeries)}</section>
      ${renderComposition(model)}
      <section class="detail-panel">${sectionHeading("leaf","Prossime azioni","Accessi rapidi alla scheda.")}
        <div class="detail-actions">${actions.map(([label,target,symbol])=>`<a href="${route(model.data.identity.id,target)}">${icon(symbol)}<span>${label}</span><span aria-hidden="true">›</span></a>`).join("")}</div>
      </section>
    </div>
    <section class="detail-panel">${sectionHeading("document","Documenti e attività recenti","Aggiornamenti in ordine cronologico.")}
      ${model.activity.length?`<ul class="detail-activity">${model.activity.map(item=>`<li><span class="detail-activity-icon">${icon(item.type==="email"?"mail":item.type==="visit"?"calendar":"document")}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description||item.origin||"")}${item.description&&item.origin?` · ${escapeHtml(item.origin)}`:""}</small></span><time datetime="${escapeHtml(item.date)}">${fmtDate(item.date)}</time></li>`).join("")}</ul>`:`<p class="detail-empty">Nessuna attività recente.</p>`}
    </section>
  </div>`;
}

function renderAccordionSection(key,title,section){
  const content=section?`<p>${escapeHtml(section.summary||section.details||"Nessuna informazione inserita.")}</p>${section.details&&section.summary?`<p>${escapeHtml(section.details)}</p>`:""}${section.items?.length?`<ul>${section.items.map(item=>`<li>${escapeHtml(item)}</li>`).join("")}</ul>`:""}`:"<p>Nessuna informazione inserita.</p>";
  return `<details class="detail-accordion" data-accordion="${key}"><summary><span>${title}</span><span class="detail-chevron" aria-hidden="true">⌄</span></summary><div class="detail-accordion-body">${content}<button type="button" class="detail-accordion-edit" data-edit-profile-section="${key}">${icon("edit")}<span>Modifica</span></button></div></details>`;
}

function renderProfile(model){
  const {identity,profile,privacy}=model.data;
  const lifestyle=profile.lifestyle;
  const consent=privacy.consent?.signedAt?`Firmato il ${fmtDate(privacy.consent.signedAt)}`:"Non registrato";
  return `<div class="detail-profile">
    <section class="detail-panel detail-identity">${sectionHeading("profile","Anagrafica")}
      <dl class="detail-fields">${field("Nome",identity.firstName)}${field("Cognome",identity.lastName)}${field("Data di nascita",fmtDate(identity.birthDate))}${field("Sesso",identity.sex)}${field("Telefono",identity.phone)}${field("Email",identity.email)}</dl>
      <button type="button" class="detail-inline-action" data-edit-identity>Vedi / Modifica anagrafica <span aria-hidden="true">›</span></button>
    </section>
    <section class="detail-panel detail-history">${sectionHeading("document","Percorso e anamnesi")}
      <div class="detail-accordions">${renderAccordionSection("goals","Obiettivi del percorso",profile.goals)}${renderAccordionSection("history","Anamnesi generale",profile.history)}${renderAccordionSection("conditions","Condizioni cliniche",profile.conditions)}${renderAccordionSection("medication","Farmaci e integrazione",profile.medication)}</div>
    </section>
    <section class="detail-panel detail-lifestyle"><div class="detail-heading-action">${sectionHeading("leaf","Stile di vita e abitudini")}<button type="button" class="detail-edit-button" data-edit-lifestyle>${icon("edit")}<span>Modifica</span></button></div>
      ${lifestyle.length?`<div class="detail-habits">${lifestyle.map(item=>`<div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value)}</span><small>${escapeHtml(item.description)}</small></div>`).join("")}</div>`:`<p class="detail-empty">Abitudini non ancora registrate.</p>`}
    </section>
    <section class="detail-panel detail-administration"><div class="detail-heading-action">${sectionHeading("check","Dati amministrativi")}<button type="button" class="detail-edit-button" data-edit-administration>${icon("edit")}<span>Modifica</span></button></div>
      <dl class="detail-fields">${field("Consenso privacy",consent)}${field("Comunicazioni",privacy.communications.email?"Email":"Non attive")}${field("Promemoria appuntamenti",privacy.reminders.email?"Email":"Non attivi")}${field("Note amministrative",privacy.administrativeNotes||"Nessuna nota")}</dl>
    </section>
  </div>`;
}

export function renderPatientDetail(root,model,activeTab="panoramica",onIdentityChange=()=>{}){
  const {id,firstName,lastName}=model.data.identity;
  const tab=tabs.some(([key])=>key===activeTab)?activeTab:"panoramica";
  root.innerHTML=`<div class="patient-detail">
    <nav class="detail-breadcrumb" aria-label="Percorso"><a href="#patients">Pazienti</a><span aria-hidden="true">›</span><span>${escapeHtml(firstName)} ${escapeHtml(lastName)}</span></nav>
    ${renderHeader(model)}
    <nav class="detail-tabs" aria-label="Sezioni paziente">${tabs.map(([key,label])=>`<a href="${route(id,key)}" class="${tab===key?"active":""}" ${tab===key?'aria-current="page"':""}>${label}</a>`).join("")}</nav>
    <div class="detail-content">${tab==="panoramica"?renderOverview(model):tab==="profilo"?renderProfile(model):`<section class="detail-panel detail-placeholder">${sectionHeading("document",tabs.find(([key])=>key===tab)[1])}<p>Questa sezione sarà disponibile nei prossimi step.</p></section>`}</div>
  </div>`;
  root.querySelectorAll(".detail-accordion").forEach(details=>details.addEventListener("toggle",()=>{
    if(details.open) root.querySelectorAll(".detail-accordion").forEach(other=>{if(other!==details) other.open=false});
  }));
  root.querySelector("[data-edit-identity]")?.addEventListener("click",()=>openIdentityDialog(root,model,onIdentityChange));
  root.querySelectorAll("[data-edit-profile-section]").forEach(button=>button.addEventListener("click",event=>{
    event.preventDefault();
    openProfileSectionDialog(root,model,button.dataset.editProfileSection,onIdentityChange);
  }));
  root.querySelector("[data-edit-lifestyle]")?.addEventListener("click",()=>openLifestyleDialog(root,model,onIdentityChange));
  root.querySelector("[data-edit-administration]")?.addEventListener("click",()=>openAdministrationDialog(root,model,onIdentityChange));
}

function attachDialog(root,dialog,onSave){
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("close",()=>{
    if(dialog.returnValue==="save") onSave?.(new FormData(dialog.querySelector("form")));
    dialog.remove();
  },{once:true});
  dialog.showModal();
}

function openIdentityDialog(root,model,onChange){
  const {identity}=model.data;
  const sexOptions=["","Maschio","Femmina","Altro","Preferisco non indicarlo"];
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog";
  dialog.innerHTML=\`<form method="dialog"><header><h2>Anagrafica</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Modifiche demo disponibili fino al ricaricamento della pagina.</p>
    <div class="detail-dialog-fields">
      <label>Nome<input name="firstName" value="\${escapeHtml(identity.firstName||"")}"></label>
      <label>Cognome<input name="lastName" value="\${escapeHtml(identity.lastName||"")}"></label>
      <label>Data di nascita<input name="birthDate" type="date" value="\${escapeHtml(identity.birthDate||"")}"></label>
      <label>Sesso<select name="sex">\${sexOptions.map(option=>\`<option value="\${escapeHtml(option)}" \${identity.sex===option?"selected":""}>\${escapeHtml(option||"Seleziona...")}</option>\`).join("")}</select></label>
      <label>Codice fiscale<input name="fiscalCode" value="\${escapeHtml(identity.fiscalCode||"")}"></label>
      <label>Indirizzo<input name="address" value="\${escapeHtml(identity.address||"")}"></label>
      <label>CAP<input name="postalCode" value="\${escapeHtml(identity.postalCode||"")}"></label>
      <label>Città<input name="city" value="\${escapeHtml(identity.city||"")}"></label>
      <label>Provincia<input name="province" value="\${escapeHtml(identity.province||"")}"></label>
      <label>Telefono<input name="phone" type="tel" value="\${escapeHtml(identity.phone||"")}"></label>
      <label>Email<input name="email" type="email" value="\${escapeHtml(identity.email||"")}"></label>
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva</button></footer></form>\`;
  attachDialog(root,dialog,values=>{
    ["firstName","lastName","birthDate","sex","fiscalCode","address","postalCode","city","province","phone","email"].forEach(key=>{
      identity[key]=String(values.get(key)||"").trim();
    });
    onChange();
  });
}

function openProfileSectionDialog(root,model,key,onChange){
  const section=model.data.profile[key];
  if(!section) return;
  const titles={goals:"Obiettivi del percorso",history:"Anamnesi generale",conditions:"Condizioni cliniche",medication:"Farmaci e integrazione"};
  const hasItems=key!=="history";
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog";
  dialog.innerHTML=\`<form method="dialog"><header><h2>\${escapeHtml(titles[key]||"Profilo")}</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Modifica le informazioni del percorso. I dati restano nella sessione demo fino al ricaricamento.</p>
    <div class="detail-dialog-fields detail-dialog-fields-single">
      <label>Sintesi<textarea name="summary" rows="4">\${escapeHtml(section.summary||"")}</textarea></label>
      \${key==="history"?\`<label>Dettaglio<textarea name="details" rows="6">\${escapeHtml(section.details||"")}</textarea></label>\`:""}
      \${hasItems?\`<label>Voci <small>Una voce per riga</small><textarea name="items" rows="6">\${escapeHtml((section.items||[]).join("\\n"))}</textarea></label>\`:""}
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva</button></footer></form>\`;
  attachDialog(root,dialog,values=>{
    section.summary=String(values.get("summary")||"").trim();
    if(key==="history") section.details=String(values.get("details")||"").trim();
    if(hasItems) section.items=String(values.get("items")||"").split(/\\r?\\n/).map(item=>item.trim()).filter(Boolean);
    onChange();
  });
}

function openLifestyleDialog(root,model,onChange){
  const lifestyle=model.data.profile.lifestyle;
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog detail-dialog-wide";
  dialog.innerHTML=\`<form method="dialog"><header><h2>Stile di vita e abitudini</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Aggiorna la sintesi delle abitudini utili al percorso.</p>
    <div class="detail-lifestyle-editor">\${lifestyle.map((item,index)=>\`<fieldset><legend>\${escapeHtml(item.label)}</legend><label>Valore sintetico<input name="lifestyle-\${index}-value" value="\${escapeHtml(item.value||"")}"></label><label>Descrizione<textarea name="lifestyle-\${index}-description" rows="2">\${escapeHtml(item.description||"")}</textarea></label></fieldset>\`).join("")}</div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva</button></footer></form>\`;
  attachDialog(root,dialog,values=>{
    lifestyle.forEach((item,index)=>{
      item.value=String(values.get(\`lifestyle-\${index}-value\`)||"").trim();
      item.description=String(values.get(\`lifestyle-\${index}-description\`)||"").trim();
    });
    onChange();
  });
}

function openAdministrationDialog(root,model,onChange){
  const privacy=model.data.privacy;
  const consentStatus=privacy.consent?.status||(privacy.consent?.signedAt?"signed":"missing");
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog";
  dialog.innerHTML=\`<form method="dialog"><header><h2>Dati amministrativi</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Gestisci consenso e preferenze operative del paziente. NUBEMO 2.0 utilizza solo email.</p>
    <div class="detail-dialog-fields detail-dialog-fields-single">
      <label>Stato consenso privacy<select name="consentStatus"><option value="signed" \${consentStatus==="signed"?"selected":""}>Firmato</option><option value="pending" \${consentStatus==="pending"?"selected":""}>In attesa</option><option value="missing" \${consentStatus==="missing"?"selected":""}>Non registrato</option></select></label>
      <label>Data firma<input name="consentSignedAt" type="date" value="\${escapeHtml(privacy.consent?.signedAt||"")}"></label>
      <label class="detail-check-field"><input name="communicationsEmail" type="checkbox" \${privacy.communications?.email?"checked":""}><span>Comunicazioni via email</span></label>
      <label class="detail-check-field"><input name="remindersEmail" type="checkbox" \${privacy.reminders?.email?"checked":""}><span>Promemoria appuntamenti via email</span></label>
      <label>Note amministrative<textarea name="administrativeNotes" rows="5">\${escapeHtml(privacy.administrativeNotes||"")}</textarea></label>
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva</button></footer></form>\`;
  attachDialog(root,dialog,values=>{
    const status=String(values.get("consentStatus")||"missing");
    const signedAt=status==="signed"?String(values.get("consentSignedAt")||"").trim():"";
    privacy.consent={...(privacy.consent||{}),status,signedAt:signedAt||null,documentId:privacy.consent?.documentId||null};
    privacy.communications={email:values.get("communicationsEmail")==="on"};
    privacy.reminders={email:values.get("remindersEmail")==="on"};
    privacy.administrativeNotes=String(values.get("administrativeNotes")||"").trim();
    onChange();
  });
}
