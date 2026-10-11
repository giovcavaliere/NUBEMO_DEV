# Admin 2.0 — seconda tranche, preparata e non distribuita

## Analisi prima delle modifiche (11 ottobre 2026)

Repository `giovcavaliere/NUBEMO_DEV`, branch `nubemo-2.0`, base `298a743ab3e1f88ca4ddd568d5faee2a7d3c68d7`. Progetto letto esclusivamente: `bggvwwjwzfskabgkynwp`. Nessuna operazione applicativa reale autorizzata in questa esecuzione.

`auth-guard.js` è solo riferimento: usa `swift-endpoint` per `invite-professional`, `resend-professional-invite`, `suspend-professional`, `activate-professional`. Non viene importato dalla 2.0. La funzione distribuita è la versione 11, con `withSupabase`, `getUser()` server e profilo Admin attivo prima delle azioni Admin. Invito/reinvio usano `auth.admin.inviteUserByEmail` e il percorso esistente `set-password.html`. La sospensione modifica `profiles.status`; non cancella dati. La versione attuale riattiva senza verificare altri blocchi ed esegue la creazione del profilo e del professionista in richieste separate, senza creare settings.

`profiles.auth_user_id` è univoco e riferisce Auth con DELETE RESTRICT; `professionals.profile_id` è univoco e riferisce profiles con DELETE RESTRICT. `professional_settings.professional_id` è PK/FK, `active_patient_limit` è nullable, default 10, CHECK > 0. `professional_patients` ha UNIQUE(professional_id,patient_id), FK RESTRICT, stati pending/active/ended e controllo ended_at. I trigger esistenti aggiornano timestamp; non applicano limiti. Le RLS usano `current_active_professional_id()` che richiede sia profilo sia professionista attivi. Admin può leggere professionals/profiles, non leggere direttamente settings/associazioni. Le policy settings permettono al professionista di aggiornare l'intera riga: il limite richiede una protezione aggiuntiva senza sostituire queste policy.

Il DEV contiene 0 professionisti/settings/associazioni e 1.784 alimenti. Nessuna tabella per impostazioni globali: il campo Admin 2.0 è dimostrativo. Nessun backfill di professionisti esistenti viene proposto.

## Ambiguità del conteggio e scelta esplicita

`swift-endpoint.create-patient` conta `professional_patients.status=active`. `patient-lifecycle` v5 conta `patient_pathways.status=active` sulle associazioni del professionista. Quest'ultimo crea/riusa associazioni prima del percorso e supporta pazienti senza Area Paziente, percorsi pending, conversione contatti e identità già presenti. Le RPC `create_new_professional_patient_pathway` e `activate_patient_pathway` possono aumentare la capacità senza il controllo Edge; activate è eseguibile solo da service_role. Nessuno di questi controlli protegge richieste concorrenti.

Si conserva il concetto esistente di **paziente attivo**, contando una sola volta il patient_id quando esiste un'associazione active **oppure** un percorso active per quel professionista. Pending, ended, contatti provvisori e percorsi storici non aumentano il conteggio; lo stato Auth del paziente non lo modifica. L'unione copre la compatibilità con il modello precedente e le transizioni non simultanee; non introduce una nuova associazione e non riconcilia dati automaticamente. Il dettaglio può mostrare anche il totale delle associazioni, distinto dai pazienti che occupano capacità.

## Interventi condivisi preparati e rischi

Una migrazione aggiuntiva crea il solo singleton `admin_settings` (default iniziale 10), un registro operativo per deduplicare inviti/reinvii e RPC service-only per provisioning atomico di profile/professional/settings. Riutilizza `professional_settings.active_patient_limit` come unica fonte individuale. Il default è assegnato alla creazione del professionista; il default generale non aggiorna righe esistenti. Impostazioni mancanti/null preesistenti restano non configurate e bloccano nuove aggiunte finché l'Admin assegna un limite esplicito. Nessun paziente viene rimosso quando il limite scende.

Nuovi trigger, senza rimuovere/sostituire quelli esistenti, proteggono cambiamenti che aumentano il conteggio su associazioni **e** percorsi, serializzando per professionista con lock di riga; il controllo considera gli stati reali del professionista/profilo. Un trigger impedisce al professionista di modificare il limite, lasciando invariati gli altri settings. Questi interventi incidono sui percorsi condivisi: devono essere revisionati e provati su fixture isolate prima di una separata approvazione per DEV. Nessuna modifica a funzioni, policy o dati esistenti viene applicata ora.

