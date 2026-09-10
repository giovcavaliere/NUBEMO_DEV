# NUBEMO 3.98 → Supabase — stato parità recovery

Riferimento prodotto: frontend NUBEMO 3.98 recuperato come contratto visivo/funzionale.
Branch recovery: `recovery/398-supabase-preserved`.

Legenda: ✅ preservato/verificato staticamente · ⚠️ migrato ma richiede test runtime · 🔄 variazione architetturale approvata · ❌ non accettabile / da recuperare.

| Dominio | Stato | Note |
|---|---|---|
| Bootstrap/Auth | ⚠️ | Login Supabase e guard separati; test browser finale ancora necessario. |
| Frontend Paziente 3.98 | ✅ | `app.js` è invariato e resta il motore UI/UX; recovery usa adapter dati e contract post-boot. |
| Home Paziente | ✅ | Pensiero del giorno, KPI e comportamento 3.98 restano nel motore originale. |
| Diario/Aggiungi | ⚠️ | UI 3.98 preservata; persistenza su `diary_entries`; CRUD da testare end-to-end. |
| Andamento | ✅ | Grafici, filtri e media mobile restano nel motore 3.98. |
| Misure Paziente | ⚠️ | UI 3.98; `patient_self_measurements` dietro adapter. |
| Documenti Paziente | ⚠️ | UI 3.98; file/metadata su Supabase Storage + `documents`; badge NUOVO collegato a `document_read_status`. |
| Privacy Paziente | 🔄 | Informativa ufficiale centralizzata; apertura obbligatoria prima dell’accettazione; non più PDF demo locale. |
| Impostazioni Paziente | ⚠️ | `showEnergyValues` e `readOnly` persistiti in `patient_settings`. |
| Backup/Restore/Import Paziente | 🔄 | Rimossi come da decisione architetturale; non devono tornare. |
| Frontend PRO 3.98 | ✅ statico | Il recovery ha ripristinato il motore PRO completo con lista pazienti, filtri/indicatori, scheda, misure, piani, esami e PDF maturi. Nessun renderer PRO semplificato deve sostituirlo. |
| Pazienti/Anagrafica | ⚠️ | Flusso 3.98 preservato; identità e relazione professionista-paziente su Supabase. L'email nel nuovo paziente è l'unica aggiunta necessaria per Auth/invito. |
| Anamnesi | ⚠️ | UI 3.98; `patient_clinical_profiles` come source of truth. |
| Misure PRO | ⚠️ | UI e form 3.98 (`Nuova misurazione` / `Modifica misurazione`) preservati; `patient_measurements` dietro adapter. |
| Agenda | ⚠️ | UI 3.98; source unica `appointments` + `appointment_patients`; test sincronizzazione richiesto. |
| Visite | ⚠️ | Stessa source Agenda; nessun secondo modello dati ammesso. |
| Note professionista | ⚠️ | UI 3.98; persistenza `professional_notes`. |
| Documenti PRO | ⚠️ | UI 3.98; Storage + `documents`; badge NUOVO su `document_read_status`. Le azioni legacy IndexedDB sono intercettate dai bridge. Il numero documento contabile torna obbligatorio come nella 3.98. |
| Piani alimentari | ⚠️ | UI/storico 3.98; `nutrition_plans` + `nutrition_plan_documents` + Storage. Le vecchie metadata locali dei piani sono escluse dalla source runtime. |
| Esami ematici | ⚠️ | UI 3.98; `laboratory_reports` + `laboratory_values`; pending review ripristinato. |
| Account paziente | 🔄 | Credenziali demo locali eliminate; accesso gestito da Supabase Auth. |
| Privacy PRO | 🔄 | Professionista vede stato di accettazione; informative gestite centralmente. Azioni e metadata privacy demo locali escluse dal runtime. |
| PDF Diario | ✅ statico | Renderer `diary-pdf.js` invariato rispetto alla baseline; nessun renderer alternativo ammesso. |
| Cartella PDF | ✅ statico / ⚠️ runtime | È presente il renderer maturo `exportClinicalPdf`: logo NUBEMO/professionista, antropometria, esami, grafici peso, allegato peso o Diario 7/30/completo e impaginazione storica. I dati arrivano dagli adapter Supabase. Va ancora generato e confrontato in browser. |
| Service Worker/cache | ⚠️ | Cache recovery20 include anche il contratto runtime PRO; test installazione/aggiornamento PWA finale richiesto. |

## Audit integrità Supabase
Controllo referenziale eseguito durante il recovery: 0 documenti orfani, 0 piani orfani, 0 link piano-documento rotti, 0 referti orfani, 0 valori laboratorio orfani, 0 link appuntamento-paziente rotti, 0 relazioni professionista-paziente rotte.

Controllo aggiuntivo piani: 0 documenti piano non collegati, 0 mismatch `valid_from` tra documento e piano, 0 mismatch delle note professionista tra documento e piano. Le RPC usate dai flussi di soft-delete sono tutte presenti nello schema pubblico.

## Audit frontend PRO
Il diff PRO non viene considerato automaticamente valido solo perché usa il vecchio file. Sono stati ricontrollati i punti che avevano causato la perdita di prodotto: lista pazienti completa, dati peso/delta, filtri documenti da leggere, form nuovo paziente completo, Modifica scheda, Nuova/Modifica misurazione, storico piani, esami, Agenda/Visite e renderer Cartella PDF. Le variazioni di Account/Privacy e invito email restano soltanto quelle imposte dalla nuova architettura Auth/privacy.

Il controllo finale sugli store legacy ha escluso dal runtime PRO `diario-pro-plan-meta-v1` e `diario-pro-privacy-meta-v1`: eventuali residui presenti nel browser non possono più diventare source of truth o far riapparire flussi locali/IndexedDB. Il controllo del numero documento contabile è stato riallineato alla 3.98 prima che il bridge Supabase intercetti il salvataggio.

## Stato chiusura statica
La recovery lato codice/architettura è chiusa. Non risultano altri blocchi statici noti da correggere prima del collaudo. La branch non deve essere promossa su `main` finché i domini marcati ⚠️ non superano il test reale desktop + iPhone.

## Regola di chiusura runtime
Nessun dominio passa a ✅ runtime senza prova reale sul flusso completo. Ogni differenza visiva o funzionale rispetto alla 3.98 è regressione, salvo le sole variazioni esplicitamente approvate o strettamente necessarie per Auth/privacy già definite.

## Test finali obbligatori
Desktop + iPhone: login, apertura paziente, modifica scheda, nuova/modifica misura, Agenda, Visite, Diario, Andamento, Documenti, Piano, Esami, Privacy, PDF Diario, Cartella PDF, logout e riapertura PWA.
