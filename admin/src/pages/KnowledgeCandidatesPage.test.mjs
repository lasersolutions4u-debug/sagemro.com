import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function read(relativeUrl) {
  return readFile(new URL(relativeUrl, import.meta.url), 'utf8');
}

async function loadHelpers() {
  const source = await read('./KnowledgeCandidatesPage.jsx');
  const start = source.indexOf('// TESTABLE_HELPERS_START');
  const end = source.indexOf('// TESTABLE_HELPERS_END');
  assert.notEqual(start, -1, 'testable helper start marker must exist');
  assert.notEqual(end, -1, 'testable helper end marker must exist');
  const helperSource = source
    .slice(start, end)
    .replaceAll('export ', '');
  const moduleSource = `${helperSource}\nexport { candidateStatusLabel, candidateCategoryLabel, candidateRiskLabel, candidateActionLabel, candidateActions, mapCandidateError, buildEditorialPayload, createLatestRequestCoordinator, createSelectionGuard, focusTrapTargetIndex, submitCandidateReviewWorkflow, queueStartMessage };`;
  return import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
}

test('pure candidate helpers expose bilingual status, legal actions, field errors and whitelist payload', async () => {
  const { candidateStatusLabel, candidateCategoryLabel, candidateRiskLabel, candidateActionLabel, candidateActions, mapCandidateError, buildEditorialPayload } = await loadHelpers();

  assert.equal(candidateStatusLabel('awaiting_technical_review', 'en'), 'Awaiting technical review');
  assert.equal(candidateStatusLabel('awaiting_technical_review', 'zh-CN'), '等待技术复核');
  assert.deepEqual(candidateActions('operations_editing'), ['save', 'submit_review', 'reject']);
  assert.deepEqual(candidateActions('awaiting_technical_review'), ['request_changes', 'approve', 'reject']);
  assert.equal(candidateCategoryLabel('cutting_parameters', 'zh-CN'), '切割参数');
  assert.equal(candidateRiskLabel('high', 'zh-CN'), '高风险');
  assert.equal(candidateActionLabel('approve', 'zh-CN'), '批准生成文章草稿');
  assert.equal(candidateActionLabel('created', 'zh-CN'), '创建候选');
  assert.equal(candidateActionLabel('not_from_allowlist', 'en'), 'Unknown workflow event');
  assert.equal(candidateActionLabel('not_from_allowlist', 'zh-CN'), '未知流程事件');

  assert.deepEqual(
    mapCandidateError({ message: 'sensitive_content_detected', fields: ['sanitized_content', 'title'] }, 'en'),
    {
      message: 'Sensitive customer or commercial information was detected. Remove it before continuing.',
      fields: ['sanitized_content', 'title'],
    },
  );
  for (const code of ['unable_to_list_knowledge_candidates', 'invalid_status', 'invalid_pagination', 'invalid_page', 'invalid_page_size']) {
    const mapped = mapCandidateError({ message: code }, 'zh-CN');
    assert.notEqual(mapped.message, code);
    assert.ok(mapped.message.length > 4);
  }
  assert.deepEqual(
    mapCandidateError({ message: 'required_field', field: 'evidence_notes' }, 'zh-CN'),
    { message: '请填写必填字段。', fields: ['evidence_notes'] },
  );

  const payload = buildEditorialPayload({
    title: '  Servo alarm recovery  ',
    category: 'fault',
    sanitized_content: '  Verified steps  ',
    equipment_type: 'laser cutter',
    brand: 'Brand X',
    model: 'Model Y',
    alarm_codes_text: 'E101, E101\nE202',
    risk_level: 'medium',
    evidence_notes: '  Field verification  ',
    internal_use_allowed: true,
    public_use_allowed: false,
    customer_phone: '+1 555 0100',
    price: '100',
  });
  assert.deepEqual(payload, {
    title: 'Servo alarm recovery',
    category: 'fault',
    sanitized_content: 'Verified steps',
    equipment_type: 'laser cutter',
    brand: 'Brand X',
    model: 'Model Y',
    alarm_codes_json: ['E101', 'E202'],
    risk_level: 'medium',
    evidence_notes: 'Field verification',
    internal_use_allowed: true,
    public_use_allowed: false,
  });
  assert.equal(candidateCategoryLabel(payload.category, 'zh-CN'), '设备故障');
  assert.equal(candidateRiskLabel(payload.risk_level, 'zh-CN'), '中风险');
  assert.equal(payload.category, 'fault');
  assert.equal(payload.risk_level, 'medium');
});