La sorgente di `swift-endpoint` viene portata nel repository dalla versione distribuita ed estesa preservando nomi/risposte legacy. La lista originale resta disponibile. La 2.0 richiede un contratto esplicito di capacità backend: senza migrazione, versione Edge e abilitazione operativa, tutte le scritture restano disabilitate. L'abilitazione è un interruttore backend, mai localStorage.

Auth/email e Postgres non condividono una transazione. Il registro riserva l'email prima della chiamata Auth e non ripete automaticamente richieste con esito incerto. Profile/professional/settings sono creati insieme da RPC; errori/timeout dopo Auth diventano `needs_review`, mai successo simulato o reinvio automatico. L'account Auth eventualmente creato viene mantenuto per riconciliazione controllata, senza cancellare account esistenti. Un messaggio di successo descrive esclusivamente la richiesta email accettata dal servizio, non la consegna. Questo limite richiede collaudo manuale e una procedura operativa prima dell'attivazione.

## File e test previsti

Solo `admin2.html`, servizi/presentazione/coordinatore `admin-v2`, nuovi file Supabase versionati, test e questo documento. Nessun import DOM/CSS legacy, nuovo client, session store, Service Worker, modifica login/privacy o seconda area.

Test: servizi/Edge con risposte controllate, validazioni/ruoli/stati/deduplicazione, SQL su database isolato se disponibile, browser Chromium già installato su origine locale dedicata con API intercettate, regressioni login/logout/navigazione/filtri/KPI e viewport 320–1920. Nessun invito o modifica sul vero DEV durante i test.

## Attivazione successiva (richiede nuova approvazione)

1. Revisionare conteggio di compatibilità e migrazione; verificare eventuali nuovi dati/stati del DEV e gestire esplicitamente settings mancanti.
2. In una finestra controllata DEV senza operazioni applicative concorrenti, distribuire prima la sorgente aggiornata di `swift-endpoint`, mantenendo autenticazione e redirect inviti esistenti. In assenza della migrazione il contratto impedisce inviti e modifiche; anche le chiamate legacy ricevono un errore esplicito durante questa finestra.
3. Dopo backup e collaudo isolato dei percorsi condivisi, applicare la migrazione soltanto al progetto DEV autorizzato, lasciando il flag spento. Nessun deploy delle altre funzioni è richiesto: i trigger proteggono anche patient-lifecycle e le RPC. Non aprire la finestra se professionisti già presenti richiedono assegnazioni manuali di limite non ancora autorizzate.
4. Verificare il nuovo contratto di lettura, conteggi, limiti, login/logout e che le scritture restino indisponibili con interruttore spento.
5. Solo in una finestra di collaudo DEV separatamente autorizzata, impostare `admin_settings.management_enabled=true`: il flag è necessario anche per eseguire i test applicativi reali. Non è un valore configurabile dalla UI o da localStorage.
6. Collaudare con account di test autorizzati invito/email reale, provisioning, reinvio, sospensione/RLS, riattivazione e aggiunta/attivazione concorrente pazienti. In caso di errore, spegnere il flag e verificare il registro; non assumere che l'email sia stata annullata.
7. Mantenere l'abilitazione soltanto dopo esito positivo e approvazione operativa. Verificare manualmente le richieste in esito incerto nel registro prima di qualsiasi ripetizione. Nessuna abilitazione o riparazione automatica è inclusa.

## Contratto preparato

La richiesta `list-professionals` con `management_version:1` restituisce la stessa lista più `management {version,enabled,default_patient_limit}`. Ogni riga aggiunge `associated_patient_count`, `active_patient_count`, `active_patient_limit`, `available_patient_slots` e `can_resend/can_suspend/can_activate`. Errori Auth della singola riga producono account non disponibile e negano reinvio/riattivazione. La richiesta legacy senza versione mantiene la risposta originale; nessuna nuova lettura viene generata dalla navigazione.

Le azioni esistenti vengono estese nel medesimo servizio, senza secondo sistema account. Si aggiungono soltanto `set-professional-limit` e `set-default-patient-limit`. Il frontend 2.0 trasmette `confirmed:true` per sospendere e UUID operazione per invito/reinvio; il backend valida transizioni attese active→suspended/suspended→active, mantiene `professionals.status` e controlla ban/cancellazione Auth. Le RPC nuove sono service-only, verificano l'Admin attivo anche in Auth e non possono essere invocate direttamente dal browser.

