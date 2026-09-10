# NUBEMO 3.98 → Supabase — stato parità recovery

Riferimento frontend: `main` @ `d2eeab75e469eba9f8105f642ba51e14a3b520ab`.
Branch recovery: `recovery/398-supabase-preserved`.

Legenda: ✅ preservato/verificato staticamente · ⚠️ migrato ma richiede test runtime · 🔄 variazione architetturale approvata · ❌ non accettabile / da recuperare.

| Dominio | Stato | Note |
|---|---|---|
| Bootstrap/Auth | ⚠️ | Login Supabase e guard separati; test browser finale ancora necessario. |
| Frontend Paziente 3.98 | ✅ | `app.js` resta il motore UI/UX; recovery usa adapter dati e contract post-boot. |
| Home Paziente | ✅ | Pensiero del giorno, KPI e comportamento 3.98 restano nel motore originale. |
| Diario/Aggiungi | ⚠️ | UI 3.98 preservata; persistenza su `diary_entries`; CRUD da testare end-to-end. |
| Andamento | ✅ | Grafici, filtri e media mobile restano nel motore 3.98. |
| Misure Paziente | ⚠️ | UI 3.98; `patient_self_measurements` dietro adapter. |
| Documenti Paziente | ⚠️ | UI 3.98; file/metadata su Supabase Storage + `documents`; badge NUOVO collegato a `document_read_status`. |
| Privacy Paziente | 🔄 | Informativa ufficiale centralizzata; apertura obbligatoria prima dell’accettazione; non più PDF demo locale. |
| Impostazioni Paziente | ⚠️ | `showEnergyValues` e `readOnly` persistiti in `patient_settings`. |
| Backup/Restore/Import Paziente | 🔄 | Rimossi come da decisione architetturale; non devono tornare. |
| Frontend PRO 3.98 | ✅ | `pro.js` resta owner principale del rendering e dei flussi. |
| Pazienti/Anagrafica | ⚠️ | UI 3.98; identità e relazione professionista-paziente su Supabase. |
| Anamnesi | ⚠️ | UI 3.98; `patient_clinical_profiles` come source of truth. |
| Misure PRO | ⚠️ | UI 3.98; `patient_measurements`; create/update già allineati al service. |
| Agenda | ⚠️ | UI 3.98; source unica `appointments` + `appointment_patients`; test sincronizzazione richiesto. |
| Visite | ⚠️ | Stessa source Agenda; nessun secondo modello dati ammesso. |
| Note professionista | ⚠️ | UI 3.98; persistenza `professional_notes`. |
| Documenti PRO | ⚠️ | UI 3.98; Storage + `documents`; badge NUOVO su `document_read_status`. |
| Piani alimentari | ⚠️ | UI/storico 3.98; `nutrition_plans` + `nutrition_plan_documents` + Storage. |
| Esami ematici | ⚠️ | UI 3.98; `laboratory_reports` + `laboratory_values`; pending review ripristinato. |
| Account paziente | 🔄 | Credenziali demo locali eliminate; accesso gestito da Supabase Auth. |
| Privacy PRO | 🔄 | Professionista vede stato di accettazione; informative gestite centralmente. |
| PDF Diario | ✅ | Renderer `diary-pdf.js` 3.98 mantenuto; nessun renderer alternativo ammesso. |
| Cartella PDF | ✅ statico / ⚠️ runtime | Renderer storico `exportClinicalPdf` resta quello 3.98; dati clinici, misure, esami, diario, impostazioni e logo arrivano dai bridge Supabase. Va ancora eseguito il collaudo reale del PDF generato. |
| Service Worker/cache | ⚠️ | Asset recovery versionati in modo uniforme; test installazione/aggiornamento PWA finale richiesto. |

## Regola di chiusura
Nessun dominio passa a ✅ runtime senza prova reale sul flusso completo. Ogni differenza visiva o funzionale rispetto alla 3.98 è regressione, salvo le sole variazioni esplicitamente approvate.

## Test finali obbligatori
Desktop + iPhone: login, apertura paziente, modifica scheda, nuova/modifica misura, Agenda, Visite, Diario, Andamento, Documenti, Piano, Esami, Privacy, PDF Diario, Cartella PDF, logout e riapertura PWA.
