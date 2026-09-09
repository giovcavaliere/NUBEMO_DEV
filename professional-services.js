// NUBEMO — Area Professionista shared Supabase services
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  if (!client) return;

  async function loadPatients(professionalId) {
    const { data: relationships, error: relationshipsError } = await client
      .from('professional_patients')
      .select('patient_id,status,started_at,ended_at')
      .eq('professional_id', professionalId);
    if (relationshipsError) throw relationshipsError;

    const patientIds = (relationships || []).map(row => row.patient_id);
    if (!patientIds.length) return { activePatients: [], endedPatients: [] };

    const { data: patientRows, error: patientsError } = await client
      .from('patients')
      .select('id,profile_id,birth_date,sex,height_cm,pathway_start_date,status')
      .in('id', patientIds);
    if (patientsError) throw patientsError;

    const profileIds = (patientRows || []).map(row => row.profile_id);
    const { data: patientProfiles, error: patientProfilesError } = await client
      .from('profiles')
      .select('id,first_name,last_name,email,status')
      .in('id', profileIds);
    if (patientProfilesError) throw patientProfilesError;

    const profilesById = new Map((patientProfiles || []).map(row => [row.id, row]));
    const relationshipsByPatient = new Map((relationships || []).map(row => [row.patient_id, row]));
    const combined = (patientRows || []).map(row => ({
      ...row,
      profile: profilesById.get(row.profile_id) || null,
      relationship: relationshipsByPatient.get(row.id) || null
    }));

    return {
      activePatients: combined.filter(row => row.relationship?.status !== 'ended'),
      endedPatients: combined.filter(row => row.relationship?.status === 'ended')
    };
  }

  async function updatePatientDemographics(row, values) {
    const { error: profileError } = await client
      .from('profiles')
      .update({ first_name: values.firstName, last_name: values.lastName })
      .eq('id', row.profile_id);
    if (profileError) throw profileError;

    const { error: patientError } = await client
      .from('patients')
      .update({
        birth_date: values.birthDate,
        sex: values.sex,
        height_cm: values.height,
        pathway_start_date: values.pathwayStart
      })
      .eq('id', row.id);
    if (patientError) throw patientError;
  }

  async function setPatientPathwayStatus(professionalId, patientId, status) {
    const payload = status === 'ended'
      ? { status: 'ended', ended_at: new Date().toISOString() }
      : { status: 'active', ended_at: null };

    const { error } = await client
      .from('professional_patients')
      .update(payload)
      .eq('professional_id', professionalId)
      .eq('patient_id', patientId);
    if (error) throw error;
  }

  window.nubemoProfessionalServices = Object.freeze({
    loadPatients,
    updatePatientDemographics,
    setPatientPathwayStatus
  });
})();
