// Estensione della funzione esistente: nessun client/session store/email provider nuovo.
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const reply = (error, status = 400, code = 'invalid_input') => Response.json({ ok: false, error, code }, { status });
const actions = new Set(['invite-professional', 'resend-professional-invite', 'suspend-professional',
  'activate-professional', 'set-professional-limit', 'set-default-patient-limit']);
const limit = value => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100000;

export function accountPermissions(row, authUser) {
  const usable = uuid(authUser?.id) && !authUser.deleted_at &&
    (!authUser.banned_until || new Date(authUser.banned_until).getTime() <= Date.now());
  return {
    account_status: !usable ? 'unavailable' : authUser.email_confirmed_at ? 'active' : 'invited',
    can_resend: usable && !authUser.email_confirmed_at && row.nubemo_status === 'active' &&
      row.professional_status === 'active' && text(row.email).toLowerCase() === text(authUser.email).toLowerCase(),
    can_suspend: row.nubemo_status === 'active' && row.professional_status === 'active',
    can_activate: usable && row.nubemo_status === 'suspended' && row.professional_status === 'active'
  };
}

export async function readManagement(ctx, actor) {
  const result = await ctx.supabaseAdmin.rpc('admin2_management_snapshot', { p_actor: actor });
  if (result.error) {
    if (result.error.code === '42501') throw Object.assign(new Error('Accesso negato'), { status: 403 });
    // La versione 11 e un deploy senza migrazione non abilitano operazioni.
    if (['PGRST202','42883'].includes(result.error.code)) return { version: 0, enabled: false, capacity: [] };
    throw new Error('Impossibile verificare la disponibilità della gestione');
  }
  if (result.data?.version !== 1 || !Array.isArray(result.data.capacity)) throw new Error('Contratto gestione non valido');
  return result.data;
}

function databaseError(error) {
  if (error?.code === '42501') return error.message === 'Admin attivo richiesto' ? reply('Accesso Admin non più autorizzato.', 403, 'forbidden') : reply('Operazione non consentita per lo stato attuale dell’account.', 409, 'ineligible');
  if (error?.code === '23505') return reply('Email già utilizzata o operazione già in corso. Aggiorna l’elenco.', 409, 'duplicate');
  if (error?.code === '40001') return reply('Lo stato è cambiato. Aggiorna l’elenco prima di riprovare.', 409, 'state_changed');
  if (error?.code === '55000') return reply('Operazione non disponibile, già in corso o da verificare.', 409, 'unavailable');
  if (['22023','22P02'].includes(error?.code)) return reply('Dati o identificatori non validi.');
  return reply('Il backend non ha confermato l’operazione. Nessuna conferma di successo.', 503, 'backend_error');
}

