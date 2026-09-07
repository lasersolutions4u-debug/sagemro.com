import { BusinessError, assertBusinessIdentity, scope, detail, ensureEpoch, businessEpochGuard } from './businessWorkspace.js';
import { calculateBusinessQuoteEstimate } from './businessQuoteEstimate.js';
import { validateQuoteExecution } from './quoteExecution.js';

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
const fail = (code, status = 400) => { throw new BusinessError(code, status, code); };
const changed = env => env.DB.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('business quote revision changed') END");
const feeKeys = ['labor_fee', 'parts_fee', 'travel_fee', 'other_fee'];

function normalizeDraft(body, wo, currency) {
  const fees = Object.fromEntries(feeKeys.map(key => [key, body[key]]));
  if (Object.values(fees).some(value => !Number.isSafeInteger(value) || value < 0)) fail('business_quote_amount_invalid');
  const amount = Object.values(fees).reduce((sum, value) => sum + value, 0);
  const result = calculateBusinessQuoteEstimate({ currency, quoted_amount: amount, costs: body.costs });
  if (result.code) fail(result.code);
  if (body.currency !== undefined && body.currency !== currency) fail('business_quote_currency_invalid');
  if (typeof body.parts_detail !== 'string' || body.parts_detail.length > 5000) fail('business_quote_parts_detail_invalid');
  if (!['single', 'installments'].includes(body.payment_plan_mode)) fail('business_quote_payment_plan_invalid');
  if (wo.service_mode !== 'remote' && (!Number.isSafeInteger(body.expected_service_days) || body.expected_service_days < 1)) fail('expected_service_days_required');
  const execution = validateQuoteExecution({ service_mode: wo.service_mode, currency, total_amount: amount, expected_service_days: body.expected_service_days, payment_plan_mode: body.payment_plan_mode, payment_schedule: body.payment_schedule });
  if (execution.code) fail(execution.code);
  const draft = { ...fees, parts_detail: body.parts_detail, expected_service_days: execution.value.expected_service_days, payment_plan_mode: execution.value.payment_plan_mode, payment_schedule: execution.value.payment_schedule, costs: result.value.costs };
  return { draft, estimate: result.value };
}

function editBlock(wo, pricing) {
  if (pricing && pricing.quote_source !== 'business') return 'business_quote_legacy_preserved';
  if (Number(wo.active_quote_version || 0) > 0 || ['confirmed', 'completed', 'cancelled', 'closed'].includes(wo.status)) return 'business_quote_active_preserved';
  if (pricing && ['pending_review', 'submitted', 'confirmed'].includes(pricing.status)) return 'business_quote_review_locked';
  if (!['pending', 'assigned', 'in_progress', 'pricing'].includes(wo.status)) return 'business_quote_work_order_locked';
  return null;
}

function stateGuard(env, wo, pricing) {
  return env.DB.prepare(`SELECT CASE WHEN EXISTS (
    SELECT 1 FROM work_orders WHERE id=? AND status=? AND service_mode IS ? AND active_quote_version IS ?
  ) AND NOT EXISTS (
    SELECT 1 FROM work_order_receipt_claims WHERE work_order_id=? AND status IN ('pending','confirmed')
  ) AND ((? IS NULL AND NOT EXISTS (SELECT 1 FROM work_order_pricing WHERE work_order_id=?))
    OR EXISTS (SELECT 1 FROM work_order_pricing WHERE work_order_id=? AND id=? AND quote_version=? AND status=? AND quote_source='business'))
  THEN 1 ELSE json('business quote state changed') END`).bind(wo.id, wo.status, wo.service_mode, wo.active_quote_version ?? null,
    wo.id, pricing?.id ?? null, wo.id, wo.id, pricing?.id ?? null, pricing?.quote_version ?? null, pricing?.status ?? null);
}

function audit(env, auth, wo, action, revision, quoteVersion = null) {
  return env.DB.prepare('INSERT INTO audit_logs(id,actor_type,actor_id,target_type,target_id,action,after_state) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), 'admin', auth.staffId || auth.userId, 'work_order', wo.id, action,
      JSON.stringify({ revision, quote_version: quoteVersion, quote_source: 'business' }));
}

