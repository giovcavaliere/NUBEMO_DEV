alter table public.diary_entries
  add column if not exists breakfast_kcal integer,
  add column if not exists morning_snack_kcal integer,
  add column if not exists lunch_kcal integer,
  add column if not exists afternoon_snack_kcal integer,
  add column if not exists dinner_kcal integer,
  add column if not exists total_kcal integer,
  add column if not exists calorie_quality text,
  add column if not exists calorie_calculated_at timestamptz;

alter table public.diary_entries
  drop constraint if exists diary_entries_calorie_quality_check,
  add constraint diary_entries_calorie_quality_check
    check (calorie_quality is null or calorie_quality in ('none','good','partial'));

alter table public.diary_entries
  drop constraint if exists diary_entries_breakfast_kcal_check,
  add constraint diary_entries_breakfast_kcal_check check (breakfast_kcal is null or breakfast_kcal >= 0),
  drop constraint if exists diary_entries_morning_snack_kcal_check,
  add constraint diary_entries_morning_snack_kcal_check check (morning_snack_kcal is null or morning_snack_kcal >= 0),
  drop constraint if exists diary_entries_lunch_kcal_check,
  add constraint diary_entries_lunch_kcal_check check (lunch_kcal is null or lunch_kcal >= 0),
  drop constraint if exists diary_entries_afternoon_snack_kcal_check,
  add constraint diary_entries_afternoon_snack_kcal_check check (afternoon_snack_kcal is null or afternoon_snack_kcal >= 0),
  drop constraint if exists diary_entries_dinner_kcal_check,
  add constraint diary_entries_dinner_kcal_check check (dinner_kcal is null or dinner_kcal >= 0),
  drop constraint if exists diary_entries_total_kcal_check,
  add constraint diary_entries_total_kcal_check check (total_kcal is null or total_kcal >= 0);
