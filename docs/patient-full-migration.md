# NUBEMO — Migrazione completa Area Paziente

Branch: `cleanup/architecture-4c2b`

## Stato

- Login centrale: ruolo `patient` instradato a `patient.html`.
- `patient.html`: runtime Supabase-first; non carica più il vecchio `app.js`.
- `patient-guard.js`: sessione/Auth/bootstrap del paziente.
- `patient-services.js`: query e azioni Supabase del paziente.
- `patient-app.js`: Home, Diario, Andamento, Misure, Documenti, Profilo, Privacy.
- `patient-measurements.js`: modifica delle automisurazioni paziente.
- Backup JSON / Ripristino / migrazione automatica localStorage: rimossi dal perimetro prodotto.
- `diary-pdf.js`: riutilizzato per esportazione Diario.
- Service worker aggiornato ai nuovi asset Paziente.

## Persistenza

- Diario: `diary_entries`.
- Automisurazioni paziente: `patient_self_measurements`.
- Misure professionista: `patient_measurements` in sola lettura lato paziente.
- Profilo: `profiles` + `patients` + `patient_clinical_profiles`.
- Documenti: `documents` + bucket privato `patient-documents`.
- Esami caricati dal paziente: documento + `laboratory_reports` con stato `pending_review`.
- Piani: `nutrition_plans` + `nutrition_plan_documents` + `documents`.
- Visite: `appointment_patients` + `appointments`.
- Privacy: `privacy_documents` + `privacy_acceptances`.
- Impostazioni: `patient_settings`.

## Semantica Misure

- Peso inserito dal paziente: `diary_entries.weight_kg`.
- Vita/fianchi inseriti dal paziente: `patient_self_measurements`.
- Peso/vita/fianchi rilevati dal professionista: `patient_measurements`.

Le fonti restano separate e riconoscibili.

## Sicurezza

Migration: `nubemo_patient_area_supabase_access`.

- helper `current_patient_id()`;
- helper `current_patient_has_active_pathway()`;
- helper `is_current_patient_appointment(uuid)`;
- RLS own-patient sulle tabelle del perimetro;
- scritture Diario/automisurazioni/documenti sanitari solo con percorso attivo;
- documenti caricabili dal paziente limitati a `health` con sottocategoria `blood_test` o `health_other`;
- nessun accesso cross-patient;
- con percorso terminato resta la consultazione, ma vengono bloccate le scritture del percorso.

## Test tecnici eseguiti

- helper `current_patient_id()` risolve il paziente autenticato corretto;
- `current_patient_has_active_pathway()` restituisce true sul paziente attivo DEV;
- il paziente vede una sola propria riga `patients` e la propria relazione;
- INSERT Diario proprio consentito in transazione di test;
- INSERT automisurazione propria consentito in transazione di test;
- SELECT di un altro paziente restituisce zero righe;
- INSERT Diario verso un altro paziente viene negato da RLS;
- i dati di test sono stati eseguiti in transazione e rollback: nessuna riga tecnica lasciata nel DB.

## Test utente consigliati

1. login con account paziente e redirect automatico;
2. Home con dati propri;
3. aggiunta giornata Diario;
4. modifica giornata;
5. duplicazione giornata;
6. eliminazione giornata;
7. reload e persistenza;
8. Andamento + PDF Diario;
9. automisurazione vita/fianchi;
10. modifica automisurazione;
11. visualizzazione separata delle misure del professionista;
12. upload analisi del sangue e verifica lato PRO in Esami;
13. upload altro documento sanitario;
14. apertura documenti/piano pubblicati dal professionista;
15. Profilo read-only con dati professionista;
16. prossima visita creata dal PRO visibile al paziente;
17. Privacy: lettura stato e accettazione;
18. termina percorso lato PRO -> Area Paziente sola consultazione;
19. riattiva percorso lato PRO -> scritture nuovamente disponibili;
20. logout/login e test rapido dei tab principali.

## Nota di accettazione

Area Paziente = IMPLEMENTED / PENDING USER TEST.
La parità grafica e le rifiniture UI non fanno parte di questo blocco e verranno trattate nel passaggio dedicato dopo i test funzionali.
