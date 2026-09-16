-- NUBEMO DEV — eliminazione contatti draft del professionista
-- Permette al professionista autenticato di eliminare solo i propri draft
-- e mantiene gli appuntamenti collegati scollegando il draft eliminato.

create policy professional_patient_drafts_delete_own_professional
on public.professional_patient_drafts
for delete
to authenticated
using (
  professional_id = current_active_professional_id()
  and status = 'draft'
);

alter table public.appointment_patients
  drop constraint appointment_patients_draft_patient_id_fkey;

alter table public.appointment_patients
  add constraint appointment_patients_draft_patient_id_fkey
  foreign key (draft_patient_id)
  references public.professional_patient_drafts(id)
  on delete set null;
