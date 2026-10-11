const test = require('node:test');
const assert = require('node:assert/strict');
let check;
test.before(async () => ({checkPatientCapacity: check} = await import('../supabase/functions/swift-endpoint/patient-capacity.mjs')));
const db = (data, error = null) => ({rpc: async () => ({data, error})});
test('conteggio Admin 2.0 deduplicato: 10 pazienti a limite', async () => {
  const res = await check(db(Array.from({length:10},(_,i)=>({patient_id:String(i)}))), 'pro', {active_patient_limit:10});
  assert.equal(res.status,409);
});
test('percorso attivo incluso dal contratto SQL', async () => {
  const res = await check(db([{patient_id:'p1'},{patient_id:'p2'}]), 'pro', {active_patient_limit:2});
  assert.equal(res.status,409);
});
test('limite non configurato: stop prima di invitare', async () => {
  assert.equal((await check(db([]),'pro',null)).status,409);
  assert.equal((await check(db([]),'pro',{active_patient_limit:null})).status,409);
});
test('posto disponibile', async () => {
  assert.equal((await check(db([{patient_id:'p1'}]),'pro',{active_patient_limit:2})).ok,true);
});
test('errore RPC non mascherato da fallback', async () => {
  assert.equal((await check(db(null,{code:'42501'}),'pro',{active_patient_limit:10})).status,500);
});
test('fallback solo se RPC assente prima della migrazione', async () => {
  const legacy={rpc:async()=>({error:{code:'PGRST202'}}),
    from:()=>({select:()=>({eq:()=>({eq:async()=>({count:10,error:null})})})})};
  assert.equal((await check(legacy,'pro',{active_patient_limit:10})).status,409);
  assert.equal((await check(legacy,'pro',null)).ok,true);
});
