alter table public.patient_measurements
  add column if not exists ffm_pct numeric(5,2),
  add column if not exists fm_pct numeric(5,2),
  add column if not exists mm_pct numeric(5,2);

alter table public.patient_measurements
  drop constraint if exists patient_measurements_ffm_pct_check,
  add constraint patient_measurements_ffm_pct_check check (ffm_pct is null or (ffm_pct >= 0 and ffm_pct <= 100)),
  drop constraint if exists patient_measurements_fm_pct_check,
  add constraint patient_measurements_fm_pct_check check (fm_pct is null or (fm_pct >= 0 and fm_pct <= 100)),
  drop constraint if exists patient_measurements_mm_pct_check,
  add constraint patient_measurements_mm_pct_check check (mm_pct is null or (mm_pct >= 0 and mm_pct <= 100));
