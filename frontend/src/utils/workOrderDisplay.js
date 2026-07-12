const DEVICE_TYPE_EN = new Map([
  ['激光切割机', 'Laser cutting machine'],
  ['激光焊接机', 'Laser welding machine'],
  ['折弯机', 'Press brake'],
  ['数控冲床', 'CNC punch press'],
  ['冲床', 'Punching machine'],
  ['焊接机', 'Welding machine'],
  ['焊机', 'Welding machine'],
  ['激光焊接', 'Laser welding'],
  ['卷板机', 'Plate rolling machine'],
  ['等离子切割', 'Plasma cutting machine'],
  ['等离子切割机', 'Plasma cutting machine'],
  ['水刀切割', 'Waterjet cutting machine'],
  ['水刀切割机', 'Waterjet cutting machine'],
  ['剪板机', 'Shearing machine'],
  ['其他', 'Other'],
]);

const BRAND_EN = new Map([
  ['大族', 'Han\'s Laser'],
  ['通快', 'TRUMPF'],
  ['百超', 'Bystronic'],
  ['迅镭', 'Xunlei'],
  ['邦德', 'Bond'],
  ['宏山', 'Hongshan'],
  ['博德', 'Bodor'],
  ['华工', 'HGTECH'],
  ['亚威', 'Yawei'],
  ['嘉泰', 'Jiatai'],
  ['村田', 'Murata'],
  ['黄石', 'Huangshi'],
  ['扬力', 'Yangli'],
  ['松下', 'Panasonic'],
  ['米勒', 'Miller'],
]);

const REGION_EN = new Map([
  ['中国', 'China'],
  ['全国', 'Nationwide'],
  ['华东', 'East China'],
  ['华北', 'North China'],
  ['华南', 'South China'],
  ['江苏省', 'Jiangsu'],
  ['江苏', 'Jiangsu'],
  ['苏州市', 'Suzhou'],
  ['苏州', 'Suzhou'],
  ['昆山市', 'Kunshan'],
  ['昆山', 'Kunshan'],
  ['上海市', 'Shanghai'],
  ['上海', 'Shanghai'],
  ['北京市', 'Beijing'],
  ['北京', 'Beijing'],
  ['天津市', 'Tianjin'],
  ['天津', 'Tianjin'],
  ['重庆市', 'Chongqing'],
  ['重庆', 'Chongqing'],
  ['广东省', 'Guangdong'],
  ['广东', 'Guangdong'],
  ['深圳市', 'Shenzhen'],
  ['深圳', 'Shenzhen'],
  ['广州市', 'Guangzhou'],
  ['广州', 'Guangzhou'],
  ['东莞市', 'Dongguan'],
  ['东莞', 'Dongguan'],
  ['佛山市', 'Foshan'],
  ['佛山', 'Foshan'],
  ['湖北省', 'Hubei'],
  ['湖北', 'Hubei'],
  ['武汉市', 'Wuhan'],
  ['武汉', 'Wuhan'],
  ['山东省', 'Shandong'],
  ['山东', 'Shandong'],
  ['济南市', 'Jinan'],
  ['济南', 'Jinan'],
  ['四川省', 'Sichuan'],
  ['四川', 'Sichuan'],
  ['成都市', 'Chengdu'],
  ['成都', 'Chengdu'],
  ['辽宁省', 'Liaoning'],
  ['辽宁', 'Liaoning'],
  ['沈阳市', 'Shenyang'],
  ['沈阳', 'Shenyang'],
  ['河北省', 'Hebei'],
  ['河北', 'Hebei'],
  ['沧州市', 'Cangzhou'],
  ['沧州', 'Cangzhou'],
]);

const SERVICE_TEXT_EN = new Map([
  ['AI 对话创建工单', 'Service request created from AI conversation'],
  ['创建工单', 'Service request created'],
  ['工程师已确认派工', 'Engineer accepted the assignment'],
  ['工程师已退回派工', 'Engineer returned the assignment'],
  ['工程师已提交报价建议，等待运营复核后发送给客户。', 'The engineer submitted a quote proposal. SAGEMRO operations will review it before sending it to the customer.'],
  ['客户已确认报价，等待客户付款。付款完成后工程师即可开始上门服务。', 'The customer confirmed the quote. Payment follow-up is pending before service starts.'],
  ['客户已确认报价，工程师将上门服务。', 'The customer confirmed the quote. The engineer will proceed with service.'],
  ['工程师已提交报价，请查看报价明细并确认。', 'The engineer submitted a quote. Please review and confirm the quote details.'],
  ['待确认', 'Pending confirmation'],
  ['已派工', 'Assigned'],
  ['处理中', 'In progress'],
  ['待报价', 'Awaiting quote'],
  ['服务中', 'In service'],
  ['待客户确认', 'Awaiting customer confirmation'],
  ['待评价', 'Awaiting review'],
  ['已完成', 'Completed'],
  ['已拒绝', 'Rejected'],
  ['已取消', 'Cancelled'],
  ['设备故障', 'Equipment repair'],
  ['设备维修', 'Equipment repair'],
  ['维护保养', 'Maintenance'],
  ['参数调试', 'Parameter tuning'],
  ['技术咨询', 'Technical consultation'],
  ['备件采购', 'Spare parts / consumables'],
  ['配件采购', 'Spare parts / consumables'],
  ['售后服务', 'After-sales support'],
  ['服务支持', 'Service support'],
  ['其他', 'Other'],
  ['非常紧急', 'Critical'],
  ['紧急', 'Urgent'],
  ['普通', 'Normal'],
  ['服务编号', 'Service No.'],
  ['类型', 'Type'],
  ['紧急程度', 'Urgency'],
  ['工单', 'Work order'],
]);

