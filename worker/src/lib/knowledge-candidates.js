const TECHNICAL_EVIDENCE_FIELDS = [
  ['Symptom', 'symptom'],
  ['Inspection Process', 'inspection_process'],
  ['Diagnosis', 'diagnosis'],
  ['Solution', 'solution'],
  ['Verification Result', 'verification_result'],
  ['Follow-up Advice', 'follow_up_advice'],
];

function cleanEvidence(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stableHash(value) {
  let hash = 0xcbf29ce484222325n;
  for (const character of String(value)) {
    hash ^= BigInt(character.codePointAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function buildCandidateRawContent(report = {}) {
  return TECHNICAL_EVIDENCE_FIELDS.flatMap(([heading, field], index) => [
    `${heading}:`,
    cleanEvidence(report[field]),
    ...(index < TECHNICAL_EVIDENCE_FIELDS.length - 1 ? [''] : []),
  ]).join('\n');
}

export function toKnowledgeMarket(requestMarket) {
  if (requestMarket === 'com') return 'global';
  if (requestMarket === 'cn') return 'cn';
  throw new Error('unsupported_request_market');
}

export function parseRatingScore(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value) && value >= 1 && value <= 5
      ? value
      : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[1-5]$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function candidateIdForRepairRecord(repairRecordId) {
  return `kc_${stableHash(`repair:${repairRecordId}`)}`;
}

export function candidateEventId(candidateId, action, actorType, actorUserId) {
  return `kce_${stableHash([candidateId, action, actorType, actorUserId || ''].join(':'))}`;
}

export function prepareWorkOrderCandidate({
  report,
  workOrder,
  requestMarket,
  evidenceNotes = null,
}) {
  if (!report || report.report_quality_status !== 'submitted') {
    throw new Error('service_report_not_submitted');
  }
  if (!report.id || !workOrder?.id || !workOrder.engineer_id) {
    throw new Error('knowledge_candidate_source_incomplete');
  }

  return {
    id: candidateIdForRepairRecord(report.id),
    market: toKnowledgeMarket(requestMarket),
    source_type: 'work_order',
    source_work_order_id: workOrder.id,
    source_repair_record_id: report.id,
    contributor_engineer_id: workOrder.engineer_id,
    status: 'awaiting_operations',
    raw_content: buildCandidateRawContent(report),
    evidence_notes: evidenceNotes,
    internal_use_allowed: 1,
    public_use_allowed: 0,
  };
}
