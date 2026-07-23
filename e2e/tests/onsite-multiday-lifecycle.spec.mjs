import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import {
  adminApi,
  createCustomerWorkOrder,
  dispatchWorkOrder,
  loginAdmin,
  onboardEngineer,
} from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';

const runtime = e2eRuntime();
const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerDir = path.resolve(e2eDir, '../worker');
const stateDir = path.join(e2eDir, '.state');

function siteDate(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function updateLocalD1(command) {
  execFileSync('npx', [
    'wrangler', 'd1', 'execute', 'sagemro-db',
    '--local',
    '--persist-to', stateDir,
    '--command', command,
    '--yes',
  ], { cwd: workerDir, stdio: 'pipe' });
}

async function browserJsonApi(page, pathName, options = {}) {
  return page.evaluate(async ({ apiBase, pathName: requestPath, requestOptions }) => {
    const token = localStorage.getItem('sagemro_token');
    const headers = new Headers(requestOptions.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${apiBase}${requestPath}`, {
      ...requestOptions,
      credentials: 'include',
      headers,
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, ok: response.ok, data };
  }, { apiBase: runtime.apiBase, pathName, requestOptions: options });
}

async function submitFieldMultipart(page, pathName, fields, idempotencyKey) {
  return page.evaluate(async ({ apiBase, pathName: requestPath, fields: requestFields, key }) => {
    const token = localStorage.getItem('sagemro_token');
    const formData = new FormData();
    for (const [name, value] of Object.entries(requestFields)) {
      if (value !== null && value !== undefined) formData.append(name, String(value));
    }
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    if (requestPath.endsWith('/check-in')) {
      formData.append('photo', new File([png], 'live-check-in.png', { type: 'image/png' }));
    } else {
      formData.append('progress_photos', new File([png], 'customer-progress.png', { type: 'image/png' }));
      formData.append('internal_photos', new File([png], 'internal-evidence.png', { type: 'image/png' }));
    }
    const response = await fetch(`${apiBase}${requestPath}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Idempotency-Key': key,
      },
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, ok: response.ok, data };
  }, { apiBase: runtime.apiBase, pathName, fields, key: idempotencyKey });
}

async function triggerScheduledFieldWork() {
  const response = await fetch('http://127.0.0.1:8878/cdn-cgi/handler/scheduled');
  return response.status;
}

