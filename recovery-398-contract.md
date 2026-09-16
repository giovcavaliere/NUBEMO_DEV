# NUBEMO 3.98 → Supabase recovery contract

## Obiettivo
La migrazione a Supabase deve sostituire infrastruttura e persistenza senza creare un nuovo prodotto lato utente.

## Baseline di prodotto
Il frontend di riferimento è NUBEMO 3.98 presente su `main` al commit `d2eeab75e469eba9f8105f642ba51e14a3b520ab`.

Sono baseline vincolante, salvo modifica esplicitamente approvata:
- DOM e struttura delle schermate;
- layout e CSS;
- testi e gerarchia visiva;
- navigazione e flussi;
- comportamento dei pulsanti e dei modali;
- grafici e filtri;
- PDF Diario e Cartella clinico-nutrizionale;
- comportamento Home, Diario, Andamento, Misure, Documenti e Profilo;
- comportamento Area Professionista e Area Paziente.

## Modifiche frontend già approvate
- rimozione di `Cambia area` dall'Area Paziente;
- eventuali altre variazioni solo se approvate esplicitamente durante il lavoro.

## Architettura target
Supabase è il livello dati/infrastruttura:
- Auth;
- PostgreSQL;
- RLS;
- Storage;
- relazioni professionista/paziente;
- documenti;
- appuntamenti;
- dati clinici e diario.

Il frontend 3.98 resta il contratto di prodotto. L'architettura nuova deve adattarsi al frontend, non viceversa.

## Regole di implementazione
1. Nessuna reimplementazione grafica se la 3.98 possiede già la funzione.
2. Nessun nuovo modulo può sostituire a posteriori parti di DOM già renderizzate dalla 3.98 come strategia permanente.
3. Ogni dominio ha un solo owner funzionale.
4. Prima si preserva la funzione 3.98, poi si sostituisce la fonte dati.
5. Ogni dominio migrato deve superare un test di parità prima di procedere al successivo.
6. I bug cosmetici non bloccanti restano separati dalla migrazione dati.
7. `main` non viene modificata durante il recovery.

## Domini di recovery
Ordine operativo:
1. bootstrap/Auth e caricamento contesto;
2. anagrafiche e pazienti;
3. anamnesi e misure;
4. agenda/visite con unica fonte Supabase;
5. diario e andamento;
6. documenti/piani/privacy;
7. PDF;
8. verifica completa di parità desktop/mobile.

## Branch
La ricostruzione avviene su `recovery/398-supabase-preserved`.
La branch `cleanup/architecture-4c2b` resta una sorgente tecnica per schema, RLS, query e servizi già verificati, ma non è il riferimento del frontend.