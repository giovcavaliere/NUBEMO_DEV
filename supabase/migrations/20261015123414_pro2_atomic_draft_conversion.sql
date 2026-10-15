CREATE OR REPLACE FUNCTION public.pro2_convert_draft_patient(p_draft_id uuid, p_email text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_sex text DEFAULT NULL::text, p_height_cm numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare d public.professional_patient_drafts%rowtype; pro uuid; pid uuid; profid uuid; cap integer; used_count integer; cleaned_email text;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
 pro:=public.current_active_professional_id();
 if pro is null then raise exception 'Professionista non autorizzato'; end if;
 select * into d from public.professional_patient_drafts where id=p_draft_id and professional_id=pro for update;
 if not found then raise exception 'Draft non disponibile'; end if;
 if d.status <> 'draft' or d.converted_patient_id is not null then raise exception 'Draft già convertito'; end if;
 if nullif(btrim(d.first_name),'') is null or nullif(btrim(d.last_name),'') is null then raise exception 'Nome e cognome obbligatori'; end if;
 cleaned_email:=nullif(lower(btrim(p_email)),'');
 if cleaned_email is not null and (length(cleaned_email)>254 or cleaned_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Email non valida'; end if;
 if p_sex is not null and p_sex not in ('M','F','X') then raise exception 'Sesso non valido'; end if;
 if p_height_cm is not null and (p_height_cm<80 or p_height_cm>250) then raise exception 'Altezza non valida'; end if;
 if cleaned_email is not null and exists(select 1 from public.profiles where lower(email)=cleaned_email) then raise exception 'Email già registrata: verificare anagrafica esistente'; end if;
 select active_patient_limit into cap from public.professional_settings where professional_id=pro;
 if cap is not null then
   select count(*) into used_count from public.professional_patients where professional_id=pro and status <> 'ended';
   if used_count>=cap then raise exception 'Limite pazienti raggiunto'; end if;
 end if;
 insert into public.profiles(role,first_name,last_name,phone,email,status)
 values ('patient',btrim(d.first_name),btrim(d.last_name),nullif(btrim(d.phone),''),cleaned_email,'active') returning id into profid;
 insert into public.patients(profile_id,birth_date,sex,height_cm,status) values (profid,p_birth_date,p_sex,p_height_cm,'active') returning id into pid;
 insert into public.professional_patients(professional_id,patient_id,status) values(pro,pid,'active');
 update public.appointment_patients set patient_id=pid,draft_patient_id=null where draft_patient_id=d.id;
 update public.professional_patient_drafts set status='converted',converted_patient_id=pid,converted_at=now(),updated_at=now() where id=d.id;
 return pid;
end $function$
;
revoke all on function public.pro2_convert_draft_patient(uuid,text,date,text,numeric) from public,anon;
grant execute on function public.pro2_convert_draft_patient(uuid,text,date,text,numeric) to authenticated;
