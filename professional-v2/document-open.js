// Apertura documenti per l'area professionista: la scheda nasce nel gesto utente.
export async function openStoredDocument(document){
  // Nessuna richiesta asincrona prima di questa istruzione: Safari iOS può
  // bloccare window.open se invocata dopo createSignedUrl().
  const preview=window.open("about:blank","_blank");
  if(preview){
    preview.opener=null;
    preview.document.title="NUBEMO · Documento";
    preview.document.body.textContent="Caricamento documento…";
  }
  try{
    const {data,error}=await window.nubemoSupabase.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path,120);
    if(error)throw error;
    if(!data?.signedUrl)throw Error("Collegamento al documento non disponibile.");

    if(preview && !preview.closed){
      preview.location.replace(data.signedUrl);
    }else{
      // Solo quando Safari ha impedito la scheda: secondo tocco diretto.
      const dialog=documentWindowFallback(data.signedUrl);
      document.body.append(dialog);
      dialog.showModal();
    }
  }catch(error){
    if(preview && !preview.closed)preview.close();
    throw error;
  }
}

function documentWindowFallback(url){
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog";
  const heading=document.createElement("h2");
  heading.textContent="Apertura documento";
  const message=document.createElement("p");
  message.textContent="Il browser non ha aperto automaticamente il documento.";
  const link=document.createElement("a");
  link.textContent="Apri documento";
  link.href=url;
  link.target="_blank";
  link.rel="noopener noreferrer";
  const note=document.createElement("p");
  note.textContent="Il collegamento scade dopo 2 minuti. Se scade, torna qui e premi Apri.";
  const close=document.createElement("button");
  close.type="button";
  close.textContent="Chiudi";
  close.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>dialog.remove(),{once:true});
  const container=document.createElement("div");
  container.className="plan-form";
  container.append(heading,message,link,note,close);
  dialog.append(container);
  return dialog;
}
