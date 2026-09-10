# NUBEMO — Migrazione completa Area Professionista / Scheda paziente

Branch: `cleanup/architecture-4c2b`

## Stato

Implementazione massiva completata sul branch di lavoro e pronta per test di accettazione utente.
`main` non è stato modificato.

- Anamnesi: Supabase, **VERIFIED** prima del blocco massivo.
- Misure: Supabase, **VERIFIED** prima del blocco massivo.
- Riepilogo: composto da fonti Supabase reali.
- Esami: `laboratory_reports` + `laboratory_values` + documenti.
- Piano: `nutrition_plans` + `nutrition_plan_documents` + documenti.
- Documenti: `documents` + bucket privato `patient-documents`.
- Privacy: sola lettura per il professionista.
- Diario: sola lettura per il professionista, provenienza paziente esplicita.
- Andamento: aggregazione di peso paziente (Diario) e professionista (Misure), fonti distinte.
- Visite: `appointments` + `appointment_patients`.
- Note: `professional_notes`.
- Cartella PDF: raccoglie i dati da Supabase tramite `professional-pdf.js`.
- Tab Account: rimossa dalla scheda paziente professionista.
- Eliminazione paziente: rimossa. Il lifecycle corretto è Termina/Riattiva percorso.
- Menu paziente `…`: Modifica scheda / Modifica anagrafica / Termina percorso.

## Ownership frontend

- `professional-guard.js`: bootstrap/Auth/caricamento moduli.
- `professional-services.js`: query e azioni Supabase condivise.
- `professional-patients.js`: anagrafica, lifecycle, menu azioni paziente e bridge controllato col renderer legacy.
- `professional-clinical.js`: sezioni cliniche e contenuti scheda paziente.
- `professional-agenda.js`: Visite.
- `professional-pdf.js`: Cartella clinico-nutrizionale stampabile/PDF.

`pro.js` rimane ancora shell/renderer legacy durante la transizione, ma non è più il proprietario funzionale dei tab migrati.

Il `MutationObserver` di `professional-patients.js` ignora le mutazioni prodotte esclusivamente dai body dei tab migrati (`nubemoProfessional*`), così il bridge col renderer legacy non genera cicli di render o flicker continui.

## Schema / sicurezza introdotti

Migration principali:

- `nubemo_professional_full_patient_area`
- `nubemo_patient_document_storage_cleanup`
- `nubemo_appointment_patient_rls_target_fix`
- `nubemo_professional_clinical_profile_read_scope`

Interventi:

- `nutrition_plans.professional_note text`
- `diary_entries.sport text`
- bucket privato `patient-documents`, limite 10 MB
- RLS/grant dedicati alle tabelle migrate
- lettura storico consentita al professionista associato
- scritture cliniche consentite solo su percorso attivo
- Diario e Privacy in sola lettura lato professionista
- nessun DELETE fisico del paziente
- policy di associazione Visite corretta sul `patient_id` effettivo della relazione
- perimetro SELECT di `patient_clinical_profiles` allineato alle colonne lette dal service

## Nota Diario

Il contratto lato Professionista è completo: legge esclusivamente `diary_entries` e dichiara esplicitamente che i dati sono registrati dal paziente.

Il database DEV non contiene ancora righe `diary_entries` e l'Area Paziente non è stata migrata in questo blocco. Quindi il professionista può verificare subito la modalità sola lettura e l'empty state; la verifica end-to-end di una giornata realmente inserita dal paziente verrà fatta durante la migrazione dell'Area Paziente.

## Test di accettazione consigliati

1. login professionista e lista pazienti;
2. aprire un paziente e verificare il Riepilogo;
3. Anamnesi: lettura/modifica/persistenza;
4. Esami: nuovo esame, valori, eventuale file, conferma revisione;
5. Piano: nuovo piano, eventuale file, modifica stato/date/note;
6. Documenti: upload e apertura;
7. Privacy: sola lettura / empty state se non esistono informative attive;
8. verificare assenza tab Account sia desktop sia drawer;
9. Diario: dicitura “Diario compilato dal paziente”, sola lettura ed empty state;
10. Andamento: distinzione fonte Paziente/Professionista;
11. Misure: aggiunta/modifica/persistenza;
12. Visite: aggiunta/modifica/persistenza;
13. Note: aggiunta/modifica/persistenza;
14. menu `…`: sole tre azioni previste;
15. nessun comando Elimina paziente;
16. Termina percorso e Riattiva percorso;
17. Modifica anagrafica;
18. Cartella PDF: apertura del flusso stampa/PDF e sezioni alimentate da Supabase;
19. reload completo della pagina e ripetizione rapida dei tab principali.

## Stato di accettazione

- Anamnesi: VERIFIED.
- Misure: VERIFIED.
- Migrazione massiva restante: **IMPLEMENTED / PENDING USER TEST**.
