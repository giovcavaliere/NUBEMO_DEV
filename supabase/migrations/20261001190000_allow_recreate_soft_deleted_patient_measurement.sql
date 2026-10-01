alter table public.patient_measurements
  drop constraint if exists measurements_pathway_date_uq;

create unique index if not exists patient_measurements_active_pathway_date_uq
  on public.patient_measurements(pathway_id, measured_at)
  where deleted_at is null;
