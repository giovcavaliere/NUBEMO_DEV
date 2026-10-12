# Invito professionisti 2.0 — Warm Human

## Stato della consegna

Restyling sul solo branch `nubemo-2.0`, base `345d08f9914dba2db6ca262ffecd478c6f8e3968`. Nessuna modifica a Edge Functions, database, client/sessioni condivisi, login, produzione o asset.

La pagina `set-password2.html` riutilizza integralmente `login-v2.css`, `auth-v2.css` e gli asset approvati del login: brand PNG, icone e colazione WebP. Nessun nuovo CSS. Il controllo visibilità precedente iniettava regole con !important e MutationObserver: non viene più caricato da questa pagina. `set-password2-view.js` gestisce soltanto i due controlli statici già stilizzati da auth-v2.css, senza chiamate Auth o manipolazioni degli stili.

`set-password2.js` cambia esclusivamente tre testi: etichette Attiva account/Attivazione e messaggio del link scaduto. Restano identici marker del redirect, sessione tramite client condiviso, attesa Auth, minimo 8 caratteri, confronto password, getUser, updateUser, pulizia dei campi, signOut e ritorno a index2. Non è stato riscritto il flusso Auth.

## Redirect e configurazione verificati

La funzione `swift-endpoint` distribuita sul progetto DEV `bggvwwjwzfskabgkynwp`, versione 13, usa già `https://nubemo-pro-2.pages.dev/set-password2.html` per i professionisti. Il redirect condiviso precedente verso set-password.html resta presente per gli altri flussi. Non sono stati modificati entrambi.

`config.js` configura esclusivamente `https://bggvwwjwzfskabgkynwp.supabase.co`. La nuova pagina usa il client singleton esistente con cookie storage e detectSessionInUrl, senza nuove chiavi/sessioni. Conserva la cattura di search/hash prima dell'inizializzazione SDK; i pulsanti finale e link scaduto usano `location.replace('index2.html')`.

## Template email: preparato, NON applicato

Il sistema di invito esistente usa `auth.admin.inviteUserByEmail`; il template pertinente è **Invite user**, non Confirm signup, Recovery o Magic Link. Il file completo preparato è `supabase/templates/invite.html`. Il vecchio file root `invite.html` è lasciato invariato e non è la sorgente di questa consegna.

Non è stato possibile leggere il corpo/oggetto effettivamente salvato nella dashboard: gli strumenti Supabase disponibili non espongono la configurazione template/Auth. La copia nel repository non prova che sia già applicata al progetto ospitato. Anche Site URL, allowlist redirect e configurazione SMTP correnti non sono stati letti o modificati. Non occorre cambiare URL per questo restyling; il percorso professionisti già distribuito viene conservato.

Variabili conservate: `{{ .ConfirmationURL }}` nel solo pulsante, `{{ .Data.first_name }}`, condizione `{{ if eq .Data.intended_role "professional" }}` e `{{ .Email }}`. La descrizione richiesta è nel ramo professionista; il ramo generico esistente è mantenuto per gli altri inviti DEV. Non si costruisce un nuovo link con token_hash, SiteURL o RedirectTo e non si sostituisce il link Auth con una pagina statica.

Il template usa tabelle di presentazione, stili inline, font di sistema/Georgia, colori solidi, PNG approvato e wrapper condizionale MSO. Non dipende da CSS esterno, grid/flex, WebP o JavaScript. I client meno recenti possono ignorare angoli arrotondati, conservando contenuto e pulsante. L'immagine `https://nubemo-pro-2.pages.dev/assets/nubemo-brand-clean-v2.png` restituisce HTTP 200 image/png; nome NUBEMO e CTA restano leggibili se le immagini sono bloccate.

## Passaggio manuale DEV

1. Aprire [Authentication → Email Templates](https://supabase.com/dashboard/project/bggvwwjwzfskabgkynwp/auth/templates), controllando il progetto **NUBEMO_DEV / bggvwwjwzfskabgkynwp**.
2. Selezionare **Invite user** e conservare una copia di oggetto/corpo correnti.
3. Impostare l'oggetto **Benvenuto in NUBEMO — attiva il tuo account**.
4. Incollare l'intero file `supabase/templates/invite.html` nel corpo del template. Verificare il link `{{ .ConfirmationURL }}` e salvare solo su questo progetto DEV. Nessuna modifica URL, SMTP, database o template produzione è inclusa.
5. Verificare l'anteprima della dashboard senza inviare email. Il template è condiviso tra tutti gli inviti del progetto: mantenere la condizione per il ruolo. Se la dashboard non consente il salvataggio, fermarsi e segnalare il blocco; non cambiare SMTP o piano. Il changelog Supabase del 3 giugno 2026 segnala restrizioni di personalizzazione per nuovi progetti Free con SMTP predefinito; la configurazione effettiva di questo DEV non è stata letta.
6. Solo dopo collaudo grafico e separata autorizzazione al reinvio, provare una vera email professionista, apertura link, password, logout e accesso da index2. Non sono stati creati o reinviati inviti in questa esecuzione.

## Test e limiti

8 test Chromium 153 con SDK Supabase reale 2.117.3 e API intercettate: caricamento/verifica, password breve/non coincidenti, errore Auth, successo, pulizia campi/signOut/index2, link assente/scaduto/senza sessione, entrambi i toggle, hidden, assenza CSS dinamico, singleton DEV e nessun worker. Viewport pagina 320/375/620/768/980/1024/1280/1920; due colonne oltre 980 px, layout verticale tablet/mobile, nessun overflow in form e successo. Anteprima email a 320/768/1920 px, variabili e contenuti professionista verificati. Screenshot desktop/mobile/email esaminati.

Le richieste Auth sono intercettate soltanto per l'host DEV; qualsiasi altro host è bloccato. Origine locale dedicata, nuovo contesto browser, sw.js non servito, zero registrazioni/controller Service Worker. Nessuna registrazione/disregistrazione o strategia di cache introdotta.

Restano da verificare manualmente: template salvato nella dashboard, rendering reale Gmail/Outlook/Apple Mail e immagini bloccate, consegna email e apertura del link reale. L'anteprima Chromium non equivale al collaudo nei client email. Il reinvio richiede separata autorizzazione.

Comando:

```sh
ADMIN2_BROWSER_PATH=/percorso/chromium SUPABASE_UMD_PATH=/percorso/supabase-js.js node --test tests/set-password2-browser.test.cjs
```

Richiede Playwright tramite `PLAYWRIGHT_MODULE_PATH` o `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. Il test non installa browser né invia email.

Riferimento ufficiale: [template per progetti Supabase ospitati](https://supabase.com/docs/guides/local-development/customizing-email-templates), da copiare nella dashboard; il commit del file non applica configurazione Auth al progetto.

## File

`set-password2.html`, `set-password2.js`, `set-password2-view.js`, `supabase/templates/invite.html`, `tests/set-password2-browser.test.cjs`, `docs/invite2-warm-human.md`. Tutti gli altri blob devono restare invariati rispetto alla base indicata.
