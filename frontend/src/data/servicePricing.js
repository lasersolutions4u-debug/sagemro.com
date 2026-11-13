/**
 * 服务页的**指示性价格区间**。
 *
 * 为什么要单独一个文件：服务页正文长期只写「报价另议」。从内容角度这是对的（不给未检测的
 * 设备报死价），但从「这家公司靠什么收钱」的角度，整站看不到任何数字——渠道尽调与收款方
 * 审核看到的就是一堆没有量级的描述。本文件给三个可直接成交的服务入口一个可核对的区间，
 * 每一条都带计价单位与不包含项。
 *
 * 三条纪律：
 * 1. 只能叫「指示性区间 / indicative range」——最终价格以书面报价为准，正文里不得写成承诺。
 * 2. 必须带单位（每例 / 每工程师·工日 / 每台每年 / 每行），否则区间没有可比性。
 * 3. 必须写明不包含项（差旅、备件、进口关税等），否则区间会被当成总价。
 *
 * 数值来源：按 2026-09 的公开成交价与行业口径定标（海外现场服务 400 USD/人·天、
 * 国内单次维修成交 1.9–2.2 万元、单台年度维保 5.2 万元/年 等，见
 * docs/research/2026-09-28-证据-需求侧-存量寿命与客单价.md §4）。这是**定价建议值**，
 * 实际执行价请业务侧确认后只改本文件，不要在各页面里各改一份。
 *
 * 覆盖范围刻意只给三个 slug：维修（上门）、预防性维护（年度）、备件（产品）。
 * 其余服务页保持「逐项报价」，因为它们的范围差异太大（改造、搬迁、二手评估），
 * 给区间反而会误导。
 */

const EN = {
  'laser-cutting-machine-repair': {
    heading: 'Indicative service budget',
    intro: 'Repair work is quoted per machine after the symptom is reviewed. These ranges are what a typical overseas job falls into, so a budget can be checked before an inquiry is sent.',
    currency: 'USD',
    rows: [
      { label: 'Remote diagnostic review', value: 'USD 150–450 per case', detail: 'one machine, one symptom set; credited against the service order if it escalates to an on-site visit' },
      { label: 'On-site attendance', value: 'USD 450–900 per engineer-day', detail: 'billed per engineer-day, first day included; extra engineers are quoted per person' },
      { label: 'Travel, visa, and accommodation', value: 'at cost, itemized', detail: 'booked against the site country and stated on the quotation before departure' },
      { label: 'Parts used during the visit', value: 'quoted per part number', detail: 'confirmed in writing before dispatch, never added silently to the labour invoice' },
    ],
    note: 'Indicative range only. The binding scope, price, and payment terms are stated in the written quotation issued by SAGEMRO LLC before any work starts.',
  },
  'preventive-maintenance': {
    heading: 'Indicative maintenance budget',
    intro: 'Preventive maintenance is priced per machine per visit, because power class, condition, and travel decide most of the cost. The ranges below are for a single machine at one site.',
    currency: 'USD',
    rows: [
      { label: 'Single preventive maintenance visit', value: 'USD 600–1,800 per machine', detail: 'inspection, alignment and parameter check, lubrication, and a written condition report' },
      { label: 'Annual plan, two visits', value: 'USD 1,100–3,200 per machine per year', detail: 'the second visit is scheduled from the first condition report' },
      { label: 'Consumables and filters', value: 'quoted per part number', detail: 'replaced parts are listed with quantity and unit price on the report' },
      { label: 'Travel and accommodation', value: 'at cost, itemized', detail: 'quoted per site country; multi-machine sites share one travel line' },
    ],
    note: 'Indicative range only. The binding scope, price, and payment terms are stated in the written quotation issued by SAGEMRO LLC before any work starts.',
  },
  'spare-parts-consumables': {
    heading: 'Indicative parts budget',
    intro: 'Parts and consumables are quoted per part number, so the range depends on the component rather than on labour. These ranges describe a typical order so a purchase can be planned before the part is identified.',
    currency: 'USD',
    rows: [
      { label: 'Typical single part order', value: 'USD 150–2,500 per line', detail: 'drives, control boards, sensors, and mechanical components' },
      { label: 'Optical consumables', value: 'USD 20–300 per piece', detail: 'protective lenses, nozzles, and ceramic rings; quantity breaks are quoted per order' },
      { label: 'Exchange unit, advance replacement', value: 'deposit equal to the unit value', detail: 'the deposit is released when the failed unit is returned and inspected' },
      { label: 'Parts above USD 5,000', value: 'written quotation and lead time first', detail: 'no advance payment is requested before the part number and lead time are confirmed' },
    ],
    note: 'Indicative range only. Compatibility, availability, price, and delivery terms are confirmed for each part number in the written quotation issued by SAGEMRO LLC.',
  },
};

