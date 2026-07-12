import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('COM service request descriptions are built with English labels', async () => {
  const { buildWorkOrderDescription } = await import('../src/utils/workOrderDisplay.js');

  const description = buildWorkOrderDescription({
    device_type: ['Laser Cutter'],
    device_brand: ['TRUMPF'],
    device_model: 'TruLaser 3030',
    region: ['United States / Chicago'],
    description: 'Cut edge has heavy burrs after warm-up.',
  }, 'en');

  assert.equal(
    description,
    'Equipment type: Laser Cutter; Brand: TRUMPF; Model: TruLaser 3030; Region: United States / Chicago. Cut edge has heavy burrs after warm-up.',
  );
  assert.doesNotMatch(description, /[\u4e00-\u9fff]/);
});

test('COM display helpers translate legacy Chinese service text to professional English', async () => {
  const {
    formatCustomerDeviceLine,
    formatServiceTextForLocale,
  } = await import('../src/utils/workOrderDisplay.js');

  assert.equal(
    formatCustomerDeviceLine({
      device_type: '激光切割机',
      device_brand: '大族',
      device_model: 'G3015H',
    }, 'en'),
    'Laser cutting machine / Han\'s Laser / G3015H',
  );

  const text = formatServiceTextForLocale(
    '设备类型：激光切割机；品牌：大族；型号：G3015H；所在地区：江苏省-苏州市。创建工单',
    'en',
  );
  assert.equal(
    text,
    'Equipment type: Laser cutting machine; Brand: Han\'s Laser; Model: G3015H; Region: Jiangsu, Suzhou. Service request created',
  );
  assert.doesNotMatch(text, /[\u4e00-\u9fff]/);
});

test('COM region input does not expose China administrative division suggestions', () => {
  const regionInput = read('frontend/src/components/common/RegionInput.jsx');
  const workOrderModal = read('frontend/src/components/Sidebar/WorkOrderModal.jsx');

  assert.match(regionInput, /isCnLocale/);
  assert.match(regionInput, /const allowDivisionSearch = isCnLocale\(\)/);
  assert.match(regionInput, /if \(allowDivisionSearch && val\.length >= 1\)/);
  assert.match(regionInput, /handleFreeformRegion/);
  assert.match(workOrderModal, /Country \/ Region/);
  assert.doesNotMatch(regionInput, /setSuggestions\(searchDivisions\(val\)\);\n\s*setShowDropdown\(true\);/);
});

test('COM work order views localize stored service text before rendering', () => {
  const myServices = read('frontend/src/components/Sidebar/MyWorkOrdersModal.jsx');
  const detail = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const notifications = read('frontend/src/components/Notification/NotificationModal.jsx');
  const messages = read('frontend/src/components/WorkOrder/MessagePanel.jsx');

  assert.match(myServices, /formatServiceTextForLocale\(order\.description, isCn \? 'zh-CN' : 'en'\)/);
  assert.match(detail, /formatServiceTextForLocale\(workOrder\.description, isCn \? 'zh-CN' : 'en'\)/);
  assert.match(detail, /formatServiceTextForLocale\(log\.content, isCn \? 'zh-CN' : 'en'\)/);
  assert.match(notifications, /formatServiceTextForLocale\(notif\.title, isCn \? 'zh-CN' : 'en'\)/);
  assert.match(notifications, /formatServiceTextForLocale\(notif\.body, isCn \? 'zh-CN' : 'en'\)/);
  assert.match(messages, /formatServiceTextForLocale\(msg\.content, isCnLocale\(\) \? 'zh-CN' : 'en'\)/);
});