test('latest request coordinator accepts only the most recent async detail result', async () => {
  const { createLatestRequestCoordinator } = await loadHelpers();
  const coordinator = createLatestRequestCoordinator();
  const accepted = [];
  const run = async (name, delay) => {
    const token = coordinator.begin();
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (coordinator.isLatest(token)) accepted.push(name);
  };
  await Promise.all([run('A', 20), run('B', 1)]);
  assert.deepEqual(accepted, ['B']);
});

test('latest coordinator rejects stale list results and selection guard prevents A writes from updating B', async () => {
  const { createLatestRequestCoordinator, createSelectionGuard } = await loadHelpers();
  const queue = createLatestRequestCoordinator();
  const accepted = [];
  const load = async (name, delay) => {
    const token = queue.begin();
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (queue.isLatest(token)) accepted.push(name);
  };
  await Promise.all([load('old-list', 20), load('new-list', 1)]);
  assert.deepEqual(accepted, ['new-list']);
  const selection = createSelectionGuard('A');
  const writeA = selection.capture();
  const appliedWrites = [];
  const pendingWrite = (async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (selection.isCurrent(writeA)) appliedWrites.push(writeA);
  })();
  await new Promise((resolve) => setTimeout(resolve, 1));
  selection.select('B');
  await pendingWrite;
  assert.equal(selection.isCurrent(writeA), false);
  assert.equal(selection.isCurrent(selection.capture()), true);
  assert.deepEqual(appliedWrites, []);
});

test('focus trap helper wraps forward and backward tab navigation', async () => {
  const { focusTrapTargetIndex } = await loadHelpers();
  assert.equal(focusTrapTargetIndex(2, 3, false), 0);
  assert.equal(focusTrapTargetIndex(0, 3, true), 2);
  assert.equal(focusTrapTargetIndex(1, 3, false), null);
  assert.equal(focusTrapTargetIndex(-1, 0, false), -1);
});

test('submit workflow saves first, forwards trimmed notes, and stops when save fails', async () => {
  const { submitCandidateReviewWorkflow } = await loadHelpers();
  const calls = [];
  const form = { title: ' Guide ', category: 'fault', sanitized_content: ' Steps ', risk_level: 'medium' };
  const result = await submitCandidateReviewWorkflow({
    id: 'cand-1', form, notes: '  checked evidence  ',
    save: async (id, payload) => { calls.push(['save', id, payload.title]); return { candidate: { id } }; },
    submit: async (id, payload) => { calls.push(['submit', id, payload]); return { candidate: { id, status: 'awaiting_technical_review' } }; },
  });
  assert.deepEqual(calls, [['save', 'cand-1', 'Guide'], ['submit', 'cand-1', { notes: 'checked evidence' }]]);
  assert.equal(result.candidate.status, 'awaiting_technical_review');

  const stopped = [];
  await assert.rejects(() => submitCandidateReviewWorkflow({
    id: 'cand-2', form, notes: 'review',
    save: async () => { stopped.push('save'); throw new Error('save_failed'); },
    submit: async () => { stopped.push('submit'); },
  }), /save_failed/);
  assert.deepEqual(stopped, ['save']);
});

test('queue start preserves successful messages only when requested', async () => {
  const { queueStartMessage } = await loadHelpers();
  assert.equal(queueStartMessage('Saved.', true), 'Saved.');
  assert.equal(queueStartMessage('Old error', false), '');
});

