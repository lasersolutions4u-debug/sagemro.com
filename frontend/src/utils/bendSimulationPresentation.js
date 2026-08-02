const WARNING_COPY = {
  short_edge: { en: 'A bend edge is short for the selected V die.', zh: '折弯边相对所选 V 槽过短。' },
  tool_mismatch: { en: 'The selected lower die is not compatible with this plan.', zh: '所选下模与当前方案不兼容。' },
  upper_tool_mismatch: { en: 'The selected upper tool is not compatible with this plan.', zh: '所选上模与当前方案不兼容。' },
  machine_overload: { en: 'Required tonnage exceeds machine capacity.', zh: '所需吨位超过设备能力。' },
  work_length_exceeded: { en: 'Bend length exceeds the machine working length.', zh: '折弯长度超过设备工作长度。' },
  machine_thickness_out_of_range: { en: 'Material thickness is outside the selected machine reference range.', zh: '材料厚度超出所选设备的参考范围。' },
  no_compatible_tool: { en: 'No compatible tooling is available in the planning catalog.', zh: '规划模具库中没有兼容模具。' },
  tight_radius: { en: 'Inside radius is tight for the selected material thickness.', zh: '内 R 相对当前材料厚度过小。' },
  review_required: { en: 'Confirm tooling and bend plan with an engineer before production.', zh: '生产前请由工程师确认模具和折弯方案。' },
};

function language(locale) {
  return locale === 'zh' || locale === 'zh-CN' ? 'zh' : 'en';
}

export function getBendCatalogLabel(item, locale = 'en') {
  if (!item) return '';
  return item.labels?.[language(locale)] || item.label || item.labelKey || item.id || '';
}

export function getBendWarningLabel(warning, locale = 'en') {
  const code = typeof warning === 'string' ? warning : warning?.code;
  return WARNING_COPY[code]?.[language(locale)] || warning?.message || code || '';
}

export function localizeBendWarnings(warnings = [], locale = 'en') {
  return warnings.map((warning) => ({
    ...(typeof warning === 'object' && warning ? warning : { code: warning }),
    message: getBendWarningLabel(warning, locale),
  }));
}
