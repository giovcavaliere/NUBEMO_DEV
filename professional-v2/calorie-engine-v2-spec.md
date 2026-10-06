# NUBEMO Calorie Engine v2 — specifica tecnica

## Obiettivo

Interpretare il testo libero del Diario del paziente in modo più tollerante e trasparente, mantenendo il catalogo NUBEMO/CREA come unica fonte dei valori nutrizionali.

Il motore non modifica mai il testo originale del paziente e non deve produrre precisione fittizia.

## Principi

1. Il testo del paziente è la fonte primaria e resta immutato.
2. Il motore può stimare, ma deve distinguere sempre tra dato esplicito, conversione standard, stima e informazione insufficiente.
3. Un componente non interpretabile non invalida gli altri componenti del pasto.
4. Kcal e nutrienti provengono esclusivamente dal catalogo NUBEMO/CREA.
5. Il professionista vede dati derivati in sola lettura.
6. Nessun alimento viene scartato solo perché il nome non coincide letteralmente con il nome ufficiale CREA.

## Dati già disponibili

La tabella `food_catalog` contiene:
- record NUBEMO e CREA;
- kcal/100 g;
- porzioni CREA;
- unità generiche NUBEMO;
- `source_payload` con i nutrienti CREA.

Nei record CREA, `source_payload.nutrients` contiene già, quando disponibili:
- Proteine (g);
- Lipidi (g);
- Carboidrati disponibili (g);
- fibra e altri nutrienti.

Quindi P/C/G possono essere derivati dalla fonte CREA senza ricorrere a valori generati.

## Pipeline proposta

### 1. Normalizzazione
Produce una forma comparabile senza perdere l'originale:
- lowercase;
- rimozione accenti;
- normalizzazione punteggiatura;
- spazi;
- varianti di unità (`30gr`, `30 g`, `30 grammi`);
- articoli/preposizioni non distintive.

### 2. Segmentazione
Scompone un pasto in componenti alimentari senza spezzare espressioni composte.

Separatori possibili:
- newline;
- `;`;
- `+`;
- virgole quando non fanno parte del nome alimentare;
- congiunzioni contestuali (`e`, `con`).

Esempio:
`80 g pasta al pomodoro, tonno e insalata con olive`
→ pasta al pomodoro / tonno / insalata / olive.

### 3. Food resolver
Ordine di risoluzione:
1. match esatto normalizzato;
2. alias/sinonimo esplicito;
3. nome ufficiale normalizzato senza punteggiatura;
4. match di famiglia;
5. fuzzy controllato solo sopra una soglia alta e senza collisioni pericolose.

Esempio famiglia olive:
- `olive verdi` → CREA Olive, verdi;
- `olive nere` → CREA Olive, nere;
- `olive verdi in salamoia` → CREA specifico;
- `olive` → famiglia olive, variante non specificata.

Un match di famiglia non deve fingere di conoscere la variante.

### 4. Quantity resolver
Priorità:
1. grammi/ml espliciti;
2. unità domestiche con conversione nota;
3. pezzi/porzioni con peso standard documentato;
4. quantità linguistiche (`un po'`, `qualche`, `una manciata`) solo se esiste una regola di stima;
5. nessuna quantità → alimento riconosciuto ma non calcolabile oppure porzione standard marcata come stima, secondo regola esplicita.

### 5. Nutrient calculator
Usa solo dati catalogo:
- kcal;
- proteine;
- carboidrati;
- grassi.

Per una quantità in grammi:
`valore = valore_100g * grammi / 100`.

### 6. Confidence
Confidenza per singolo componente:
- `high`: alimento specifico + quantità esplicita;
- `medium`: alimento specifico + conversione standard/porzione;
- `low`: famiglia alimentare o quantità stimata;
- `unresolved`: componente non interpretabile.

La qualità del pasto deriva dai componenti e non deve trasformare un singolo errore in fallimento totale.

## Contratto di output proposto

```js
{
  originalText: "80 g pasta + tonno + 10 olive",
  components: [
    {
      originalText: "80 g pasta",
      food: {
        source: "CREA",
        sourceCode: "...",
        label: "Pasta ...",
        matchType: "exact|alias|family|fuzzy"
      },
      quantity: {
        value: 80,
        unit: "g",
        grams: 80,
        origin: "explicit|conversion|standard|estimated"
      },
      nutrients: {
        kcal: 282,
        protein_g: 10.1,
        carbs_g: 58.0,
        fat_g: 1.2
      },
      confidence: "high"
    }
  ],
  totals: {
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0
  },
  coverage: {
    resolved: 0,
    unresolved: 0,
    total: 0
  },
  confidence: "high|medium|low|none"
}
```

## Regole UX

- Il paziente continua a scrivere il Diario come oggi.
- Il professionista non modifica il dato sorgente.
- Le stime devono mostrare `≈` quando includono quantità o varianti stimate.
- I componenti non interpretati vengono segnalati senza cancellare i valori calcolabili.
- Nessun messaggio generale "impossibile interpretare" se almeno una parte del pasto è stata calcolata.

## Criteri minimi prima della UI avanzata

Il motore v2 deve superare il benchmark con:
- 100% dei casi ad alta precisione riconosciuti senza errore di alimento;
- nessun alimento inventato nei casi volutamente ambigui;
- gestione parziale corretta dei pasti misti;
- nessun totale derivato da componenti `unresolved`;
- distinzione verificabile tra match esatto, alias/famiglia e quantità stimata.

Solo dopo questa soglia ha senso introdurre grafici professionista basati su P/C/G.
