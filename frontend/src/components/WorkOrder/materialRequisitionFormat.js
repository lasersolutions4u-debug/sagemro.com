const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatMaterialRequisitionDate(value, isCn) {
  if (!value) return '-';
  const dateOnly = DATE_ONLY_PATTERN.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    if (isCn) return `${year}年${Number(month)}月${Number(day)}日`;
    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' })
      .format(new Date(2000, Number(month) - 1, 1));
    return `${monthLabel} ${Number(day)}, ${year}`;
  }
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(isCn ? 'zh-CN' : 'en-US', { dateStyle: 'medium' });
}
