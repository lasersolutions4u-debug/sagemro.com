export const UPSELL_CATEGORIES = [
  { value: 'parts_consumables', cn: '配件 / 易损件', en: 'Parts / consumables' },
  { value: 'laser_peripheral', cn: '激光周边设备', en: 'Laser peripheral equipment' },
  { value: 'post_processing', cn: '后道处理设备', en: 'Post-processing equipment' },
  { value: 'automation_retrofit', cn: '自动化改造', en: 'Automation retrofit' },
  { value: 'bending_tooling', cn: '折弯相关', en: 'Bending tooling' },
  { value: 'other_retrofit', cn: '其他现场改造需求', en: 'Other retrofit need' },
];

export const UPSELL_TIMELINES = [
  { value: 'immediate', cn: '立即', en: 'Immediate' },
  { value: 'within_1_month', cn: '1 个月内', en: 'Within 1 month' },
  { value: 'within_3_months', cn: '3 个月内', en: 'Within 3 months' },
  { value: 'unclear', cn: '暂不明确', en: 'Unclear' },
];

export const UPSELL_BUDGET_SIGNALS = [
  { value: 'has_budget', cn: '明确预算', en: 'Has budget' },
  { value: 'comparing_quotes', cn: '询价比较', en: 'Comparing quotes' },
  { value: 'unknown', cn: '尚未确认', en: 'Not confirmed' },
];

export const UPSELL_STATUSES = [
  { value: 'pending_assignment', cn: '待分配', en: 'Pending assignment' },
  { value: 'sales_following', cn: '业务跟进中', en: 'Sales following' },
  { value: 'quoted', cn: '已报价', en: 'Quoted' },
  { value: 'won', cn: '已成交', en: 'Won' },
  { value: 'lost', cn: '未成交', en: 'Lost' },
  { value: 'delivery_support', cn: '交付协同中', en: 'Delivery support' },
  { value: 'completed', cn: '已完成', en: 'Completed' },
];

function pickLabel(list, value, locale) {
  const item = list.find((entry) => entry.value === value);
  if (!item) return value || '-';
  return locale === 'zh-CN' ? item.cn : item.en;
}

export function getUpsellCategoryLabel(value, locale = 'zh-CN') {
  return pickLabel(UPSELL_CATEGORIES, value, locale);
}

export function getUpsellStatusLabel(value, locale = 'zh-CN') {
  return pickLabel(UPSELL_STATUSES, value, locale);
}

export function buildUpsellPayload(form, context = {}) {
  return {
    source_type: context.sourceType === 'work_order' ? 'work_order' : 'engineer_workspace',
    work_order_id: context.sourceType === 'work_order' ? (context.workOrderId || '') : '',
    category: form.category || 'other_retrofit',
    title: (form.title || '').trim(),
    description: (form.description || '').trim(),
    site_context: (form.site_context || '').trim(),
    expected_timeline: form.expected_timeline || 'unclear',
    budget_signal: form.budget_signal || 'unknown',
    contact_name: (form.contact_name || '').trim(),
    contact_phone: (form.contact_phone || '').trim(),
  };
}
