-- NUBEMO DEV — correzione eliminazione contatto draft con appuntamenti collegati
-- La riga appointment_patients deve essere rimossa insieme al draft,
-- mentre l'appuntamento principale resta in Agenda senza paziente associato.

alter table public.appointment_patients
  drop constraint if exists appointment_patients_draft_patient_id_fkey;

alter table public.appointment_patients
  add constraint appointment_patients_draft_patient_id_fkey
  foreign key (draft_patient_id)
  references public.professional_patient_drafts(id)
  on delete cascade;
