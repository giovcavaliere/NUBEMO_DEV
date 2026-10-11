# Admin 2.0 — prima tranche in sola lettura

Baseline: branch `nubemo-2.0`, commit `625a287a550b8a193c97498a59debd9ac33f6a3c`.
Progetto: `NUBEMO_DEV` (`bggvwwjwzfskabgkynwp`).

## Perimetro

L'accesso diretto a `admin2.html` verifica l'utente tramite Auth e il profilo persistente `admin/active` prima di mostrare la UI. Il login condiviso conserva il suo instradamento attuale: dopo aver effettuato l'accesso, aprire direttamente `admin2.html` sulla stessa origine.

Dashboard, ricerca e filtri usano un unico elenco restituito da `swift-endpoint` con la sola azione `list-professionals`. Il KPI attivi richiede account Auth confermato, profilo attivo e professionista attivo. Inviti e sospesi possono sovrapporsi e non sono una partizione dei professionisti totali.

La privacy legge l'ultima versione NUBEMO attiva e i consensi riferiti a quella versione. Non pubblica documenti e non cambia consensi. Il PDF viene aperto con URL firmato valido per 300 secondi; prima di generarlo viene ricontrollato l'accesso Admin.

Inviti, reinvii, sospensioni, riattivazioni, modifica dei limiti e pubblicazione sono disabilitati. Gestisci apre il dialogo approvato in consultazione, con conferma disabilitata. Conteggio e limite pazienti risultano non disponibili: il backend attuale non li restituisce e le RLS non consentono di recuperarli direttamente all'Admin. L'impostazione globale non è simulata.

## Responsabilità e dipendenze

- `admin-v2/admin-services.js`: sole letture Auth, Edge Function, tabelle e URL Storage firmati; non conosce il DOM, non inizializza un secondo client e non contiene scritture.
- `admin-v2/admin-views.js`: rendering sui componenti Admin 2.0, ricerca, KPI e dialogo in consultazione; nessuna chiamata Supabase.
- `admin-v2/admin-app.js`: verifica accesso, coordinamento, navigazione e invalidazione delle risposte tardive.
- Riutilizzo senza modifiche di libreria Supabase JS, `config.js`, `supabase-client.js` e baseline `professional-v2/home-design.css`.
- Nessuna importazione di `auth-guard.js`, `admin-privacy.js`, DOM o CSS del vecchio Admin.
- `auth.js`, `privacy.js`, `sw.js`, file condivisi e backend non sono modificati.

Il client mantiene la persistenza di sessione già esistente. Nessuna nuova chiave storage, copia della sessione, override o modalità di autenticazione alternativa.

## Verifiche della prima integrazione (commit `00e9e18`)

- `node --check` sui tre moduli Admin.
- `node --test tests/admin2-read.test.cjs`: 21 test non-browser con client controllati e un doppio DOM minimale per il coordinamento; nessuna chiamata autenticata al progetto reale.
- Accesso Admin attivo, diniego per altri ruoli/stati/identità, sessione assente, timeout, rete indisponibile e accesso revocato dal backend.
- Contratto elenco e header JWT; elenco vuoto distinto da errore; query privacy/consensi e lotti limitati; link PDF privato.
- KPI, ricerca e filtri, consensi, escaping del markup, scritture disabilitate.
- Risposte tardive dopo logout, dati parziali e ricontrollo al ritorno sulla pagina.
- Confronto statico con la baseline: contenitori e gerarchie di layout, navigazione, filtri, colonne, stili esistenti e media query conservati. Il selettore locale `[hidden]` è esteso ai nuovi stati e comandi.
- Server temporaneo esterno al repository, su `127.0.0.1` e porta assegnata: verificato via HTTP, `Cache-Control: no-store`; vecchio Admin e `sw.js` non serviti.
- Confronto in sola lettura di catalogo, account Admin, bucket, vincoli, policy, trigger e funzioni SQL prima/dopo.

## Limiti del collaudo iniziale

Nessun browser Chromium/Chrome/Edge eseguibile disponibile nell'ambiente. Non sono stati eseguiti rendering, screenshot, test visivi o responsive. Il confronto statico delle media query non è un test responsive.

L'isolamento del Service Worker è predisposto tramite origine locale separata, ma controller/registrazioni non sono verificati in un browser. Nessuna registrazione, disregistrazione o modifica automatica del worker esistente.

Prima del collaudo manuale utilizzare un browser con contesto nuovo su un'origine di test separata, verificando `navigator.serviceWorker.controller === null` e nessuna registrazione. Usare copie inalterate di configurazione/client e, per la sessione reale, del login condiviso; non trasferire token o credenziali nei file. Dopo il login aprire direttamente `admin2.html`. Non usare la produzione per il collaudo.

Da verificare manualmente:

