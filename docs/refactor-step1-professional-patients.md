# Refactor Step 1 — Modulo Pazienti Area Professionista

## Obiettivo
Stabilire il primo confine architetturale riutilizzabile senza cambiare funzioni, UI, schema Supabase o RLS.

## Modifiche effettuate

### `professional-services.js`
Nuovo owner dell'accesso dati Supabase condiviso dell'Area Professionista.

Per il modulo Pazienti espone:
- `loadPatients(professionalId)`
- `updatePatientDemographics(row, values)`
- `setPatientPathwayStatus(professionalId, patientId, status)`

Il modulo UI non esegue più direttamente query/update Supabase.

### `professional-patients.js`
Sostituisce il precedente `professional-patient-management.js`.

Responsabilità:
- modifica anagrafica;
- termina percorso;
- riattiva percorso;
- sezione percorsi terminati;
- adattamento temporaneo al render legacy di `pro.js`.

Il `MutationObserver` rimane deliberatamente come compatibility bridge finché elenco/dettaglio paziente sono ancora renderizzati da `pro.js`. Non è considerato architettura definitiva.

È stata rimossa dal modulo Pazienti la correzione del click sul titolo/header, perché appartiene alla futura shell/navigation e oggi è già contenuta nel relativo compatibility fix.

### `professional-guard.js`
Rimane owner di auth/bootstrap.

Ora:
1. autorizza il professionista;
2. carica `professional-services.js`;
3. usa il service per caricare i pazienti nel context;
4. carica il legacy `pro.js`;
5. carica `professional-patients.js`.

La funzione di reload pazienti rimane esposta temporaneamente per compatibilità con il core legacy.

### File rimosso
- `professional-patient-management.js` — sostituito da `professional-patients.js`.

## Cosa NON è stato toccato
- `main`;
- `pro.js`;
- Supabase schema;
- RLS/grant;
- dati;
- HTML/UI;
- CSS e responsive;
- drawer fix;
- landscape CSS;
- flussi clinici.

## Stato architetturale dopo Step 1

`professional-guard.js` → bootstrap/auth

`professional-services.js` → accesso dati remoto condiviso

`pro.js` → legacy rendering/core (temporaneo)

`professional-patients.js` → ownership funzionale Pazienti + compatibility bridge

Questo è il pattern da seguire per le prossime aree migrate: separare prima accesso dati e ownership funzionale, mantenendo un bridge minimo col legacy fino a quando il render della specifica area viene migrato.

## Regression test richiesto prima di merge su main
1. Login professionista e caricamento Area Professionista.
2. Elenco pazienti attivi invariato.
3. Apertura dettaglio paziente invariata.
4. `Modifica scheda` clinica invariata.
5. `Modifica anagrafica`: apertura, salvataggio e refresh dati.
6. `Termina percorso`: sparizione dagli attivi e presenza nei terminati.
7. `Riattiva percorso`: ritorno negli attivi con dati conservati.
8. Navigazione Dashboard / Pazienti / dettaglio senza errori console.
9. Verifica drawer desktop, iPad e iPhone invariata.
10. Verifica che nessuna modifica grafica sia stata introdotta dal refactor.

## Regola di merge
Non portare questo branch su `main` finché il regression test funzionale non è completato.
