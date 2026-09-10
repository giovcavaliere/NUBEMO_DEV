# NUBEMO — Migrazione completa Area Professionista / Scheda paziente

Branch: `cleanup/architecture-4c2b`

## Stato

- Anamnesi: Supabase, VERIFIED prima del blocco massivo.
- Misure: Supabase, VERIFIED prima del blocco massivo.
- Riepilogo: composto da fonti Supabase reali.
- Esami: `laboratory_reports` + `laboratory_values` + documenti.
- Piano: `nutrition_plans` + `nutrition_plan_documents` + documenti.
- Documenti: `documents` + bucket privato `patient-documents`.
- Privacy: sola lettura per il professionista.
- Diario: sola lettura per il professionista, provenienza paziente esplicita.
- Andamento: aggregazione di peso paziente (Diario) e professionista (Misure), fonti distinte.
- Visite: `appointments` + `appointment_patients`.
- Note: `professional_notes`.
- Cartella PDF: raccoglie dati da Supabase tramite `professional-pdf.js`.
- Tab Account: rimossa dalla scheda paziente professionista.
- Eliminazione paziente: rimossa. Il lifecycle corretto è Termina/Riattiva percorso.
- Menu paziente `…`: Modifica scheda / Modifica anagrafica / Termina percorso.

## Ownership frontend

- `professional-guard.js`: bootstrap/Auth/caricamento moduli.
- `professional-services.js`: query e azioni Supabase condivise.
- `professional-patients.js`: anagrafica, lifecycle, menu azioni paziente.
- `professional-clinical.js`: sezioni cliniche e contenuti scheda paziente.
- `professional-agenda.js`: Visite.
- `professional-pdf.js`: Cartella clinico-nutrizionale stampabile/PDF.

`pro.js` rimane ancora shell/renderer legacy durante la transizione, ma non è più il proprietario funzionale dei tab migrati.

## Schema / sicurezza introdotti

Migration: `nubemo_professional_full_patient_area`

- `nutrition_plans.professional_note text`
- `diary_entries.sport text`
- bucket privato `patient-documents`, limite 10 MB
- RLS/grant dedicati alle tabelle migrate
- lettura storico consentita al professionista associato
- scritture cliniche consentite solo su percorso attivo
- Diario e Privacy in sola lettura lato professionista
- nessun DELETE fisico del paziente

## Nota Diario

Il contratto lato Professionista è completo: legge esclusivamente `diary_entries` e dichiara esplicitamente che i dati sono registrati dal paziente. La scrittura end-to-end dal frontend Paziente verrà verificata/migrata quando si affronta l'Area Paziente; non viene simulata dal Professionista.

## Test di accettazione consigliati

1. login professionista e lista pazienti;
2. Riepilogo;
3. Anamnesi lettura/modifica/persistenza;
4. Esami: nuovo esame, valori, eventuale file, conferma revisione;
5. Piano: nuovo piano, file, modifica stato/date/note;
6. Documenti: upload e apertura;
7. Privacy in sola lettura;
8. assenza tab Account;
9. Diario: dicitura provenienza paziente e sola lettura;
10. Andamento: distinzione fonte Paziente/Professionista;
11. Misure: aggiunta/modifica/persistenza;
12. Visite: aggiunta/modifica/persistenza;
13. Note: aggiunta/modifica/persistenza;
14. menu `…`: sole tre azioni previste;
15. nessun comando Elimina paziente;
16. Termina/Riattiva percorso;
17. Modifica anagrafica;
18. Cartella PDF: apertura stampa, sezioni alimentate da Supabase;
19. reload completo e ripetizione rapida dei tab principali.