async function dispatchManagement(body, ctx, user, profile, redirectUrl) {
  if (!actions.has(body.action)) return null;
  if (!user?.id || profile?.role !== 'admin' || profile.status !== 'active') return reply('Accesso negato', 403, 'forbidden');
  let capability;
  try { capability = await readManagement(ctx, user.id); }
  catch (error) { return reply(error.status === 403 ? 'Accesso negato' : 'Verifica backend non disponibile', error.status || 503, 'backend_unavailable'); }
  if (capability.version !== 1 || capability.enabled !== true) return reply('Gestione professionisti non ancora disponibile.', 503, 'backend_unavailable');
  const actor = { p_actor: user.id };
  if (['set-default-patient-limit','set-professional-limit'].includes(body.action)) {
    if (!limit(body.limit) || (body.action === 'set-professional-limit' && !uuid(body.professional_id))) return reply('Limite o professionista non validi.');
    const result = await ctx.supabaseAdmin.rpc('admin2_set_limits', {
      ...actor, p_limit: body.limit, p_professional: body.action === 'set-professional-limit' ? body.professional_id : null
    });
    return result.error ? databaseError(result.error) : Response.json(result.data);
  }
  if (['suspend-professional','activate-professional'].includes(body.action)) {
    if (!uuid(body.professional_id) || (body.action === 'suspend-professional' && body.management_version === 1 && body.confirmed !== true)) return reply('Identificatore o conferma non validi.');
    const result = await ctx.supabaseAdmin.rpc('admin2_set_professional_status', {
      ...actor, p_professional: body.professional_id,
      p_expected: body.action === 'suspend-professional' ? 'active' : 'suspended',
      p_status: body.action === 'suspend-professional' ? 'suspended' : 'active'
    });
    return result.error ? databaseError(result.error) : Response.json(result.data);
  }
  const operationId = body.operation_id ?? crypto.randomUUID(); // Compatibilità callers precedenti.
  if (!uuid(operationId)) return reply('Identificatore operazione non valido.');
  let payload;
  if (body.action === 'invite-professional') {
    payload = { first_name: text(body.first_name), last_name: text(body.last_name), email: text(body.email).toLowerCase() };
    if (!payload.first_name || !payload.last_name || payload.first_name.length > 100 || payload.last_name.length > 100 ||
      payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return reply('Nome, cognome o email non validi.');
  } else {
    if (!uuid(body.professional_id)) return reply('Professionista non valido.');
    payload = { professional_id: body.professional_id };
  }
  const started = await ctx.supabaseAdmin.rpc('admin2_begin_email_operation', {
    ...actor, p_operation: operationId, p_action: body.action, p_payload: payload
  });
  if (started.error) return databaseError(started.error);
  if (started.data?.replay) {
    if (started.data.state === 'completed' && started.data.result?.ok === true) return Response.json(started.data.result);
    return reply('Richiesta già registrata: verificare l’esito prima di un nuovo invio.', 409, 'operation_pending');
  }
  const operations = () => ctx.supabaseAdmin.from('admin_professional_operations');
  const mark = async (state, result = null) => {
    const response = await operations().update({ state, result, updated_at: new Date().toISOString() })
      .eq('id', operationId).eq('actor_auth_id', user.id).eq('state', 'email_started').select('id').single();
    if (response.error || !response.data) throw new Error('Esito invio non registrato');
  };
  let emailAttempted = false;
  let resendAuthId = null;
  try {
    const claimed = await operations().update({ state: 'email_started', updated_at: new Date().toISOString() })
      .eq('id', operationId).eq('actor_auth_id', user.id).eq('state', 'started').select('id').single();
    if (claimed.error || !claimed.data) return reply('Operazione già in corso o non disponibile.', 409, 'operation_pending');
    if (body.action === 'resend-professional-invite') {
      const target = await ctx.supabaseAdmin.from('professionals')
        .select('id,status,profiles!inner(auth_user_id,role,status,email,first_name,last_name)')
        .eq('id', payload.professional_id).single();
      const linked = Array.isArray(target.data?.profiles) ? target.data.profiles[0] : target.data?.profiles;
      if (target.error || !linked || linked.role !== 'professional') throw new Error('Account non disponibile');
      const auth = await ctx.supabaseAdmin.auth.admin.getUserById(linked.auth_user_id);
      const permissions = accountPermissions({ nubemo_status: linked.status, professional_status: target.data.status, email: linked.email }, auth.data?.user);
      if (auth.error || !permissions.can_resend) { await mark('failed'); return reply('Reinvio non consentito per questo account.', 409, 'ineligible'); }
      resendAuthId = linked.auth_user_id;
      payload = { first_name: text(linked.first_name), last_name: text(linked.last_name), email: text(linked.email).toLowerCase() };
    }
    // Ricontrollo Admin/abilitazione immediatamente prima dell'effetto esterno.
    const access = await ctx.supabaseAdmin.rpc('admin2_assert_actor', { ...actor, p_write: true });
    if (access.error) { await mark('failed'); return databaseError(access.error); }
    emailAttempted = true;
    const invite = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(payload.email, {
      data: { first_name: payload.first_name, last_name: payload.last_name, intended_role: 'professional' }, redirectTo: redirectUrl
    });
    if (invite.error || !invite.data?.user?.id) {
      // Un errore email può avvenire dopo creazione Auth: non si assume rollback/consegna.
      await mark('needs_review');
      return reply('Invito non confermato dal servizio Auth/email. Verificare l’esito prima di riprovare.', 502, 'email_unconfirmed');
    }
    if (body.action === 'invite-professional') {
      const finished = await ctx.supabaseAdmin.rpc('admin2_finish_invite', {
        ...actor, p_operation: operationId, p_auth_user: invite.data.user.id
      });
      if (finished.error || finished.data?.ok !== true) {
        await mark('needs_review', { auth_user_id: invite.data.user.id });
        return reply('Invito Auth ricevuto, ma creazione NUBEMO non confermata. Verifica amministrativa necessaria.', 503, 'needs_review');
      }
      return Response.json(finished.data);
    }
    if (invite.data.user.id !== resendAuthId) {
      await mark('needs_review');
      return reply('Account restituito dal reinvio non coerente. Verifica amministrativa necessaria.', 503, 'needs_review');
    }
    const result = { ok: true, resent: true, professional_id: body.professional_id, email_status: 'accepted' };
    await mark('completed', result);
    return Response.json(result);
  } catch (_) {
    try { await mark(emailAttempted ? 'needs_review' : 'failed'); } catch (_) { /* Una riga email_started resta bloccata e richiede verifica. */ }
    return reply(emailAttempted ? 'Esito invio incerto. Verifica amministrativa necessaria.' : 'Operazione non completata. Verificare lo stato prima di riprovare.',
      503, emailAttempted ? 'needs_review' : 'backend_error');
  }
}

export async function handleManagement(body, ctx, user, profile, redirectUrl) {
  try { return await dispatchManagement(body, ctx, user, profile, redirectUrl); }
  catch (_) { return reply('Servizio amministrativo non disponibile. Nessuna operazione confermata.', 503, 'backend_error'); }
}
