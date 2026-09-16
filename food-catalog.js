// Catalogo condiviso: dati Supabase, nessun archivio alimenti incorporato.
(() => {
  'use strict';
  const normalize = value => String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const columns = 'source,source_code,source_version,name,normalized_name,names,source_order,kcal_100g,nubemo_portion_kcal,nubemo_generic_units,crea_portion_g,crea_portion_kcal';
  const pageSize = 500;
  let catalog = null;
  let pending = null;

  function build(rows) {
    const nubemo = [];
    const crea = new Map();
    const codes = new Set();
    const orders = new Set();
    const versions = new Map();
    for (const input of rows) {
      const row = { ...input };
      // Postgres numeric può essere serializzato come numero o stringa decimale.
      for (const field of ['kcal_100g', 'nubemo_portion_kcal', 'crea_portion_g', 'crea_portion_kcal']) {
        if (typeof row[field] === 'string' && /^\d+(?:\.\d+)?$/.test(row[field])) row[field] = Number(row[field]);
      }
      const key = `${row.source}:${row.source_code}`;
      const order = `${row.source}:${row.source_order}`;
      if (!['CREA', 'NUBEMO'].includes(row.source) || codes.has(key) || orders.has(order)
          || !row.source_code || !row.source_version || !Number.isInteger(row.source_order)
          || row.source_order < 0 || !row.name || row.normalized_name !== normalize(row.name)
          || !Array.isArray(row.names) || row.names[0] !== row.name
          || row.names.some(name => typeof name !== 'string' || !name.trim())) {
        throw new Error('Catalogo alimenti non valido.');
      }
      codes.add(key);
      orders.add(order);
      if (versions.has(row.source) && versions.get(row.source) !== row.source_version) {
        throw new Error('Versioni del catalogo alimenti non coerenti.');
      }
      versions.set(row.source, row.source_version);
      const food = { names: Object.freeze([...row.names]), source: row.source,
        sourceCode: row.source_code, sourceVersion: row.source_version };
      for (const field of ['kcal_100g', 'nubemo_portion_kcal', 'crea_portion_g', 'crea_portion_kcal']) {
        if (row[field] !== null && (!Number.isFinite(row[field]) || row[field] < 0)) {
          throw new Error('Valori del catalogo alimenti non validi.');
        }
      }
      if (row.kcal_100g !== null) food.k100 = row.kcal_100g;
      if (row.source === 'NUBEMO') {
        if (row.nubemo_portion_kcal !== null) food.portionKcal = row.nubemo_portion_kcal;
        if (row.nubemo_generic_units !== null) {
          if (typeof row.nubemo_generic_units !== 'object' || Array.isArray(row.nubemo_generic_units)) {
            throw new Error('Conversioni del catalogo alimenti non valide.');
          }
          food.generic = Object.freeze({ ...row.nubemo_generic_units });
        }
        nubemo.push(Object.freeze(food));
      } else {
        // Una porzione CREA non equivale automaticamente a un pezzo/fetta/vasetto.
        // Restano metadati distinti; il parser originale non viene modificato.
        food.creaPortionGrams = row.crea_portion_g;
        food.creaPortionKcal = row.crea_portion_kcal;
        food.names = Object.freeze([row.normalized_name]);
        const matches = crea.get(row.normalized_name) || [];
        matches.push(Object.freeze(food));
        crea.set(row.normalized_name, matches);
      }
    }
    if (!nubemo.length || !crea.size) throw new Error('Catalogo alimenti incompleto.');
    return { nubemo: Object.freeze(nubemo), crea };
  }

  async function load(client) {
    if (catalog) return;
    if (pending) return pending;
    pending = (async () => {
      const rows = [];
      let total = null;
      do {
        const { data, error, count } = await client.from('food_catalog')
          .select(columns, { count: 'exact' }).eq('is_active', true)
          .order('source').order('source_order').order('source_code')
          .range(rows.length, rows.length + pageSize - 1);
        if (error || !Array.isArray(data) || !Number.isInteger(count) || count <= 0
            || (total !== null && count !== total) || !data.length
            || rows.length + data.length > count) {
          throw new Error('Impossibile caricare il catalogo alimenti completo. Riprova ad accedere.');
        }
        total = count;
        rows.push(...data);
      } while (rows.length < total);
      // Pubblicazione atomica: nessun calcolo può usare una pagina parziale.
      catalog = build(rows);
    })();
    try { await pending; } finally { pending = null; }
  }

  function requireCatalog() {
    if (!catalog) throw new Error('Catalogo alimenti non ancora disponibile.');
    return catalog;
  }

  const number = '\\d+(?:[.,]\\d+)?';
  const units = 'g|gr|grammi|ml|fetta|fette|cucchiaino|cucchiaini|cucchiaio|cucchiai|vasetto|vasetti|porzione|porzioni|pezzo|pezzi|bicchiere|bicchieri|bottiglia|bottiglie|lattina|lattine|biscotto|biscotti|tazzina|tazzine|tazza|tazze';
  const leadingUnit = new RegExp(`^${number}\\s*(?:${units})\\b\\s*(?:di\\s+)?(.+)$`);
  const trailingUnit = new RegExp(`^(.+?)\\s+${number}\\s*(?:${units})\\b$`);
  const leadingCount = new RegExp(`^${number}\\s+(?:di\\s+)?(.+)$`);

  function findCrea(segment) {
    const { crea } = requireCatalog();
    const text = normalize(segment);
    const candidates = new Set([text]);
    for (const pattern of [leadingUnit, trailingUnit, leadingCount]) {
      const match = text.match(pattern);
      if (match) candidates.add(match[1].trim());
    }
    const found = new Map();
    for (const name of candidates) {
      for (const food of crea.get(name) || []) found.set(food.sourceCode, { ...food,
        matchedName: name, matchIndex: text.indexOf(name) });
    }
    // Nomi ufficiali completi soltanto, senza sinonimi, substring o fuzzy matching.
    return found.size === 1 ? found.values().next().value : null;
  }

  function canUseCrea(segment, crea, nubemo) {
    // La scelta della fonte precede il parser originale e ne conserva le unità.
    // Senza una quantità utilizzabile da CREA resta l'intero record NUBEMO.
    if (!crea.k100) return false;
    const text = normalize(segment);
    const precise = text.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grammi|ml)\b/i);
    if (precise) {
      const quantity = Number(precise[1].replace(',', '.'));
      return Number.isFinite(quantity) && quantity > 0;
    }
    if (new RegExp(`${number}\\s*(?:${units})\\b`).test(text)) return false;
    const count = text.match(/^(\d+(?:[.,]\d+)?)\s+(?:di\s+)?/i);
    if (count && !/\b(g|gr|grammi|ml)\b/i.test(text)) {
      const quantity = Number(count[1].replace(',', '.'));
      // Il parser tratta 10 come porzioni se NUBEMO possiede portionKcal,
      // altrimenti le quantità >= 10 sono già interpretate come grammi.
      if (Number.isInteger(quantity) && quantity > 0 && quantity <= 10 && nubemo?.portionKcal) return false;
      return Number.isFinite(quantity) && quantity >= 10;
    }
    return false;
  }

  window.nubemoFoodCatalog = Object.freeze({ load, findCrea, canUseCrea,
    get nubemoFoods() { return requireCatalog().nubemo; }
  });
})();
