alter policy appointment_patients_select_associated_professional on public.appointment_patients\n using (((EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = appointment_patients.appointment_id) AND (a.deleted_at IS NULL) AND (a.professional_id = current_active_professional_id())))) AND (((patient_id IS NOT NULL) AND (((pathway_id IS NOT NULL) AND pathway_belongs_to_current_professional(pathway_id) AND pathway_matches_patient(pathway_id, patient_id)) OR ((pathway_id IS NULL) AND (EXISTS ( SELECT 1
   FROM professional_patients pp
  WHERE ((pp.patient_id = appointment_patients.patient_id) AND (pp.professional_id = current_active_professional_id()) AND (pp.status <> 'ended'::relationship_status))))))) OR ((patient_id IS NULL) AND (draft_patient_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM professional_patient_drafts d
  WHERE ((d.id = appointment_patients.draft_patient_id) AND (d.professional_id = current_active_professional_id()))))))));\n