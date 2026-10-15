-- Restore approved Professional 2.0 patient identity fields.
alter table public.patients
 add column if not exists fiscal_code text,
 add column if not exists address text,
 add column if not exists postal_code text,
 add column if not exists city text,
 add column if not exists province text,
 add column if not exists show_calories_to_patient boolean not null default false;
alter table public.patients
 add constraint patients_fiscal_code_length check (fiscal_code is null or char_length(fiscal_code)<=16),
 add constraint patients_postal_code_length check (postal_code is null or char_length(postal_code)<=10),
 add constraint patients_province_length check (province is null or char_length(province)<=100);
