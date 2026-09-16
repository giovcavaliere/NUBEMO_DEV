# Delta — tab Pazienti

Sovrascrivere questi 5 file nella radice del repo. Nessun file da
eliminare, nessun file nuovo, nessuna modifica a `pro.html` o `sw.js`
(le versioni `?v=` restano `nubemo40clean01`).

## professional-patient-invite-guard.js — FIX doppio paziente

Il guard, quando decideva di non intervenire, rilanciava il click con
`button.click()` invece di lasciar proseguire l'evento. Il rilancio
creava il paziente una volta, e l'evento originale — mai bloccato —
lo creava una seconda volta. Rimosso il rilancio, la funzione che lo
faceva e il flag di bypass che serviva solo a gestirlo.

## pro.js + professional-dashboard-bootstrap.js — badge "Anagrafica parziale"

Il badge veniva iniettato come foglio di stile con un selettore `::after`
per ogni id draft, agganciato alla posizione esatta dei nodi
(`> div:nth-child(2)`). Si perdeva a ogni ricostruzione della lista, per
i draft creati dopo il caricamento, e si sarebbe rotto in silenzio a
qualsiasi modifica del markup.

Ora il badge e' reso direttamente nell'elenco pazienti, dalla stessa
condizione gia' usata per "Paziente non ancora attivo". Lo stile vive
accanto agli altri del lifecycle bridge.

Rimossi dal bootstrap: `syncDraftPresentation()`, `cssAttributeValue()`,
la costante `DRAFT_STYLE_ID` e le quattro chiamate.

## professional-patient-lifecycle-bridge.js — eliminazione contatto draft

Nuovo pulsante "Elimina contatto" nel modale "Completa anagrafica".
Chiede conferma, cancella la riga da `professional_patient_drafts`
filtrando anche per `professional_id`, poi ricarica.

Gli appuntamenti collegati NON vengono toccati: restano in Agenda senza
paziente associato. E' scritto nel testo di conferma. Se preferisci un
comportamento diverso (bloccare l'eliminazione se ci sono appuntamenti,
oppure eliminarli a cascata) va deciso e implementato a parte.

## professional-patient-management.js — rimosso il creatore duplicato

Conteneva una seconda implementazione completa della creazione paziente
verso la Edge Function `swift-endpoint`, mai raggiunta: il lifecycle
bridge si carica prima (guard riga 95 contro 104), si registra prima
sulla fase di cattura e blocca l'evento. Rimossa insieme alle tre
funzioni di supporto rimaste orfane (`clinicalFromForm`,
`readItalianDate`, `optionalNumber`) e al flag `creatingPatient`.

Il file resta in uso per fine percorso, riattivazione, modifiche alla
scheda e telefono.

Nota: la Edge Function `swift-endpoint` non e' piu' chiamata da nessun
punto del frontend. Verificare su Supabase se e' usata altrove prima di
rimuoverla anche li'.

## Da collaudare

- Creazione paziente senza spunta di attivazione: un solo record.
- Creazione con spunta ed email nuova, e con email di paziente esistente.
- Badge "Anagrafica parziale" sui draft: all'apertura della tab, dopo un
  filtro di ricerca, e su un draft appena creato dall'Agenda.
- Eliminazione di un contatto draft, con e senza appuntamenti collegati.
- Fine percorso e riattivazione paziente, perche' vivono nel file da cui
  e' stato rimosso il creatore duplicato.
