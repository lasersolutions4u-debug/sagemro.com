export function hasChineseText(value) {
  return /[\u3400-\u9fff]/u.test(String(value || ''));
}

function firstText(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function getLocalizedCustomerContent(record = {}, locale = 'en') {
  const original = firstText(record, ['content', 'description', 'original_content', 'original_text']);
  const translated = locale === 'cn'
    ? firstText(record, ['content_zh', 'description_zh', 'translated_content_zh'])
    : firstText(record, ['content_en', 'description_en', 'translated_content', 'translated_content_en']);
  if (translated && translated !== original) {
    return {
      primaryText: translated,
      primaryLabel: locale === 'cn' ? '中文翻译' : 'English translation',
      originalText: original,
      originalLabel: locale === 'cn' ? '客户原文' : 'Customer original',
    };
  }
  const foreignOriginal = locale === 'en' ? hasChineseText(original) : Boolean(original) && !hasChineseText(original);
  return {
    primaryText: foreignOriginal ? '' : original,
    primaryLabel: '',
    originalText: foreignOriginal ? original : '',
    originalLabel: foreignOriginal ? (locale === 'cn' ? '客户原文' : 'Customer original') : '',
  };
}

const SYSTEM_MESSAGES = {
  ticket_accepted: {
    en: 'The engineer confirmed the assignment.',
    cn: '工程师已确认派工。',
  },
  service_assignment: {
    en: 'SAGEMRO assigned a team engineer to the service task.',
    cn: 'SAGEMRO 已为服务任务分配团队工程师。',
  },
  ticket_rejected: {
    en: 'The assignment was returned to dispatch.',
    cn: '该派工已退回调度。',
  },
  service_assigned: {
    en: 'The service task was assigned.',
    cn: '服务任务已派工。',
  },
  pricing_update: {
    en: 'The quote status was updated.',
    cn: '报价状态已更新。',
  },
  payment_update: {
    en: 'The payment status was updated.',
    cn: '付款状态已更新。',
  },
  invoice_update: {
    en: 'The invoice status was updated.',
    cn: '发票状态已更新。',
  },
  ticket_cancelled: {
    en: 'The work order was cancelled.',
    cn: '工单已取消。',
  },
  ticket_resolved: {
    en: 'The service report was sent for customer confirmation.',
    cn: '服务报告已提交客户确认。',
  },
};

export function localizeWorkOrderSystemMessage(message = {}, locale = 'en') {
  const stable = SYSTEM_MESSAGES[message.message_type];
  if (stable) return stable[locale] || stable.en;
  const content = String(message.content || '');
  if (locale === 'en') {
    if (/确认派工/.test(content)) return SYSTEM_MESSAGES.ticket_accepted.en;
    if (/退回.*派工|退回.*调度/.test(content)) return SYSTEM_MESSAGES.ticket_rejected.en;
    if (hasChineseText(content)) return 'The work-order status was updated.';
  }
  if (locale === 'cn' && content && !hasChineseText(content)) return '工单状态已更新。';
  return content;
}
