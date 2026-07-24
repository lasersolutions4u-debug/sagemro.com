import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';
import { fieldDayLocalDate, siteLocalDateTimeToUtc } from '../src/lib/field-work.js';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const arrivalMigrationSql = readFileSync(new URL('../migrations/033_work_order_location_verification.sql', import.meta.url), 'utf8');
const fieldWorkMigrationSql = readFileSync(new URL('../migrations/039_field_workdays.sql', import.meta.url), 'utf8');

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function createEnv() {
  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    __workOrders: [{
      id: 'wo-onsite-1', order_no: 'WO-ONSITE-1', customer_id: 'customer-1', engineer_id: 'engineer-1',
      status: 'in_service', service_mode: 'onsite', site_timezone: 'Asia/Shanghai',
      expected_service_days: 2, expected_completion_date: '2026-07-24', planned_daily_start_time: '08:30',
      planned_daily_end_time: '17:30', service_latitude: 31.2304, service_longitude: 121.4737,
      service_coordinate_system: 'wgs84', service_accuracy_m: 25, arrival_verified_at: null,
      active_quote_version: null, quote_expected_service_days: null, approved_extension_days: 0,
    }],
    __fieldDays: [],
    __media: [],
    __arrivalChecks: [],
    __auditLogs: [],
    __notifications: [],
    __extensions: [],
    __revisions: [],
    __holds: [],
    __logs: [],
    __staff: [],
    __fieldWorkAudits: [],
    __repairRecords: [{
      work_order_id: 'wo-onsite-1', symptom: 'Low output', diagnosis: 'Dirty lens',
      solution: 'Replaced lens', parts_used: '[]', labor_hours: 2,
    }],
    __objects: new Map(),
    __cleanupQueue: [],
    __deleteAttempts: [],
    __kv: new Map(),
    __queries: [],
    __writes: [],
    KV: {
      async get(key) { return env.__kv.get(key) ?? null; },
      async put(key, value) { env.__kv.set(key, value); },
      async delete(key) { env.__kv.delete(key); },
    },
  };
  env.FIELD_EVIDENCE = {
    async put(key, value, options) {
      const body = value instanceof ReadableStream ? await new Response(value).arrayBuffer() : await new Response(value).arrayBuffer();
      env.__objects.set(key, { body, httpMetadata: options?.httpMetadata || {} });
    },
    async get(key) {
      const object = env.__objects.get(key);
      return object && { body: new Blob([object.body]).stream(), httpMetadata: object.httpMetadata };
    },
    async head(key) {
      if (env.__headFailures?.has(key)) throw new Error(`R2 head failed for ${key}`);
      return env.__objects.has(key) ? { key } : null;
    },
    async delete(key) {
      env.__deleteAttempts.push(key);
      if (env.__deleteFailures?.has(key)) {
        if (env.__deleteBeforeFailure?.has(key)) env.__objects.delete(key);
        throw new Error(`R2 delete failed for ${key}`);
      }
      env.__objects.delete(key);
    },
  };
  env.DB = {
    prepare(sql) { return createStatement(env, sql); },
    async batch(statements) {
      if (env.__closeBeforeFieldWrite) {
        env.__closeBeforeFieldWrite = false;
        const workOrder = env.__workOrders.find((item) => item.id === 'wo-onsite-1');
        if (workOrder) workOrder.status = 'resolved';
      }
      if (env.__extensionDecisionRaceWinner) {
        const winner = env.__extensionDecisionRaceWinner;
        env.__extensionDecisionRaceWinner = null;
        const extension = env.__extensions.find((item) => item.id === winner.requestId && item.work_order_id === winner.workOrderId);
        Object.assign(extension, {
          status: winner.decision,
          decided_by: 'winning-admin',
          decision_reason: winner.decisionReason,
          approved_plan: winner.approvedPlan ? JSON.stringify(winner.approvedPlan) : null,
          decided_at: 'winner-time',
        });
        if (winner.approvedPlan) {
          const workOrder = env.__workOrders.find((item) => item.id === winner.workOrderId);
          Object.assign(workOrder, winner.approvedPlan);
        }
        throw new Error(winner.errorMessage || 'D1_ERROR: malformed JSON');
      }
      if (env.__checkInRaceWinner) {
        const winner = env.__checkInRaceWinner;
        env.__checkInRaceWinner = null;
        winner.fieldDay.site_local_date = statements[0].args[3];
        winner.fieldDay.expected_check_out_at = `${winner.fieldDay.site_local_date}T17:30:00`;
        env.__fieldDays.push(winner.fieldDay);
        env.__media.push(winner.media);
        env.__objects.set(winner.media.object_key, { body: JPEG.buffer, httpMetadata: { contentType: winner.media.mime_type } });
        throw new Error(winner.errorMessage || 'D1_ERROR: UNIQUE constraint failed: work_order_field_days.work_order_id, work_order_field_days.engineer_id, work_order_field_days.site_local_date: SQLITE_CONSTRAINT');
      }
      const snapshot = {
        fieldDays: structuredClone(env.__fieldDays),
        media: structuredClone(env.__media),
        arrivalChecks: structuredClone(env.__arrivalChecks),
        auditLogs: structuredClone(env.__auditLogs),
        workOrders: structuredClone(env.__workOrders),
        extensions: structuredClone(env.__extensions),
        revisions: structuredClone(env.__revisions),
        holds: structuredClone(env.__holds),
        logs: structuredClone(env.__logs),
        notifications: structuredClone(env.__notifications),
      };
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        return results;
      } catch (error) {
        env.__fieldDays = snapshot.fieldDays;
        env.__media = snapshot.media;
        env.__arrivalChecks = snapshot.arrivalChecks;
        env.__auditLogs = snapshot.auditLogs;
        env.__workOrders = snapshot.workOrders;
        env.__extensions = snapshot.extensions;
        env.__revisions = snapshot.revisions;
        env.__holds = snapshot.holds;
        env.__logs = snapshot.logs;
        env.__notifications = snapshot.notifications;
        throw error;
      }
    },
  };
  return env;
}

