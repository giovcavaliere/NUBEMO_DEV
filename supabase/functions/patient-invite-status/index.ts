import { withSupabase } from "npm:@supabase/server@^1";

const INVITE_REDIRECT_URL = "https://nubemo-pro-2.pages.dev/set-password-patient2.html";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { data: { user }, error: userError } = await ctx.supabase.auth.getUser();
    if (userError || !user) return Response.json({ ok:false, error:"Utente non autenticato" }, { status:401 });

    const { data: profile, error: profileError } = await ctx.supabase
      .from("profiles")
      .select("id,role,status")
      .eq("auth_user_id", user.id)
      .single();
    if (profileError || !profile || profile.role !== "professional" || profile.status !== "active") {
      return Response.json({ ok:false, error:"Accesso negato" }, { status:403 });
    }

    const { data: professional, error: professionalError } = await ctx.supabaseAdmin
      .from("professionals")
      .select("id,status")
      .eq("profile_id", profile.id)
      .single();
    if (professionalError || !professional || professional.status !== "active") {
      return Response.json({ ok:false, error:"Professionista non attivo" }, { status:403 });
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { return Response.json({ ok:false, error:"Payload JSON non valido" }, { status:400 }); }

    const action = typeof body.action === "string" ? body.action : "check";
    const patientId = typeof body.patient_id === "string" ? body.patient_id.trim() : "";
    if (!patientId) return Response.json({ ok:false, error:"Paziente non valido" }, { status:400 });

    const { data: patient, error: patientError } = await ctx.supabaseAdmin
      .from("patients")
      .select("id,profile_id")
      .eq("id", patientId)
      .maybeSingle();
    if (patientError) return Response.json({ ok:false, error:"Impossibile verificare il paziente" }, { status:500 });
    if (!patient) return Response.json({ ok:false, error:"Paziente non trovato" }, { status:404 });

    const { data: relationship, error: relationshipError } = await ctx.supabaseAdmin
      .from("professional_patients")
      .select("id,status")
      .eq("professional_id", professional.id)
      .eq("patient_id", patient.id)
      .maybeSingle();
    if (relationshipError) return Response.json({ ok:false, error:"Impossibile verificare l'associazione" }, { status:500 });
    if (!relationship) return Response.json({ ok:false, error:"Paziente non associato a questo professionista" }, { status:403 });

    const { data: patientProfile, error: patientProfileError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id,auth_user_id,role,status,email,first_name,last_name,activation_completed_at")
      .eq("id", patient.profile_id)
      .maybeSingle();
    if (patientProfileError || !patientProfile || patientProfile.role !== "patient") {
      return Response.json({ ok:false, error:"Profilo paziente non disponibile" }, { status:500 });
    }

    if (!patientProfile.auth_user_id) {
      if (action === "check") {
        return Response.json({
          ok:true,
          patient_id:patient.id,
          account_status:"not_enabled",
          email:patientProfile.email || null
        });
      }
      if (action === "resend") {
        return Response.json({ ok:false, code:"not_enabled", error:"Area Paziente non attiva" }, { status:409 });
      }
      return Response.json({ ok:false, error:"Azione non riconosciuta" }, { status:400 });
    }

    const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.getUserById(patientProfile.auth_user_id);
    if (authError || !authData?.user) return Response.json({ ok:false, error:"Account Auth non disponibile" }, { status:500 });

    const active = !!patientProfile.activation_completed_at;
    const accountStatus = active ? "active" : "invited";

    if (action === "check") {
      return Response.json({
        ok:true,
        patient_id:patient.id,
        account_status:accountStatus,
        email:patientProfile.email || authData.user.email || null
      });
    }

    if (action === "resend") {
      if (active) return Response.json({ ok:false, code:"already_active", error:"Account già attivo" }, { status:409 });
      const email = String(patientProfile.email || authData.user.email || "").trim().toLowerCase();
      if (!email) return Response.json({ ok:false, error:"Email paziente non disponibile" }, { status:400 });

      // Generate a one-time Auth link for the existing account, delivered using the NUBEMO activation email.
      const { data: generated, error: linkError } = await ctx.supabaseAdmin.auth.admin.generateLink({
        type:"recovery",
        email,
        options:{redirectTo:INVITE_REDIRECT_URL}
      });
      const tokenHash = generated?.properties?.hashed_token;
      const actionLink = tokenHash
        ? INVITE_REDIRECT_URL + "?type=recovery&token_hash=" + encodeURIComponent(tokenHash)
        : null;
      if (linkError || !actionLink) {
        console.error("Patient activation link generation failed", linkError);
        return Response.json({ok:false,error:"Impossibile generare il collegamento sicuro di attivazione"}, {status:400});
      }
      const mailKey = Deno.env.get("RESEND_API_KEY");
      const mailFrom = Deno.env.get("RESEND_FROM_EMAIL");
      if (!mailKey || !mailFrom) return Response.json({ok:false,error:"Servizio email NUBEMO non configurato"}, {status:503});
      const firstName=String(patientProfile.first_name||"").trim();
      const greeting=firstName ? `Ciao ${firstName},` : "Ciao,";
      const escapeHtml=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
      const html=`<div style="background:#f5efe6;padding:28px 14px;font-family:Arial,sans-serif;color:#183f36"><div style="max-width:550px;margin:auto;background:#fffdfa;border:1px solid #e9e1d6;border-radius:18px;overflow:hidden"><div style="padding:26px;background:#eaf0e7"><strong style="font-size:23px;letter-spacing:2px;color:#10483e">NUBEMO</strong><div style="font-size:12px;color:#60746c;margin-top:6px">Il tuo percorso, ogni giorno.</div></div><div style="padding:28px"><h1 style="font-size:25px;line-height:1.25;margin:0 0 22px;color:#10483e">Completa l'attivazione NUBEMO</h1><p>${escapeHtml(greeting)}</p><p>Il tuo professionista ti ha invitato ad accedere alla tua area personale NUBEMO.</p><p>Per completare l'attivazione, scegli la tua password tramite il collegamento sicuro qui sotto.</p><p style="margin:28px 0"><a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#1d5c4b;color:white;padding:14px 22px;border-radius:9px;text-decoration:none;font-weight:bold">Attiva il mio account</a></p><p style="font-size:12px;color:#6e7d76">Se non aspettavi questa email, puoi ignorarla. Non condividere il collegamento con altre persone.</p></div></div></div>`;
      const mailResponse=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"Authorization":`Bearer ${mailKey}`,"Content-Type":"application/json"},
        body:JSON.stringify({from:mailFrom,to:[email],subject:"NUBEMO — Completa l'attivazione del tuo account",html,
          text:`${greeting}\n\nIl tuo professionista ti ha invitato ad accedere a NUBEMO. Completa l'attivazione impostando la tua password:\n${actionLink}\n\nSe non aspettavi questa email, puoi ignorarla.`})
      });
      if (!mailResponse.ok){
        console.error("Patient activation mail delivery failed",mailResponse.status);
        return Response.json({ok:false,error:"Email di attivazione non inviata. Verificare configurazione e limiti del servizio email."},{status:502});
      }
      return Response.json({ ok:true, resent:true, patient_id:patient.id, email });
    }

    return Response.json({ ok:false, error:"Azione non riconosciuta" }, { status:400 });
  })
};