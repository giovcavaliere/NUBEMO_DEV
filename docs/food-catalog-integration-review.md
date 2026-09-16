# Collegamento catalogo alimenti — verifica del 12 settembre 2026

## Stato

Versione candidata al rilascio. Branch di lavoro: `recovery/398-supabase-preserved`, commit di partenza `1a2be4b993a3aba7c1b200c906fa90a9bd7e5bb3`. Nessuna modifica a `main`.

Supabase NUBEMO_DEV (`bggvwwjwzfskabgkynwp`): lettura confermata di 952 record NUBEMO e 832 CREA. Tutti attivati dopo la conferma della regola di fallback sulle quantità. L’attivazione ha modificato esclusivamente `is_active`; confronto del contenuto completo prima/dopo identico. Schema, RLS e account non modificati. Lettura verificata nel database con ruolo `authenticated` e profili attivi paziente/professionista/admin: 1.784 righe ciascuno; senza profilo: zero. `anon` senza SELECT; `authenticated` con solo SELECT.

## Implementazione preparata

- `food-catalog.js` carica i record attivi tramite il client autenticato esistente, con pagine da 500, ordinamento deterministico e conteggio esatto. Rifiuta dati parziali, versioni miste, duplicati e assenza di una fonte. Pubblica il catalogo in memoria solo a caricamento completo.
- Gli archivi statici sono rimossi da `app.js` e `pro.js`: 40.574 byte in meno per file. Non si tratta della maggior parte del peso di `pro.js`, che resta circa 3,69 MB.
- Il caricamento precede l'avvio di ciascuna applicazione. Il catalogo non entra nella cache del service worker; gli asset modificati hanno nuove versioni.
- La ricerca CREA accetta soltanto il nome ufficiale completo normalizzato per maiuscole, accenti e spazi, eventualmente preceduto/seguito da quantità riconosciute. Qualificatori di cottura, percentuali e punteggiatura restano distinti. Nessun abbinamento approssimativo o associazione di sinonimi a CREA.
- La ricerca NUBEMO e le funzioni di calcolo sono preservate. I metadati distinguono fonte e codice. Le porzioni CREA non sono convertite arbitrariamente in pezzi, fette o vasetti.

## Verifiche eseguite

- Confronto integrale dei 952 record NUBEMO letti dal database con gli archivi del commit di riferimento: campi, omissioni, valori e ordine di alimenti/alias identici.
- 9.320 confronti per Area Paziente e 9.320 per Area Professionista, su tutti i 1.165 alias e otto forme di quantità: nessuna differenza quando la fonte selezionata resta NUBEMO.
- Funzioni di calcolo confrontate testualmente: invariate.
- Tutti gli 832 nomi ufficiali CREA verificati con cinque forme di scrittura/quantità; prove negative per qualificatori aggiunti e prova di ambiguità tramite duplicato sintetico.
- Verificati caricamento multipagina, attesa prima dell'uso, errori a metà caricamento, pagina vuota, conteggio variabile, catalogo vuoto, fonte mancante, versione mista, duplicati e ripetizione dopo errore.
- Sintassi JavaScript e `git diff --check`: superati.
- Nessuna prova effettuata con login reale nel browser né su iPhone. Il caricamento applicativo è stato provato con risposte simulate costruite dai record effettivamente letti dal database; non equivale a un collaudo autenticato della Data API.

## Problema rilevato e risolto

La priorità CREA applicata a ogni nome corrispondente può far perdere le conversioni domestiche presenti soltanto in NUBEMO. Su entrambe le aree:

| Test | Versione attuale | Priorità CREA rigida |
| --- | --- | --- |
| `1 succo di frutta` | 90 kcal | Quantità mancante, senza stima |
| `2 succo di frutta` | 180 kcal | Quantità mancante, senza stima |
| `2 fette pane di segale` | 155 kcal | Conversione non disponibile, senza stima |
| `10 succo di frutta` | 900 kcal, 10 porzioni | 6 kcal, interpretazione di 10 g |

Questi valori descrivono il comportamento software osservato, non una validazione nutrizionale delle vecchie stime. Sono quattro casi distinti nei test eseguiti, non un elenco esaustivo di tutte le possibili frasi.

Dopo il fallback approvato, tutti e quattro i casi tornano identici alla versione attuale in entrambe le aree. Nessuna perdita di stima o cambio di unità nei 18.640 casi eseguiti. Verificate inoltre tutte le 24 unità domestiche riconosciute dal parser e la priorità CREA per grammi/ml espliciti. Il test fallisce se ricompaiono regressioni.

## Regola confermata e implementata

Usare CREA quando il nome è certo e la quantità è utilizzabile: grammi/ml espliciti oppure un numero iniziale >= 10 che il parser originale interpreta già come grammi. Se quel numero indica invece porzioni nel record NUBEMO (caso 10), mantenere NUBEMO. Per quantità domestiche, pezzi o quantità non specificata usare il record NUBEMO completo, anche quando il nome esiste in CREA. Nessuna mescolanza silenziosa fra kcal CREA e conversioni di un prodotto NUBEMO diverso.

Estensione del fallback confermata dall’utente: «dato che la quantità non è definita, utilizza nubemo». Nessuna richiesta di grammi aggiunta all’interfaccia. Il significato di “porzione CREA” rimane distinto da quello di “pezzo”.

## Riproduzione

Da questa directory repository:

```sh
node tests/food-catalog.test.cjs /percorso/catalog-readback.json
```

Il comando verifica la parità del fallback e blocca la pubblicazione se riappaiono regressioni. Il JSON di input deve essere l'array di righe restituito, tramite accesso tecnico autorizzato, da:

```sql
select source, source_code, source_version, name, normalized_name, names,
       source_order, kcal_100g, nubemo_portion_kcal, nubemo_generic_units,
       crea_portion_g, crea_portion_kcal, is_active
from public.food_catalog
order by source, source_order, id;
```

Il collaudo automatico aggiornato è superato e l’attivazione controllata è completata. Resta da eseguire il collaudo utente autenticato nel browser e su iPhone. Per un rollback del frontend ripristinare i file del commit di riferimento su questo stesso branch, senza riscrivere la cronologia: quel frontend non legge food_catalog, quindi non occorre cancellare i dati importati.
