# Mappatura chiavi localStorage → destinazione reale

Stato al giro di pulizia `nubemo40clean01`. Per ogni chiave usata da `pro.js` / `app.js`:
chi la intercetta, dove finisce davvero il dato, e se sopravvive a un refresh.

Legenda colonna "Persistita":
- **Supabase** — c'è un percorso di scrittura verso il database. Sopravvive.
- **Solo memoria** — tenuta in una `Map` dal bridge. Si perde al refresh.
- **Inerte** — seminata con un valore fisso e mai più scritta in modo utile.

## Area Professionista (`pro.js`)

| Chiave | Gestita da | Persistita | Note |
|---|---|---|---|
| `diario-pro-extra-patients-v1` | legacy adapter | **Supabase** | `syncPatients()`. È la chiave centrale: 16 file la leggono. |
| `diario-pro-appts-recovery-v1` | legacy adapter, agenda, visits | **Supabase** | `syncAppointments()` + bridge agenda/visite. Tre gestori sulla stessa chiave. |
| `diario-pro-notes-recovery-v1` | notes bridge | **Supabase** | via `services.createProfessionalNote` / `updateProfessionalNote`. |
| `diario-pro-settings-recovery-v1` | settings bridge | **Supabase** | upsert su `professional_settings`. |
| `diario-pro-labs-v1` | labs bridge | **Supabase** | `syncLabs()`. |
| `nubemo-documents-meta-v1` | documents bridge, document-read | **Supabase** | metadata su `documents` + stato lettura su `document_read_status`. |
| `diario-pro-pending-labs-v1` | labs bridge | **Supabase** | i referti in attesa vivono su `laboratory_reports` con `status='pending_review'`; la Map e' solo una proiezione ricostruita a ogni idratazione. |
| `diario-pro-plan-meta-v1` | recovery contract | **Inerte** | in `RETIRED_LOCAL_KEYS`, seminata `{}`. |
| `diario-pro-privacy-meta-v1` | recovery contract | **Inerte** | idem. |
| `nubemo-patient-start-date-v1` | recovery contract, patient-edit-lazy | **Supabase** (indiretta) | la chiave è retired, ma `patient-edit-lazy` scrive `pathway_start_date` direttamente sulla tabella `patients`. La chiave è solo una cache di lettura. |
| `diario-pro-patient-main-v1` | legacy adapter | **Inerte** | seminata `[]`. Residuo demo mono-paziente. |
| `diario-pro-profile-main-v1` | legacy adapter | **Inerte** | seminata `{}`. Residuo demo. |
| `diario-pro-measures-main-v1` | legacy adapter | **Inerte** | seminata `[]`. Residuo demo. |
| `diario-pro-accounts-v1` | legacy adapter | **Inerte** | seminata `{}`. Residuo demo. |
| `diario-pro-demo-measures-overrides-v1` | legacy adapter | **Inerte** | seminata `{}`. Residuo demo, nome esplicito. |
| `diario-pro-deleted-patients-v1` | legacy adapter, dashboard bootstrap | **Solo memoria** | **load-bearing, vedi sotto.** |

## Area Paziente (`app.js`)

| Chiave | Gestita da | Persistita | Note |
|---|---|---|---|
| `diario-pro-patient-main-v1` | legacy adapter | **Supabase** | `syncDiary()`. Qui è la chiave vera del diario. |
| `diario-pro-measures-main-v1` | legacy adapter | **Supabase** | `syncMeasurements()`. |
| `diario-pro-profile-main-v1` | legacy adapter, settings bridge | **Solo memoria** | il settings bridge sovrappone `showEnergyValues`/`readOnly` in lettura; le scritture non risalgono. |
| `nubemo-documents-meta-v1` | legacy adapter, document-read | **Supabase** | stato lettura documenti. |
| `diario-pro-extra-patients-v1` | legacy adapter | **Solo memoria** | lato paziente è di sola lettura. |
| `diario-pro-appts-recovery-v1` | legacy adapter | **Solo memoria** | appuntamenti in sola lettura lato paziente. |
| `diario-pro-accounts-v1` | legacy adapter | **Inerte** | seminata con l'email del profilo. |
| `diario-pro-active-patient-v1` | legacy adapter | **Solo memoria** | selettore paziente attivo, per-sessione. |
| `diario-pro-plan-meta-v1` | legacy adapter | **Solo memoria** | |
| `diario-pro-pending-labs-v1` | labs bridge paziente | **Solo memoria** | |

