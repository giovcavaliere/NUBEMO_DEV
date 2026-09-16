# Delta — badge "Anagrafica parziale" + bump di build

Sovrascrivere tutti i 18 file nella radice del repo.

## Perche' il badge era sparito

Nel delta precedente `pro.js` era stato modificato (badge reso nel markup)
ma il numero di build `?v=` NON era stato incrementato. Il service worker
ha quindi continuato a servire il `pro.js` in cache, privo del badge nuovo,
mentre `professional-dashboard-bootstrap.js` — aggiornato correttamente —
aveva gia' rimosso il vecchio badge iniettato via CSS.

Risultato: vecchio badge rimosso, nuovo mai caricato.

I dati erano corretti per tutto il tempo (`_draft: true` su tutti i
contatti provvisori): il difetto era solo di distribuzione.

## Cosa cambia in questo delta

Build passato da `nubemo40clean01` a **`nubemo40clean02`** in tutti i
punti, e nome cache del service worker da `nubemo-demo-v4.0-profilo01` a
`nubemo-demo-v4.0-clean02`. Questo forza il rifetch di tutto.

Nessuna modifica di logica rispetto al delta precedente: i 5 file
funzionali sono identici a quelli gia' consegnati, cambiano solo le
stringhe di versione nei file che li referenziano.

### File con modifiche funzionali (identici al delta precedente)

    pro.js
    professional-dashboard-bootstrap.js
    professional-patient-lifecycle-bridge.js
    professional-patient-management.js
    professional-patient-invite-guard.js

### File con solo il numero di build aggiornato

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

## Regola per i prossimi giri

Qualsiasi file servito dal service worker che venga modificato richiede
l'incremento del build in TRE posti, tenuti allineati:

1. il tag `<script src="...?v=">` nella pagina che lo carica
2. la chiamata `loadScript('...?v=')` nel guard, per i file lazy
3. l'elenco `CORE` in `sw.js`, piu' la costante `CACHE`

E' esattamente il problema che il numero di build unico doveva prevenire:
unico va incrementato, non solo unico.

## Dopo il deploy

Se il badge ancora non compare, e' cache del browser e non del service
worker: forzare un ricaricamento completo, oppure disinstallare il service
worker da DevTools > Application > Service Workers > Unregister e
ricaricare.

## Da collaudare

- Badge "Anagrafica parziale" sui 10 contatti provvisori in elenco.
- Conversione di un draft in paziente: il badge sparisce solo per quello.
- Eliminazione contatto draft.
- Creazione paziente senza spunta di attivazione: un solo record.
