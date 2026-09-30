create table if not exists public.favorite_meals (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid not null references public.patient_pathways(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast','snack1','lunch','snack2','dinner')),
  meal_text text not null check (length(trim(meal_text)) > 0),
  normalized_text text not null check (length(trim(normalized_text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pathway_id, meal_type, normalized_text)
);

create index if not exists favorite_meals_pathway_type_idx
  on public.favorite_meals(pathway_id, meal_type, created_at desc);

alter table public.favorite_meals enable row level security;

drop policy if exists favorite_meals_select_own_patient on public.favorite_meals;
create policy favorite_meals_select_own_patient on public.favorite_meals
for select using (patient_id = public.current_patient_id());

drop policy if exists favorite_meals_insert_own_patient on public.favorite_meals;
create policy favorite_meals_insert_own_patient on public.favorite_meals
for insert with check (patient_id = public.current_patient_id());

drop policy if exists favorite_meals_update_own_patient on public.favorite_meals;
create policy favorite_meals_update_own_patient on public.favorite_meals
for update using (patient_id = public.current_patient_id())
with check (patient_id = public.current_patient_id());

drop policy if exists favorite_meals_delete_own_patient on public.favorite_meals;
create policy favorite_meals_delete_own_patient on public.favorite_meals
for delete using (patient_id = public.current_patient_id());

drop trigger if exists favorite_meals_set_updated_at on public.favorite_meals;
create trigger favorite_meals_set_updated_at
before update on public.favorite_meals
for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.favorite_meals to authenticated;
