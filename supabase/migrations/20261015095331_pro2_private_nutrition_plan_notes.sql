create table if not exists public.nutrition_plan_private_notes (
 plan_id uuid primary key references public.nutrition_plans(id) on delete restrict,
 note text not null default '',
 updated_at timestamptz not null default now()
);
alter table public.nutrition_plan_private_notes enable row level security;
create policy nutrition_plan_private_notes_select_professional on public.nutrition_plan_private_notes
 for select to authenticated using (
 exists(select 1 from public.nutrition_plans p where p.id=plan_id and p.deleted_at is null
   and p.professional_id=public.current_active_professional_id()
   and public.pathway_belongs_to_current_professional(p.pathway_id)));
create policy nutrition_plan_private_notes_insert_professional on public.nutrition_plan_private_notes
 for insert to authenticated with check (
 exists(select 1 from public.nutrition_plans p where p.id=plan_id and p.deleted_at is null
  and p.professional_id=public.current_active_professional_id() and public.pathway_is_active(p.pathway_id)
  and public.pathway_belongs_to_current_professional(p.pathway_id)));
create policy nutrition_plan_private_notes_update_professional on public.nutrition_plan_private_notes
 for update to authenticated using (
 exists(select 1 from public.nutrition_plans p where p.id=plan_id and p.deleted_at is null
  and p.professional_id=public.current_active_professional_id() and public.pathway_is_active(p.pathway_id)))
 with check (
 exists(select 1 from public.nutrition_plans p where p.id=plan_id and p.deleted_at is null
  and p.professional_id=public.current_active_professional_id() and public.pathway_is_active(p.pathway_id)));
grant select,insert,update on public.nutrition_plan_private_notes to authenticated;
