# Punti aperti, rimandati alla riscrittura della Dashboard

Entrambi vivono in `professional-dashboard-bootstrap.js`, cioe' proprio il
file che la riscrittura della Dashboard sostituira'. Correggerli prima
significherebbe rifare lo stesso lavoro due volte: decisione presa di
aspettare.

## 1. Le impostazioni Agenda vengono azzerate all'avvio

`publishDashboard()` scrive in SETTINGS_KEY il solo `workDays`:

    memory.set(SETTINGS_KEY, JSON.stringify({workDays: ...}));

Sostituisce l'intero oggetto, quindi `first`, `control`, `dayStart` e
`dayEnd` spariscono. Il bridge che li rilegge davvero
(`professional-settings-supabase-bridge.js`) e' caricato lazy, solo aprendo
Agenda o Profilo professionista.

Effetto: chi legge le impostazioni prima di quel momento vede i default
(60, 30, 08:00, 19:00) invece dei valori salvati. Caso concreto: creare un
evento partendo dalla Dashboard senza passare da Agenda mostra una durata
predefinita sbagliata.

Aggiramento nel frattempo: passare da Agenda o Profilo prima di creare
eventi. Non c'e' perdita di dati: i valori veri restano su Supabase, e'
solo la proiezione in memoria a essere incompleta.

Correzione prevista: la Dashboard nuova non deve scrivere impostazioni che
non possiede. Se le scrive, deve fondere con quanto gia' presente invece
di sostituire.

## 2. `work_days_count` - NON e' un difetto

Annotato qui perche' era stato segnalato come criticita' in una revisione
precedente, per errore.

`work_days_count` non e' un secondo archivio: la RPC
`get_professional_dashboard` lo calcola al volo leggendo per primo
`settings_json->>'workDays'`, lo stesso campo che scrive il bridge delle
impostazioni (vedi
`supabase/migrations/20260914191500_dashboard_draft_count.sql`, CTE
`settings`). La sorgente di verita' e' una sola e le due strade non possono
divergere.

Nessuna azione richiesta. Da non "correggere" durante la riscrittura.
