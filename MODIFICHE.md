# Pacchetto delta — solo i file modificati

Sovrascrivere questi file nel repo, mantenendo i percorsi (`docs/` va in
`docs/`, il resto nella radice).

## ATTENZIONE — un file va ELIMINATO

    support-email-supabase-bridge.js      → eliminare

Sostituito da `nubemo-support.js`. Non e' piu' referenziato da nessuna
pagina ne' dal service worker: se resta nel repo e' solo codice morto, ma
va rimosso perche' registra listener sui pulsanti Assistenza e andrebbe in
conflitto con il modulo nuovo.

## File NUOVI (3)

    storage-bridge-kit.js     kit condiviso per l'intercettazione di Storage
    nubemo-support.js         Assistenza NUBEMO, aree Professionista e Paziente
    pro-profile.js            Profilo professionista

## Codice modificato (19)

    app.js                                         delega pagina Assistenza; rimosse sendPatientSupport e deviceInfo
    pro.js                                         delega Assistenza e Profilo; rimossi backup, quick patient, saveNewPatient; griglia Agenda a 15'
    pro.html                                       nuovi script, rimosso il vecchio bridge Assistenza
    patient.html                                   nuovi script, rimosso il vecchio bridge Assistenza
    sw.js                                          elenco CORE aggiornato, versione cache
    professional-recovery-contract.js              FIX draft: consulta anche il lifecycle bridge
    professional-dashboard-bootstrap.js            uso del kit condiviso
    professional-legacy-supabase-adapter.js        uso del kit condiviso
    patient-legacy-supabase-adapter.js             uso del kit condiviso
    professional-agenda-supabase-bridge.js         uso del kit condiviso
    professional-diary-calorie-supabase-bridge.js  uso del kit condiviso
    professional-document-read-supabase-bridge.js  uso del kit condiviso
    professional-documents-supabase-bridge.js      uso del kit condiviso
    professional-labs-supabase-bridge.js           uso del kit condiviso
    professional-notes-supabase-bridge.js          uso del kit condiviso
    professional-patient-settings-supabase-bridge.js uso del kit condiviso
    professional-settings-supabase-bridge.js       uso del kit condiviso
    professional-visits-supabase-bridge.js         uso del kit condiviso
    patient-document-read-supabase-bridge.js       uso del kit condiviso
    patient-settings-supabase-bridge.js            uso del kit condiviso

## Solo commenti — rimozione dei riferimenti "3.98" (10)

Nessuna modifica di codice. Si possono anche non applicare, ma restano
allora i riferimenti alla vecchia versione.

    auth.js
    patient-guard.js
    patient-labs-supabase-bridge.js
    patient-measures-pdf.js
    patient-recovery-contract.js
    pdf-open-recovery-bridge.js
    professional-bmi-dashboard-fix.js
    professional-patient-actions-menu.js
    professional-patient-management.js
    professional-plans-supabase-bridge.js

## Solo numero di build `?v=` (8)

Le versioni sono state unificate su `nubemo40clean01`. Questi file cambiano
solo per quello: vanno applicati comunque, altrimenti le versioni tornano
disallineate tra chi carica e chi e' caricato.

    admin.html
    index.html
    privacy.html
    set-password.html
    professional-guard.js
    professional-new-patient-lazy.js
    professional-pathway-lazy.js
    professional-patient-edit-lazy.js
    professional-patient-list-freshness.js

## Documentazione (3, in docs/)

    docs/storage-bridge-kit-refactor.md   il kit condiviso e il fix del timing
    docs/storage-key-mapping.md           mappatura chiave per chiave
    docs/punti-aperti.md                  i due punti rimandati alla Dashboard

## Non toccati

`style.css`, `supabase/`, `assets/`, `tests/` e tutti gli altri file non
elencati qui sono invariati rispetto allo zip di partenza.
