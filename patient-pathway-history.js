// NUBEMO — storico percorsi Area Paziente.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const app = document.getElementById('app');
  if (!client || !app) return;

  let pathways = [];
  let loaded = false;
  let loadingPromise = null;
  let observer = null;
  let patching = false;

  const esc = (value='') => String(value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  const fmtDate = value => {
    if (!value) return '—';
    const raw = String(value);
    const d = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('it-IT');
  };

  async function loadPathways() {
    if (loaded) return pathways;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      const {data,error} = await client.rpc('get_current_patient_pathways');
      if (error) throw error;
      pathways = Array.isArray(data) ? data : [];
      loaded = true;
      return pathways;
    })().finally(() => { loadingPromise = null; });
    return loadingPromise;
  }

  function summaryRow(label, value) {
    return `<div style="display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid #edf1f2"><span class="muted">${esc(label)}</span><b style="text-align:right">${esc(value ?? '—')}</b></div>`;
  }

  function diaryContent(diary) {
    if (!diary.length) return '<p class="muted" style="margin:0">Nessuna giornata registrata.</p>';
    const rows = [...diary].sort((a,b) => String(b.entry_date || '').localeCompare(String(a.entry_date || '')));
    return `<div style="max-height:320px;overflow:auto;border:1px solid #e2e9e6;border-radius:12px">
      <table style="width:100%;border-collapse:collapse;min-width:520px">
        <thead style="position:sticky;top:0;background:#f8fbf9;z-index:1"><tr><th style="text-align:left;padding:10px 12px">Data</th><th style="text-align:left;padding:10px 12px">Peso</th><th style="text-align:left;padding:10px 12px">Acqua</th><th style="text-align:left;padding:10px 12px">Kcal</th></tr></thead>
        <tbody>${rows.map(d => `<tr><td style="padding:10px 12px;border-top:1px solid #edf1f2">${fmtDate(d.entry_date)}</td><td style="padding:10px 12px;border-top:1px solid #edf1f2">${d.weight_kg != null ? `${esc(d.weight_kg)} kg` : '—'}</td><td style="padding:10px 12px;border-top:1px solid #edf1f2">${d.water != null ? `${esc(d.water)} L` : '—'}</td><td style="padding:10px 12px;border-top:1px solid #edf1f2">${d.total_kcal != null ? esc(d.total_kcal) : '—'}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  function documentsContent(docs) {
    if (!docs.length) return '<p class="muted" style="margin:0">Nessun piano alimentare disponibile per questo percorso.</p>';
    const rows = [...docs].sort((a,b) => String(b.document_date || b.created_at || '').localeCompare(String(a.document_date || a.created_at || '')));
    return `<div style="display:grid;gap:8px">${rows.map(doc => `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 12px;border:1px solid #e4ebe8;border-radius:12px;background:#fbfdfc"><div style="min-width:0"><div style="font-weight:700;color:#2d4741;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(doc.title || doc.original_filename || 'Piano alimentare')}</div><div class="muted" style="margin-top:2px;font-size:12px">${fmtDate(doc.document_date || doc.created_at)}${doc.original_filename ? ` · ${esc(doc.original_filename)}` : ''}</div></div><button class="secondary compact" style="flex:0 0 auto;white-space:nowrap" type="button" data-open-patient-history-document="${esc(doc.id)}">Apri</button></div>`).join('')}</div>`;
  }

  async function openDocument(doc) {
    if (!doc?.storage_path) throw new Error('Piano alimentare non disponibile.');
    const url = await window.nubemoPatientServices?.openDocument?.(doc);
    if (!url) throw new Error('Piano alimentare non disponibile.');
    window.location.href = url;
  }

  async function openSnapshot(pathwayId) {
    const {data,error} = await client.rpc('get_current_patient_pathway_snapshot', {p_pathway_id:pathwayId});
    if (error) throw error;

    const p = data?.pathway || {};
    const diary = Array.isArray(data?.diary) ? data.diary : [];
    const docs = Array.isArray(data?.documents) ? data.documents : [];
    const orderedDiary = [...diary].sort((a,b) => String(a.entry_date || '').localeCompare(String(b.entry_date || '')));
    const firstWeight = orderedDiary.find(row => row?.weight_kg != null)?.weight_kg;
    const lastWeight = [...orderedDiary].reverse().find(row => row?.weight_kg != null)?.weight_kg;
    const docsById = new Map(docs.map(doc => [String(doc.id), doc]));

    document.getElementById('nubemoPatientPathwayHistoryModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'nubemoPatientPathwayHistoryModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(4,23,20,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    modal.innerHTML = `<section class="card" style="width:min(820px,100%);margin:auto;max-height:none">
      <div class="section-head"><div><div class="eyebrow">STORICO PERCORSO</div><h2 style="margin-bottom:4px">Percorso concluso</h2><p class="muted" style="margin:0">${fmtDate(p.pathway_start_date || p.started_at)} → ${fmtDate(p.ended_at)}</p></div><button class="mini" type="button" data-close-patient-pathway-history>✕</button></div>
      <div style="margin-top:16px">${summaryRow('Stato','Terminato')}${summaryRow('Peso iniziale',firstWeight != null ? `${firstWeight} kg` : '—')}${summaryRow('Peso finale',lastWeight != null ? `${lastWeight} kg` : '—')}</div>
      <details class="card" style="margin-top:16px;padding:0;overflow:hidden"><summary style="cursor:pointer;padding:16px 18px;font-size:17px;font-weight:800;color:#213b36">Diario <span class="pill" style="margin-left:8px">${diary.length}</span></summary><div style="padding:0 18px 18px">${diaryContent(diary)}</div></details>
      <details class="card" style="margin-top:12px;padding:0;overflow:hidden"><summary style="cursor:pointer;padding:16px 18px;font-size:17px;font-weight:800;color:#213b36">Documenti <span class="pill" style="margin-left:8px">${docs.length}</span></summary><div style="padding:0 18px 18px">${documentsContent(docs)}</div></details>
      <p class="muted" style="margin-top:16px">Percorso storico in sola lettura.</p>
    </section>`;
    document.body.appendChild(modal);

    modal.querySelector('[data-close-patient-pathway-history]')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    modal.querySelectorAll('[data-open-patient-history-document]').forEach(button => button.addEventListener('click', async () => {
      const doc = docsById.get(String(button.dataset.openPatientHistoryDocument));
      button.disabled = true;
      const old = button.textContent;
      button.textContent = 'Apertura...';
      try { await openDocument(doc); }
      catch (error) { console.error('NUBEMO piano storico paziente:', error); alert(error?.message || 'Piano alimentare non disponibile.'); }
      finally { button.disabled = false; button.textContent = old; }
    }));
  }

  function pathwayCard(pathway) {
    const from = pathway.pathway_start_date || pathway.started_at;
    return `<div class="document-row" style="align-items:center"><div><b>${fmtDate(from)} → ${fmtDate(pathway.ended_at)}</b>${pathway.professional_name ? `<span>${esc(pathway.professional_name)}</span>` : ''}</div><button class="secondary compact" type="button" data-open-patient-pathway="${esc(pathway.id)}">Apri</button></div>`;
  }

  function historySection() {
    if (!pathways.length) return null;
    const section = document.createElement('section');
    section.className = 'card';
    section.id = 'nubemoPatientPathways';
    section.innerHTML = `<div class="section-head"><div><div class="eyebrow">PERCORSI</div><h2>Le tue esperienze precedenti</h2></div><span class="pill">${pathways.length}</span></div><div class="document-list">${pathways.map(pathwayCard).join('')}</div>`;
    section.querySelectorAll('[data-open-patient-pathway]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      const old = button.textContent;
      button.textContent = 'Apertura...';
      try { await openSnapshot(button.dataset.openPatientPathway); }
      catch (error) { console.error('NUBEMO storico percorso paziente:', error); alert(error?.message || 'Percorso non disponibile.'); }
      finally { button.disabled = false; button.textContent = old; }
    }));
    return section;
  }

  function patchActiveHome() {
    if (patching || !pathways.length) return;
    patching = true;
    try {
      const addButton = [...app.querySelectorAll('button')].find(button => String(button.getAttribute('onclick') || '').includes('newDay()'));
      if (!addButton) return;
      const actions = addButton.closest('.grid.actions') || addButton.parentElement;
      if (!actions) return;

      [...actions.querySelectorAll('button')].forEach(button => {
        if (String(button.getAttribute('onclick') || '').includes("go('trend')")) button.remove();
      });

      document.getElementById('nubemoPatientPathways')?.remove();
      const section = historySection();
      if (section) actions.insertAdjacentElement('afterend', section);
    } finally { patching = false; }
  }

  async function mountActive() {
    try {
      await loadPathways();
      if (!observer) {
        observer = new MutationObserver(() => queueMicrotask(patchActiveHome));
        observer.observe(app, {childList:true, subtree:true});
      }
      patchActiveHome();
    } catch (error) {
      console.error('NUBEMO storico percorsi paziente:', error);
    }
  }

  async function mountNoActive() {
    try {
      await loadPathways();
      document.getElementById('nubemoPatientPathways')?.remove();
      if (!pathways.length) return;
      const section = historySection();
      if (section) app.appendChild(section);
    } catch (error) {
      console.error('NUBEMO storico percorsi paziente:', error);
    }
  }

  window.nubemoPatientPathwayHistory = Object.freeze({mountActive, mountNoActive});
})();