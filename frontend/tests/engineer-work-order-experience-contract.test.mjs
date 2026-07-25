import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('engineer work orders are sorted by required action without mutating input', async () => {
  const { sortEngineerWorkOrders } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');
  const tickets = [
    { id: 'done', status: 'completed', created_at: '2026-07-25T10:00:00Z' },
    { id: 'quote', status: 'pricing', created_at: '2026-07-24T10:00:00Z' },
    { id: 'assigned', status: 'assigned', created_at: '2026-07-23T10:00:00Z' },
  ];

  assert.deepEqual(sortEngineerWorkOrders(tickets).map((ticket) => ticket.id), ['assigned', 'quote', 'done']);
  assert.deepEqual(tickets.map((ticket) => ticket.id), ['done', 'quote', 'assigned']);
});

test('engineer work-order title and schedule helpers use existing fields only', async () => {
  const {
    getEngineerScheduleLabel,
    getEngineerWorkOrderTitle,
  } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');

  assert.equal(getEngineerWorkOrderTitle({ category_l2: 'other', description: 'Laser power drops after warm-up.' }, false, 'Service task'), 'Laser power drops after warm-up.');
  assert.equal(getEngineerWorkOrderTitle({}, true, '服务任务'), '服务任务');
  assert.equal(getEngineerScheduleLabel({ sla_deadline: '2026-07-25T06:00:00.000Z' }, 'zh-CN').length > 0, true);
  assert.equal(getEngineerScheduleLabel({}, 'en-US'), '');
});

test('engineer work-order redesign stays frontend-only', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');
  assert.doesNotMatch(workspace, /saveChecklist|updateChecklist|checklist_progress/);
});
