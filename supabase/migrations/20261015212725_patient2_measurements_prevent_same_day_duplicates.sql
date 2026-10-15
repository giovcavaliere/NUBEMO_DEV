CREATE OR REPLACE FUNCTION public.patient2_add_own_measurement(p_day date, p_weight numeric, p_waist numeric, p_hips numeric, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_patient uuid;v_pathway uuid;v_id uuid;v_professional_exists boolean;
begin
 v_patient:=public.current_patient_id();
 v_pathway:=public.current_active_pathway_id();
 if auth.uid() is null or v_patient is null or v_pathway is null then raise exception 'Percorso attivo richiesto'; end if;
 if p_day is null or p_day>current_date or p_day<current_date-interval '10 years' then raise exception 'Data non valida';end if;
 if p_weight is null and p_waist is null and p_hips is null then raise exception 'Inserisci almeno una misura';end if;
 if (p_weight is not null and (p_weight<20 or p_weight>400)) or (p_waist is not null and (p_waist<30 or p_waist>250)) or (p_hips is not null and (p_hips<30 or p_hips>250)) then raise exception 'Valore fuori intervallo';end if;
 if length(coalesce(p_notes,''))>2000 then raise exception 'Note troppo lunghe'; end if;
 -- Serialize same-patient writes to prevent concurrent duplicate submissions.
 perform 1 from public.patients where id=v_patient for update;
 select id into v_id from public.patient_measurements
 where patient_id=v_patient and pathway_id=v_pathway and measured_at=p_day
   and created_by_user_id=auth.uid() and deleted_at is null
 order by created_at desc,id desc limit 1 for update;
 if v_id is not null then
   update public.patient_measurements
   set weight_kg=p_weight,waist_cm=p_waist,hips_cm=p_hips,
       notes=nullif(trim(coalesce(p_notes,''),''),''),updated_at=now()
   where id=v_id;
   return v_id;
 end if;
 select exists(select 1 from public.patient_measurements
  where patient_id=v_patient and pathway_id=v_pathway and measured_at=p_day
    and deleted_at is null and created_by_user_id<>auth.uid())
 into v_professional_exists;
 if v_professional_exists then
   raise exception 'Per questa data esiste già una misurazione del professionista. Non viene creata una seconda misurazione.';
 end if;
 insert into public.patient_measurements(patient_id,pathway_id,created_by_user_id,measured_at,weight_kg,waist_cm,hips_cm,notes)
 values(v_patient,v_pathway,auth.uid(),p_day,p_weight,p_waist,p_hips,nullif(trim(coalesce(p_notes,'')),'')) returning id into v_id;
 return v_id;
end $function$
;
revoke all on function public.patient2_add_own_measurement(date,numeric,numeric,numeric,text) from public;
grant execute on function public.patient2_add_own_measurement(date,numeric,numeric,numeric,text) to authenticated;
