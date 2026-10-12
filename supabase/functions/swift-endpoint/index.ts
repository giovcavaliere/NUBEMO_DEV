import { withSupabase } from "npm:@supabase/server@^1";
import { handleManagement, readManagement, accountPermissions } from "./management.mjs";
import { checkPatientCapacity } from "./patient-capacity.mjs";

const INVITE_REDIRECT_URL =
  "https://giovcavaliere.github.io/NUBEMO_DEV/set-password.html";
const PROFESSIONAL_INVITE_REDIRECT_URL =
  "https://nubemo-pro-2.pages.dev/set-password2.html";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { data: { user }, error: userError } =
      await ctx.supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ ok: false, error: "Utente non autenticato" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await ctx.supabase
      .from("profiles")
      .select("id, role, status, first_name, last_name")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ ok: false, error: "Profilo non disponibile" }, { status: 403 });
    }

    let body: Record<string, unknown> = {};
    try {
      if (req.headers.get("content-type")?.includes("application/json")) body = await req.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Payload non valido");
    } catch {
      return Response.json({ ok: false, error: "Payload JSON non valido" }, { status: 400 });
    }

    if (body.action === "create-patient") {
      if (profile.role !== "professional" || profile.status !== "active") {
        return Response.json({ ok: false, error: "Accesso negato" }, { status: 403 });
      }

      const { data: currentProfessional, error: currentProfessionalError } = await ctx.supabaseAdmin
        .from("professionals").select("id,status").eq("profile_id", profile.id).single();
      if (currentProfessionalError || !currentProfessional || currentProfessional.status !== "active") {
        return Response.json({ ok: false, error: "Professionista non attivo" }, { status: 403 });
      }

      const firstName = typeof body.first_name === "string" ? body.first_name.trim() : "";
      const lastName = typeof body.last_name === "string" ? body.last_name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const birthDate = typeof body.birth_date === "string" && body.birth_date.trim() ? body.birth_date.trim() : null;
      const sex = typeof body.sex === "string" && body.sex.trim() ? body.sex.trim() : null;
      const pathwayStartDate = typeof body.pathway_start_date === "string" && body.pathway_start_date.trim() ? body.pathway_start_date.trim() : null;
      const heightCm = body.height_cm === null || body.height_cm === undefined || body.height_cm === "" ? null : Number(body.height_cm);

      if (!firstName || !lastName || !email) return Response.json({ ok: false, error: "Nome, cognome ed email sono obbligatori" }, { status: 400 });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ ok: false, error: "Email non valida" }, { status: 400 });
      if (sex !== null && !["M", "F", "X"].includes(sex)) return Response.json({ ok: false, error: "Sesso non valido" }, { status: 400 });
      if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250)) return Response.json({ ok: false, error: "Altezza non valida" }, { status: 400 });

      const { data: professionalSettings, error: settingsError } = await ctx.supabaseAdmin
        .from("professional_settings").select("active_patient_limit").eq("professional_id", currentProfessional.id).maybeSingle();
      if (settingsError) {
        console.error("Patient limit settings error:", settingsError);
        return Response.json({ ok: false, error: "Impossibile verificare il limite pazienti" }, { status: 500 });
      }

      // Il conteggio deduplicato rispecchia i trigger SQL Admin 2.0.
      // Prima della migrazione mantiene il comportamento della Edge precedente.
      const capacity = await checkPatientCapacity(ctx.supabaseAdmin, currentProfessional.id, professionalSettings);
      if (!capacity.ok) return Response.json({ ok: false, error: capacity.error }, { status: capacity.status });

      let authUserId: string | null = null;
      let patientProfileId: string | null = null;
      let patientId: string | null = null;
      let relationshipId: string | null = null;

      try {
        const { data: inviteData, error: inviteError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { first_name: firstName, last_name: lastName, intended_role: "patient" },
          redirectTo: INVITE_REDIRECT_URL
        });
        if (inviteError || !inviteData.user?.id) {
          console.error("Patient invite error:", inviteError);
          return Response.json({ ok: false, error: "Impossibile creare o invitare il paziente" }, { status: 400 });
        }
        authUserId = inviteData.user.id;

        const { data: createdProfile, error: profileCreateError } = await ctx.supabaseAdmin.from("profiles")
          .insert({ auth_user_id: authUserId, role: "patient", first_name: firstName, last_name: lastName, email, status: "active" })
          .select("id").single();
        if (profileCreateError || !createdProfile?.id) throw profileCreateError || new Error("Profilo paziente non creato");
        patientProfileId = createdProfile.id;

        const { data: createdPatient, error: patientCreateError } = await ctx.supabaseAdmin.from("patients")
          .insert({ profile_id: patientProfileId, birth_date: birthDate, sex, height_cm: heightCm, pathway_start_date: pathwayStartDate, status: "active" })
          .select("id").single();
        if (patientCreateError || !createdPatient?.id) throw patientCreateError || new Error("Paziente non creato");
        patientId = createdPatient.id;

        const { data: createdRelationship, error: relationshipError } = await ctx.supabaseAdmin.from("professional_patients")
          .insert({ professional_id: currentProfessional.id, patient_id: patientId, status: "active", started_at: new Date().toISOString() })
          .select("id").single();
        if (relationshipError || !createdRelationship?.id) throw relationshipError || new Error("Associazione non creata");
        relationshipId = createdRelationship.id;

        return Response.json({ ok:true, invited:true, message:"Paziente NUBEMO creato e invitato", auth_user_id:authUserId, profile_id:patientProfileId, patient_id:patientId, relationship_id:relationshipId, email });
      } catch (creationError) {
        console.error("Patient creation error:", creationError);
        if (relationshipId) await ctx.supabaseAdmin.from("professional_patients").delete().eq("id", relationshipId);
        if (patientId) await ctx.supabaseAdmin.from("patients").delete().eq("id", patientId);
        if (patientProfileId) await ctx.supabaseAdmin.from("profiles").delete().eq("id", patientProfileId);
        if (authUserId) await ctx.supabaseAdmin.auth.admin.deleteUser(authUserId);
        return Response.json({ ok:false, error:"Errore durante la creazione del paziente" }, { status:500 });
      }
    }

    if (profile.role !== "admin" || profile.status !== "active") return Response.json({ ok:false, error:"Accesso negato" }, { status:403 });

    if (!body.action) return Response.json({ ok:true, message:"Admin NUBEMO verificato", role:profile.role, status:profile.status });

    const managed = await handleManagement(body, ctx, user, profile, PROFESSIONAL_INVITE_REDIRECT_URL);
    if (managed) return managed;

    // Contratto dry-run precedente: valida senza inviare email.
    if (body.action === "prepare-professional-invite") {
      const firstName = typeof body.first_name === "string" ? body.first_name.trim() : "";
      const lastName = typeof body.last_name === "string" ? body.last_name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return Response.json({ ok:false, error:"Dati invito non validi" }, {status:400});
      return Response.json({ok:true,dry_run:true,message:"Invito professionista valido e pronto",professional:{first_name:firstName,last_name:lastName,email},redirect_to:INVITE_REDIRECT_URL});
    }

    if (body.action === "list-professionals") {
      const { data: professionals, error: professionalsError } = await ctx.supabaseAdmin
        .from("professionals")
        .select(`id,profile_id,status,profiles!inner (auth_user_id,first_name,last_name,email,role,status)`)
        .order("created_at", { ascending:true });
      if (professionalsError) {
        console.error("Professional list error:", professionalsError);
        return Response.json({ ok:false, error:"Impossibile leggere i professionisti" }, { status:500 });
      }
      let management = null;
      if (body.management_version === 1) {
        try { management = await readManagement(ctx, user.id); }
        catch (error) { return Response.json({ok:false,error:"Verifica gestione non disponibile"},{status: (error as any).status || 503}); }
      }
      const result = [];
      for (const professional of professionals || []) {
        const linkedProfile = Array.isArray(professional.profiles) ? professional.profiles[0] : professional.profiles;
        if (!linkedProfile || linkedProfile.role !== "professional") continue;
        const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.getUserById(linkedProfile.auth_user_id);
        if (authError) console.error("Professional Auth status error:", authError);
        result.push({
          professional_id:professional.id,
          profile_id:professional.profile_id,
          first_name:linkedProfile.first_name,
          last_name:linkedProfile.last_name,
          email:linkedProfile.email,
          account_status:authData?.user?.email_confirmed_at ? "active" : "invited",
          nubemo_status:linkedProfile.status,
          professional_status:professional.status,
          ...(management ? {
            ...accountPermissions({nubemo_status:linkedProfile.status,professional_status:professional.status,email:linkedProfile.email},authError ? null : authData?.user),
            ...(management.capacity.find((row: any) => row.professional_id === professional.id) || {})
          } : {})
        });
      }
      return Response.json({ ok:true, professionals:result, ...(management ? {management:{version:management.version,enabled:management.enabled,default_patient_limit:management.default_patient_limit}} : {}) });
    }

    return Response.json({ ok:false, error:"Azione non riconosciuta" }, { status:400 });
  }),
};