Gli UUID email sono conservati soltanto nella memoria della pagina per ripetere la stessa richiesta dopo un errore; il registro backend impedisce un secondo invio. Le operazioni completed restituiscono l'esito registrato, quelle started/email_started/needs_review non eseguono email. Nessuna scadenza automatica sblocca un invio incerto. Il reinvio controlla stato Auth, email e identità restituita dal provider; i reinvii riusciti hanno un intervallo minimo di 60 secondi.

La protezione settings conserva gli upsert del bridge precedente per durata/orari/report sulla riga già configurata. Impedisce variazioni del limite e l'autoconfigurazione di una riga mancante. Prima di distribuire, eventuali professionisti storici senza limite richiedono un'assegnazione Admin esplicita. Nessun backfill o adeguamento automatico viene eseguito.

## Verifiche eseguite e limiti

- 46 test Node: servizi, autorizzazione, validazioni, deduplicazione, errori email, conferme backend, flussi Auth e coordinamento prima tranche. L'entrypoint TypeScript è trasformato da Node e provato con il middleware di autenticazione sostituito da un adattatore; il middleware distribuito `withSupabase` viene conservato ma non è eseguito localmente.
- 11 test SQL su Postgres WASM PGlite 0.3.14, completamente in memoria: migrazione reale, RLS/grant, default/individuale, provisioning atomico, rollback, riduzione sotto conteggio, blocchi Auth e sospensione, insert/riattivazione/percorso oltre capacità, upsert settings precedente, INSERT multiplo e richieste accodate. Le ultime non equivalgono a connessioni concorrenti indipendenti.
- 25 test Chromium 153: SDK controllato per la gestione e SDK Supabase reale 2.117.3 con API intercettate per la regressione login. Invito/reinvio/sospensione/riattivazione/limiti, doppio submit, errore email, errore rilettura, Logout durante richiesta, Back/BFCache, dialogo nascosto durante riverifica, filtri/KPI/navigazione. Viewport 320/375/720/768/1024/1280/1920; screenshot esaminati per desktop e smartphone. Origine locale dedicata, zero controller/registrazioni Service Worker, risorse legacy/worker non servite nei test Admin.
- Nessuna modifica CSS: i modali e i controlli usano gli stili Warm Human già presenti. La baseline tablet portrait conserva la limitazione documentata nella prima tranche (sidebar e navigazione mobile nascoste a 768 px); i test attraversano le sezioni tramite hash in quel caso.
- Intatti gli hash DEV di catalogo (1.784 righe), profili, policy, trigger, funzioni e bucket, confrontati prima/dopo. `swift-endpoint` distribuita resta v11; nessuna migrazione è stata applicata.

**Non eseguiti:** email/inviti/account reali, collaudo della nuova Edge nel runtime Supabase distribuito, concorrenza PostgreSQL con connessioni indipendenti e verifica manuale di consegna email. È stato predisposto un binario PostgreSQL 17.6 fuori dal repository, ma il runtime isola solo UID root e vieta cambio utente; il server nativo non è stato avviato. La prova di concorrenza indipendente è un prerequisito prima di applicare la migrazione al DEV.

Comandi riproducibili (dipendenze test esterne al repository):

```sh
node --test tests/admin2-read.test.cjs tests/auth-v2-read.test.cjs tests/admin2-management.test.cjs
PGLITE_MODULE_PATH=/percorso/@electric-sql/pglite node --test tests/admin2-management-sql.test.cjs
ADMIN2_BROWSER_PATH=/percorso/chromium SUPABASE_UMD_PATH=/percorso/supabase-js.js node --test tests/admin2-browser.test.cjs tests/auth-v2-browser.test.cjs
```

I test browser richiedono anche `PLAYWRIGHT_MODULE_PATH` oppure `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. Non installano browser, disregistrano worker o chiamano API reali.

## File della consegna

- `admin2.html`
- `admin-v2/admin-services.js`, `admin-v2/admin-views.js`, `admin-v2/admin-app.js`
- `supabase/functions/swift-endpoint/index.ts`, `supabase/functions/swift-endpoint/management.mjs`
- `supabase/migrations/20261011180000_admin2_professional_management.sql` — proposta da approvare, non applicata; file versionato manualmente perché il CLI Supabase non è disponibile.
- `tests/admin2-read.test.cjs`, `tests/admin2-browser.test.cjs`, `tests/admin2-management.test.cjs`, `tests/admin2-management-sql.test.cjs`
- `docs/admin2-management-integration.md`

Tutti gli altri blob del repository devono restare identici al commit di partenza, inclusi login 1.0/2.0, vecchia Admin, privacy, client/config/sessioni, Service Worker e CSS.
