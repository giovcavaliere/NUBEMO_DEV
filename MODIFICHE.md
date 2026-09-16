# Delta clean03 — stile del badge sempre disponibile

Sovrascrivere i 19 file nella radice del repo.

## Il problema

Il badge "Anagrafica parziale" compariva senza stile alla prima apertura
della lista pazienti, e diventava una pillola gialla solo dopo aver
cliccato un paziente.

Causa: la regola CSS `.pro3-draft-badge` era stata messa dentro
`professional-patient-lifecycle-bridge.js`, che viene caricato lazy.
Alla prima apertura della lista quel file non e' ancora in memoria,
quindi il markup c'e' ma nessuna regola lo veste. Cliccando un paziente
il guard carica il bridge, lo stile viene iniettato e da quel momento il
badge appare corretto anche tornando indietro.

Era il posto sbagliato: uno stile che serve al primo render non puo'
vivere in un file caricato su richiesta.

## La correzione

La regola e' ora in `style.css`, accanto alle altre `.pro3-patient`.
`style.css` e' caricato dal tag `<link>` della pagina, quindi e'
disponibile prima di qualsiasi render. Rimossa dal lifecycle bridge.

Nessuna modifica di logica: cambia solo dove vive una regola CSS.

## Build

Portato a `nubemo40clean03`, cache service worker a
`nubemo-demo-v4.0-clean03`. `style.css` e' versionato e presente
nell'elenco `CORE`, quindi il bump forza il rifetch anche del foglio di
stile.

## File

Modifiche funzionali:

    style.css                                  regola .pro3-draft-badge aggiunta
    professional-patient-lifecycle-bridge.js   regola rimossa

Gia' consegnati nei delta precedenti, inclusi qui per completezza:

    pro.js
    professional-dashboard-bootstrap.js
    professional-patient-management.js
    professional-patient-invite-guard.js

Solo numero di build:

    sw.js  (anche il nome cache)
    professional-guard.js
    patient-guard.js
    professional-pathway-lazy.js
    professional-new-patient-lazy.js
    professional-patient-list-freshness.js
    professional-patient-edit-lazy.js
    pro.html
    patient.html
    index.html
    admin.html
    privacy.html
    set-password.html

## Da collaudare

Aprire la lista pazienti come primo gesto dopo il login: il badge deve
gia' essere una pillola gialla, senza bisogno di cliccare nulla.