## Il nodo: `diario-pro-deleted-patients-v1`

Questa chiave viene seminata in **tre punti** con lo stesso valore fisso
`['main','laura','marco']`:
- `professional-legacy-supabase-adapter.js:376`
- `professional-dashboard-bootstrap.js:199` e `:212`

Sembra scaffolding demo da rimuovere, **ma non lo è.** `pro.js` costruisce la
lista pazienti come "i pazienti demo cablati nel codice, meno quelli presenti in
questa lista di cancellati" (`pro.js:412`: `...(!deleted.has('main') ? [mainPatient()] : [])`).
I pazienti fittizi `main`, `laura` e `marco` sono **hardcoded dentro `pro.js`**,
e questa chiave è il meccanismo che li nasconde.

Conseguenza: **rimuovere la riga fa ricomparire i tre pazienti demo**, non li
elimina. La riga è l'antidoto, non il veleno.

Rimuovere davvero lo scaffolding significa togliere i pazienti demo da `pro.js`
— cioè mettere le mani nel file da 189 KB che il contratto di recovery
tiene congelato. È una modifica più invasiva di quanto sembrasse, e va
pianificata a parte.

L'identificatore `'main'` inoltre non è solo un paziente demo: in `app.js` è
anche il **sentinel** che distingue "paziente principale" da "paziente extra"
(`app.js:27,31,36,45,55,308,320,418`). Va disambiguato prima di toccarlo.

## Cosa si perde davvero su un database pulito

Nulla di gia' salvato. Le chiavi "Solo memoria" e "Inerte" non contengono dati
utente storici: sono impalcatura di runtime, ricostruita a ogni idratazione da
Supabase.

Due allarmi presenti in una stesura precedente di questo documento si sono
rivelati **infondati** a verifica piu' approfondita, e sono stati corretti
nella tabella sopra:

- `diario-pro-pending-labs-v1` **e' persistita**: i referti in attesa di
  conferma stanno su `laboratory_reports` con `status='pending_review'` e
  vengono riletti a ogni `ensurePatient()`. La Map in memoria e' una cache,
  non l'archivio.
- Il profilo paziente non risale a Supabase, ma `saveProfile()` in `app.js`
  ha **un solo chiamante**: il ripristino da backup JSON (`app.js:1088`),
  una funzione ereditata dall'era local-storage. Non e' un percorso utente
  normale.

Resta invece vero il punto sui pazienti demo: sono nel codice, nascosti da un
meccanismo replicato in tre punti che va tenuto allineato a mano.

## Stato dopo il giro di pulizia

1. ~~Mappatura~~ - questo documento.
2. ~~Fix del timing dei bridge lazy~~ - risolto nel kit: vedi
   `storage-bridge-kit-refactor.md`.
3. ~~Rimozione dei riferimenti alla 3.98~~ - fatto, e versioni `?v=`
   unificate su un solo numero di build.
4. **Rimozione dei pazienti demo da `pro.js`** - NON fatta. Richiede di
   toccare `pro.js` e di disambiguare il sentinel `'main'` in `app.js`:
   va isolata in un giro dedicato con collaudo proprio.
5. **Persistenza del profilo paziente** - NON fatta, e a bassa priorita'
   visto che il solo chiamante e' il ripristino da backup. Se quella
   funzione viene dismessa, il problema sparisce con lei.
