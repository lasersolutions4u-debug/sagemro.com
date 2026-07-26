import { redactPII } from './redact.js';

const TITLE_LIMIT = 100;
const CHINESE_TEXT = /[\u3400-\u9fff]/u;
const INTERNATIONAL_PHONE = /\+\d[\d\s().-]{6,}\d/g;
const UNPREFIXED_INTERNATIONAL_PHONE = /(?<![\w-])(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?![\w-])/g;

const COPY = {
  com: {
    fallback: 'Service task',
    categories: {
      laser_cutting: 'Laser cutting', bending: 'Press brake', punching: 'Punching',
      welding: 'Welding', surface_treatment: 'Surface treatment', auxiliary: 'Auxiliary equipment',
      cnc_automation: 'CNC and automation', inspection: 'Inspection', other: 'Equipment',
    },
    services: {
      fault: 'repair', maintenance: 'maintenance', parameter: 'parameter tuning',
      consult: 'technical support', parts: 'parts request', aftersales: 'after-sales service', other: 'service',
    },
    onsiteRepair: 'on-site repair',
  },
  cn: {
    fallback: '服务任务',
    categories: {
      laser_cutting: '激光切割', bending: '折弯设备', punching: '冲压设备', welding: '焊接设备',
      surface_treatment: '表面处理', auxiliary: '辅助设备', cnc_automation: '数控与自动化',
      inspection: '检测与品控', other: '设备',
    },
    services: {
      fault: '维修', maintenance: '维护保养', parameter: '参数调试', consult: '技术支持',
      parts: '备件申请', aftersales: '售后服务', other: '服务',
    },
    onsiteRepair: '现场维修',
  },
};

export function normalizeWorkOrderShortTitle(value) {
  if (typeof value !== 'string') return '';
  return redactPII(value)
    .replace(INTERNATIONAL_PHONE, ' ')
    .replace(UNPREFIXED_INTERNATIONAL_PHONE, ' ')
    .replace(/\[(?:手机号|身份证|邮箱|银行卡|车牌|URL)\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_LIMIT)
    .trim();
}

export function buildWorkOrderShortTitle(workOrder = {}, market = 'com') {
  const locale = market === 'cn' ? 'cn' : 'com';
  const copy = COPY[locale];
  const deviceIdentity = normalizeWorkOrderShortTitle([
    workOrder.device_brand || workOrder.brand,
    workOrder.device_model || workOrder.model,
  ].filter(Boolean).join(' '));
  const category = workOrder.category_l1 && workOrder.category_l1 !== 'other'
    ? copy.categories[workOrder.category_l1]
    : '';
  const service = workOrder.type === 'fault' && workOrder.service_mode === 'onsite'
    ? copy.onsiteRepair
    : copy.services[workOrder.type] || '';
  if (!deviceIdentity && !category && !service) return copy.fallback;
  const machine = deviceIdentity || category || copy.categories.other;
  const separator = locale === 'cn' && !deviceIdentity ? '' : ' ';
  return normalizeWorkOrderShortTitle(`${machine}${separator}${service}`) || copy.fallback;
}

export function resolveWorkOrderShortTitle(workOrder = {}, market = 'com') {
  const persisted = normalizeWorkOrderShortTitle(workOrder.short_title);
  if (persisted) return persisted;
  const locale = market === 'cn' ? 'cn' : 'com';
  const legacy = [workOrder.issue_title, workOrder.title]
    .map(normalizeWorkOrderShortTitle)
    .find((value) => value && (locale === 'cn' ? CHINESE_TEXT.test(value) : !CHINESE_TEXT.test(value)));
  return legacy
    || buildWorkOrderShortTitle(workOrder, market)
    || COPY[market === 'cn' ? 'cn' : 'com'].fallback;
}
