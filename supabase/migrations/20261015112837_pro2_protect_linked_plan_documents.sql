create or replace function public.prevent_linked_plan_document_soft_delete()
returns trigger language plpgsql set search_path = public as $$
begin
 if old.deleted_at is null and new.deleted_at is not null and exists (
  select 1 from public.nutrition_plan_documents link
  join public.nutrition_plans plan on plan.id=link.nutrition_plan_id
  where link.document_id=old.id and plan.deleted_at is null
 ) then
  raise exception 'Documento collegato a un piano alimentare: gestire il piano dalla tab Piano.';
 end if;
 return new;
end;
$$;
create trigger protect_linked_plan_document
before update of deleted_at on public.documents
for each row execute function public.prevent_linked_plan_document_soft_delete();