export async function businessQuoteCostSnapshot(env, workOrderId, quoteVersion) {
  return env.DB.prepare('SELECT * FROM business_quote_cost_snapshots WHERE work_order_id=? AND quote_version=?').bind(workOrderId, quoteVersion).first();
}

export function businessQuotePendingLifecycleGuard(env, workOrderId) {
  return env.DB.prepare(`SELECT CASE WHEN EXISTS (
    SELECT 1 FROM work_orders WHERE id=? AND status='pricing' AND COALESCE(active_quote_version,0)=0
  ) AND NOT EXISTS (SELECT 1 FROM work_order_installments WHERE work_order_id=?)
    AND NOT EXISTS (SELECT 1 FROM work_order_receipt_claims WHERE work_order_id=? AND status IN ('pending','confirmed'))
  THEN 1 ELSE json('business quote lifecycle changed') END`).bind(workOrderId, workOrderId, workOrderId);
}

export async function businessQuoteReviewScope(request, env, market, body, workOrderId) {
  assertBusinessIdentity(request._auth, body.expected_staff_id);
  const s = await scope(env, request._auth, market);
  if (s.role !== 'admin') fail('business_quote_admin_review_required', 403);
  if (body.scope_version !== s.version) fail('business_scope_changed', 409);
  await detail(env, 'work_order', workOrderId, s, market);
  await ensureEpoch(env, s);
  return s;
}

export function businessQuoteCostGuard(env, workOrderId, quoteVersion, amount, currency) {
  return env.DB.prepare(`SELECT CASE WHEN EXISTS (
    SELECT 1 FROM business_quote_cost_snapshots c
    JOIN work_order_pricing p ON p.work_order_id=c.work_order_id AND p.quote_version=c.quote_version
    JOIN work_order_pricing_history h ON h.pricing_id=p.id AND h.version=c.quote_version
    WHERE c.work_order_id=? AND c.quote_version=? AND c.quoted_amount=? AND c.currency=?
      AND c.parts_cost IS NOT NULL AND c.engineer_cost IS NOT NULL AND c.travel_cost IS NOT NULL AND c.other_cost IS NOT NULL
      AND p.quote_source='business' AND h.quote_source='business'
      AND p.total_amount=c.quoted_amount AND h.total_amount=c.quoted_amount
      AND p.subtotal=c.quoted_amount AND h.subtotal=c.quoted_amount
      AND p.labor_fee=h.labor_fee AND p.parts_fee=h.parts_fee AND p.travel_fee=h.travel_fee AND p.other_fee=h.other_fee
      AND h.labor_fee+h.parts_fee+h.travel_fee+h.other_fee=c.quoted_amount
      AND p.expected_service_days IS h.expected_service_days AND p.payment_plan_mode=h.payment_plan_mode
      AND (SELECT SUM(amount) FROM work_order_payment_schedule WHERE work_order_id=c.work_order_id AND quote_version=c.quote_version)=c.quoted_amount
      AND NOT EXISTS (SELECT 1 FROM work_order_payment_schedule WHERE work_order_id=c.work_order_id AND quote_version=c.quote_version AND currency<>c.currency)
  ) THEN 1 ELSE json('business quote snapshot missing') END`).bind(workOrderId, quoteVersion, amount, currency);
}