1. Login Admin reale, caricamento SDK/CDN, cookie di sessione e chiamata autenticata a `list-professionals`.
2. Con database attualmente vuoto: quattro KPI a zero, elenco vuoto e nessuna informativa pubblicata.
3. Desktop, tablet e smartphone (320, 375, 720, 768, 1024, 1280 e 1920 px): sidebar/nav mobile, griglie, tabella/card, focus e scorrimento.
4. Con risposte controllate nel contesto di test: ricerca/filtri, dialogo Gestisci, testi lunghi, errori/retry e stati parziali. Nessun nuovo record di test necessario nel progetto.
5. Logout/scadenza e ritorno BFCache: nessun dato riaperto senza nuova verifica.
6. Apertura PDF e blocco popup quando esiste un'informativa reale; oggi non è presente alcun documento.

## Correzioni del collaudo Admin 2.0

Base delle correzioni: `00e9e18692fa07e800092f4f4db7f5af83a322be`.

- In `pages.css` la regola dei pulsanti azione applica `display:inline-flex` soltanto senza `hidden`. La dichiarazione originaria aveva la stessa specificità del selettore locale `[hidden]` ed era caricata dopo: prevaleva nella cascata. Nessun override o `!important` aggiunto.
- Logout nella posizione `.side-user .exit` già prevista dalla baseline Professional 2.0. Quando la sidebar è nascosta, il comando è nella testata compatta. Il servizio usa `nubemoSupabase.auth.signOut({ scope: 'local' })`, senza un secondo client né revoca delle altre sessioni. È la sola nuova operazione Auth autorizzata.
- Il comando invalida le risposte pendenti, nasconde e svuota i dati prima della chiamata. Successo: `location.replace('index.html')`. Errore/timeout: area bloccata, messaggio e pulsante Riprova logout; nessuna riapertura tramite eventi Auth o ritorno alla pagina.
- Hash e navigazione interna modificano solo la vista. `SIGNED_IN` ripetuto per l'Admin verificato non genera richieste. `TOKEN_REFRESHED`, `USER_UPDATED` e ritorno in primo piano verificano Auth/profilo senza rileggere professionisti, privacy e consensi. Gli eventi concomitanti sono accorpati e i task in corso riutilizzati; nessun polling.
- `pagehide` elimina i dati dalla presentazione; `pageshow` persistito li ricostruisce solo dopo verifica. Cambi di identità, logout e revoca invalidano i risultati tardivi.

### Verifiche delle correzioni

- 28 test Node: precedente suite e regressioni di logout, timeout, retry, doppio click, cambi di identità, hash, eventi Auth concomitanti, ritorno e BFCache.
- 7 test Playwright con Chromium 153 già disponibile, server temporaneo su origine `127.0.0.1` con porta assegnata e contesto nuovo. Verificati controller Service Worker nullo, zero registrazioni, 404 per vecchio Admin e `sw.js`; nessuna registrazione/disregistrazione del worker.
- SDK controllato nei test browser, con `config.js` e `supabase-client.js` inalterati: una sola creazione del client. Rete esterna bloccata; nessuna chiamata Auth o dati al progetto reale.
- Cascata CSS effettiva: retry visibile solo per errore elenco/privacy e `hidden:true, display:none` dopo successo. Controllati anche gate, comandi e viste con `hidden`.
- Contatori delle chiamate: nessuna richiesta durante navigazione/ricerca/filtri; sola verifica Auth/profilo alla ripresa e al rinnovo del token.
- Logout nel browser con risposte controllate: occultamento immediato, cancellazione righe, errore, retry, redirect e ritorno indietro. Eventi BFCache verificati anche tramite PageTransitionEvent; non equivalgono a collaudo su tutte le politiche BFCache dei dispositivi reali.
- Responsive: 320, 375, 720, 768, 1024, 1280 e 1920 px, controllo overflow e hidden sulle quattro viste, logout accessibile e dialogo contenuto nel viewport. Screenshot desktop/tablet/smartphone ispezionati. A 768 px portrait resta il comportamento della baseline: sidebar e nav mobile nascoste; il test della vista usa l'hash, senza modificarne il layout.
- Sintassi JS e `git diff --check`.

Esecuzione browser senza installazioni:

```sh
ADMIN2_BROWSER_PATH=/percorso/chromium \
PLAYWRIGHT_MODULE_PATH=/percorso/playwright \
node --test tests/admin2-browser.test.cjs
```

I test browser non eseguono il vero logout dell'account Admin del progetto. Resta da ripetere manualmente sul DEV il percorso con SDK/CDN e sessione reale, verificando logout/errore di rete e ritorno indietro nei browser dei dispositivi usati. Il login precedente, i file condivisi, il Service Worker e il backend sono invariati.

Nessuna attività della seconda tranche è autorizzata da questa implementazione.
