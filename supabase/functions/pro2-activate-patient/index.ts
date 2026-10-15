import {createClient} from "npm:@supabase/supabase-js@2";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info"};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return reply({});
 if(req.method!=="POST")return reply({ok:false,error:"Metodo non consentito"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!secret)return reply({ok:false,error:"Configurazione mancante"},500);
 const auth=req.headers.get("Authorization")||"";
 const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 const {data:{user},error:userError}=await caller.auth.getUser();
 if(userError||!user)return reply({ok:false,error:"Accesso non autorizzato"},401);
 const {data:identity}=await admin.from("profiles").select("id,role,status").eq("auth_user_id",user.id).maybeSingle();
 if(identity?.role!=="professional"||identity.status!=="active")return reply({ok:false,error:"Professionista non autorizzato"},403);
 const {data:professional}=await admin.from("professionals").select("id,status").eq("profile_id",identity.id).maybeSingle();
 if(professional?.status!=="active")return reply({ok:false,error:"Professionista non attivo"},403);
 let body;try{body=await req.json()}catch{return reply({ok:false,error:"Dati non validi"},400)}
 const patientId=typeof body?.patient_id==="string"?body.patient_id.trim():"";
 const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
 if(!/^[0-9a-f-]{36}$/i.test(patientId))return reply({ok:false,error:"Paziente non valido"},400);
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({ok:false,error:"Email non valida"},400);
 const {data:relation}=await admin.from("professional_patients").select("id,status").eq("professional_id",professional.id).eq("patient_id",patientId).maybeSingle();
 if(!relation||relation.status==="ended")return reply({ok:false,error:"Paziente non associato o rapporto concluso"},403);
 const {data:patient}=await admin.from("patients").select("id,profile_id").eq("id",patientId).maybeSingle();
 if(!patient)return reply({ok:false,error:"Paziente non trovato"},404);
 const {data:profile}=await admin.from("profiles").select("id,auth_user_id,role,status,email,first_name,last_name").eq("id",patient.profile_id).maybeSingle();
 if(!profile||profile.role!=="patient"||profile.status!=="active")return reply({ok:false,error:"Profilo paziente non disponibile"},409);
 if(profile.auth_user_id)return reply({ok:false,error:"Account già attivato o invitato: verifica lo stato dell'invito."},409);
 const destination=email||String(profile.email||"").trim().toLowerCase();
 if(!destination)return reply({ok:false,error:"Email obbligatoria per l'attivazione"},400);
 const {data:duplicates,error:duplicateError}=await admin.from("profiles").select("id").ilike("email",destination).neq("id",profile.id).limit(1);
 if(duplicateError)return reply({ok:false,error:"Verifica email non riuscita"},500);
 if(duplicates?.length)return reply({ok:false,error:"Email già utilizzata da un altro account"},409);
 // Invitation email is sent only for an explicitly requested activation.
 const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(destination,{data:{first_name:profile.first_name,last_name:profile.last_name,intended_role:"patient"},redirectTo:"https://nubemo-pro-2.pages.dev/set-password-patient2.html"});
 if(inviteError||!invited?.user?.id)return reply({ok:false,error:inviteError?.message||"Invito non riuscito"},400);
 const authId=invited.user.id;
 const {data:updated,error:updateError}=await admin.from("profiles").update({auth_user_id:authId,email:destination}).eq("id",profile.id).is("auth_user_id",null).select("id").maybeSingle();
 if(updateError||!updated){
  await admin.auth.admin.deleteUser(authId);
  return reply({ok:false,error:"Impossibile collegare l'account paziente"},409);
 }
 return reply({ok:true,patient_id:patientId,invited:true});
});