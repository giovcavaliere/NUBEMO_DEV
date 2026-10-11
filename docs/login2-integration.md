# Accesso dedicato NUBEMO 2.0

Repository `giovcavaliere/NUBEMO_DEV`, branch `nubemo-2.0`.
Base: `a541e01ceb9d9e9e1686002f398c2c70d2cc23e6`.
Progetto esistente: `NUBEMO_DEV` (`bggvwwjwzfskabgkynwp`).

## Analisi e perimetro

`index.html` usa già la grafica Warm Human di `login-v2.css`. Il vecchio `auth.js` usa `nubemoSupabase`, verifica l'utente server e il profilo DB, richiede stato attivo e indirizza Admin a `admin.html`; Professionista/Paziente passano anche dal gate privacy precedente. Il client condiviso conserva le sessioni tramite cookie `nubemo-auth-*`, con refresh gestito dall'SDK.

`index2.html` riutilizza quel CSS e gli stessi asset, senza manifest, script della vecchia autenticazione o Service Worker. `auth-v2.css` contiene soltanto il nuovo controllo password statico; non usa `password-visibility.js`, che inietta stili e manipola il DOM. Nessuna modifica ai CSS condivisi.

`auth-v2.js` contiene i servizi senza DOM: login password, utente server, verifica profilo e logout locale tramite il singleton esistente. `login-v2-app.js` coordina form, errori, stati e navigazione. Nessuna nuova persistenza o inizializzazione del client.

Autorizzazione: identità Auth server, `profiles.auth_user_id` corrispondente, `status='active'`, ruolo riconosciuto. I metadati modificabili dell'utente non autorizzano l'accesso. La password viene cancellata prima del redirect e negli errori/uscita dalla pagina. I risultati tardivi invalidati non navigano.

| Ruolo | Percorso verificato | Esito dal nuovo login |
|---|---|---|
| Admin | `admin2.html`, guard reale in `admin-v2/admin-services.js` | Redirect dopo verifica, seguito dalla verifica della pagina Admin |
| Professionista | `professional2.html` assente. `pro2.html` presente con `pro2-auth.js`, ma redirect verso `index.html`, `admin.html`, `patient.html`, `privacy.html` | Area 2.0 non ancora disponibile; nessun redirect automatico o accesso a un altro percorso |
| Paziente | `patient2.html` usa `home-demo.js`, `profile-demo.js`, altri script demo; nessun guard Auth reale | Area 2.0 non ancora disponibile; nessun accesso alla demo |

Le aree non disponibili non vengono abilitate aggirando i consensi: non vi si concede accesso e non si avvia il vecchio gate privacy. Il pulsante Esci termina la sessione corrente.

Il recupero password resta esplicitamente disabilitato nella nuova pagina: il percorso attuale `set-password.html` appartiene al flusso precedente. Non si inviano email di recupero né si implementa un percorso aggiuntivo. Il comando e la spiegazione restano coerenti con il layout approvato.

## Collegamento Admin

Link al login e logout puntano a `index2.html`. Gli errori Auth che identificano una sessione assente/scaduta reindirizzano al nuovo login dopo aver nascosto e svuotato i dati. Ruolo/stato non autorizzati restano bloccati nel gate; non vengono confusi con un guasto di rete. Il guard continua a verificare Auth e profilo prima del primo rendering.

`SIGNED_OUT` esterno chiude i dati e torna a `index2.html`; l'uscita richiesta dall'Admin conserva la propria gestione di errore/retry. `pagehide`, BFCache e risposte tardive restano protetti. Non si modifica la navigazione tra le sezioni o la lettura dei dati Admin.

## Verifiche eseguite

- 35 test Node: 28 regressioni Admin e 7 test Auth 2.0. Validazione input, credenziali errate, stato/ruolo/identità, sessione assente/scaduta, rete, timeout, logout locale e separazione delle responsabilità.
- 16 test Chromium: 7 regressioni Admin con SDK controllato e 9 test del nuovo login con SDK Supabase UMD reale **2.117.3** e tutte le richieste Auth/REST/Edge intercettate. Nessuna richiesta al progetto reale.
- Login Admin → `admin2.html`, cookie condivisi, nessun `localStorage`, una sola creazione del client per pagina, ripristino della sessione già presente.
- Credenziali errate e autorizzazioni negative, nessuna navigazione prematura/vecchio redirect. Professionista/Paziente vedono lo stato esplicito e restano bloccati anche aprendo direttamente Admin.
- Logout → `index2.html`, cancellazione dei cookie di sessione, errore/retry e Browser Back senza contenuti Admin. Logout con scope `local` verificato nelle richieste dell'SDK reale.
- Login precedente: credenziali errate e redirect Admin originario a `admin.html` invariati, con risposte controllate.
- Nuovo login e stato di indisponibilità a 320, 375, 720, 768, 1024, 1280 e 1920 px; niente overflow orizzontale, form/logout accessibili, password toggle e `hidden` corretti. Screenshot desktop/tablet/smartphone ispezionati.
- Origine locale dedicata, contesto browser nuovo: controller Service Worker nullo, zero registrazioni, `sw.js` non servito. Nessuna registrazione/disregistrazione automatica.
- Controlli di sintassi e `git diff --check`. Il tree del commit preserva tutti i file protetti e i percorsi Professionista/Paziente.

Esecuzione con dipendenze esistenti, senza installare browser:

```sh
node --test tests/admin2-read.test.cjs tests/auth-v2-read.test.cjs
ADMIN2_BROWSER_PATH=/percorso/chromium \
PLAYWRIGHT_MODULE_PATH=/percorso/playwright \
node --test tests/admin2-browser.test.cjs
SUPABASE_UMD_PATH=/percorso/supabase-js-2.117.3.js \
ADMIN2_BROWSER_PATH=/percorso/chromium \
PLAYWRIGHT_MODULE_PATH=/percorso/playwright \
node --test tests/auth-v2-browser.test.cjs
```

Il file UMD può essere ottenuto dall'URL CDN già usato dall'app, fissato per riprodurre il test: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js`. Non viene committato o sostituito nell'app.

## Verifiche manuali ancora necessarie

Non sono disponibili credenziali Admin per eseguire un login contro il vero progetto. I test con SDK reale e risposte intercettate non costituiscono un login reale al backend.

Sul DEV con browser/origine di test senza worker:

1. Aprire `index2.html`, effettuare il login con l'Admin esistente e verificare `admin2.html`.
2. Ripetere con credenziali errate, poi riaprire `index2.html` con sessione Admin già presente.
3. Logout, ritorno a `index2.html`, Back e refresh: dati Admin non visibili senza nuova verifica.
4. Verificare rete/SDK/CDN e cookie sui dispositivi reali usati per il collaudo; ripetere logout/errori su tablet e smartphone.

Non creare utenti o cambiare dati per collaudare gli altri ruoli: le risposte controllate coprono le autorizzazioni negative e le aree indisponibili.

`index.html`, `auth.js`, vecchia Admin, `privacy.js`, `sw.js`, `config.js`, `supabase-client.js`, backend e dati sono invariati. Nessuna ulteriore integrazione o seconda tranche Admin.
