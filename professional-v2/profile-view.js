const PHOTO_TYPES=["image/png","image/jpeg","image/webp"];
const PHOTO_MAX_BYTES=2.5*1024*1024;

export const professionalProfile={
  firstName:"Maria",
  surname:"Rossi",
  displayName:"Dott.ssa Rossi",
  qualification:"Biologa Nutrizionista",
  taxCode:"RSSMRA80A41F257X",
  vat:"01234567890",
  address:"Via Emilia Centro 120",
  zip:"41121",
  city:"Modena",
  province:"MO",
  email:"maria.rossi@example.it",
  phone:"+39 333 123 4567",\n  studios:[\n    {id:"studio-main",name:"Studio principale",address:"Via Emilia Centro 120",zip:"41121",city:"Modena",province:"MO",primary:true},\n    {id:"studio-secondary",name:"Studio secondario",address:"Via Giardini 80",zip:"41124",city:"Modena",province:"MO",primary:false}\n  ],
  firstVisit:60,
  controlVisit:30,
  dayStart:"08:00",
  dayEnd:"19:00",
  workDays:5,
  photoData:"",
  logoData:""
};

export function initials(profile=professionalProfile){
  const first=(profile.firstName||"").trim().charAt(0);
  const last=(profile.surname||"").trim().charAt(0);
  return (first+last).toLocaleUpperCase("it")||"P";
}

function esc(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
}

function photoMarkup(profile){
  return profile.photoData
    ? `<img src="${esc(profile.photoData)}" alt="Foto profilo">`
    : `<span class="profile-photo-initials">${esc(initials(profile))}</span>`;
}

function logoMarkup(profile){
  return profile.logoData
    ? `<img src="${esc(profile.logoData)}" alt="Logo professionale">`
    : '<span class="profile-logo-empty">Nessun logo</span>';
}