function createStatement(env, sql) {
  return {
    args: [],
    bind(...args) { this.args = args; return this; },
    async first() {
      const normalized = normalizeSql(sql);
      if (/FROM work_orders(?: w)?(?: .*?)? WHERE (?:w\.)?id = \?/i.test(normalized)) {
        const record = env.__workOrders.find((item) => item.id === this.args[0]);
        return record ? { ...record } : null;
      }
      if (/FROM admin_staff_accounts WHERE id = \? AND is_active = 1/i.test(normalized)) {
        const record = env.__staff.find((item) => item.id === this.args[0] && item.is_active === 1);
        return record ? { ...record } : null;
      }
      if (/FROM admin_staff_accounts WHERE id = \?/i.test(normalized)) {
        const record = env.__staff.find((item) => item.id === this.args[0]);
        return record ? { ...record } : null;
      }
      if (/FROM work_order_field_days WHERE id = \? AND work_order_id = \?/i.test(normalized)) {
        const record = env.__fieldDays.find((item) => item.id === this.args[0] && item.work_order_id === this.args[1]);
        return record ? { ...record } : null;
      }
      if (/FROM work_order_field_days WHERE report_idempotency_key = \?/i.test(normalized)) {
        const record = env.__fieldDays.find((item) => item.report_idempotency_key === this.args[0]);
        return record ? { ...record } : null;
      }
      if (/FROM work_order_field_days WHERE check_in_idempotency_key = \?/i.test(normalized)) {
        const record = env.__fieldDays.find((item) => item.check_in_idempotency_key === this.args[0]);
        return record ? { ...record } : null;
      }
      if (/FROM work_order_field_days WHERE work_order_id = \? AND engineer_id = \? AND site_local_date = \?/i.test(normalized)) {
        const record = env.__fieldDays.find((item) => item.work_order_id === this.args[0] && item.engineer_id === this.args[1] && item.site_local_date === this.args[2]);
        return record ? { ...record } : null;
      }
      if (/FROM work_order_field_days WHERE work_order_id = \? AND engineer_id = \? LIMIT 1/i.test(normalized)) {
        const record = env.__fieldDays.find((item) => item.work_order_id === this.args[0] && item.engineer_id === this.args[1]);
        return record ? { id: record.id } : null;
      }
      if (/FROM work_order_field_day_media WHERE field_day_id = \? AND purpose = 'check_in'/i.test(normalized)) {
        const record = env.__media.find((item) => item.field_day_id === this.args[0] && item.purpose === 'check_in');
        return record ? { ...record } : null;
      }
      if (/FROM work_order_field_day_media WHERE id = \? AND work_order_id = \?/i.test(normalized)) {
        const record = env.__media.find((item) => item.id === this.args[0] && item.work_order_id === this.args[1]);
        return record ? { ...record } : null;
      }
      if (/FROM work_order_extension_requests WHERE work_order_id = \? AND status = 'pending'/i.test(normalized)) {
        const record = env.__extensions.find((item) => item.work_order_id === this.args[0] && item.status === 'pending');
        return record ? { ...record } : null;
      }
      if (/FROM work_order_extension_requests WHERE id = \? AND work_order_id = \?/i.test(normalized)) {
        const record = env.__extensions.find((item) => item.id === this.args[0] && item.work_order_id === this.args[1]);
        return record ? { ...record } : null;
      }
      if (/FROM work_order_field_evidence_holds WHERE id = \? AND work_order_id = \?/i.test(normalized)) {
        const record = env.__holds.find((item) => item.id === this.args[0] && item.work_order_id === this.args[1]);
        return record ? { ...record } : null;
      }
      if (/FROM work_order_repair_records WHERE work_order_id = \?/i.test(normalized)) {
        const record = env.__repairRecords.find((item) => item.work_order_id === this.args[0]);
        return record ? { ...record } : null;
      }
      if (/SELECT COUNT\(\*\) as count FROM notifications WHERE user_id = \?/i.test(normalized)) {
        const [userId, userType] = this.args;
        return { count: env.__notifications.filter((item) => item.args[1] === userId && item.args[2] === userType && !item.is_read).length };
      }
      if (/SELECT COUNT\(\*\) as count FROM work_orders/i.test(normalized)) return { count: env.__workOrders.length };
      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);
      env.__queries.push({ sql: normalized, args: [...this.args] });
      if (/FROM audit_logs/i.test(normalized) && /work_order_field/i.test(normalized)) {
        return { results: env.__fieldWorkAudits.filter((item) => item.work_order_id === this.args[0]).map((item) => ({ ...item })) };
      }
      if (/FROM work_order_field_days fd JOIN work_orders wo/i.test(normalized)) {
        const cursor = /fd\.id > \?/i.test(normalized) ? this.args[0] : null;
        const limit = Number(this.args.at(-1)) || 100;
        return {
          results: env.__fieldDays
            .filter((item) => item.status === 'checked_in')
            .filter((item) => !cursor || item.id > cursor)
            .sort((a, b) => String(a.id).localeCompare(String(b.id)))
            .slice(0, limit)
            .map((item) => ({
              ...item,
              order_no: env.__workOrders.find((order) => order.id === item.work_order_id)?.order_no,
            })),
        };
      }
      if (/FROM work_order_field_day_media m JOIN work_orders wo/i.test(normalized)) {
        const sqlFiltersEligibility = /wo\.status = 'completed'/i.test(normalized)
          && /wo\.completed_at <= \?/i.test(normalized)
          && /NOT EXISTS \( SELECT 1 FROM work_order_field_evidence_holds/i.test(normalized);
        const completedBefore = sqlFiltersEligibility ? this.args[0] : null;
        const staleClaimBefore = sqlFiltersEligibility ? this.args[1] : this.args[0];
        const limit = Number(this.args.at(-1)) || 100;
        return {
          results: env.__media
            .filter((item) => !item.deleted_at)
            .filter((item) => !item.retention_claim_token || item.retention_claimed_at <= staleClaimBefore)
            .map((item) => {
              const order = env.__workOrders.find((record) => record.id === item.work_order_id) || {};
              return {
                ...item,
                work_order_status: order.status,
                completed_at: order.completed_at || null,
                has_open_hold: env.__holds.some((hold) => hold.work_order_id === item.work_order_id && hold.status === 'open') ? 1 : 0,
              };
            })
            .filter((item) => !sqlFiltersEligibility || (
              item.work_order_status === 'completed'
              && item.completed_at <= completedBefore
              && !item.has_open_hold
            ))
            .sort((a, b) => String(a.completed_at || '').localeCompare(String(b.completed_at || '')) || String(a.id).localeCompare(String(b.id)))
            .slice(0, limit),
        };
      }
      if (/FROM field_evidence_cleanup_queue/i.test(normalized)) {
        return { results: env.__cleanupQueue.slice(0, Number(this.args.at(-1)) || 100).map((item) => ({ ...item })) };
      }
      if (/SELECT \* FROM notifications WHERE user_id = \?/i.test(normalized)) {
        const [userId, userType, limit, offset] = this.args;
        return {
          results: env.__notifications
            .filter((item) => item.args[1] === userId && item.args[2] === userType)
            .slice(offset, offset + limit)
            .map((item) => ({ id: item.args[0], user_id: item.args[1], user_type: item.args[2], type: item.args[3], title: item.args[4], body: item.args[5], is_read: 0 })),
        };
      }
      if (/FROM admin_staff_accounts/i.test(normalized)) {
        const market = this.args[0];
        return {
          results: env.__staff
            .filter((item) => item.is_active === 1
              && ['admin', 'operations'].includes(item.role)
              && ['all', market].includes(item.market_scope))
            .map((item) => ({ id: item.id })),
        };
      }
      if (/FROM work_order_field_days/i.test(normalized)) {
        return { results: env.__fieldDays.filter((item) => item.work_order_id === this.args[0]).map((item) => ({ ...item })) };
      }
      if (/FROM work_order_field_day_media/i.test(normalized)) {
        const dayIds = new Set(env.__fieldDays.filter((item) => item.work_order_id === this.args[0]).map((item) => item.id));
        const customerOnly = /customer_visible = 1/i.test(normalized);
        return { results: env.__media.filter((item) => dayIds.has(item.field_day_id) && (!customerOnly || item.customer_visible)).map((item) => ({ ...item })) };
      }
      if (/FROM work_order_extension_requests/i.test(normalized)) {
        const pendingOnly = /status = 'pending'/i.test(normalized);
        return {
          results: env.__extensions
            .filter((item) => item.work_order_id === this.args[0] && (!pendingOnly || item.status === 'pending'))
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
            .map((item) => ({ ...item })),
        };
      }
      if (/FROM work_order_field_evidence_holds/i.test(normalized)) {
        return { results: env.__holds.filter((item) => item.work_order_id === this.args[0]).map((item) => ({ ...item })) };
      }
      if (/FROM work_order_field_day_revisions/i.test(normalized)) {
        return { results: env.__revisions.filter((item) => item.work_order_id === this.args[0]).map((item) => ({ ...item })) };
      }
      if (/FROM work_orders w/i.test(normalized)) {
        return { results: env.__workOrders.map((item) => ({ ...item })) };
      }
      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);
      env.__writes.push({ sql: normalized, args: [...this.args] });
      let changes = 1;
      if (/SELECT CASE WHEN changes\(\) = 1 THEN 1 .*json\(/i.test(normalized)) {
        if (env.__lastChanges !== 1) throw new Error('D1_ERROR: malformed JSON');
        return { success: true, meta: { changes: 0 } };
      }
      if (/INSERT INTO work_order_field_days/i.test(normalized) && /'admin_override'/i.test(normalized)) {
        const [id, workOrderId, engineerId, localDate, timezone, checkInAt, reason] = this.args;
        env.__fieldDays.push({ id, work_order_id: workOrderId, engineer_id: engineerId, site_local_date: localDate, site_timezone: timezone, status: 'admin_override_open', check_in_at: checkInAt, location_status: 'admin_override', location_source: 'admin_override', capture_source: 'admin_override', internal_note: reason });
      } else if (/INSERT INTO work_order_field_days/i.test(normalized)) {
        const [id, workOrderId, engineerId, localDate, timezone, expectedCheckout, locationStatus, latitude, longitude, accuracy, coordinateSystem, locationSource, distance, radius, within, idempotency] = this.args;
        const workOrder = env.__workOrders.find((item) => item.id === workOrderId);
        if (/WHERE EXISTS/i.test(normalized) && (!workOrder || workOrder.status !== 'in_service' || workOrder.service_mode !== 'onsite' || workOrder.engineer_id !== engineerId)) {
          changes = 0;
        } else {
          env.__fieldDays.push({ id, work_order_id: workOrderId, engineer_id: engineerId, site_local_date: localDate, site_timezone: timezone, status: 'checked_in', expected_check_out_at: expectedCheckout, location_status: locationStatus, latitude, longitude, accuracy_m: accuracy, coordinate_system: coordinateSystem, location_source: locationSource, distance_m: distance, radius_m: radius, within_geofence: within, check_in_idempotency_key: idempotency });
        }
      }
      if (/UPDATE work_order_field_days SET status = \?/i.test(normalized)) {
        const [status, laborHours, completedWork, issuesRisks, nextPlan, customerSupportNeeded, internalNote, lateReason, idempotencyKey, fieldDayId, workOrderId] = this.args;
        const record = env.__fieldDays.find((item) => item.id === fieldDayId && item.work_order_id === workOrderId);
        if (record) Object.assign(record, { status, labor_hours: laborHours, completed_work: completedWork, issues_risks: issuesRisks, next_plan: nextPlan, customer_support_needed: customerSupportNeeded, internal_note: internalNote, late_reason: lateReason, report_idempotency_key: idempotencyKey, report_submitted_at: 'now' });
      }
      if (/UPDATE work_order_field_days SET labor_hours = \?/i.test(normalized)) {
        const [laborHours, completedWork, issuesRisks, nextPlan, customerSupportNeeded, internalNote, lateReason, fieldDayId, workOrderId] = this.args;
        const record = env.__fieldDays.find((item) => item.id === fieldDayId && item.work_order_id === workOrderId);
        if (record) Object.assign(record, { labor_hours: laborHours, completed_work: completedWork, issues_risks: issuesRisks, next_plan: nextPlan, customer_support_needed: customerSupportNeeded, internal_note: internalNote, late_reason: lateReason });
      }
      if (/INSERT INTO work_order_field_day_media/i.test(normalized)) {
        if (env.__failNextMediaInsert) throw new Error('D1 media persistence failed');
        const [id, workOrderId, fieldDayId, purpose, objectKey, mimeType, fileSize, uploaderType, uploaderId, customerVisible, captureSource] = this.args;
        env.__media.push({ id, work_order_id: workOrderId, field_day_id: fieldDayId, purpose, object_key: objectKey, mime_type: mimeType, file_size: fileSize, uploader_type: uploaderType, uploader_id: uploaderId, customer_visible: customerVisible, capture_source: captureSource });
      }
      if (/INSERT OR IGNORE INTO field_evidence_cleanup_queue/i.test(normalized)) {
        const [objectKey, failureReason] = this.args;
        if (!env.__cleanupQueue.some((item) => item.object_key === objectKey)) {
          env.__cleanupQueue.push({ object_key: objectKey, failure_reason: failureReason });
        }
      }
      if (/DELETE FROM field_evidence_cleanup_queue WHERE object_key = \?/i.test(normalized)) {
        env.__cleanupQueue = env.__cleanupQueue.filter((item) => item.object_key !== this.args[0]);
      }
      if (/INSERT INTO work_order_arrival_checks/i.test(normalized)) env.__arrivalChecks.push({ args: this.args });
      if (/INSERT INTO audit_logs/i.test(normalized)) env.__auditLogs.push({ args: this.args });
      if (/INSERT(?: OR IGNORE)? INTO notifications/i.test(normalized)) {
        const fieldDay = env.__fieldDays.find((item) => item.id === this.args.at(-2));
        const claimColumn = /checkout_reminder_sent_at/i.test(normalized)
          ? 'checkout_reminder_sent_at'
          : 'overdue_notification_sent_at';
        const claimMatches = /WHERE EXISTS/i.test(normalized)
          ? fieldDay?.[claimColumn] === this.args.at(-1)
          : true;
        if (claimMatches && !env.__notifications.some((item) => item.args[0] === this.args[0])) {
          env.__notifications.push({ args: this.args });
        }
      }
      if (/INSERT INTO work_order_logs/i.test(normalized)) env.__logs.push({ args: this.args });
      if (/INSERT INTO work_order_extension_requests/i.test(normalized)) {
        const [id, workOrderId, fieldDayId, engineerId, reason, customerExplanation, internalNote, days, proposedDate, originalPlan] = this.args;
        const workOrder = env.__workOrders.find((item) => item.id === workOrderId);
        if (/WHERE EXISTS/i.test(normalized) && (!workOrder || workOrder.status !== 'in_service' || workOrder.service_mode !== 'onsite' || workOrder.engineer_id !== engineerId)) {
          changes = 0;
        } else {
          if (env.__extensions.some((item) => item.work_order_id === workOrderId && item.status === 'pending')) throw new Error('UNIQUE constraint failed: work_order_extension_requests.work_order_id');
          env.__extensions.push({ id, work_order_id: workOrderId, field_day_id: fieldDayId, engineer_id: engineerId, reason, customer_explanation: customerExplanation, internal_note: internalNote, requested_additional_days: days, proposed_completion_date: proposedDate, original_plan: originalPlan, approved_plan: null, status: 'pending' });
        }
      }
      if (/UPDATE work_order_extension_requests SET status = \?/i.test(normalized)) {
        const [status, decidedBy, decisionReason, approvedPlan, requestId, workOrderId] = this.args;
        const record = env.__extensions.find((item) => item.id === requestId && item.work_order_id === workOrderId);
        if (record) Object.assign(record, { status, decided_by: decidedBy, decision_reason: decisionReason, approved_plan: approvedPlan, decided_at: 'now' });
      }
      if (/INSERT INTO work_order_field_day_revisions/i.test(normalized)) {
        const [id, workOrderId, fieldDayId, previousReport, changedByType, changedById, reason] = this.args;
        env.__revisions.push({ id, work_order_id: workOrderId, field_day_id: fieldDayId, previous_report: previousReport, changed_by_type: changedByType, changed_by_id: changedById, reason });
      }
      if (/INSERT INTO work_order_field_evidence_holds/i.test(normalized)) {
        const [id, workOrderId, category, reason, openedBy] = this.args;
        const activeClaim = env.__media.some((item) => item.work_order_id === workOrderId && item.retention_claim_token && !item.deleted_at);
        if (/WHERE NOT EXISTS/i.test(normalized) && activeClaim) changes = 0;
        else env.__holds.push({ id, work_order_id: workOrderId, reason_category: category, reason, status: 'open', opened_by: openedBy });
      }
      if (/UPDATE work_order_field_evidence_holds SET status = 'resolved'/i.test(normalized)) {
        const [resolvedBy, resolutionReason, holdId, workOrderId] = this.args;
        const record = env.__holds.find((item) => item.id === holdId && item.work_order_id === workOrderId);
        if (record) Object.assign(record, { status: 'resolved', resolved_by: resolvedBy, resolution_reason: resolutionReason, resolved_at: 'now' });
      }
      if (/UPDATE work_orders SET site_timezone = \?/i.test(normalized)) {
        const [timezone, days, completionDate, startTime, endTime, workOrderId] = this.args;
        const record = env.__workOrders.find((item) => item.id === workOrderId);
        if (record) Object.assign(record, { site_timezone: timezone, expected_service_days: days, expected_completion_date: completionDate, planned_daily_start_time: startTime, planned_daily_end_time: endTime });
      }
      if (/UPDATE work_orders SET expected_service_days = \?/i.test(normalized)) {
        const [days, completionDate, workOrderId] = this.args;
        const record = env.__workOrders.find((item) => item.id === workOrderId);
        if (record) Object.assign(record, { expected_service_days: days, expected_completion_date: completionDate });
      }
      if (/UPDATE work_orders SET approved_extension_days = approved_extension_days \+ \?/i.test(normalized)) {
        const [days, workOrderId] = this.args;
        const record = env.__workOrders.find((item) => item.id === workOrderId);
        if (record) record.approved_extension_days = Number(record.approved_extension_days || 0) + Number(days);
      }
      if (/UPDATE work_orders SET arrival_verified_at/i.test(normalized)) {
        const record = env.__workOrders.find((item) => item.id === this.args.at(-1));
        if (record && !record.arrival_verified_at) record.arrival_verified_at = 'now';
      }
      if (/UPDATE work_orders SET status = 'resolved'/i.test(normalized)) {
        const record = env.__workOrders.find((item) => item.id === this.args[0]);
        if (env.__activeRecordBeforeResolve === 'field-day') {
          env.__activeRecordBeforeResolve = null;
          seedFieldDay(env, { id: 'concurrent-field-day', status: 'checked_in' });
        }
        if (env.__activeRecordBeforeResolve === 'extension') {
          env.__activeRecordBeforeResolve = null;
          env.__extensions.push({ id: 'concurrent-extension', work_order_id: this.args[0], status: 'pending' });
        }
        const hasBlockingDay = env.__fieldDays.some((item) => item.work_order_id === this.args[0] && ['checked_in', 'report_overdue', 'admin_override_open'].includes(item.status));
        const hasPendingExtension = env.__extensions.some((item) => item.work_order_id === this.args[0] && item.status === 'pending');
        if (/NOT EXISTS/i.test(normalized) && (hasBlockingDay || hasPendingExtension)) changes = 0;
        else if (record) record.status = 'resolved';
        else changes = 0;
      }
      if (/UPDATE work_order_field_days SET checkout_reminder_sent_at/i.test(normalized)) {
        const record = env.__fieldDays.find((item) => item.id === this.args.at(-1));
        if (record && !record.checkout_reminder_sent_at && !env.__forceFieldDayClaimMiss) record.checkout_reminder_sent_at = this.args[0];
        else changes = 0;
      }
      if (/UPDATE work_order_field_days SET status = 'report_overdue'/i.test(normalized)) {
        const record = env.__fieldDays.find((item) => item.id === this.args.at(-1));
        if (record && record.status === 'checked_in' && !record.overdue_notification_sent_at) {
          record.status = 'report_overdue';
          record.overdue_notification_sent_at = this.args[0];
        } else changes = 0;
      }
      if (/UPDATE work_order_field_day_media SET deleted_at/i.test(normalized)) {
        const record = env.__media.find((item) => item.id === this.args[1]);
        if (env.__failRetentionMarkOnce) {
          env.__failRetentionMarkOnce = false;
          throw new Error('D1 retention mark failed');
        }
        if (env.__forceRetentionMarkMiss) changes = 0;
        else if (record && !record.deleted_at && (!this.args[2] || record.retention_claim_token === this.args[2])) {
          Object.assign(record, { deleted_at: this.args[0], retention_claim_token: null, retention_claimed_at: null });
        }
        else changes = 0;
      }
      if (/UPDATE work_order_field_day_media SET retention_claim_token = \?/i.test(normalized)) {
        const [claimToken, claimedAt, mediaId] = this.args;
        const record = env.__media.find((item) => item.id === mediaId);
        const held = record && env.__holds.some((hold) => hold.work_order_id === record.work_order_id && hold.status === 'open');
        const expectedToken = this.args[3];
        const staleBefore = this.args[4];
        const claimAvailable = !record?.retention_claim_token
          || (expectedToken && record.retention_claim_token === expectedToken && record.retention_claimed_at <= staleBefore);
        if (record && !record.deleted_at && claimAvailable && !held) Object.assign(record, { retention_claim_token: claimToken, retention_claimed_at: claimedAt });
        else changes = 0;
      }
      if (/UPDATE work_order_field_day_media SET retention_claim_token = NULL/i.test(normalized)) {
        const [mediaId, claimToken] = this.args;
        const record = env.__media.find((item) => item.id === mediaId);
        if (record && record.retention_claim_token === claimToken) Object.assign(record, { retention_claim_token: null, retention_claimed_at: null });
        else changes = 0;
      }
      env.__lastChanges = changes;
      return { success: true, meta: { changes } };
    },
  };
}

