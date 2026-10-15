create or replace function public.patient2_add_own_measurement(p_day date,p_weight numeric,p_waist numeric,p_hips numeric,p_notes text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_patient uuid;v_pathway uuid;v_id uuid;
begin
 v_patient:=public.current_patient_id();
 v_pathway:=public.current_active_pathway_id();
 if auth.uid() is null or v_patient is null or v_pathway is null then raise exception 'Percorso attivo richiesto'; end if;
 if p_day is null or p_day>current_date or p_day<current_date-interval '10 years' then raise exception 'Data non valida';end if;
 if p_weight is null and p_waist is null and p_hips is null then raise exception 'Inserisci almeno una misura';end if;
 if (p_weight is not null and (p_weight<20 or p_weight>400)) or (p_waist is not null and (p_waist<30 or p_waist>250)) or (p_hips is not null and (p_hips<30 or p_hips>250)) then raise exception 'Valore fuori intervallo';end if;
 if length(coalesce(p_notes,''))>2000 then raise exception 'Note troppo lunghe'; end if;
 insert into public.patient_measurements(patient_id,pathway_id,created_by_user_id,measured_at,weight_kg,waist_cm,hips_cm,notes)
 values(v_patient,v_pathway,auth.uid(),p_day,p_weight,p_waist,p_hips,nullif(trim(coalesce(p_notes,'')),''))
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.patient2_add_own_measurement(date,numeric,numeric,numeric,text) from public;
grant execute on function public.patient2_add_own_measurement(date,numeric,numeric,numeric,text) to authenticated;