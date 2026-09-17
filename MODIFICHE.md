# Delta clean04 — dati non aggiornati dopo un inserimento del paziente

Sovrascrivere i 20 file nella radice del repo.

## Causa comune dei due bug

Entrambi i sintomi venivano da cache lato client che nessuno invalidava
mai. I dati su Supabase erano corretti: era il frontend a non rileggerli.

### 1. Grafico a torta BMI non aggiornato

`get_professional_dashboard` veniva eseguita **una sola volta**, dentro
`init()`. Tornando sulla Dashboard, `restoreDashboard()` ripubblicava il
payload iniziale. I conteggi BMI restavano quelli del login, anche dopo
che un paziente aveva inserito un nuovo peso.

Correzione: nuova `refreshDashboard()` che riesegue la RPC, agganciata al
click sulla voce di navigazione Dashboard (sia `data-view` sia
`data-drawer-view`). Protetta contro chiamate sovrapposte.

### 2. Diario paziente in pro.html non allineato

`professional-patient-diary-lazy.js` teneva le righe in una `Map`, e la
sua funzione `clear()` **non era chiamata da nessuno**: la cache non
veniva mai svuotata. Una giornata inserita dal paziente non compariva
fino al ricaricamento completo della pagina. Il sintomo era esattamente
quello descritto: sembra che al click sulla tab Diario non avvenga
nessuna lettura del database, perche' in effetti non avveniva.

Correzione: `load()` accetta ora un parametro `force` che salta la cache,
e il click sulla tab Diario rilegge sempre dal database mantenendo il
periodo selezionato e la posizione di scorrimento.

## Nota su come viene forzato il ridisegno

Il codice altrove ridisegna simulando un click sul pulsante di
navigazione. E' lo stesso schema che aveva causato la creazione doppia
del paziente (un click rilanciato piu' l'evento originale), quindi non
l'ho riusato.

`pro.js` espone ora `window.nubemoProfessionalRender()`, una riga, che
richiama il render della vista corrente senza rilanciare eventi. E' il
secondo punto di contatto esplicito verso la shell PRO, dopo `host` del
modulo Profilo.

## File

Modifiche funzionali:

    professional-dashboard-bootstrap.js   refreshDashboard() + aggancio al nav
    professional-patient-diary-lazy.js    load(force) + rilettura al click tab
    pro.js                                espone nubemoProfessionalRender

Gia' consegnati nei delta precedenti, inclusi per completezza:

    style.css
    professional-patient-lifecycle-bridge.js
    professional-patient-management.js
    professional-patient-invite-guard.js

Solo numero di build (`nubemo40clean04`, cache `nubemo-demo-v4.0-clean04`):

    sw.js, professional-guard.js, patient-guard.js,
    professional-pathway-lazy.js, professional-new-patient-lazy.js,
    professional-patient-list-freshness.js, professional-patient-edit-lazy.js,
    pro.html, patient.html, index.html, admin.html, privacy.html,
    set-password.html

## Da collaudare

Con due sessioni aperte (paziente e professionista), senza mai ricaricare
la pagina del professionista:

- Il paziente inserisce una giornata con peso.
- Sul professionista: tornare sulla Dashboard e verificare che il grafico
  BMI rifletta il nuovo peso.
- Aprire la scheda di quel paziente, tab Diario: la giornata nuova deve
  esserci.
- Cambiare periodo del diario (30 / 90 / tutto) e verificare che i filtri
  funzionino ancora e che la posizione di scorrimento sia mantenuta.
- Verificare che il passaggio sulla Dashboard non sia diventato lento:
  ora esegue una RPC a ogni ingresso.

## Punto aperto correlato

Il refresh a ogni ingresso in Dashboard e' una lettura in piu' ogni
volta. Se risultasse pesante, la strada giusta e' invalidare solo quando
qualcosa e' cambiato (Realtime di Supabase, o un contatore di versione
nel payload) invece di rileggere sempre. Da valutare con la riscrittura
della Dashboard, insieme ai punti gia' in `docs/punti-aperti.md`.
