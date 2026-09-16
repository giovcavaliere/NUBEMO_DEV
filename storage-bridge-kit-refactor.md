# Centralizzazione della patch su Storage.prototype

## Cosa cambia

15 file (`*-supabase-bridge.js`, i due `*-legacy-supabase-adapter.js` e
`professional-recovery-contract.js`) intercettavano `localStorage` ciascuno per
conto proprio: catturava i metodi correnti del prototipo, poi li sovrascriveva
con la propria versione che delega ai metodi catturati per le chiavi che non
gestisce. Il comportamento a runtime era corretto, ma il meccanismo era
duplicato 15 volte con piccole variazioni di stile, e non c'era un modo per
sapere, in un dato momento, quali bridge avessero già installato la propria
patch.

`storage-bridge-kit.js` centralizza solo questo meccanismo:
- `window.NubemoStorageKit.capture()` restituisce i metodi correnti del
  prototipo, esattamente come faceva ogni file con
  `Object.getPrototypeOf(window.localStorage)` + lettura di getItem/setItem/
  removeItem.
- `window.NubemoStorageKit.patch(nome, {getItem, setItem, removeItem})`
  applica la patch, esattamente come faceva ogni file con
  `storageProto.getItem = ...` ecc.
- `window.NubemoStorageKit.getPatchLog()` è di sola lettura: elenca i bridge
  che hanno effettivamente installato la propria patch, in ordine. Utile in
  console per verificare se un bridge lazy è già attivo prima di fidarsi di
  una lettura/scrittura su una sua chiave.

Nessuna logica applicativa è stata toccata: ogni bridge patcha ancora
esattamente gli stessi metodi (get/set/remove, o solo un sottoinsieme), sulle
stesse chiavi, con lo stesso corpo di funzione, nello stesso punto del codice
(subito al caricamento oppure dentro il proprio `install()`/hydrate asincrono,
come prima). Cambia solo dove vive il codice che cattura e applica la patch.

## Il fix del timing (unica modifica di comportamento)

I bridge sono caricati lazy, ma il motore UI puo' scrivere su una chiave
prima che il bridge che la possiede sia installato. Prima, quella scrittura
finiva sul vero `localStorage` e non raggiungeva mai Supabase: spariva al
refresh successivo, in modo dipendente dal percorso di navigazione e quindi
difficile da riprodurre.

Il kit ora installa subito un **recorder** (prima di ogni bridge, perche' e'
il primo script della pagina). Il recorder non altera il comportamento della
scrittura: la lascia proseguire e annota i valori scritti su chiavi che
nessun bridge ha ancora reclamato.

Quando un bridge si installa, dichiara le chiavi che possiede come terzo
argomento di `patch()`:

    window.NubemoStorageKit.patch('professional-notes-supabase-bridge', {
      setItem: function(key, value) { ... }
    }, [NOTES_KEY]);

A quel punto il kit ripropone le scritture bufferizzate per quelle chiavi
passando dal `setItem` appena installato, cioe' esattamente il percorso che
avrebbero seguito se il bridge fosse gia' stato caricato.

**Questa e' l'unica modifica di comportamento del giro e va collaudata.**
Lo scenario da provare: agire su una sezione lazy (Note, Esami, Agenda)
navigando in modo da toccare i dati *prima* di aprire quella sezione, poi
ricaricare e verificare che il dato sia ancora li'.

Diagnostica in console:
- `window.NubemoStorageKit.getPatchLog()` - bridge installati, in ordine,
  con le chiavi reclamate e quali scritture sono state riproposte.
- `window.NubemoStorageKit.getUnclaimedWrites()` - scritture rimaste orfane.
  Se qui compare una chiave che dovrebbe finire su Supabase, manca il
  `claims` nel bridge corrispondente.

## Da fare aggiungendo un nuovo bridge

- Caricare `storage-bridge-kit.js` prima di qualsiasi bridge in ogni pagina
  che ne aggiunge uno nuovo (già fatto per `patient.html` e `pro.html`).
- Aggiungerlo a `sw.js` (`CORE`) se si aggiunge una nuova pagina che lo usa.
- Verificare in console, con `window.NubemoStorageKit.getPatchLog()`, che il
  bridge coinvolto in un bug sia effettivamente installato nel momento in cui
  serve.

## File coinvolti in questo giro

`storage-bridge-kit.js` (nuovo), `patient-document-read-supabase-bridge.js`,
`patient-legacy-supabase-adapter.js`, `patient-settings-supabase-bridge.js`,
`professional-agenda-supabase-bridge.js`, `professional-dashboard-bootstrap.js`,
`professional-diary-calorie-supabase-bridge.js`,
`professional-document-read-supabase-bridge.js`,
`professional-documents-supabase-bridge.js`, `professional-labs-supabase-bridge.js`,
`professional-legacy-supabase-adapter.js`, `professional-notes-supabase-bridge.js`,
`professional-patient-settings-supabase-bridge.js`, `professional-recovery-contract.js`,
`professional-settings-supabase-bridge.js`, `professional-visits-supabase-bridge.js`,
più `patient.html`, `pro.html`, `sw.js`, `professional-guard.js`,
`professional-patient-list-freshness.js`, `patient-guard.js` (solo tag/versioni
degli script, nessuna logica).

Nota a margine emersa durante il lavoro: le versioni `?v=` di
`professional-agenda-supabase-bridge.js` e `professional-notes-supabase-bridge.js`
erano già disallineate tra `professional-guard.js` e `sw.js`/
`professional-patient-list-freshness.js` (stringhe diverse per lo stesso file).
Sono state riportate alla stessa versione insieme al resto di questo giro,
senza altre modifiche.
