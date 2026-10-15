create table if not exists public.patient_meal_favorites (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 meal_type text not null check (meal_type in ('breakfast','snack1','lunch','snack2','dinner')),
 meal_text text not null check (length(trim(meal_text)) between 1 and 3000),
 created_at timestamptz not null default now(),
 unique(patient_id,meal_type,meal_text)
);
alter table public.patient_meal_favorites enable row level security;
create policy patient_meal_favorites_select_self on public.patient_meal_favorites for select to authenticated using(patient_id=public.current_patient_id());
create policy patient_meal_favorites_insert_self on public.patient_meal_favorites for insert to authenticated with check(patient_id=public.current_patient_id() and public.current_active_pathway_id() is not null);
create policy patient_meal_favorites_delete_self on public.patient_meal_favorites for delete to authenticated using(patient_id=public.current_patient_id() and public.current_active_pathway_id() is not null);
grant select,insert,delete on public.patient_meal_favorites to authenticated;