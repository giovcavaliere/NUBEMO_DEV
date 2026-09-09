// NUBEMO — Area Professionista shared Supabase services
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  if (!client) return;

  const ANAMNESIS_COLUMNS = [
    'patient_id',
    'theoretical_weight_kg',
    'work',
    'activity',
    'smoking',
    'alcohol',
    'diagnosis',
    'bowel',
    'metabolism',
    'feeg',
    'impedance',
    'family_obesity',
    'family_diabetes',
    'family_hypertension',
    'family_cardiovascular',
    'family_dyslipidemia',
    'family_thyroid',
    'previous_diets',
    'allergies',
    'medications',
    'gi_issues',
    'past_conditions',
    'observations',
    'objectives'
  ].join(',');

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

  async function loadPatientClinicalProfile(patientId) {
    const { data, error } = await client
      .from('patient_clinical_profiles')
      .select(ANAMNESIS_COLUMNS)
      .eq('patient_id', patientId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function anamnesisPayload(values) {
    return {
      theoretical_weight_kg: values.theoreticalWeight,
      work: values.work,
      activity: values.activity,
      smoking: values.smoking,
      alcohol: values.alcohol,
      diagnosis: values.diagnosis,
      bowel: values.bowel,
      metabolism: values.metabolism,
      feeg: values.feeg,
      impedance: values.impedance,
      family_obesity: values.familyObesity,
      family_diabetes: values.familyDiabetes,
      family_hypertension: values.familyHypertension,
      family_cardiovascular: values.familyCardiovascular,
      family_dyslipidemia: values.familyDyslipidemia,
      family_thyroid: values.familyThyroid,
      previous_diets: values.previousDiets,
      allergies: values.allergies,
      medications: values.medications,
      gi_issues: values.giIssues,
      past_conditions: values.pastConditions,
      observations: values.observations,
      objectives: values.objectives
    };
  }

  async function savePatientAnamnesis(patientId, values) {
    const existing = await loadPatientClinicalProfile(patientId);
    const payload = anamnesisPayload(values);

    if (existing) {
      const { data, error } = await client
        .from('patient_clinical_profiles')
        .update(payload)
        .eq('patient_id', patientId)
        .select(ANAMNESIS_COLUMNS)
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await client
      .from('patient_clinical_profiles')
      .insert({ patient_id: patientId, ...payload })
      .select(ANAMNESIS_COLUMNS)
      .single();
    if (error) throw error;
    return data;
  }

  window.nubemoProfessionalServices = Object.freeze({
    loadPatients,
    updatePatientDemographics,
    setPatientPathwayStatus,
    loadPatientClinicalProfile,
    savePatientAnamnesis
  });
})();