export async function handleBusinessQuote(request, env, market) {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/admin\/business\/work-orders\/([^/]+)\/quote(\/submit|\/costs)?$/);
    if (!match) return reply({ error: 'Not found' }, 404);
    const body = ['PUT', 'POST'].includes(request.method) ? await request.json().catch(() => null) : null;
    if (['PUT', 'POST'].includes(request.method) && (!body || typeof body !== 'object' || Array.isArray(body))) fail('invalid_business_request');
    if (!body && (url.searchParams.getAll('expected_staff_id').length !== 1 || url.searchParams.getAll('scope_version').length !== 1)) fail('business_scope_changed', 409);
    assertBusinessIdentity(request._auth, body?.expected_staff_id ?? url.searchParams.get('expected_staff_id'));
    const s = await scope(env, request._auth, market);
    if ((body?.scope_version ?? url.searchParams.get('scope_version')) !== s.version) fail('business_scope_changed', 409);
    const id = decodeURIComponent(match[1]);
    await detail(env, 'work_order', id, s, market);
    const wo = await env.DB.prepare('SELECT id,status,service_mode,active_quote_version FROM work_orders WHERE id=?').bind(id).first();
    const currency = market === 'cn' ? 'CNY' : 'USD';
    if (match[2] === '/costs' && request.method === 'GET') {
      const raw = url.searchParams.get('quote_version');
      if (url.searchParams.getAll('quote_version').length !== 1 || !/^[1-9]\d*$/.test(raw || '') || !Number.isSafeInteger(Number(raw))) fail('business_quote_version_invalid');
      const snapshot = await businessQuoteCostSnapshot(env, id, Number(raw));
      if (!snapshot) fail('business_quote_snapshot_not_found', 404);
      const estimate = calculateBusinessQuoteEstimate({ currency: snapshot.currency, quoted_amount: snapshot.quoted_amount,
        costs: { parts_cost: snapshot.parts_cost, engineer_cost: snapshot.engineer_cost, travel_cost: snapshot.travel_cost, other_cost: snapshot.other_cost } });
      if (estimate.code) fail('business_quote_snapshot_invalid', 409);
      await ensureEpoch(env, s);
      return reply({ quote_version: snapshot.quote_version, source: 'business', author_staff_id: snapshot.author_staff_id, scope_version: s.version, estimate: estimate.value });
    }
    const pricing = await env.DB.prepare('SELECT id,quote_version,status,quote_source FROM work_order_pricing WHERE work_order_id=?').bind(id).first();
    const saved = await env.DB.prepare('SELECT * FROM business_quote_drafts WHERE work_order_id=?').bind(id).first();
    const stored = saved ? normalizeDraft(JSON.parse(saved.draft_json), wo, currency) : null;
    const block = editBlock(wo, pricing);
    const latest = pricing ? { quote_version: pricing.quote_version, status: pricing.status, source: pricing.quote_source } : null;
    if (pricing?.quote_source === 'business' && pricing.status === 'draft') {
      const feedback = await env.DB.prepare(`SELECT sender_type,content FROM work_order_messages
        WHERE id=? AND work_order_id=? AND sender_type IN ('system','customer')
          AND EXISTS (SELECT 1 FROM work_order_pricing_history WHERE pricing_id=? AND version=? AND quote_source='business' AND status='rejected')`)
        .bind(`business-quote-feedback:${id}:${pricing.quote_version}`, id, pricing.id, pricing.quote_version).first();
      if (feedback) latest.feedback = { quote_version: pricing.quote_version, source: feedback.sender_type === 'system' ? 'admin' : 'customer', message: feedback.content };
    }
    const view = (value = stored, revision = saved?.revision || 0) => ({ scope_version: s.version, revision, currency, service_mode: wo.service_mode,
      draft: value?.draft || null, estimate: value?.estimate || null, latest_quote: latest,
      can_edit: !block, edit_block_reason: block, can_submit: !block && Boolean(value?.estimate.complete) && saved?.submitted_revision !== revision });
    if (!match[2] && request.method === 'GET') { await ensureEpoch(env, s); return reply(view()); }
    if (!((!match[2] && request.method === 'PUT') || (match[2] === '/submit' && request.method === 'POST'))) return reply({ error: 'Not found' }, 404);
    if (block) fail(block, 409);
    if (!Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision !== (saved?.revision || 0)) fail('business_quote_revision_changed', 409);
    if (request.method === 'PUT') {
      const value = normalizeDraft(body, wo, currency);
      const write = saved
        ? env.DB.prepare("UPDATE business_quote_drafts SET draft_json=?,currency=?,author_staff_id=?,revision=revision+1,updated_at=datetime('now') WHERE work_order_id=? AND revision=?")
          .bind(JSON.stringify(value.draft), currency, request._auth.staffId || request._auth.userId, id, body.revision)
        : env.DB.prepare('INSERT INTO business_quote_drafts(work_order_id,revision,author_staff_id,currency,draft_json) VALUES (?,1,?,?,?)')
          .bind(id, request._auth.staffId || request._auth.userId, currency, JSON.stringify(value.draft));
      await env.DB.batch([businessEpochGuard(env, s.epoch), stateGuard(env, wo, pricing), write, changed(env), audit(env, request._auth, wo, 'business_quote_draft_saved', body.revision + 1)]);
      await ensureEpoch(env, s);
      return reply(view(value, body.revision + 1));
    }
    if (!saved || saved.submitted_revision === saved.revision) fail('business_quote_revision_changed', 409);
    if (!stored.estimate.complete) fail('business_quote_costs_incomplete');
    const d = stored.draft, estimate = stored.estimate;
    const pricingId = pricing?.id || crypto.randomUUID();
    const max = pricing ? await env.DB.prepare('SELECT MAX(version) AS version FROM work_order_pricing_history WHERE pricing_id=?').bind(pricingId).first() : null;
    const version = Math.max(pricing?.quote_version || 0, max?.version || 0) + 1;
    const statements = [businessEpochGuard(env, s.epoch), stateGuard(env, wo, pricing),
      env.DB.prepare('UPDATE business_quote_drafts SET submitted_revision=revision WHERE work_order_id=? AND revision=? AND (submitted_revision IS NULL OR submitted_revision<>revision)').bind(id, saved.revision), changed(env)];
    const quoteValues = [d.labor_fee, d.parts_fee, d.travel_fee, d.other_fee, JSON.stringify(d.parts_detail), estimate.quoted_amount, estimate.quoted_amount, version, d.expected_service_days, d.payment_plan_mode];
    if (pricing) {
      statements.push(env.DB.prepare("UPDATE work_order_pricing SET labor_fee=?,parts_fee=?,travel_fee=?,other_fee=?,parts_detail=?,subtotal=?,total_amount=?,quote_version=?,expected_service_days=?,payment_plan_mode=?,platform_fee=NULL,deposit_withhold=NULL,quote_source='business',status='pending_review',submitted_at=datetime('now') WHERE id=?").bind(...quoteValues, pricingId));
    } else {
      statements.push(env.DB.prepare("INSERT INTO work_order_pricing(labor_fee,parts_fee,travel_fee,other_fee,parts_detail,subtotal,total_amount,quote_version,expected_service_days,payment_plan_mode,id,work_order_id,engineer_id,platform_fee,deposit_withhold,quote_source,status,submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,'business','pending_review',datetime('now'))").bind(...quoteValues, pricingId, id));
    }
    statements.push(env.DB.prepare("INSERT INTO work_order_pricing_history(labor_fee,parts_fee,travel_fee,other_fee,parts_detail,subtotal,total_amount,version,expected_service_days,payment_plan_mode,id,pricing_id,platform_fee,deposit_withhold,quote_source,status,quote_kind) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,'business','pending_review','baseline')").bind(...quoteValues, crypto.randomUUID(), pricingId));
    for (const row of d.payment_schedule) statements.push(env.DB.prepare('INSERT INTO work_order_payment_schedule(id,pricing_id,work_order_id,quote_version,sequence,amount,currency,trigger_type,due_date,description,required_before_start) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), pricingId, id, version, row.sequence, row.amount, row.currency, row.trigger_type, row.due_date, row.description, row.required_before_start ? 1 : 0));
    statements.push(env.DB.prepare('INSERT INTO business_quote_cost_snapshots(work_order_id,quote_version,author_staff_id,draft_revision,currency,quoted_amount,parts_cost,engineer_cost,travel_cost,other_cost) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, version, saved.author_staff_id, saved.revision, currency, estimate.quoted_amount, d.costs.parts_cost, d.costs.engineer_cost, d.costs.travel_cost, d.costs.other_cost));
    statements.push(env.DB.prepare("UPDATE work_orders SET status='pricing',quote_review_status='pending_review' WHERE id=?").bind(id), audit(env, request._auth, wo, 'business_quote_submitted', saved.revision, version));
    await env.DB.batch(statements);
    await ensureEpoch(env, s);
    return reply({ ...view(), can_edit: false, edit_block_reason: 'business_quote_review_locked', can_submit: false, latest_quote: { quote_version: version, status: 'pending_review', source: 'business' } });
  } catch (error) {
    if (error instanceof BusinessError) return reply({ error: error.message, code: error.code }, error.status);
    if (/malformed json|UNIQUE constraint/i.test(error.message)) return reply({ error: 'Business scope, quote or revision changed', code: 'business_quote_conflict' }, 409);
    throw error;
  }
}