function translateListValue(value, map) {
  if (!value) return '';
  return String(value)
    .split(/[,，、;；/]/)
    .map((part) => {
      const clean = part.trim();
      return map.get(clean) || clean;
    })
    .filter(Boolean)
    .join(', ');
}

export function toEnglishDeviceValue(value) {
  return translateListValue(value, DEVICE_TYPE_EN);
}

export function toEnglishBrandValue(value) {
  return translateListValue(value, BRAND_EN);
}

export function toEnglishRegionValue(value) {
  if (!value) return '';
  if (!/[\u4e00-\u9fff]/.test(String(value))) return String(value).trim();
  return String(value)
    .split(/[,，、;；/-]/)
    .map((part) => {
      const clean = part.trim();
      return REGION_EN.get(clean) || clean;
    })
    .filter(Boolean)
    .join(', ');
}

function isCnLocaleValue(locale) {
  return locale === 'zh-CN' || locale === 'cn';
}

function joinDisplayList(value, locale, translator) {
  if (!value) return '';
  const raw = Array.isArray(value) ? value.join(isCnLocaleValue(locale) ? '、' : ', ') : String(value);
  return isCnLocaleValue(locale) ? raw : translator(raw);
}

export function formatCustomerDeviceLine(order = {}, locale = 'en') {
  const parts = [
    joinDisplayList(order.device_type || order.category_l1, locale, toEnglishDeviceValue),
    joinDisplayList(order.device_brand || order.brand, locale, toEnglishBrandValue),
    order.device_model || order.model,
  ].filter(Boolean);
  return parts.join(' / ');
}

export function buildWorkOrderDescription(data = {}, locale = 'en') {
  const isCn = isCnLocaleValue(locale);
  const parts = [
    data.device_type?.length > 0
      ? `${isCn ? '设备类型：' : 'Equipment type: '}${joinDisplayList(data.device_type, locale, toEnglishDeviceValue)}`
      : null,
    data.device_brand?.length > 0
      ? `${isCn ? '品牌：' : 'Brand: '}${joinDisplayList(data.device_brand, locale, toEnglishBrandValue)}`
      : null,
    data.device_model
      ? `${isCn ? '型号：' : 'Model: '}${data.device_model}`
      : null,
    data.region?.length > 0
      ? `${isCn ? '所在地区：' : 'Region: '}${joinDisplayList(data.region, locale, toEnglishRegionValue)}`
      : null,
  ].filter(Boolean);

  const deviceInfo = parts.join(isCn ? '；' : '; ');
  if (!deviceInfo) return data.description || '';
  return `${deviceInfo}${isCn ? '。' : '. '}${data.description || ''}`;
}

export function formatServiceTextForLocale(text, locale = 'en') {
  if (!text || isCnLocaleValue(locale)) return text || '';

  let result = String(text)
    .replace(/设备类型[:：]\s*([^;；。]+)/g, (_, value) => `Equipment type: ${toEnglishDeviceValue(value)}`)
    .replace(/品牌[:：]\s*([^;；。]+)/g, (_, value) => `Brand: ${toEnglishBrandValue(value)}`)
    .replace(/型号[:：]\s*([^;；。]+)/g, (_, value) => `Model: ${value.trim()}`)
    .replace(/所在地区[:：]\s*([^;；。]+)/g, (_, value) => `Region: ${toEnglishRegionValue(value)}`);

  for (const [source, replacement] of SERVICE_TEXT_EN) {
    result = result.replaceAll(source, replacement);
  }

  for (const [source, replacement] of DEVICE_TYPE_EN) {
    result = result.replaceAll(source, replacement);
  }
  for (const [source, replacement] of BRAND_EN) {
    result = result.replaceAll(source, replacement);
  }
  for (const [source, replacement] of REGION_EN) {
    result = result.replaceAll(source, replacement);
  }

  return result
    .replace(/：/g, ': ')
    .replace(/；/g, '; ')
    .replace(/，/g, ', ')
    .replace(/、/g, ', ')
    .replace(/。/g, '. ')
    .replace(/\s+([;,.])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