export function renderProfilePage(root,profile=professionalProfile){
  root.innerHTML=`
    <div class="profile-page">
      <header class="profile-head">
        <h1>Profilo</h1>
        <p>Gestisci i dati professionali, l'identità mostrata in NUBEMO e le impostazioni dell'agenda.</p>
      </header>

      <div class="profile-grid">
        <section class="profile-card wide">
          <div class="profile-card-head"><h2>Dati professionali</h2><span class="profile-badge">Report NUBEMO</span></div>
          <div class="profile-fields">
            <div class="profile-field"><label>Nome</label><input data-profile-field="firstName" value="${esc(profile.firstName)}" readonly></div>
            <div class="profile-field"><label>Cognome</label><input data-profile-field="surname" value="${esc(profile.surname)}" readonly></div>
            <div class="profile-field"><label>Qualifica / titolo professionale</label><input data-profile-field="qualification" value="${esc(profile.qualification)}" placeholder="es. Biologa Nutrizionista"></div>
            <div class="profile-field"><label>Nome visualizzato</label><input data-profile-field="displayName" value="${esc(profile.displayName)}" placeholder="es. Dott.ssa Maria Rossi"></div>
            <div class="profile-field"><label>Codice fiscale</label><input data-profile-field="taxCode" value="${esc(profile.taxCode)}"></div>
            <div class="profile-field"><label>Partita IVA</label><input data-profile-field="vat" value="${esc(profile.vat)}"></div>
          </div>
        </section>

        <section class="profile-card">
          <div class="profile-card-head"><h2>Foto profilo</h2><span class="profile-badge">Interfaccia</span></div>
          <div class="profile-media">
            <div class="profile-photo-preview" data-profile-photo-preview>${photoMarkup(profile)}</div>
            <div class="profile-media-copy">
              <p>Usata nella barra laterale. Se non presente vengono mostrate le iniziali di nome e cognome.</p>
              <div class="profile-media-actions">
                <label class="profile-secondary">Carica foto<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-profile-photo-file></label>
                <button class="profile-remove" type="button" data-profile-photo-remove>Rimuovi foto</button>
              </div>
            </div>
          </div>
        </section>

        <section class="profile-card">
          <div class="profile-card-head"><h2>Logo professionale</h2><span class="profile-badge">Opzionale</span></div>
          <div class="profile-media">
            <div class="profile-logo-preview" data-profile-logo-preview>${logoMarkup(profile)}</div>
            <div class="profile-media-copy">
              <p>Se presente, viene utilizzato nei documenti professionali insieme al marchio NUBEMO.</p>
              <div class="profile-media-actions">
                <label class="profile-secondary">Carica logo<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-profile-logo-file></label>
                <button class="profile-remove" type="button" data-profile-logo-remove>Rimuovi logo</button>
              </div>
            </div>
          </div>
        </section>

        <section class="profile-card wide">
          <div class="profile-card-head"><h2>Recapiti professionali</h2></div>
          <div class="profile-fields">
            <div class="profile-field"><label>E-mail</label><input data-profile-field="email" type="email" value="${esc(profile.email)}" readonly></div>
            <div class="profile-field"><label>Telefono</label><input data-profile-field="phone" value="${esc(profile.phone)}"></div>
          </div>
        </section>

        <section class="profile-card wide">
          <div class="profile-card-head"><div><h2>Sedi studio</h2><p class="profile-card-subtitle">Gli studi configurati qui alimentano il campo Luogo / Studio dei nuovi appuntamenti.</p></div><button class="profile-secondary" type="button" data-studio-add>+ Aggiungi studio</button></div>
          <div class="profile-studios">
            ${(Array.isArray(profile.studios)?profile.studios:[]).map((studio,index)=>`
              <article class="profile-studio-row ${studio.primary?"primary":""}" data-studio-row="${index}">
                <div class="profile-studio-title">
                  <strong>${esc(studio.name||`Studio ${index+1}`)}</strong>
                  ${studio.primary?'<span class="profile-badge">Principale</span>':`<button type="button" class="profile-studio-primary" data-studio-primary="${index}">Imposta principale</button>`}
                </div>
                <div class="profile-fields studio-fields">
                  <div class="profile-field"><label>Nome sede</label><input data-studio-index="${index}" data-studio-field="name" value="${esc(studio.name)}" placeholder="es. Studio principale"></div>
                  <div class="profile-field"><label>Indirizzo</label><input data-studio-index="${index}" data-studio-field="address" value="${esc(studio.address)}" placeholder="Via e numero civico"></div>
                  <div class="profile-field"><label>CAP</label><input data-studio-index="${index}" data-studio-field="zip" value="${esc(studio.zip)}"></div>
                  <div class="profile-field"><label>Comune</label><input data-studio-index="${index}" data-studio-field="city" value="${esc(studio.city)}"></div>
                  <div class="profile-field"><label>Provincia</label><input data-studio-index="${index}" data-studio-field="province" value="${esc(studio.province)}"></div>
                </div>
                <button type="button" class="profile-remove profile-studio-remove" data-studio-remove="${index}" ${profile.studios.length<=1?"disabled":""}>Rimuovi studio</button>
              </article>
            `).join("")}
          </div>
        </section>

        <section class="profile-card wide">
          <div class="profile-card-head"><h2>Agenda</h2></div>
          <div class="profile-fields">
            <div class="profile-field"><label>Durata predefinita prima visita</label><input data-profile-field="firstVisit" type="number" step="15" min="15" value="${esc(profile.firstVisit)}"></div>
            <div class="profile-field"><label>Durata predefinita controllo</label><input data-profile-field="controlVisit" type="number" step="15" min="15" value="${esc(profile.controlVisit)}"></div>
            <div class="profile-field"><label>Inizio agenda</label><input data-profile-field="dayStart" type="time" value="${esc(profile.dayStart)}"></div>
            <div class="profile-field"><label>Fine agenda</label><input data-profile-field="dayEnd" type="time" value="${esc(profile.dayEnd)}"></div>
            <div class="profile-field"><label>Settimana lavorativa</label>
              <select data-profile-field="workDays">
                <option value="5" ${Number(profile.workDays)===5?"selected":""}>Da lunedì a venerdì</option>
                <option value="6" ${Number(profile.workDays)===6?"selected":""}>Da lunedì a sabato</option>
              </select>
            </div>
          </div>
        </section>

        <div class="profile-save-row">
          <button class="profile-save" type="button" data-profile-save>Salva profilo professionista</button>
        </div>
      </div>
    </div>
  `;
}

