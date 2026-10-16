// Patient 2.0 entrypoint: private session check. Demo patient2.html stays untouched.
(async()=>{
 const client=window.nubemoSupabase,title=document.getElementById("patient-live-title"),message=document.getElementById("patient-live-message"),logout=document.getElementById("patient-live-logout");
 try{
  if(!client)throw Error("Connessione NUBEMO non disponibile.");
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user){location.replace("index2.html");return;}
  const {data:profile,error:profileError}=await client.from("profiles").select("id,first_name,role,status,activation_completed_at").eq("auth_user_id",user.id).single();
  if(profileError||!profile||profile.role!=="patient"||profile.status!=="active")throw Error("Questo account non è autorizzato per l'area Paziente.");
  if(!profile.activation_completed_at){await client.auth.signOut({scope:"local"});location.replace("index2.html");return;}
  const {data:patient,error:patientError}=await client.from("patients").select("id").eq("profile_id",profile.id).single();
  if(patientError||!patient)throw Error("Anagrafica paziente non disponibile.");
  // The patient entry must never bypass the shared privacy acceptance gate.
  const {data:document,error:documentError}=await client.from("privacy_documents")
    .select("id").eq("document_type","nubemo").eq("active",true)
    .order("published_at",{ascending:false,nullsFirst:false})
    .order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(documentError)throw new Error("Impossibile verificare l'informativa privacy.");
  if(document){
   const {data:choice,error:choiceError}=await client.from("privacy_acceptances")
     .select("status").eq("profile_id",profile.id)
     .eq("privacy_document_id",document.id).maybeSingle();
   if(choiceError)throw new Error("Impossibile verificare il consenso privacy.");
   if(choice?.status!=="accepted"){location.replace("privacy2.html");return;}
  }
  title.textContent="Benvenuto"+(profile.first_name?", "+profile.first_name:"");
  message.textContent="Accesso verificato. Le sezioni Patient 2.0 saranno collegate ai dati reali durante la migrazione. Nessun dato dimostrativo è visualizzato.";
  logout.hidden=false;
  logout.onclick=async()=>{await client.auth.signOut({scope:"local"});location.replace("index2.html");};
 }catch(error){title.textContent="Accesso non disponibile";message.textContent=error.message||"Verifica non riuscita.";logout.hidden=false;logout.textContent="Torna al login";logout.onclick=async()=>{await client?.auth.signOut({scope:"local"});location.replace("index2.html");};}
})();