test('page provides queue, two-column review desk, safety warnings and explicit draft approval copy', async () => {
  const source = await read('./KnowledgeCandidatesPage.jsx');

  assert.match(source, /Original service facts/);
  assert.match(source, /原始服务事实/);
  assert.match(source, /Sanitized knowledge draft/);
  assert.match(source, /脱敏知识稿/);
  assert.match(source, /xl:grid-cols-2/);
  assert.match(source, /customer contact details, addresses, identities, or prices/i);
  assert.match(source, /客户联系方式、地址、身份信息或价格/);
  assert.match(source, /creates a draft knowledge article/i);
  assert.match(source, /不会发布，也不会立即用于 AI/);
  assert.match(source, /currently has both operations and technical review permissions/i);
  assert.match(source, /当前管理员暂时兼具运营编辑和技术复核权限/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /'aria-invalid':/);
  assert.match(source, /'aria-describedby':/);
  assert.match(source, /safe_raw_content/);
  assert.match(source, /technical_reviewer_id/);
  assert.match(source, /event\.actor_user_id/);
  assert.match(source, /event\.actor_type === 'customer'/);
  assert.match(source, /event\.actor_type === 'system'/);
  assert.doesNotMatch(source, /candidate\.raw_content\}/);
  assert.match(source, /previousFocusRef/);
  assert.match(source, /focusTrapTargetIndex/);
  assert.match(source, /querySelectorAll/);
  assert.match(source, /tabIndex="-1"/);
  assert.match(source, /targetIndex === -1/);
  assert.match(source, /dialogRef\.current\?\.focus/);
  assert.match(source, /\[confirmAction, busy\]/);
  assert.match(source, /AbortController/);
  assert.match(source, /<button[^>]+aria-label=/s);
  assert.match(source, /<option key=\{item\} value=\{item\}>/);
  assert.match(source, /latestQueueRef/);
  assert.match(source, /queueAbortRef/);
  assert.match(source, /setDetail\(null\); setForm\(null\)/);
  assert.match(source, /capturedId/);
  assert.match(source, /selectedIdRef\.current === capturedId/);
  assert.match(source, /disabled=\{busy\}/);
  assert.match(source, /automatic redaction/i);
  assert.match(source, /自动遮蔽仍需人工检查/);
  assert.match(source, /eyebrow: '证据审核台'/);
  const workflowCall = source.indexOf('submitCandidateReviewWorkflow({');
  const queuePreserve = source.indexOf('loadQueue(true)');
  const detailPreserve = source.indexOf('loadDetail(capturedId, true)');
  assert.notEqual(workflowCall, -1);
  assert.notEqual(queuePreserve, -1);
  assert.notEqual(detailPreserve, -1);
  assert.ok(
    workflowCall < queuePreserve,
    'submit-review must save the sanitized whitelist payload before transitioning status',
  );
});

test('app navigation places bilingual knowledge candidates beside knowledge base', async () => {
  const source = await read('../App.jsx');

  assert.match(source, /KnowledgeCandidatesPage/);
  assert.match(source, /knowledgeCandidates: 'Knowledge Candidates'/);
  assert.match(source, /knowledgeCandidates: '知识候选'/);
  assert.match(source, /key: 'knowledgeCandidates'/);
  assert.match(source, /case 'knowledgeCandidates': return <KnowledgeCandidatesPage \/>/);
  const knowledgeIndex = source.indexOf("key: 'knowledge'");
  const candidateIndex = source.indexOf("key: 'knowledgeCandidates'");
  assert.notEqual(knowledgeIndex, -1);
  assert.notEqual(candidateIndex, -1);
  assert.ok(knowledgeIndex < candidateIndex);
});

test('candidate API contract preserves structured errors and uses workflow endpoints', async () => {
  const source = await read('../services/api.js');

  assert.match(source, /error\.field = data\.field/);
  assert.match(source, /error\.fields = data\.fields/);
  assert.match(source, /options\.signal/);
  assert.match(source, /\/api\/admin\/knowledge-candidates\?/);
  assert.match(source, /\/api\/admin\/knowledge-candidates\/\$\{candidateId\}/);
  assert.match(source, /\$\{candidateId\}\/editorial/);
  assert.match(source, /\$\{candidateId\}\/submit-review/);
  assert.match(source, /JSON\.stringify\(payload\)/);
  assert.match(source, /\$\{candidateId\}\/request-changes/);
  assert.match(source, /\$\{candidateId\}\/approve/);
  assert.match(source, /\$\{candidateId\}\/reject/);
});