function readImage(file,onReady){
  if(!file) return;
  if(file.size>PHOTO_MAX_BYTES){
    alert("L'immagine è troppo grande. Usa un file sotto 2,5 MB.");
    return;
  }
  if(!PHOTO_TYPES.includes(file.type)){
    alert("Formato non supportato. Usa PNG, JPEG o WebP.");
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>onReady(String(reader.result||""));
  reader.readAsDataURL(file);
}

export function bindProfilePage(root,{profile=professionalProfile,onChange}={}){\n  const rerender=()=>{renderProfilePage(root,profile);bindProfilePage(root,{profile,onChange});};\n\n  root.querySelectorAll("[data-studio-field]").forEach(field=>{\n    field.addEventListener("input",()=>{\n      const index=Number(field.dataset.studioIndex);\n      const studio=profile.studios?.[index];\n      if(studio) studio[field.dataset.studioField]=field.value;\n    });\n  });\n  root.querySelector("[data-studio-add]")?.addEventListener("click",()=>{\n    if(!Array.isArray(profile.studios)) profile.studios=[];\n    profile.studios.push({id:`studio-${Date.now()}`,name:`Studio ${profile.studios.length+1}`,address:"",zip:"",city:"",province:"",primary:profile.studios.length===0});\n    rerender();\n  });\n  root.querySelectorAll("[data-studio-primary]").forEach(button=>button.addEventListener("click",()=>{\n    const selected=Number(button.dataset.studioPrimary);\n    profile.studios.forEach((studio,index)=>{studio.primary=index===selected});\n    rerender();\n  }));\n  root.querySelectorAll("[data-studio-remove]").forEach(button=>button.addEventListener("click",()=>{\n    if(profile.studios.length<=1) return;\n    const index=Number(button.dataset.studioRemove);\n    const wasPrimary=!!profile.studios[index]?.primary;\n    profile.studios.splice(index,1);\n    if(wasPrimary&&profile.studios.length) profile.studios[0].primary=true;\n    rerender();\n  }));
  root.querySelector("[data-profile-photo-file]")?.addEventListener("change",event=>{
    readImage(event.target.files?.[0],data=>{
      profile.photoData=data;
      const preview=root.querySelector("[data-profile-photo-preview]");
      if(preview) preview.innerHTML=photoMarkup(profile);
      onChange?.(profile);
    });
  });

  root.querySelector("[data-profile-photo-remove]")?.addEventListener("click",()=>{
    profile.photoData="";
    const preview=root.querySelector("[data-profile-photo-preview]");
    if(preview) preview.innerHTML=photoMarkup(profile);
    onChange?.(profile);
  });

  root.querySelector("[data-profile-logo-file]")?.addEventListener("change",event=>{
    readImage(event.target.files?.[0],data=>{
      profile.logoData=data;
      const preview=root.querySelector("[data-profile-logo-preview]");
      if(preview) preview.innerHTML=logoMarkup(profile);
    });
  });

  root.querySelector("[data-profile-logo-remove]")?.addEventListener("click",()=>{
    profile.logoData="";
    const preview=root.querySelector("[data-profile-logo-preview]");
    if(preview) preview.innerHTML=logoMarkup(profile);
  });

  root.querySelector("[data-profile-save]")?.addEventListener("click",()=>{
    root.querySelectorAll("[data-profile-field]").forEach(field=>{
      const key=field.dataset.profileField;
      profile[key]=field.type==="number"||key==="workDays" ? Number(field.value) : field.value.trim();
    });

    const start=String(profile.dayStart||"08:00").split(":").map(Number);
    const end=String(profile.dayEnd||"19:00").split(":").map(Number);
    if((end[0]*60+end[1]) <= (start[0]*60+start[1])){
      alert("L'orario di fine agenda deve essere successivo a quello di inizio.");
      return;
    }

    if(!profile.displayName) profile.displayName=[profile.firstName,profile.surname].filter(Boolean).join(" ")||"Professionista";\n    if(!Array.isArray(profile.studios)||!profile.studios.length){alert("Configura almeno uno studio prima di salvare il profilo.");return;}\n    if(!profile.studios.some(studio=>studio.primary)) profile.studios[0].primary=true;
    onChange?.(profile);
    alert("Profilo aggiornato nella demo. Il salvataggio su Supabase verrà collegato nella fase backend.");
  });
}
