import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

test('one four-step flow owns the canonical service-request draft', () => {
  const flow = read('frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx');

  assert.match(flow, /createEmptyServiceRequestDraft/);
  assert.match(flow, /validateServiceRequestStep/);
  assert.match(flow, /toWorkOrderPayload/);
  assert.match(flow, /const \[draft, setDraft\] = useState/);
  assert.match(flow, /Step \$\{value\} \/ 4|第\$\{value\}步，共4步/);
  assert.match(flow, /data-step="1"/);
  assert.match(flow, /data-step="2"/);
  assert.match(flow, /data-step="3"/);
  assert.match(flow, /data-step="4"/);
  assert.match(flow, /validateServiceRequestStep\(draft, currentStep\)/);
  assert.match(flow, /\[&_button\]:min-h-11/);
  assert.match(flow, /\[&_input\]:min-h-11/);
});

test('the flow exposes all six concrete industrial service routes in both languages', () => {
  const flow = read('frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx');

  for (const text of [
    '维修诊断', '系统升级改造', '拆机移位安装', '检测保养', '二手设备评估 / 处置支持', '耗材配件 / 更换调试',
    'Repair & diagnostics', 'System retrofit', 'Relocation & installation', 'Inspection & maintenance',
    'Used equipment evaluation / disposition support', 'Parts, consumables & commissioning',
  ]) {
    assert.match(flow, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(flow, /提交服务请求/);
  assert.match(flow, /Send service request/);
  assert.doesNotMatch(flow, />\s*Submit\s*</);
  assert.doesNotMatch(flow, /(?:4小时|24小时|72小时|same[- ]day|within \d+ hours|全国必达|固定价格)/i);
  assert.match(flow, /根据地区、设备和项目单独评估，报价明细确认后再启动/);
});

test('page and legacy modal render the same flow without a second form owner', () => {
  const page = read('frontend/src/components/ServiceRequest/ServiceRequestPage.jsx');
  const modal = read('frontend/src/components/Sidebar/WorkOrderModal.jsx');

  assert.match(page, /import \{ ServiceRequestFlow \}/);
  assert.match(page, /<ServiceRequestFlow/);
  assert.match(page, /support@sagemro\.com/);
  assert.match(modal, /import \{ ServiceRequestFlow \}/);
  assert.match(modal, /<ServiceRequestFlow/);
  assert.doesNotMatch(modal, /const \[form,\s*setForm\] = useState/);
  assert.doesNotMatch(modal, /<TagInput|<RegionInput|getBrowserLocation\(/);
});

test('submission uses the canonical payload and keeps runtime files separate', () => {
  const flow = read('frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx');
  const modal = read('frontend/src/components/Sidebar/WorkOrderModal.jsx');

  assert.match(flow, /const payload = toWorkOrderPayload\(draft/);
  assert.match(flow, /await onSubmit\(payload, files\)/);
  assert.match(flow, /accept="image\/jpeg,image\/png,image\/gif,image\/webp,video\/mp4,video\/webm"/);
  assert.doesNotMatch(flow, /saveServiceRequestDraft\([^)]*files/);
  assert.match(modal, /uploadWorkOrderAttachment/);
  assert.match(modal, /async \(payload, files\)/);
  assert.doesNotMatch(flow, /createMachineLead|submitWorkOrderApi|\/api\/leads/);
  assert.doesNotMatch(modal, /createMachineLead|\/api\/leads/);
});

test('submission has a synchronous lock that is always released', () => {
  const flow = read('frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx');

  assert.match(flow, /const submitLockRef = useRef\(false\)/);
  assert.match(flow, /if \(submitLockRef\.current\) return/);
  assert.match(flow, /submitLockRef\.current = true/);
  assert.match(flow, /finally \{[\s\S]*submitLockRef\.current = false[\s\S]*setSubmitting\(false\)/);
  assert.ok(
    flow.indexOf('submitLockRef.current = true') < flow.indexOf('await onSubmit(payload, files)'),
    'the synchronous lock must be acquired before onSubmit starts',
  );
});