const ZH = {
  'laser-cutting-machine-repair': {
    heading: '参考价格区间',
    intro: '维修按设备逐台报价，这里给出的是海外典型订单的落点区间，便于在询价前先判断预算。',
    currency: 'CNY',
    rows: [
      { label: '远程诊断评估', value: '800–2,500 元/例', detail: '单台设备、单一故障现象；升级为现场服务时抵扣服务费' },
      { label: '现场服务', value: '1,200–3,600 元/工程师·工日', detail: '按工程师·工日计，含首日；增派人员按人另外报价' },
      { label: '差旅与住宿', value: '实报实销、逐项列明', detail: '按现场所在地区核算，出发前写入报价单' },
      { label: '现场更换的备件', value: '按零件号单独报价', detail: '发货前书面确认，不并入人工发票' },
    ],
    note: '以上仅为参考区间。最终范围、价格与结算方式以书面报价为准，报价在开工前确认。',
  },
  'preventive-maintenance': {
    heading: '保养参考价格区间',
    intro: '预防性维护按台按次计价：功率段、设备状态与差旅决定了大部分成本。下表按单台、单现场计。',
    currency: 'CNY',
    rows: [
      { label: '单次预防性维护', value: '4,000–12,000 元/台', detail: '包含检查、精度与参数核对、润滑及书面状态报告' },
      { label: '年度计划（两次）', value: '7,000–20,000 元/台·年', detail: '第二次的检查项由第一次的状态报告确定' },
      { label: '耗材与滤芯', value: '按零件号单独报价', detail: '更换件在报告中列明数量与单价' },
      { label: '差旅与住宿', value: '实报实销、逐项列明', detail: '按现场地区核算；同一现场多台设备共用一条差旅' },
    ],
    note: '以上仅为参考区间。最终范围、价格与结算方式以书面报价为准，报价在开工前确认。',
  },
  'spare-parts-consumables': {
    heading: '备件参考价格区间',
    intro: '备件与耗材按零件号逐项报价，区间取决于部件本身而不是人工。下表描述典型订单的量级，便于在确认零件号之前先做预算。',
    currency: 'CNY',
    rows: [
      { label: '典型单行备件订单', value: '500–20,000 元/行', detail: '驱动、控制板、传感器与机械部件' },
      { label: '光学耗材', value: '80–2,000 元/件', detail: '保护镜、喷嘴与陶瓷环；批量价格按订单单独报价' },
      { label: '交换件（先发后修）', value: '按件值收取押金', detail: '回收件检测合格后退还押金' },
      { label: '单价 3 万元以上的部件', value: '先出书面报价与货期', detail: '零件号与货期确认前不要求预付款' },
    ],
    note: '以上仅为参考区间。兼容性、供应情况、价格与交付条件按零件号逐单确认，以书面报价为准。',
  },
};

const PRICING = { en: EN, 'zh-CN': ZH };

export function getServicePricing(slug, locale = 'en') {
  const table = PRICING[locale === 'zh-CN' ? 'zh-CN' : 'en'];
  const pricing = table[slug];
  return pricing ? { ...pricing, rows: pricing.rows.map((row) => ({ ...row })) } : null;
}

/** 有指示性价格的服务页 slug 列表：静态测试与页面渲染共用同一份清单。 */
export const PRICED_SERVICE_SLUGS = Object.keys(EN);
