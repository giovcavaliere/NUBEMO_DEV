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

      // Account già esistente: recupero password, non un secondo invito Auth.
      const { error: recoveryError } = await ctx.supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: INVITE_REDIRECT_URL
      });
      if (recoveryError) {
        console.error("Patient activation recovery error:", recoveryError);
        return Response.json({ ok:false, error:"Invio del link di attivazione non riuscito. Verificare i limiti email Supabase." }, { status:400 });
      }
      return Response.json({ ok:true, resent:true, patient_id:patient.id, email });
    }

    return Response.json({ ok:false, error:"Azione non riconosciuta" }, { status:400 });
  })
};