async function api(env, path, { userType, userId, method = 'GET', formData, body, idempotencyKey, staffRole, staffId } = {}) {
  if (staffId && !env.__staff.some((item) => item.id === staffId)) {
    env.__staff.push({ id: staffId, role: staffRole, is_active: 1, market_scope: 'all', must_change_password: 0 });
  }
  const jwt = await signJwt({ userId, userType, market: 'com', staffRole, staffId, phone: '13800000000', iat: 1, exp: Math.floor(Date.now() / 1000) + 3600 }, env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${jwt}`, Origin: 'https://sagemro.com' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, { method, headers, body: formData || (body === undefined ? undefined : JSON.stringify(body)) }), env, { waitUntil() {} });
  return { response, json: await response.clone().json().catch(() => ({})) };
}

function reportForm(overrides = {}) {
  const formData = new FormData();
  const values = {
    completed_work: 'Replaced the damaged protective lens.',
    issues_risks: 'No additional issue found.',
    next_plan: 'Verify output stability tomorrow.',
    customer_support_needed: 'Keep the machine powered down overnight.',
    labor_hours: '8',
    internal_note: 'Monitor internal temperature trend.',
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && key !== 'progress_photos' && key !== 'internal_photos') formData.set(key, String(value));
  }
  for (const file of overrides.progress_photos || [new Blob([JPEG], { type: 'image/jpeg' })]) formData.append('progress_photos', file, 'progress.jpg');
  for (const file of overrides.internal_photos || []) formData.append('internal_photos', file, 'internal.jpg');
  return formData;
}

function seedFieldDay(env, overrides = {}) {
  const fieldDay = {
    id: 'field-day-1', work_order_id: 'wo-onsite-1', engineer_id: 'engineer-1',
    site_local_date: fieldDayLocalDate(new Date(), 'Asia/Shanghai'),
    site_timezone: 'Asia/Shanghai', status: 'checked_in', location_status: 'verified', check_in_at: '2026-07-24T01:00:00Z',
    ...overrides,
  };
  env.__fieldDays.push(fieldDay);
  return fieldDay;
}

async function runScheduled(env, scheduledTime) {
  const waits = [];
  env.FIELD_WORK_PUSHER = async () => true;
  await worker.scheduled({ scheduledTime: Date.parse(scheduledTime) }, env, {
    waitUntil(promise) { waits.push(promise); },
  });
  assert.equal(waits.length, 1);
  await waits[0];
}

function checkInForm({ location } = {}) {
  const formData = new FormData();
  formData.set('photo', new Blob([JPEG], { type: 'image/jpeg' }), 'arrival.jpg');
  formData.set('expected_checkout_time', '17:30');
  if (location) formData.set('location', JSON.stringify(location));
  return formData;
}

function directLocationCheckInForm() {
  const formData = new FormData();
  formData.set('photo', new Blob([JPEG], { type: 'image/jpeg' }), 'arrival.jpg');
  formData.set('latitude', '31.2304');
  formData.set('longitude', '121.4737');
  formData.set('accuracy_m', '20');
  formData.set('coordinate_system', 'wgs84');
  formData.set('location_source', 'browser');
  return formData;
}

function setCheckInRaceWinner(env, { idempotencyKey, workOrderId = 'wo-onsite-1', engineerId = 'engineer-1', errorMessage }) {
  const fieldDayId = `winner-${idempotencyKey}`;
  const objectKey = `field-evidence/com/${workOrderId}/${fieldDayId}/check-in.jpg`;
  env.__checkInRaceWinner = {
    fieldDay: {
      id: fieldDayId, work_order_id: workOrderId, engineer_id: engineerId, site_local_date: null,
      site_timezone: 'Asia/Shanghai', status: 'checked_in', expected_check_out_at: null,
      location_status: 'unavailable', check_in_idempotency_key: idempotencyKey,
    },
    media: {
      id: `media-${fieldDayId}`, work_order_id: workOrderId, field_day_id: fieldDayId, purpose: 'check_in',
      object_key: objectKey, mime_type: 'image/jpeg', file_size: JPEG.byteLength, uploader_type: 'engineer',
      uploader_id: engineerId, customer_visible: 1, capture_source: 'check_in',
    },
    errorMessage,
  };
  return { fieldDayId, objectKey };
}

function setExtensionDecisionRaceWinner(env, {
  requestId,
  decision,
  workOrderId = 'wo-onsite-1',
  decisionReason = 'Concurrent Admin decision',
  errorMessage,
}) {
  const workOrder = env.__workOrders.find((item) => item.id === workOrderId);
  const extension = env.__extensions.find((item) => item.id === requestId && item.work_order_id === workOrderId);
  const approvedPlan = decision === 'approved' ? {
    site_timezone: workOrder.site_timezone,
    expected_service_days: Number(workOrder.expected_service_days) + Number(extension.requested_additional_days),
    expected_completion_date: extension.proposed_completion_date,
    planned_daily_start_time: workOrder.planned_daily_start_time,
    planned_daily_end_time: workOrder.planned_daily_end_time,
  } : null;
  env.__extensionDecisionRaceWinner = { requestId, workOrderId, decision, decisionReason, approvedPlan, errorMessage };
}

test('field-work migration preserves legacy arrival checks and permits unavailable coordinates', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);
    CREATE TABLE customers (id TEXT PRIMARY KEY);
    CREATE TABLE engineers (id TEXT PRIMARY KEY);
    CREATE TABLE work_orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      engineer_id TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (engineer_id) REFERENCES engineers(id)
    );
    INSERT INTO customers (id) VALUES ('customer-1');
    INSERT INTO engineers (id) VALUES ('engineer-1');
    INSERT INTO work_orders (id, customer_id, engineer_id) VALUES ('wo-1', 'customer-1', 'engineer-1');
  `);
  db.exec(arrivalMigrationSql);
  db.prepare(`
    INSERT INTO work_order_arrival_checks (
      id, work_order_id, engineer_id, latitude, longitude, coordinate_system, location_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('arrival-1', 'wo-1', 'engineer-1', 31.2304, 121.4737, 'wgs84', 'browser');

  db.exec(fieldWorkMigrationSql);

  const columns = db.prepare('PRAGMA table_info(work_order_arrival_checks)').all();
  assert.equal(columns.find((column) => column.name === 'latitude').notnull, 0);
  assert.equal(columns.find((column) => column.name === 'longitude').notnull, 0);
  const preserved = db.prepare(`
    SELECT id, latitude, longitude FROM work_order_arrival_checks WHERE id = 'arrival-1'
  `).get();
  assert.equal(preserved.id, 'arrival-1');
  assert.equal(preserved.latitude, 31.2304);
  assert.equal(preserved.longitude, 121.4737);
});

test('assigned engineer photo check-in creates private evidence and remains idempotent for the local day', async () => {
  const env = createEnv();
  const first = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', { userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(), idempotencyKey: 'check-in-1' });
  assert.equal(first.response.status, 201);
  assert.equal(first.json.location_status, 'unavailable');
  assert.equal(env.__fieldDays.length, 1);
  assert.equal(env.__media.length, 1);
  assert.match(env.__media[0].object_key, /^field-evidence\/com\/wo-onsite-1\/[^/]+\/check-in\.jpg$/);
  assert.equal(env.__objects.size, 1);
  assert.equal(env.__arrivalChecks.length, 1);
  assert.equal(env.__arrivalChecks[0].args[3], null);
  assert.equal(env.__arrivalChecks[0].args[4], null);
  assert.equal(env.__arrivalChecks[0].args[11], 'unavailable');
  assert.equal(env.__workOrders[0].arrival_verified_at, 'now');
  assert.equal(env.__auditLogs.length, 1);

  const retry = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', { userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(), idempotencyKey: 'check-in-1' });
  assert.equal(retry.response.status, 200);
  assert.equal(retry.json.field_day.id, first.json.field_day.id);
  assert.equal(env.__fieldDays.length, 1);
  assert.equal(env.__objects.size, 1);

  const sameDay = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', { userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(), idempotencyKey: 'check-in-2' });
  assert.equal(sameDay.response.status, 200);
  assert.equal(sameDay.json.field_day.id, first.json.field_day.id);
  assert.equal(env.__fieldDays.length, 1);
});

for (const race of [
  {
    name: 'the same idempotency key', requestKey: 'race-key', winnerKey: 'race-key',
    errorMessage: 'D1_ERROR: UNIQUE constraint failed: work_order_field_days.check_in_idempotency_key: SQLITE_CONSTRAINT',
  },
  {
    name: 'a different idempotency key on the same local day', requestKey: 'loser-key', winnerKey: 'winner-key',
    errorMessage: 'constraint failed',
  },
]) {
  test(`concurrent check-in recovers the winner for ${race.name}`, async () => {
    const env = createEnv();
    const winner = setCheckInRaceWinner(env, { idempotencyKey: race.winnerKey, errorMessage: race.errorMessage });

    const result = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', {
      userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(), idempotencyKey: race.requestKey,
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.json.field_day.id, winner.fieldDayId);
    assert.equal(result.json.media.object_key, undefined);
    assert.equal(result.json.media.url, `/api/workorders/wo-onsite-1/field-media/media-${winner.fieldDayId}`);
    assert.deepEqual(env.__fieldDays.map((item) => item.id), [winner.fieldDayId]);
    assert.deepEqual(env.__media.map((item) => item.field_day_id), [winner.fieldDayId]);
    assert.deepEqual([...env.__objects.keys()], [winner.objectKey]);
  });
}

test('concurrent idempotency-key conflict owned by another check-in remains a conflict', async () => {
  const env = createEnv();
  const winner = setCheckInRaceWinner(env, {
    idempotencyKey: 'shared-race-key', workOrderId: 'wo-other', errorMessage: 'D1_ERROR: UNIQUE constraint',
  });

  const result = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(), idempotencyKey: 'shared-race-key',
  });

  assert.equal(result.response.status, 409);
  assert.deepEqual([...env.__objects.keys()], [winner.objectKey]);
});

test('check-in rejects an unrelated engineer and requests a real photo', async () => {
  const env = createEnv();
  const denied = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', { userType: 'engineer', userId: 'engineer-2', method: 'POST', formData: checkInForm() });
  assert.equal(denied.response.status, 403);

  const missingPhoto = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', { userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: new FormData() });
  assert.equal(missingPhoto.response.status, 400);
  assert.equal(env.__objects.size, 0);
});

test('quote-driven normal check-in blocks when submitted workdays consume the allowance', async () => {
  const env = createEnv();
  Object.assign(env.__workOrders[0], {
    active_quote_version: 1,
    quote_expected_service_days: 2,
    approved_extension_days: 1,
  });
  seedFieldDay(env, {
    id: 'submitted-1', site_local_date: '2026-07-21', status: 'report_submitted',
    check_in_at: '2026-07-21T01:00:00Z',
  });
  seedFieldDay(env, {
    id: 'submitted-2', site_local_date: '2026-07-22', status: 'late_report_submitted',
    check_in_at: '2026-07-22T01:00:00Z',
  });
  seedFieldDay(env, {
    id: 'duplicate-date', site_local_date: '2026-07-22', status: 'report_submitted',
    check_in_at: '2026-07-22T02:00:00Z',
  });
  seedFieldDay(env, {
    id: 'submitted-3', site_local_date: '2026-07-23', status: 'report_submitted',
    check_in_at: '2026-07-23T01:00:00Z',
  });
  seedFieldDay(env, {
    id: 'missing-check-in', site_local_date: '2026-07-20', status: 'report_submitted', check_in_at: null,
  });

  const result = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(),
  });

  assert.equal(result.response.status, 409);
  assert.equal(result.json.code, 'workday_allowance_exhausted');
  assert.equal(env.__objects.size, 0);
  assert.equal(env.__fieldDays.length, 5);
});

test('zero location accuracy is unavailable and a D1 persistence failure deletes the private object', async () => {
  const locationEnv = createEnv();
  const unavailable = await api(locationEnv, '/api/workorders/wo-onsite-1/field-days/check-in', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST',
    formData: checkInForm({ location: { latitude: 31.2304, longitude: 121.4737, accuracy_m: 0, coordinate_system: 'wgs84' } }),
  });
  assert.equal(unavailable.response.status, 201);
  assert.equal(unavailable.json.location_status, 'unavailable');

  const failureEnv = createEnv();
  failureEnv.__failNextMediaInsert = true;
  const failed = await api(failureEnv, '/api/workorders/wo-onsite-1/field-days/check-in', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(),
  });
  assert.equal(failed.response.status, 500);
  assert.equal(failureEnv.__objects.size, 0);
  assert.equal(failureEnv.__fieldDays.length, 0);
  assert.equal(failureEnv.__media.length, 0);
  assert.equal(failureEnv.__arrivalChecks.length, 0);
  assert.equal(failureEnv.__auditLogs.length, 0);
  assert.equal(failureEnv.__workOrders[0].arrival_verified_at, null);
});

test('a failed private-object rollback is queued for scheduler cleanup', async () => {
  const env = createEnv();
  env.__failNextMediaInsert = true;
  env.__deleteFailures = new Set();
  const originalPut = env.FIELD_EVIDENCE.put;
  env.FIELD_EVIDENCE.put = async (...args) => {
    await originalPut(...args);
    env.__deleteFailures.add(args[0]);
  };

  const failed = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(),
  });

  assert.equal(failed.response.status, 500);
  assert.equal(env.__objects.size, 1);
  assert.equal(env.__cleanupQueue.length, 1);
  assert.match(env.__cleanupQueue[0].object_key, /^field-evidence\/com\/wo-onsite-1\//);

  env.__deleteFailures.clear();
  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.equal(env.__objects.size, 0);
  assert.deepEqual(env.__cleanupQueue, []);
});

test('optional plan times, planned checkout fallback, and direct location fields are supported', async () => {
  const env = createEnv();
  env.__workOrders[0].planned_daily_start_time = null;

  const checkedIn = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: directLocationCheckInForm(),
  });

  assert.equal(checkedIn.response.status, 201);
  assert.equal(checkedIn.json.location_status, 'verified');
  assert.match(checkedIn.json.field_day.expected_check_out_at, /T17:30:00$/);
  assert.equal(env.__arrivalChecks.length, 1);
  assert.equal(env.__arrivalChecks[0].args[3], 31.2304);
  assert.equal(env.__arrivalChecks[0].args[4], 121.4737);
});

test('an overdue field day does not block check-in on the next site-local day', async () => {
  const env = createEnv();
  const today = fieldDayLocalDate(new Date(), 'Asia/Shanghai');
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  seedFieldDay(env, { site_local_date: yesterday.toISOString().slice(0, 10), status: 'report_overdue' });

  const checkedIn = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(), idempotencyKey: 'next-day-check-in',
  });

  assert.equal(checkedIn.response.status, 201);
  assert.equal(env.__fieldDays.length, 2);
  assert.equal(env.__fieldDays[1].site_local_date, today);
});

test('site local datetime conversion follows DST without using the host timezone', () => {
  assert.equal(
    siteLocalDateTimeToUtc('2026-03-08T01:30:00', 'America/New_York').toISOString(),
    '2026-03-08T06:30:00.000Z',
  );
  assert.equal(
    siteLocalDateTimeToUtc('2026-03-08T03:30:00', 'America/New_York').toISOString(),
    '2026-03-08T07:30:00.000Z',
  );
});

test('scheduler sends one checkout reminder 30 minutes before site-local checkout', async () => {
  const env = createEnv();
  seedFieldDay(env, {
    site_local_date: '2026-03-08', site_timezone: 'America/New_York',
    expected_check_out_at: '2026-03-08T03:30:00',
  });

  await runScheduled(env, '2026-03-08T07:00:00Z');
  await runScheduled(env, '2026-03-08T07:05:00Z');

  assert.ok(env.__fieldDays[0].checkout_reminder_sent_at);
  assert.equal(env.__notifications.filter((item) => item.args[3] === 'field_checkout_reminder').length, 1);
});

test('scheduler does not insert a reminder when its conditional claim loses', async () => {
  const env = createEnv();
  env.__forceFieldDayClaimMiss = true;
  seedFieldDay(env, {
    site_local_date: '2026-03-08', site_timezone: 'America/New_York',
    expected_check_out_at: '2026-03-08T03:30:00',
  });

  await runScheduled(env, '2026-03-08T07:00:00Z');

  assert.equal(env.__fieldDays[0].checkout_reminder_sent_at, undefined);
  assert.equal(env.__notifications.filter((item) => item.args[3] === 'field_checkout_reminder').length, 0);
});

test('scheduler marks a prior site-local day overdue and notifies engineer and active operations once', async () => {
  const env = createEnv();
  env.__staff.push(
    { id: 'admin-1', role: 'admin', is_active: 1, market_scope: 'all' },
    { id: 'operations-1', role: 'operations', is_active: 1, market_scope: 'com' },
    { id: 'inactive-1', role: 'operations', is_active: 0, market_scope: 'all' },
  );
  seedFieldDay(env, {
    site_local_date: '2026-07-23', site_timezone: 'Asia/Shanghai', expected_check_out_at: '2026-07-23T17:30:00',
  });

  await runScheduled(env, '2026-07-24T00:00:00Z');
  await runScheduled(env, '2026-07-24T00:15:00Z');

  assert.equal(env.__fieldDays[0].status, 'report_overdue');
  assert.ok(env.__fieldDays[0].overdue_notification_sent_at);
  const overdue = env.__notifications.filter((item) => item.args[3] === 'field_report_overdue');
  assert.deepEqual(overdue.map((item) => item.args[1]).sort(), ['admin-1', 'engineer-1', 'operations-1']);
});

test('scheduler rotates beyond a full batch so a newly due checkout reminder is not starved', async () => {
  const env = createEnv();
  for (let index = 0; index < 100; index += 1) {
    seedFieldDay(env, {
      id: `a-${String(index).padStart(3, '0')}`,
      site_local_date: '2026-07-24', site_timezone: 'Asia/Shanghai', expected_check_out_at: '2026-07-24T23:00:00',
    });
  }
  seedFieldDay(env, {
    id: 'z-due', site_local_date: '2026-07-24', site_timezone: 'Asia/Shanghai', expected_check_out_at: '2026-07-24T16:00:00',
  });

  await runScheduled(env, '2026-07-24T07:30:00Z');
  await runScheduled(env, '2026-07-24T07:35:00Z');

  assert.ok(env.__fieldDays.find((item) => item.id === 'z-due').checkout_reminder_sent_at);
  assert.equal(env.__notifications.filter((item) => item.args[0] === 'field-checkout-reminder:z-due').length, 1);
});

test('scheduler processes DB_CN when DB fails without aborting the scan', async () => {
  const cn = createEnv();
  seedFieldDay(cn, {
    site_local_date: '2026-07-23', site_timezone: 'Asia/Shanghai', expected_check_out_at: '2026-07-23T17:30:00',
  });
  const env = {
    ...cn,
    DB: { prepare() { throw new Error('primary D1 unavailable'); } },
    DB_CN: cn.DB,
  };

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.equal(cn.__fieldDays[0].status, 'report_overdue');
});

test('scheduler processes distinct DB and DB_CN bindings in the same run', async () => {
  const primary = createEnv();
  const cn = createEnv();
  seedFieldDay(primary, {
    site_local_date: '2026-07-23', site_timezone: 'Asia/Shanghai', expected_check_out_at: '2026-07-23T17:30:00',
  });
  seedFieldDay(cn, {
    id: 'cn-day', site_local_date: '2026-07-23', site_timezone: 'Asia/Shanghai', expected_check_out_at: '2026-07-23T17:30:00',
  });

  await runScheduled({ ...primary, DB_CN: cn.DB }, '2026-07-24T00:00:00Z');

  assert.equal(primary.__fieldDays[0].status, 'report_overdue');
  assert.equal(cn.__fieldDays[0].status, 'report_overdue');
});

test('retention deletes completed evidence after 12 months regardless of a future due-at and skips open holds', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-07-23T00:00:00Z';
  seedFieldDay(env, { status: 'report_submitted' });
  env.__media.push(
    { id: 'eligible', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'eligible.jpg', privacy_retention_due_at: '2026-07-23T00:00:00Z', deleted_at: null },
    { id: 'held', work_order_id: 'wo-held', field_day_id: 'held-day', object_key: 'held.jpg', deleted_at: null },
    { id: 'recent', work_order_id: 'wo-recent', field_day_id: 'recent-day', object_key: 'recent.jpg', deleted_at: null },
    { id: 'deferred', work_order_id: 'wo-deferred', field_day_id: 'deferred-day', object_key: 'deferred.jpg', privacy_retention_due_at: '2026-08-01T00:00:00Z', deleted_at: null },
    { id: 'resolved-only', work_order_id: 'wo-resolved', field_day_id: 'resolved-day', object_key: 'resolved.jpg', deleted_at: null },
    { id: 'pending-review', work_order_id: 'wo-review', field_day_id: 'review-day', object_key: 'review.jpg', deleted_at: null },
  );
  env.__workOrders.push(
    { id: 'wo-held', status: 'completed', completed_at: '2025-01-01T00:00:00Z' },
    { id: 'wo-recent', status: 'completed', completed_at: '2026-01-01T00:00:00Z' },
    { id: 'wo-deferred', status: 'completed', completed_at: '2025-01-01T00:00:00Z' },
    { id: 'wo-resolved', status: 'resolved', completed_at: '2025-01-01T00:00:00Z' },
    { id: 'wo-review', status: 'pending_review', completed_at: '2025-01-01T00:00:00Z' },
  );
  env.__holds.push({ id: 'hold-1', work_order_id: 'wo-held', status: 'open' });
  for (const key of ['eligible.jpg', 'held.jpg', 'recent.jpg', 'deferred.jpg', 'resolved.jpg', 'review.jpg']) env.__objects.set(key, { body: JPEG.buffer });

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.deepEqual([...env.__deleteAttempts].sort(), ['deferred.jpg', 'eligible.jpg']);
  assert.ok(env.__media.find((item) => item.id === 'eligible').deleted_at);
  assert.equal(env.__media.find((item) => item.id === 'held').deleted_at, null);
  assert.equal(env.__media.find((item) => item.id === 'recent').deleted_at, null);
  assert.ok(env.__media.find((item) => item.id === 'deferred').deleted_at);
  assert.equal(env.__media.find((item) => item.id === 'resolved-only').deleted_at, null);
  assert.equal(env.__media.find((item) => item.id === 'pending-review').deleted_at, null);
});

test('retention leaves database rows untouched when FIELD_EVIDENCE is not configured', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01T00:00:00Z';
  seedFieldDay(env, { status: 'report_submitted' });
  env.__media.push({ id: 'missing-binding', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'missing.jpg', deleted_at: null });
  delete env.FIELD_EVIDENCE;

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.equal(env.__media[0].deleted_at, null);
});

test('opening an evidence hold rejects an active retention deletion claim', async () => {
  const env = createEnv();
  env.__media.push({
    id: 'claimed-media', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'claimed.jpg',
    retention_claim_token: 'retention-claim', retention_claimed_at: '2026-07-24T00:00:00Z', deleted_at: null,
  });

  const result = await api(env, '/api/admin/workorders/wo-onsite-1/evidence-holds', {
    userType: 'admin', userId: 'admin', method: 'POST',
    body: { reason_category: 'complaint', reason: 'Customer evidence review.' },
  });

  assert.equal(result.response.status, 409);
  assert.equal(env.__holds.length, 0);
});

test('retention still runs when the field-day scheduler query fails for the same database', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01T00:00:00Z';
  env.__media.push({ id: 'eligible-after-scheduler-error', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'eligible-after-error.jpg', deleted_at: null });
  const originalDb = env.DB;
  env.DB = {
    prepare(sql) {
      if (/FROM work_order_field_days fd/i.test(normalizeSql(sql))) throw new Error('field-day scan failed');
      return originalDb.prepare(sql);
    },
    batch(statements) { return originalDb.batch(statements); },
  };

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.ok(env.__media[0].deleted_at);
});

test('retention continues after an object delete failure and does not mark the failed object', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01T00:00:00Z';
  seedFieldDay(env, { status: 'report_submitted' });
  env.__media.push(
    { id: 'failed', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'failed.jpg', deleted_at: null },
    { id: 'deleted', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'deleted.jpg', deleted_at: null },
  );
  env.__deleteFailures = new Set(['failed.jpg']);
  env.__objects.set('failed.jpg', { body: JPEG.buffer });
  env.__objects.set('deleted.jpg', { body: JPEG.buffer });

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.deepEqual([...env.__deleteAttempts].sort(), ['deleted.jpg', 'failed.jpg']);
  assert.equal(env.__media[0].deleted_at, null);
  assert.ok(env.__media[1].deleted_at);
});

test('retention releases its deletion claim when an object delete fails', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01T00:00:00Z';
  seedFieldDay(env, { status: 'report_submitted' });
  env.__media.push({ id: 'failed-claim', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'failed-claim.jpg', deleted_at: null });
  env.__deleteFailures = new Set(['failed-claim.jpg']);
  env.__objects.set('failed-claim.jpg', { body: JPEG.buffer });

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.equal(env.__media[0].deleted_at, null);
  assert.equal(env.__media[0].retention_claim_token, null);
  assert.equal(env.__media[0].retention_claimed_at, null);
});

test('retention keeps ownership and marks deleted when delete throws after the object disappeared', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01 00:00:00';
  env.__media.push({ id: 'ambiguous-delete', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'ambiguous-delete.jpg', deleted_at: null });
  env.__objects.set('ambiguous-delete.jpg', { body: JPEG.buffer });
  env.__deleteFailures = new Set(['ambiguous-delete.jpg']);
  env.__deleteBeforeFailure = new Set(['ambiguous-delete.jpg']);

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.ok(env.__media[0].deleted_at);
  assert.equal(env.__media[0].retention_claim_token, null);
});

test('retention retains its claim when delete failure cannot be reconciled', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01 00:00:00';
  env.__media.push({ id: 'unknown-delete', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'unknown-delete.jpg', deleted_at: null });
  env.__objects.set('unknown-delete.jpg', { body: JPEG.buffer });
  env.__deleteFailures = new Set(['unknown-delete.jpg']);
  env.__headFailures = new Set(['unknown-delete.jpg']);

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.equal(env.__media[0].deleted_at, null);
  assert.ok(env.__media[0].retention_claim_token);
});

test('retention recovers a stale claim by deleting the object before marking the media deleted', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01T00:00:00Z';
  env.__media.push({
    id: 'stale-claim', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'stale-claim.jpg',
    retention_claim_token: 'old-token', retention_claimed_at: '2026-07-23T22:00:00Z', deleted_at: null,
  });
  env.__objects.set('stale-claim.jpg', { body: JPEG.buffer });

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.deepEqual(env.__deleteAttempts, ['stale-claim.jpg']);
  assert.ok(env.__media[0].deleted_at);
  assert.equal(env.__media[0].retention_claim_token, null);
});

test('retention keeps its claim when R2 deletion succeeds but the conditional delete mark fails', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01T00:00:00Z';
  env.__media.push({ id: 'mark-failure', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'mark-failure.jpg', deleted_at: null });
  env.__objects.set('mark-failure.jpg', { body: JPEG.buffer });
  env.__failRetentionMarkOnce = true;

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.deepEqual(env.__deleteAttempts, ['mark-failure.jpg']);
  assert.equal(env.__media[0].deleted_at, null);
  assert.ok(env.__media[0].retention_claim_token);
  const hold = await api(env, '/api/admin/workorders/wo-onsite-1/evidence-holds', {
    userType: 'admin', userId: 'admin', method: 'POST',
    body: { reason_category: 'legal_hold', reason: 'Preserve retained evidence.' },
  });
  assert.equal(hold.response.status, 409);
});

test('retention keeps and later reconciles a claim when the post-delete conditional mark loses', async () => {
  const env = createEnv();
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01 00:00:00';
  env.__media.push({ id: 'mark-miss', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'mark-miss.jpg', deleted_at: null });
  env.__objects.set('mark-miss.jpg', { body: JPEG.buffer });
  env.__forceRetentionMarkMiss = true;

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.equal(env.__media[0].deleted_at, null);
  assert.ok(env.__media[0].retention_claim_token);
  env.__forceRetentionMarkMiss = false;
  env.__media[0].retention_claimed_at = '2026-07-23T22:00:00Z';
  await runScheduled(env, '2026-07-24T00:15:00Z');
  assert.ok(env.__media[0].deleted_at);
  assert.deepEqual(env.__deleteAttempts, ['mark-miss.jpg', 'mark-miss.jpg']);
});

test('retention filters eligible candidates in SQL before applying its bounded batch', async () => {
  const env = createEnv();
  for (let index = 0; index < 100; index += 1) {
    const workOrderId = `wo-active-${index}`;
    env.__workOrders.push({ id: workOrderId, status: 'in_service', completed_at: null });
    env.__media.push({ id: `a-${String(index).padStart(3, '0')}`, work_order_id: workOrderId, field_day_id: `day-${index}`, object_key: `active-${index}.jpg`, deleted_at: null });
  }
  env.__workOrders[0].status = 'completed';
  env.__workOrders[0].completed_at = '2025-01-01T00:00:00Z';
  env.__media.push({ id: 'z-eligible', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', object_key: 'eligible-after-active.jpg', deleted_at: null });
  env.__objects.set('eligible-after-active.jpg', { body: JPEG.buffer });

  await runScheduled(env, '2026-07-24T00:00:00Z');

  assert.ok(env.__media.find((item) => item.id === 'z-eligible').deleted_at);
  const retentionQuery = env.__queries.find(({ sql }) => /FROM work_order_field_day_media m JOIN work_orders wo/i.test(sql));
  assert.match(retentionQuery.sql, /wo\.status = 'completed'/i);
  assert.match(retentionQuery.sql, /wo\.completed_at <= \?/i);
  assert.match(retentionQuery.sql, /NOT EXISTS \( SELECT 1 FROM work_order_field_evidence_holds/i);
  assert.equal(retentionQuery.args[0], '2025-07-24 00:00:00');
});

test('operations staff can read their overdue notification list and unread count', async () => {
  const env = createEnv();
  env.__notifications.push({ args: ['field-report-overdue:day:admin:operations-1', 'operations-1', 'admin', 'field_report_overdue', 'Field report overdue', 'Daily report required', null] });

  const auth = { userType: 'admin', userId: 'operations-1', staffId: 'operations-1', staffRole: 'operations' };
  const list = await api(env, '/api/notifications', auth);
  const unread = await api(env, '/api/notifications/unread-count', auth);

  assert.equal(list.response.status, 200, JSON.stringify(list.json));
  assert.equal(list.json.notifications[0].type, 'field_report_overdue');
  assert.equal(unread.response.status, 200, JSON.stringify(unread.json));
  assert.equal(unread.json.count, 1);
});

test('check-in rejects a nonexistent site-local DST checkout time before persisting evidence', async () => {
  const env = createEnv();
  Object.assign(env.__workOrders[0], { site_timezone: 'America/New_York' });
  env.FIELD_WORK_NOW = '2026-03-08T06:00:00Z';
  const formData = checkInForm();
  formData.set('expected_checkout_time', '02:30');

  const result = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData,
  });

  assert.equal(result.response.status, 400);
  assert.equal(env.__fieldDays.length, 0);
  assert.equal(env.__objects.size, 0);
});

test('check-in cannot persist after a concurrent final closure', async () => {
  const env = createEnv();
  env.__closeBeforeFieldWrite = true;

  const result = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm(),
  });

  assert.equal(result.response.status, 409);
  assert.equal(env.__workOrders[0].status, 'resolved');
  assert.equal(env.__fieldDays.length, 0);
  assert.equal(env.__objects.size, 0);
});

test('customer field-day list and protected media expose only customer-visible evidence', async () => {
  const env = createEnv();
  const checkedIn = await api(env, '/api/workorders/wo-onsite-1/field-days/check-in', { userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: checkInForm() });
  Object.assign(env.__fieldDays[0], {
    internal_note: 'Internal dispatch note',
    late_reason: 'Customer requested a delayed start',
    location_status: 'outside_geofence',
    latitude: 31.2304,
    longitude: 121.4737,
    accuracy_m: 8,
    coordinate_system: 'wgs84',
    location_source: 'browser',
    distance_m: 250,
    radius_m: 100,
    within_geofence: 0,
  });
  const media = env.__media[0];
  env.__media.push({ ...media, id: 'media-internal', object_key: 'field-evidence/com/wo-onsite-1/day/internal.jpg', customer_visible: 0 });

  const list = await api(env, '/api/workorders/wo-onsite-1/field-days', { userType: 'customer', userId: 'customer-1' });
  assert.equal(list.response.status, 200);
  assert.equal(list.json.field_days.length, 1);
  assert.equal(list.json.media.length, 1);
  assert.equal(list.json.field_days[0].internal_note, undefined);
  assert.equal(list.json.field_days[0].late_reason, 'Customer requested a delayed start');
  for (const field of ['location_status', 'latitude', 'longitude', 'accuracy_m', 'coordinate_system', 'location_source', 'distance_m', 'radius_m', 'within_geofence']) {
    assert.equal(list.json.field_days[0][field], undefined, `customer field-day list exposed ${field}`);
  }
  assert.equal(list.json.media[0].object_key, undefined);
  assert.equal(list.json.media.some((item) => item.id === 'media-internal'), false);

  const hidden = await api(env, '/api/workorders/wo-onsite-1/field-media/media-internal', { userType: 'customer', userId: 'customer-1' });
  assert.equal(hidden.response.status, 403);

  const visible = await api(env, `/api/workorders/wo-onsite-1/field-media/${checkedIn.json.media.id}`, { userType: 'customer', userId: 'customer-1' });
  assert.equal(visible.response.status, 200);
  assert.equal(visible.response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(visible.response.headers.get('Content-Disposition'), 'inline');
  assert.equal(visible.response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(visible.response.headers.get('Cache-Control'), 'private, no-store');
});

test('nonparticipating regional lead keeps work-order access without receiving private field-work data', async () => {
  const env = createEnv();
  env.__workOrders[0].assigned_regional_lead_id = 'lead-1';
  seedFieldDay(env, {
    internal_note: 'Engineer-only diagnosis',
    location_status: 'outside_geofence',
    latitude: 31.2304,
    longitude: 121.4737,
    accuracy_m: 8,
    coordinate_system: 'wgs84',
    location_source: 'browser',
    distance_m: 250,
    radius_m: 100,
    within_geofence: 0,
  });
  env.__media.push(
    { id: 'lead-public-media', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', purpose: 'progress', object_key: 'lead-public.jpg', mime_type: 'image/jpeg', customer_visible: 1 },
    { id: 'lead-internal-media', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', purpose: 'internal', object_key: 'lead-internal.jpg', mime_type: 'image/jpeg', customer_visible: 0 },
  );
  env.__objects.set('lead-public.jpg', { body: JPEG.buffer, httpMetadata: { contentType: 'image/jpeg' } });
  env.__objects.set('lead-internal.jpg', { body: JPEG.buffer, httpMetadata: { contentType: 'image/jpeg' } });

  const leadDetail = await api(env, '/api/workorders/wo-onsite-1', { userType: 'engineer', userId: 'lead-1' });
  assert.equal(leadDetail.response.status, 200);
  assert.equal(leadDetail.json.id, 'wo-onsite-1');
  assert.equal(leadDetail.json.service_latitude, undefined);
  assert.equal(leadDetail.json.service_longitude, undefined);
  assert.deepEqual(leadDetail.json.arrival_checks, []);
  assert.deepEqual(leadDetail.json.field_days, []);
  assert.deepEqual(leadDetail.json.field_extension_requests, []);
  assert.deepEqual(leadDetail.json.pending_extension_requests, []);
  assert.equal(JSON.stringify(leadDetail.json).includes('Engineer-only diagnosis'), false);
  assert.equal(JSON.stringify(leadDetail.json).includes('outside_geofence'), false);
  assert.equal(JSON.stringify(leadDetail.json).includes('lead-internal-media'), false);
  assert.equal(JSON.stringify(leadDetail.json).includes('lead-internal.jpg'), false);

  const leadList = await api(env, '/api/workorders/wo-onsite-1/field-days', { userType: 'engineer', userId: 'lead-1' });
  assert.equal(leadList.response.status, 403);

  for (const mediaId of ['lead-public-media', 'lead-internal-media']) {
    const denied = await api(env, `/api/workorders/wo-onsite-1/field-media/${mediaId}`, { userType: 'engineer', userId: 'lead-1' });
    assert.equal(denied.response.status, 403);
  }

  const assignedDetail = await api(env, '/api/workorders/wo-onsite-1', { userType: 'engineer', userId: 'engineer-1' });
  assert.equal(assignedDetail.json.field_days[0].internal_note, 'Engineer-only diagnosis');
  assert.equal(assignedDetail.json.field_days[0].location_status, 'outside_geofence');
  assert.equal(assignedDetail.json.field_days[0].latitude, 31.2304);
  assert.deepEqual(new Set(assignedDetail.json.field_days[0].media.map((item) => item.id)), new Set(['lead-public-media', 'lead-internal-media']));

  const adminDetail = await api(env, '/api/workorders/wo-onsite-1', { userType: 'admin', userId: 'admin' });
  assert.equal(adminDetail.json.field_days[0].internal_note, 'Engineer-only diagnosis');
  assert.equal(adminDetail.json.field_days[0].location_status, 'outside_geofence');
  assert.equal(adminDetail.json.field_days[0].longitude, 121.4737);
  assert.deepEqual(new Set(adminDetail.json.field_days[0].media.map((item) => item.id)), new Set(['lead-public-media', 'lead-internal-media']));
});

test('historical engineers only read their own field days and protected media after reassignment', async () => {
  const env = createEnv();
  env.__workOrders[0].engineer_id = 'engineer-2';
  seedFieldDay(env, {
    id: 'old-day', engineer_id: 'engineer-1', internal_note: 'Old engineer note',
    location_status: 'outside_geofence', latitude: 31.2304, longitude: 121.4737, within_geofence: 0,
  });
  seedFieldDay(env, { id: 'new-day', engineer_id: 'engineer-2', internal_note: 'New engineer note' });
  env.__media.push(
    { id: 'old-internal', work_order_id: 'wo-onsite-1', field_day_id: 'old-day', object_key: 'old-internal.jpg', mime_type: 'image/jpeg', customer_visible: 0 },
    { id: 'new-internal', work_order_id: 'wo-onsite-1', field_day_id: 'new-day', object_key: 'new-internal.jpg', mime_type: 'image/jpeg', customer_visible: 0 },
  );
  env.__objects.set('old-internal.jpg', { body: JPEG.buffer, httpMetadata: { contentType: 'image/jpeg' } });
  env.__objects.set('new-internal.jpg', { body: JPEG.buffer, httpMetadata: { contentType: 'image/jpeg' } });

  const oldList = await api(env, '/api/workorders/wo-onsite-1/field-days', { userType: 'engineer', userId: 'engineer-1' });
  assert.equal(oldList.response.status, 200);
  assert.deepEqual(oldList.json.field_days.map((item) => item.id), ['old-day']);
  assert.deepEqual(oldList.json.media.map((item) => item.id), ['old-internal']);

  const oldDetail = await api(env, '/api/workorders/wo-onsite-1', { userType: 'engineer', userId: 'engineer-1' });
  assert.equal(oldDetail.response.status, 200);
  assert.deepEqual(Object.keys(oldDetail.json).sort(), ['field_days', 'field_work_summary', 'id', 'order_no', 'service_mode', 'status']);
  assert.deepEqual(oldDetail.json.field_days.map((item) => item.id), ['old-day']);
  assert.equal(oldDetail.json.field_days[0].internal_note, 'Old engineer note');
  assert.equal(oldDetail.json.field_days[0].location_status, 'outside_geofence');
  assert.equal(oldDetail.json.field_days[0].latitude, 31.2304);
  assert.equal(oldDetail.json.field_days[0].within_geofence, 0);
  assert.deepEqual(oldDetail.json.field_days[0].media.map((item) => item.id), ['old-internal']);

  const ownMedia = await api(env, '/api/workorders/wo-onsite-1/field-media/old-internal', { userType: 'engineer', userId: 'engineer-1' });
  assert.equal(ownMedia.response.status, 200);
  const laterMedia = await api(env, '/api/workorders/wo-onsite-1/field-media/new-internal', { userType: 'engineer', userId: 'engineer-1' });
  assert.equal(laterMedia.response.status, 403);

  const currentList = await api(env, '/api/workorders/wo-onsite-1/field-days', { userType: 'engineer', userId: 'engineer-2' });
  assert.equal(currentList.response.status, 200);
  assert.deepEqual(new Set(currentList.json.field_days.map((item) => item.id)), new Set(['old-day', 'new-day']));
  assert.deepEqual(new Set(currentList.json.media.map((item) => item.id)), new Set(['old-internal', 'new-internal']));

  const currentDetail = await api(env, '/api/workorders/wo-onsite-1', { userType: 'engineer', userId: 'engineer-2' });
  assert.equal(currentDetail.response.status, 200);
  assert.deepEqual(new Set(currentDetail.json.field_days.map((item) => item.id)), new Set(['old-day', 'new-day']));
  assert.deepEqual(
    new Set(currentDetail.json.field_days.flatMap((item) => item.media.map((media) => media.id))),
    new Set(['old-internal', 'new-internal']),
  );
  const currentReadsOldMedia = await api(env, '/api/workorders/wo-onsite-1/field-media/old-internal', { userType: 'engineer', userId: 'engineer-2' });
  assert.equal(currentReadsOldMedia.response.status, 200);
});

test('operations staff can stream authorized private field media read-only', async () => {
  const env = createEnv();
  seedFieldDay(env);
  env.__media.push({
    id: 'operations-media', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', purpose: 'internal',
    object_key: 'operations-media.jpg', mime_type: 'image/jpeg', customer_visible: 0,
  });
  env.__objects.set('operations-media.jpg', { body: JPEG.buffer, httpMetadata: { contentType: 'image/jpeg' } });

  const result = await api(env, '/api/workorders/wo-onsite-1/field-media/operations-media', {
    userType: 'admin', userId: 'operations-1', staffId: 'operations-1', staffRole: 'operations',
  });

  assert.equal(result.response.status, 200, JSON.stringify(result.json));
  assert.equal(result.response.headers.get('Content-Type'), 'image/jpeg');
});

test('Admin field plan validates ownership, role, and writes an audited before/after change', async () => {
  const env = createEnv();
  const body = {
    site_timezone: 'America/Los_Angeles', expected_service_days: 4,
    expected_completion_date: '2026-07-30', planned_daily_start_time: '09:00', planned_daily_end_time: '18:00',
  };
  const denied = await api(env, '/api/admin/workorders/wo-onsite-1/field-plan', {
    userType: 'admin', userId: 'operations-1', staffId: 'operations-1', staffRole: 'operations', method: 'PATCH', body,
  });
  assert.equal(denied.response.status, 403);

  const invalid = await api(env, '/api/admin/workorders/wo-onsite-1/field-plan', {
    userType: 'admin', userId: 'admin', method: 'PATCH', body: { ...body, site_timezone: '+08:00' },
  });
  assert.equal(invalid.response.status, 400);

  const updated = await api(env, '/api/admin/workorders/wo-onsite-1/field-plan', {
    userType: 'admin', userId: 'admin', method: 'PATCH', body,
  });
  assert.equal(updated.response.status, 200);
  assert.equal(env.__workOrders[0].site_timezone, 'America/Los_Angeles');
  assert.equal(env.__auditLogs.length, 1);
  assert.match(env.__auditLogs[0].args[6], /Asia\/Shanghai/);
  assert.match(env.__auditLogs[0].args[7], /America\/Los_Angeles/);
});

test('active quote field plan is immutable through the normal Admin plan route', async () => {
  const env = createEnv();
  Object.assign(env.__workOrders[0], {
    active_quote_version: 1,
    quote_expected_service_days: 2,
  });

  const result = await api(env, '/api/admin/workorders/wo-onsite-1/field-plan', {
    userType: 'admin', userId: 'admin', method: 'PATCH', body: {
      site_timezone: 'America/Los_Angeles', expected_service_days: 4,
      expected_completion_date: '2026-07-30', planned_daily_start_time: '09:00', planned_daily_end_time: '18:00',
    },
  });

  assert.equal(result.response.status, 409);
  assert.equal(result.json.code, 'quote_driven_field_plan');
  assert.equal(env.__workOrders[0].site_timezone, 'Asia/Shanghai');
  assert.equal(env.__workOrders[0].expected_service_days, 2);
  assert.equal(env.__auditLogs.length, 0);
});

test('daily report enforces required fields, progress evidence, positive hours, and overdue reason', async () => {
  for (const [overrides, expectedError] of [
    [{ completed_work: '' }, 'daily_report_incomplete'],
    [{ progress_photos: [] }, 'progress_photo_required'],
    [{ labor_hours: '0' }, 'labor_hours_invalid'],
  ]) {
    const env = createEnv();
    seedFieldDay(env);
    const result = await api(env, '/api/workorders/wo-onsite-1/field-days/field-day-1/report', {
      userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: reportForm(overrides),
    });
    assert.equal(result.response.status, 400);
    assert.equal(result.json.code, expectedError);
  }

  const overdueEnv = createEnv();
  seedFieldDay(overdueEnv, { status: 'report_overdue' });
  const overdue = await api(overdueEnv, '/api/workorders/wo-onsite-1/field-days/field-day-1/report', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: reportForm(),
  });
  assert.equal(overdue.response.status, 400);
  assert.equal(overdue.json.code, 'late_reason_required');
});

test('daily report stores public and internal photos once, notifies customer, and compensates failed D1 writes', async () => {
  const env = createEnv();
  seedFieldDay(env);
  const form = reportForm({
    progress_photos: [new Blob([JPEG], { type: 'image/jpeg' }), new Blob([JPEG], { type: 'image/jpeg' })],
    internal_photos: [new Blob([JPEG], { type: 'image/jpeg' })],
  });
  const first = await api(env, '/api/workorders/wo-onsite-1/field-days/field-day-1/report', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: form, idempotencyKey: 'report-1',
  });
  assert.equal(first.response.status, 201);
  assert.equal(env.__fieldDays[0].status, 'report_submitted');
  assert.deepEqual(env.__media.map((item) => item.customer_visible), [1, 1, 0]);
  assert.equal(env.__objects.size, 3);
  assert.equal(env.__notifications.length, 1);
  assert.equal(first.json.media.every((item) => item.object_key === undefined && item.url.includes(item.id)), true);

  const retry = await api(env, '/api/workorders/wo-onsite-1/field-days/field-day-1/report', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: reportForm(), idempotencyKey: 'report-1',
  });
  assert.equal(retry.response.status, 200);
  assert.equal(env.__media.length, 3);
  assert.equal(env.__notifications.length, 1);

  const failedEnv = createEnv();
  seedFieldDay(failedEnv);
  failedEnv.__failNextMediaInsert = true;
  const failed = await api(failedEnv, '/api/workorders/wo-onsite-1/field-days/field-day-1/report', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: reportForm(), idempotencyKey: 'report-fail',
  });
  assert.equal(failed.response.status, 500);
  assert.equal(failedEnv.__objects.size, 0);
  assert.equal(failedEnv.__fieldDays[0].status, 'checked_in');
});

test('post-commit notification failure keeps the submitted report and R2 evidence', async () => {
  const env = createEnv();
  seedFieldDay(env);
  let notificationAttempted = false;
  env.FIELD_WORK_NOTIFIER = async () => {
    notificationAttempted = true;
    throw new Error('notification transport failed');
  };

  const result = await api(env, '/api/workorders/wo-onsite-1/field-days/field-day-1/report', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', formData: reportForm(), idempotencyKey: 'report-notify-fail',
  });

  assert.equal(notificationAttempted, true);
  assert.equal(result.response.status, 201);
  assert.equal(env.__fieldDays[0].status, 'report_submitted');
  assert.equal(env.__media.length, 1);
  assert.equal(env.__objects.size, 1);
});

test('daily report validates all photos before upload and can create one extension in the same batch', async () => {
  const invalidEnv = createEnv();
  seedFieldDay(invalidEnv);
  const invalid = await api(invalidEnv, '/api/workorders/wo-onsite-1/field-days/field-day-1/report', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST',
    formData: reportForm({ progress_photos: [
      new Blob([JPEG], { type: 'image/jpeg' }),
      new Blob([new Uint8Array([0x00, 0x01, 0x02])], { type: 'image/jpeg' }),
    ] }),
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalidEnv.__objects.size, 0);

  const env = createEnv();
  seedFieldDay(env);
  env.__staff.push({ id: 'operations-1', role: 'operations', is_active: 1, market_scope: 'all' });
  const submitted = await api(env, '/api/workorders/wo-onsite-1/field-days/field-day-1/report', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', idempotencyKey: 'report-with-extension',
    formData: reportForm({
      extension_reason: 'Replacement part delivery moved.',
      extension_customer_explanation: 'One additional visit is required.',
      requested_additional_days: '2', proposed_completion_date: '2026-07-26',
      extension_internal_note: 'Supplier confirmed dispatch.',
    }),
  });
  assert.equal(submitted.response.status, 201);
  assert.equal(env.__extensions.length, 1);
  assert.equal(env.__extensions[0].field_day_id, 'field-day-1');
  assert.equal(env.__logs.length, 1);
  assert.equal(env.__notifications.some((item) => item.args[1] === 'operations-1' && item.args[3] === 'extension_requested'), true);
});

test('engineer extension requests allow one pending request and Admin approve or reject with notifications', async () => {
  const env = createEnv();
  env.__staff.push({ id: 'operations-1', role: 'operations', is_active: 1, market_scope: 'all' });
  const requestBody = {
    reason: 'Replacement part delivery moved.', customer_explanation: 'One additional visit is required.',
    requested_additional_days: 2, proposed_completion_date: '2026-07-26', internal_note: 'Supplier confirmed dispatch.',
  };
  const created = await api(env, '/api/workorders/wo-onsite-1/extension-requests', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', body: requestBody,
  });
  assert.equal(created.response.status, 201);
  assert.equal(env.__extensions.length, 1);
  assert.match(env.__extensions[0].original_plan, /expected_service_days/);
  assert.equal(env.__logs.length, 1);
  assert.equal(env.__notifications.some((item) => item.args[1] === 'operations-1' && item.args[3] === 'extension_requested'), true);

  const shortened = await api(createEnv(), '/api/workorders/wo-onsite-1/extension-requests', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST',
    body: { reason: 'Needs time', customer_explanation: 'Needs time', requested_additional_days: 1, proposed_completion_date: '2026-07-24' },
  });
  assert.equal(shortened.response.status, 400);
  assert.equal(shortened.json.error, 'proposed_completion_date_not_extended');

  const duplicate = await api(env, '/api/workorders/wo-onsite-1/extension-requests', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', body: requestBody,
  });
  assert.equal(duplicate.response.status, 409);

  const approved = await api(env, `/api/admin/workorders/wo-onsite-1/extension-requests/${env.__extensions[0].id}/decision`, {
    userType: 'admin', userId: 'admin', method: 'POST', body: { decision: 'approved', decision_reason: 'Schedule and evidence support the request.' },
  });
  assert.equal(approved.response.status, 200);
  assert.equal(env.__extensions[0].status, 'approved');
  assert.equal(env.__workOrders[0].expected_service_days, 4);
  assert.equal(env.__workOrders[0].expected_completion_date, '2026-07-26');
  assert.equal(env.__notifications.filter((item) => item.args[2] === 'engineer').length, 1);
  assert.equal(env.__notifications.filter((item) => item.args[2] === 'customer').length, 1);

  const rejectEnv = createEnv();
  rejectEnv.__extensions.push({ ...env.__extensions[0], id: 'extension-reject', status: 'pending', approved_plan: null });
  const rejected = await api(rejectEnv, '/api/admin/workorders/wo-onsite-1/extension-requests/extension-reject/decision', {
    userType: 'admin', userId: 'admin', method: 'POST', body: { decision: 'rejected', decision_reason: 'Current plan remains achievable.' },
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejectEnv.__workOrders[0].expected_service_days, 2);
  assert.equal(rejectEnv.__notifications.filter((item) => item.args[2] === 'customer').length, 0);
});

test('extension request cannot persist after a concurrent final closure', async () => {
  const env = createEnv();
  env.__closeBeforeFieldWrite = true;
  const requestBody = {
    reason: 'Replacement part delivery moved.', customer_explanation: 'One additional visit is required.',
    requested_additional_days: 2, proposed_completion_date: '2026-07-26', internal_note: 'Supplier confirmed dispatch.',
  };

  const result = await api(env, '/api/workorders/wo-onsite-1/extension-requests', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', body: requestBody,
  });

  assert.equal(result.response.status, 409);
  assert.equal(env.__workOrders[0].status, 'resolved');
  assert.equal(env.__extensions.length, 0);
});

test('quote-driven extension approval increments time allowance without mutating quote or payment rows', async () => {
  const env = createEnv();
  Object.assign(env.__workOrders[0], {
    active_quote_version: 1,
    quote_expected_service_days: 2,
    approved_extension_days: 1,
  });
  env.__extensions.push({
    id: 'quote-extension', work_order_id: 'wo-onsite-1', engineer_id: 'engineer-1',
    requested_additional_days: 2, proposed_completion_date: '2026-07-30', status: 'pending',
  });

  const result = await api(env, '/api/admin/workorders/wo-onsite-1/extension-requests/quote-extension/decision', {
    userType: 'admin', userId: 'admin', method: 'POST',
    body: { decision: 'approved', decision_reason: 'Two additional onsite days approved.' },
  });

  assert.equal(result.response.status, 200);
  assert.equal(env.__workOrders[0].approved_extension_days, 3);
  assert.equal(env.__workOrders[0].expected_service_days, 2);
  assert.equal(env.__workOrders[0].quote_expected_service_days, 2);
  assert.equal(env.__workOrders[0].expected_completion_date, '2026-07-24');
  assert.equal(env.__writes.some(({ sql }) => /work_order_(?:pricing|payment_schedule|installments|receipt_claims|payments)/i.test(sql)), false);
});

for (const decision of ['approved', 'rejected']) {
  test(`extension ${decision} remains successful when post-commit notifications fail and replays safely`, async () => {
    const env = createEnv();
    env.__extensions.push({
      id: `extension-${decision}`, work_order_id: 'wo-onsite-1', field_day_id: null,
      engineer_id: 'engineer-1', requested_additional_days: 2, proposed_completion_date: '2026-07-26',
      status: 'pending', original_plan: JSON.stringify({ expected_service_days: 2, expected_completion_date: '2026-07-24' }),
    });
    let notificationAttempts = 0;
    env.FIELD_WORK_NOTIFIER = async () => {
      notificationAttempts += 1;
      throw new Error('notification transport failed');
    };
    const body = { decision, decision_reason: `${decision} after review` };

    const first = await api(env, `/api/admin/workorders/wo-onsite-1/extension-requests/extension-${decision}/decision`, {
      userType: 'admin', userId: 'admin', method: 'POST', body,
    });

    assert.equal(notificationAttempts > 0, true);
    assert.equal(first.response.status, 200);
    assert.equal(first.json.extension_request.status, decision);
    assert.equal(env.__extensions[0].status, decision);
    assert.equal(env.__workOrders[0].expected_service_days, decision === 'approved' ? 4 : 2);
    assert.equal(env.__workOrders[0].expected_completion_date, decision === 'approved' ? '2026-07-26' : '2026-07-24');

    const replay = await api(env, `/api/admin/workorders/wo-onsite-1/extension-requests/extension-${decision}/decision`, {
      userType: 'admin', userId: 'admin', method: 'POST', body,
    });
    assert.equal(replay.response.status, 200);
    assert.equal(replay.json.extension_request.status, decision);
    assert.equal(env.__workOrders[0].expected_service_days, decision === 'approved' ? 4 : 2);
  });
}

test('concurrent extension decision returns the stored same decision instead of a false failure', async () => {
  const env = createEnv();
  env.__extensions.push({
    id: 'extension-race-same', work_order_id: 'wo-onsite-1', engineer_id: 'engineer-1',
    requested_additional_days: 2, proposed_completion_date: '2026-07-26', status: 'pending',
  });
  setExtensionDecisionRaceWinner(env, { requestId: 'extension-race-same', decision: 'approved' });

  const result = await api(env, '/api/admin/workorders/wo-onsite-1/extension-requests/extension-race-same/decision', {
    userType: 'admin', userId: 'admin', method: 'POST',
    body: { decision: 'approved', decision_reason: 'Approved by this Admin too.' },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.json.extension_request.status, 'approved');
  assert.equal(result.json.extension_request.decision_reason, 'Concurrent Admin decision');
  assert.equal(env.__workOrders[0].expected_service_days, 4);
  assert.equal(env.__notifications.length, 0);
});

test('concurrent opposite extension decision returns conflict with the winning decision preserved', async () => {
  const env = createEnv();
  env.__extensions.push({
    id: 'extension-race-opposite', work_order_id: 'wo-onsite-1', engineer_id: 'engineer-1',
    requested_additional_days: 2, proposed_completion_date: '2026-07-26', status: 'pending',
  });
  setExtensionDecisionRaceWinner(env, { requestId: 'extension-race-opposite', decision: 'rejected' });

  const result = await api(env, '/api/admin/workorders/wo-onsite-1/extension-requests/extension-race-opposite/decision', {
    userType: 'admin', userId: 'admin', method: 'POST',
    body: { decision: 'approved', decision_reason: 'This Admin attempted approval.' },
  });

  assert.equal(result.response.status, 409);
  assert.equal(env.__extensions[0].status, 'rejected');
  assert.equal(env.__workOrders[0].expected_service_days, 2);
  assert.equal(env.__notifications.length, 0);
});

test('non-concurrent extension decision errors remain server errors', async () => {
  const env = createEnv();
  env.__extensions.push({
    id: 'extension-non-race-error', work_order_id: 'wo-onsite-1', engineer_id: 'engineer-1',
    requested_additional_days: 2, proposed_completion_date: '2026-07-26', status: 'pending',
  });
  setExtensionDecisionRaceWinner(env, {
    requestId: 'extension-non-race-error', decision: 'approved', errorMessage: 'D1 storage unavailable',
  });

  const result = await api(env, '/api/admin/workorders/wo-onsite-1/extension-requests/extension-non-race-error/decision', {
    userType: 'admin', userId: 'admin', method: 'POST',
    body: { decision: 'approved', decision_reason: 'Attempted approval.' },
  });

  assert.equal(result.response.status, 500);
});

test('Admin override, report correction, and evidence holds are reasoned and audited', async () => {
  const env = createEnv();
  const created = await api(env, '/api/admin/workorders/wo-onsite-1/field-days/override', {
    userType: 'admin', userId: 'admin', method: 'POST', body: {
      action: 'create_day', reason: 'Legacy paper attendance verified.', site_local_date: '2026-07-23',
      engineer_id: 'engineer-1', site_timezone: 'Asia/Shanghai', check_in_at: '2026-07-23T01:00:00Z',
    },
  });
  assert.equal(created.response.status, 201);
  assert.equal(env.__fieldDays[0].status, 'admin_override_open');
  assert.equal(env.__fieldDays[0].location_status, 'admin_override');
  assert.equal(env.__fieldDays[0].capture_source, 'admin_override');

  env.__fieldDays[0].status = 'report_submitted';
  Object.assign(env.__fieldDays[0], { labor_hours: 7, completed_work: 'Old work', issues_risks: 'Old risk', next_plan: 'Old plan', customer_support_needed: 'Old support' });
  const corrected = await api(env, `/api/admin/workorders/wo-onsite-1/field-days/${env.__fieldDays[0].id}/report`, {
    userType: 'admin', userId: 'admin', method: 'PATCH', body: {
      reason: 'Customer confirmed the corrected labor time.', labor_hours: 8, completed_work: 'Corrected work',
      issues_risks: 'No risk', next_plan: 'Continue verification', customer_support_needed: 'None', internal_note: 'Reviewed',
    },
  });
  assert.equal(corrected.response.status, 200);
  assert.equal(env.__revisions.length, 1);
  assert.match(env.__revisions[0].previous_report, /Old work/);

  const opened = await api(env, '/api/admin/workorders/wo-onsite-1/evidence-holds', {
    userType: 'admin', userId: 'admin', method: 'POST', body: { reason_category: 'dispute', reason: 'Preserve evidence during dispute review.' },
  });
  assert.equal(opened.response.status, 201);
  const resolved = await api(env, `/api/admin/workorders/wo-onsite-1/evidence-holds/${env.__holds[0].id}/resolve`, {
    userType: 'admin', userId: 'admin', method: 'POST', body: { resolution_reason: 'Dispute closed with customer confirmation.' },
  });
  assert.equal(resolved.response.status, 200);
  assert.equal(env.__holds[0].status, 'resolved');
  assert.ok(env.__auditLogs.length >= 4);
});

test('field-work detail filters internal evidence and Admin list reports daily indicators', async () => {
  const env = createEnv();
  seedFieldDay(env, {
    status: 'report_overdue', labor_hours: 6, internal_note: 'Internal only', capture_source: 'admin_override',
    location_status: 'outside_geofence', latitude: 31.2, longitude: 121.4, within_geofence: 0,
  });
  env.__media.push(
    { id: 'public-media', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', purpose: 'progress', object_key: 'public-key', customer_visible: 1 },
    { id: 'internal-media', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', purpose: 'internal', object_key: 'internal-key', customer_visible: 0 },
  );
  env.__extensions.push({ id: 'pending-extension', work_order_id: 'wo-onsite-1', status: 'pending', internal_note: 'Internal extension note' });

  const detail = await api(env, '/api/workorders/wo-onsite-1', { userType: 'customer', userId: 'customer-1' });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.service_latitude, undefined);
  assert.equal(detail.json.service_longitude, undefined);
  assert.equal(detail.json.field_days[0].internal_note, undefined);
  assert.equal(detail.json.field_days[0].latitude, undefined);
  assert.equal(detail.json.field_days[0].longitude, undefined);
  assert.equal(detail.json.field_days[0].location_status, undefined);
  assert.equal(detail.json.field_days[0].within_geofence, undefined);
  assert.deepEqual(detail.json.field_days[0].media.map((item) => item.id), ['public-media']);
  assert.equal(detail.json.field_days[0].media[0].object_key, undefined);
  assert.equal(detail.json.field_work_summary.total_days, 1);
  assert.deepEqual(detail.json.field_extension_requests, []);
  assert.deepEqual(detail.json.pending_extension_requests, []);

  const engineerDetail = await api(env, '/api/workorders/wo-onsite-1', { userType: 'engineer', userId: 'engineer-1' });
  assert.equal(engineerDetail.response.status, 200);
  assert.equal(engineerDetail.json.field_extension_requests[0].status, 'pending');
  assert.equal(engineerDetail.json.pending_extension_requests[0].internal_note, 'Internal extension note');

  const adminList = await api(env, '/api/admin/workorders', { userType: 'admin', userId: 'admin' });
  assert.equal(adminList.response.status, 200);
  assert.equal(adminList.json.list[0].field_checked_in_today, true);
  assert.equal(adminList.json.list[0].field_report_overdue_count, 1);
  assert.equal(adminList.json.list[0].field_extension_pending, true);
});

test('work-order detail exposes evidence holds, report revisions, and field audits only to Admin', async () => {
  const env = createEnv();
  seedFieldDay(env, { status: 'report_submitted' });
  env.__holds.push({
    id: 'hold-1', work_order_id: 'wo-onsite-1', reason_category: 'complaint', reason: 'Customer complaint review',
    status: 'open', opened_by: 'admin-1', opened_at: '2026-07-24T01:00:00Z',
  });
  env.__revisions.push({
    id: 'revision-1', work_order_id: 'wo-onsite-1', field_day_id: 'field-day-1', previous_report: '{"completed_work":"Before"}',
    changed_by_type: 'admin', changed_by_id: 'admin-1', reason: 'Corrected report', created_at: '2026-07-24T02:00:00Z',
  });
  env.__fieldWorkAudits.push({
    id: 'audit-1', work_order_id: 'wo-onsite-1', target_type: 'work_order_field_day', target_id: 'field-day-1',
    action: 'field_day_report_corrected', actor_type: 'admin', actor_id: 'admin-1', created_at: '2026-07-24T02:00:00Z',
  }, {
    id: 'audit-plan', work_order_id: 'wo-onsite-1', target_type: 'work_order', target_id: 'wo-onsite-1',
    action: 'field_plan_updated', actor_type: 'admin', actor_id: 'admin-1', created_at: '2026-07-24T03:00:00Z',
  });

  const admin = await api(env, '/api/workorders/wo-onsite-1', { userType: 'admin', userId: 'admin' });
  assert.deepEqual(admin.json.field_evidence_holds.map((item) => item.id), ['hold-1']);
  assert.deepEqual(admin.json.field_day_revisions.map((item) => item.id), ['revision-1']);
  assert.deepEqual(admin.json.field_work_audit_logs.map((item) => item.id), ['audit-1', 'audit-plan']);

  for (const credentials of [
    { userType: 'customer', userId: 'customer-1' },
    { userType: 'engineer', userId: 'engineer-1' },
  ]) {
    const detail = await api(env, '/api/workorders/wo-onsite-1', credentials);
    assert.equal(Object.hasOwn(detail.json, 'field_evidence_holds'), false);
    assert.equal(Object.hasOwn(detail.json, 'field_day_revisions'), false);
    assert.equal(Object.hasOwn(detail.json, 'field_work_audit_logs'), false);
  }
});

test('evidence hold accepts only approved reason categories', async () => {
  for (const category of ['complaint', 'warranty', 'safety_review', 'legal_hold', 'dispute']) {
    const env = createEnv();
    const result = await api(env, '/api/admin/workorders/wo-onsite-1/evidence-holds', {
      userType: 'admin', userId: 'admin', method: 'POST', body: { reason_category: category, reason: 'Preserve evidence.' },
    });
    assert.equal(result.response.status, 201, category);
  }

  const env = createEnv();
  const invalid = await api(env, '/api/admin/workorders/wo-onsite-1/evidence-holds', {
    userType: 'admin', userId: 'admin', method: 'POST', body: { reason_category: 'other', reason: 'Unsupported category.' },
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(env.__holds.length, 0);
});

test('customer work-order detail includes safe approved extension history', async () => {
  const env = createEnv();
  env.__extensions.push({
    id: 'approved-extension', work_order_id: 'wo-onsite-1', engineer_id: 'engineer-1', status: 'approved',
    requested_additional_days: 2, proposed_completion_date: '2026-07-26',
    customer_explanation: 'One additional visit is required.', decision_reason: 'Schedule evidence approved.',
    approved_plan: JSON.stringify({ expected_service_days: 4, expected_completion_date: '2026-07-26' }),
    decided_at: '2026-07-24T10:00:00Z', internal_note: 'Supplier detail', original_plan: '{"expected_service_days":2}',
    decided_by: 'admin-1', reason: 'Internal operational reason', field_day_id: 'field-day-1', created_at: '2026-07-24T09:00:00Z',
  });

  const detail = await api(env, '/api/workorders/wo-onsite-1', { userType: 'customer', userId: 'customer-1' });

  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.field_extension_requests.length, 1);
  assert.deepEqual(detail.json.field_extension_requests[0], {
    status: 'approved', requested_additional_days: 2, proposed_completion_date: '2026-07-26',
    customer_explanation: 'One additional visit is required.', decision_reason: 'Schedule evidence approved.',
    approved_plan: JSON.stringify({ expected_service_days: 4, expected_completion_date: '2026-07-26' }),
    decided_at: '2026-07-24T10:00:00Z',
  });
  assert.deepEqual(detail.json.pending_extension_requests, []);

  const engineerDetail = await api(env, '/api/workorders/wo-onsite-1', { userType: 'engineer', userId: 'engineer-1' });
  assert.equal(engineerDetail.response.status, 200);
  assert.equal(engineerDetail.json.field_extension_requests[0].internal_note, 'Supplier detail');
  assert.equal(engineerDetail.json.field_extension_requests[0].original_plan, '{"expected_service_days":2}');
  assert.equal(engineerDetail.json.field_extension_requests[0].decided_by, 'admin-1');
});

test('final service completion rejects a complete field plan with no field days', async () => {
  const env = createEnv();
  env.__workOrders[0].arrival_verified_at = '2026-07-24T00:00:00Z';

  const result = await api(env, '/api/workorders/wo-onsite-1/resolve', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', body: {},
  });

  assert.equal(result.response.status, 409);
  assert.match(result.json.error, /field day/i);
  assert.equal(env.__workOrders[0].status, 'in_service');
});

for (const status of ['checked_in', 'report_overdue']) {
  test(`final service completion rejects field day status ${status}`, async () => {
    const env = createEnv();
    env.__workOrders[0].arrival_verified_at = '2026-07-24T00:00:00Z';
    seedFieldDay(env, { status });

    const result = await api(env, '/api/workorders/wo-onsite-1/resolve', {
      userType: 'engineer', userId: 'engineer-1', method: 'POST', body: {},
    });

    assert.equal(result.response.status, 409);
    assert.match(result.json.error, /daily report/i);
    assert.equal(env.__workOrders[0].status, 'in_service');
  });
}

test('final service completion rejects a pending field extension', async () => {
  const env = createEnv();
  env.__workOrders[0].arrival_verified_at = '2026-07-24T00:00:00Z';
  seedFieldDay(env, { status: 'report_submitted' });
  env.__extensions.push({ id: 'extension-1', work_order_id: 'wo-onsite-1', status: 'pending' });

  const result = await api(env, '/api/workorders/wo-onsite-1/resolve', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', body: {},
  });

  assert.equal(result.response.status, 409);
  assert.match(result.json.error, /extension/i);
  assert.equal(env.__workOrders[0].status, 'in_service');
});

test('final service completion allows submitted and late-submitted field reports', async () => {
  const env = createEnv();
  env.__workOrders[0].arrival_verified_at = '2026-07-24T00:00:00Z';
  seedFieldDay(env, { id: 'day-1', status: 'report_submitted' });
  seedFieldDay(env, { id: 'day-2', site_local_date: '2026-07-23', status: 'late_report_submitted' });

  const result = await api(env, '/api/workorders/wo-onsite-1/resolve', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', body: {},
  });

  assert.equal(result.response.status, 200);
  assert.equal(env.__workOrders[0].status, 'resolved');
});

for (const concurrentRecord of ['field-day', 'extension']) {
  test(`final service completion refuses a concurrent active ${concurrentRecord}`, async () => {
    const env = createEnv();
    env.__workOrders[0].arrival_verified_at = '2026-07-24T00:00:00Z';
    seedFieldDay(env, { status: 'report_submitted' });
    env.__activeRecordBeforeResolve = concurrentRecord;

    const result = await api(env, '/api/workorders/wo-onsite-1/resolve', {
      userType: 'engineer', userId: 'engineer-1', method: 'POST', body: {},
    });

    assert.equal(result.response.status, 409);
    assert.equal(env.__workOrders[0].status, 'in_service');
  });
}

test('legacy onsite work order without a field plan keeps the arrival-only completion rule', async () => {
  const env = createEnv();
  Object.assign(env.__workOrders[0], {
    site_timezone: null, expected_service_days: null, expected_completion_date: null,
    arrival_verification_required: 1, arrival_verified_at: '2026-07-24T00:00:00Z',
  });

  const result = await api(env, '/api/workorders/wo-onsite-1/resolve', {
    userType: 'engineer', userId: 'engineer-1', method: 'POST', body: {},
  });

  assert.equal(result.response.status, 200);
  assert.equal(env.__workOrders[0].status, 'resolved');
});
