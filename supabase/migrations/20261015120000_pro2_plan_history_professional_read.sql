-- Keep professional archive visible after pathway closure; writes remain restricted.
alter policy nutrition_plans_select_associated_professional on public.nutrition_plans
 using (deleted_at is null and professional_id=public.current_active_professional_id()
        and pathway_id is not null and public.pathway_belongs_to_current_professional(pathway_id));
alter policy documents_select_associated_professional on public.documents
 using (deleted_at is null and pathway_id is not null
        and public.pathway_belongs_to_current_professional(pathway_id));
