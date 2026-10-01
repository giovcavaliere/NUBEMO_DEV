alter table public.patient_measurements
  add column if not exists ecm_pct numeric(5,2),
  add column if not exists bcm_pct numeric(5,2);

alter table public.patient_measurements
  drop constraint if exists patient_measurements_ecm_pct_check,
  add constraint patient_measurements_ecm_pct_check check (ecm_pct is null or (ecm_pct >= 0 and ecm_pct <= 100)),
  drop constraint if exists patient_measurements_bcm_pct_check,
  add constraint patient_measurements_bcm_pct_check check (bcm_pct is null or (bcm_pct >= 0 and bcm_pct <= 100));