test('multi-day onsite work preserves protected evidence and closes only after daily reports', async ({ browser }) => {
  test.setTimeout(240_000);
  const dayOneTimezone = 'Pacific/Pago_Pago';
  const dayTwoTimezone = 'Pacific/Kiritimati';
  const dayOne = siteDate(dayOneTimezone);
  const dayTwo = siteDate(dayTwoTimezone);
  const extendedCompletion = addDays(dayTwo, 2);
  expect(dayOne).not.toBe(dayTwo);

  const { engineer, context: engineerContext, page: engineerPage } = await onboardEngineer({ browser, runtime });
  const {
    context: customerContext,
    page: customerPage,
    orderNo,
  } = await createCustomerWorkOrder({
    browser,
    runtime,
    description: 'E2E protected multi-day onsite maintenance lifecycle.',
  });
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  try {
    await loginAdmin(adminPage, runtime);
    await dispatchWorkOrder({ page: adminPage, orderNo, engineer });

    await engineerPage.reload();
    const assignedTask = engineerPage.locator('article').filter({ hasText: orderNo });
    await expect(assignedTask).toBeVisible();
    await assignedTask.getByRole('button', { name: 'Confirm Assignment', exact: true }).click();

    const customerOrders = await browserJsonApi(customerPage, '/api/workorders');
    expect(customerOrders.ok).toBe(true);
    const workOrder = customerOrders.data.work_orders.find((item) => item.order_no === orderNo);
    expect(workOrder).toBeTruthy();
    const workOrderId = workOrder.id;

    updateLocalD1(`
      UPDATE work_orders
      SET status = 'in_service', service_mode = 'onsite', arrival_verification_required = 1,
          onsite_conversion_status = 'confirmed'
      WHERE id = ${sqlText(workOrderId)};
    `);

    const plan = await adminApi(adminPage, runtime, `/api/admin/workorders/${workOrderId}/field-plan`, {
      method: 'PATCH',
      body: JSON.stringify({
        site_timezone: dayOneTimezone,
        expected_service_days: 2,
        expected_completion_date: dayTwo,
        planned_daily_start_time: '08:00',
        planned_daily_end_time: '17:00',
      }),
    });
    expect(plan.field_plan).toMatchObject({ site_timezone: dayOneTimezone, expected_service_days: 2 });

    const dayOneCheckIn = await submitFieldMultipart(
      engineerPage,
      `/api/workorders/${workOrderId}/field-days/check-in`,
      { expected_checkout_time: '17:00', location: JSON.stringify({ location_status: 'unavailable' }) },
      `e2e-check-in-day-one-${workOrderId}`,
    );
    expect(dayOneCheckIn.status).toBe(201);
    expect(dayOneCheckIn.data.location_status).toBe('unavailable');
    expect(dayOneCheckIn.data.field_day.site_local_date).toBe(dayOne);
    const dayOneId = dayOneCheckIn.data.field_day.id;

    await adminApi(adminPage, runtime, `/api/admin/workorders/${workOrderId}/field-plan`, {
      method: 'PATCH',
      body: JSON.stringify({
        site_timezone: dayTwoTimezone,
        expected_service_days: 2,
        expected_completion_date: dayTwo,
        planned_daily_start_time: '08:00',
        planned_daily_end_time: '17:00',
      }),
    });
    updateLocalD1(`
      UPDATE work_order_field_days
      SET site_timezone = ${sqlText(dayTwoTimezone)},
          expected_check_out_at = ${sqlText(`${dayOne}T17:00:00`)},
          updated_at = datetime('now')
      WHERE id = ${sqlText(dayOneId)};
    `);
    expect(await triggerScheduledFieldWork()).toBe(200);
    await expect.poll(async () => {
      const fieldData = await browserJsonApi(engineerPage, `/api/workorders/${workOrderId}/field-days`);
      return fieldData.data.field_days.find((day) => day.id === dayOneId)?.status;
    }).toBe('report_overdue');

    const dayTwoCheckIn = await submitFieldMultipart(
      engineerPage,
      `/api/workorders/${workOrderId}/field-days/check-in`,
      { expected_checkout_time: '17:00', location: JSON.stringify({ location_status: 'unavailable' }) },
      `e2e-check-in-day-two-${workOrderId}`,
    );
    expect(dayTwoCheckIn.status).toBe(201);
    expect(dayTwoCheckIn.data.field_day.site_local_date).toBe(dayTwo);
    const dayTwoId = dayTwoCheckIn.data.field_day.id;

    const lateDayOneReport = await submitFieldMultipart(
      engineerPage,
      `/api/workorders/${workOrderId}/field-days/${dayOneId}/report`,
      {
        completed_work: 'Inspected the optical path and documented contamination.',
        issues_risks: 'Protective lens contamination may reduce power.',
        next_plan: 'Replace the lens and validate cutting output.',
        customer_support_needed: 'Keep the machine available for morning testing.',
        labor_hours: 7.5,
        internal_note: 'INTERNAL-DAY-ONE supplier batch requires review.',
        late_reason: 'The site network was unavailable after the shift.',
      },
      `e2e-report-day-one-${workOrderId}`,
    );
    expect(lateDayOneReport.status).toBe(201);
    expect(lateDayOneReport.data.field_day.status).toBe('late_report_submitted');

    const dayTwoReport = await submitFieldMultipart(
      engineerPage,
      `/api/workorders/${workOrderId}/field-days/${dayTwoId}/report`,
      {
        completed_work: 'Replaced the protective lens and restored stable output.',
        issues_risks: 'No remaining production risk after validation.',
        next_plan: 'Monitor output during the next production batch.',
        customer_support_needed: 'Record output readings for the next shift.',
        labor_hours: 6,
        internal_note: 'INTERNAL-DAY-TWO procurement reference E2E-PRIVATE.',
        extension_reason: 'One monitored production shift is required.',
        extension_customer_explanation: 'An additional monitored shift will confirm stable production output.',
        requested_additional_days: 1,
        proposed_completion_date: extendedCompletion,
        extension_internal_note: 'INTERNAL-EXTENSION supplier coordination note.',
      },
      `e2e-report-day-two-${workOrderId}`,
    );
    expect(dayTwoReport.status).toBe(201);
    expect(dayTwoReport.data.field_day.status).toBe('report_submitted');

    const blockedClosure = await browserJsonApi(engineerPage, `/api/workorders/${workOrderId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ engineer_id: engineer.id }),
    });
    expect(blockedClosure.status).toBe(409);
    expect(blockedClosure.data.error).toMatch(/extension/i);

    const adminDetail = await adminApi(adminPage, runtime, `/api/workorders/${workOrderId}`);
    const pendingExtension = adminDetail.pending_extension_requests[0];
    expect(pendingExtension).toBeTruthy();
    const approved = await adminApi(
      adminPage,
      runtime,
      `/api/admin/workorders/${workOrderId}/extension-requests/${pendingExtension.id}/decision`,
      {
        method: 'POST',
        body: JSON.stringify({ decision: 'approved', decision_reason: 'Daily evidence supports one additional monitored shift.' }),
      },
    );
    expect(approved.extension_request.status).toBe('approved');

    const engineerFieldData = await browserJsonApi(engineerPage, `/api/workorders/${workOrderId}/field-days`);
    expect(engineerFieldData.ok).toBe(true);
    expect(engineerFieldData.data.field_days).toHaveLength(2);
    expect(engineerFieldData.data.media).toHaveLength(6);
    const privateMedia = engineerFieldData.data.media.find((item) => item.customer_visible === 0);
    expect(privateMedia).toBeTruthy();
    expect(privateMedia).not.toHaveProperty('object_key');

    const customerDetail = await browserJsonApi(customerPage, `/api/workorders/${workOrderId}`);
    expect(customerDetail.ok).toBe(true);
    expect(customerDetail.data.expected_completion_date).toBe(extendedCompletion);
    expect(customerDetail.data.field_days).toHaveLength(2);
    expect(customerDetail.data.field_extension_requests).toHaveLength(1);
    expect(customerDetail.data.field_extension_requests[0]).toMatchObject({
      status: 'approved',
      proposed_completion_date: extendedCompletion,
    });
    expect(customerDetail.data.field_extension_requests[0]).not.toHaveProperty('internal_note');
    expect(JSON.stringify(customerDetail.data)).not.toContain('INTERNAL-');
    for (const day of customerDetail.data.field_days) {
      expect(day).not.toHaveProperty('internal_note');
      expect(day).not.toHaveProperty('latitude');
      expect(day).not.toHaveProperty('longitude');
      expect(day.media.every((item) => item.customer_visible === 1)).toBe(true);
      expect(day.media.every((item) => !Object.hasOwn(item, 'object_key'))).toBe(true);
    }

    const visibleMedia = customerDetail.data.field_days.flatMap((day) => day.media)[0];
    const visibleRead = await customerPage.evaluate(async ({ apiBase, workOrderId: id, mediaId }) => {
      const token = localStorage.getItem('sagemro_token');
      const response = await fetch(`${apiBase}/api/workorders/${id}/field-media/${mediaId}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { status: response.status, cacheControl: response.headers.get('cache-control') };
    }, { apiBase: runtime.apiBase, workOrderId, mediaId: visibleMedia.id });
    expect(visibleRead).toEqual({ status: 200, cacheControl: 'private, no-store' });

    const privateRead = await customerPage.evaluate(async ({ apiBase, workOrderId: id, mediaId }) => {
      const token = localStorage.getItem('sagemro_token');
      return fetch(`${apiBase}/api/workorders/${id}/field-media/${mediaId}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((response) => response.status);
    }, { apiBase: runtime.apiBase, workOrderId, mediaId: privateMedia.id });
    expect(privateRead).toBe(403);

    const serviceReport = await browserJsonApi(engineerPage, `/api/workorders/${workOrderId}/repair-record`, {
      method: 'POST',
      body: JSON.stringify({
        symptom: 'Laser output dropped during continuous production.',
        diagnosis: 'Protective lens contamination reduced delivered power.',
        solution: 'Replaced the lens and validated stable production output.',
        labor_hours: 13.5,
      }),
    });
    expect(serviceReport.ok).toBe(true);

    const resolved = await browserJsonApi(engineerPage, `/api/workorders/${workOrderId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ engineer_id: engineer.id }),
    });
    expect(resolved.ok).toBe(true);

    const completed = await browserJsonApi(customerPage, '/api/workorders/rating', {
      method: 'POST',
      body: JSON.stringify({
        work_order_id: workOrderId,
        rating_timeliness: 5,
        rating_technical: 5,
        rating_communication: 5,
        rating_professional: 5,
        comment: 'Protected multi-day onsite lifecycle completed.',
      }),
    });
    expect(completed.ok).toBe(true);
    const finalDetail = await browserJsonApi(customerPage, `/api/workorders/${workOrderId}`);
    expect(finalDetail.data.status).toBe('completed');
  } finally {
    await adminContext.close();
    await customerContext.close();
    await engineerContext.close();
  }
});
