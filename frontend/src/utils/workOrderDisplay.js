const DEVICE_TYPE_EN = new Map([
  ['激光切割机', 'Laser cutting machine'],
  ['折弯机', 'Press brake'],
  ['冲床', 'Punching machine'],
  ['焊接机', 'Welding machine'],
  ['激光焊接', 'Laser welding'],
  ['卷板机', 'Plate rolling machine'],
  ['等离子切割', 'Plasma cutting'],
  ['水刀切割', 'Waterjet cutting'],
  ['剪板机', 'Shearing machine'],
  ['其他', 'Other'],
]);

export function toEnglishDeviceValue(value) {
  if (!value) return '';
  return String(value)
    .split(/[,，、;；]/)
    .map((part) => {
      const clean = part.trim();
      return DEVICE_TYPE_EN.get(clean) || clean;
    })
    .filter(Boolean)
    .join(', ');
}

export function formatCustomerDeviceLine(order = {}) {
  const parts = [
    toEnglishDeviceValue(order.device_type || order.category_l1),
    order.device_brand || order.brand,
    order.device_model || order.model,
  ].filter(Boolean);
  return parts.join(' / ');
}
