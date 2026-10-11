// Controllo preventivo per create-patient. Il trigger SQL resta la fonte definitiva
// per transazioni concorrenti; qui evitiamo inviti Auth quando la capienza è esaurita.
export async function checkPatientCapacity(db, professionalId, settings) {
  const result = await db.rpc('admin2_active_patient_ids', { p_professional: professionalId });
  if (!result.error) {
    if (!Array.isArray(result.data)) return { ok: false, status: 500, error: 'Impossibile verificare il numero di pazienti' };
    const assigned = settings?.active_patient_limit;
    if (!Number.isInteger(assigned) || assigned < 1) {
      return { ok: false, status: 409, error: 'Limite pazienti non configurato: contatta l’amministratore' };
    }
    const count = new Set(result.data.map(row => row?.patient_id)).size;
    return count >= assigned
      ? { ok: false, status: 409, error: `Limite di ${assigned} pazienti attivi raggiunto` }
      : { ok: true };
  }
  // Prima della migrazione Admin 2.0, questa RPC non esiste.
  if (!['42883', 'PGRST202'].includes(result.error.code)) {
    return { ok: false, status: 500, error: 'Impossibile verificare il numero di pazienti' };
  }
  const oldLimit = settings?.active_patient_limit ?? null;
  if (oldLimit === null) return { ok: true }; // Solo contratto legacy.
  const { count, error } = await db.from('professional_patients')
    .select('id', { count: 'exact', head: true }).eq('professional_id', professionalId).eq('status', 'active');
  if (error) return { ok: false, status: 500, error: 'Impossibile verificare il numero di pazienti' };
  return (count ?? 0) >= oldLimit
    ? { ok: false, status: 409, error: `Limite di ${oldLimit} pazienti attivi raggiunto` }
    : { ok: true };
}
