export const insights = [
  {
    slug: 'laser-cutting-cost-drivers',
    category: 'Laser cutting',
    title: 'Laser cutting cost drivers: cut length, pierces, gas, and setup time',
    // 正文标题即 H1，可以长；SERP 标题有宽度限制，所以单独给一份 60 字符以内、关键词前置的。
    seoTitle: 'Laser Cutting Cost Drivers: Length, Pierces, Gas',
    description: 'A practical breakdown of the inputs that usually move laser cutting cost before a formal shop quote.',
    toolSlug: 'laser-cutting-cost-calculator',
    toolLabel: 'Laser Cutting Cost Calculator',
    readingTime: '5 min read',
    publishedAt: '2026-08-06',
    updatedAt: '2026-08-06',
    sections: [
      {
        heading: 'Start with machine time',
        body: 'Cut length and cutting speed create the base cutting time. Pierce count and pierce time add short delays that can become meaningful on parts with many holes.',
      },
      {
        heading: 'Add the shop-specific costs',
        body: 'Machine hourly rate, assist gas, setup time, handling, scrap, and deburring can shift the final number. Keep these assumptions visible when comparing outsourcing and in-house production.',
      },
      {
        heading: 'When to ask for review',
        body: 'Ask for qualified review when material is expensive, nesting is complex, edge quality is critical, or the estimate is being used for equipment investment planning.',
      },
    ],
  },
  {
    slug: 'metal-weight-for-structural-profiles',
    category: 'Materials',
    title: 'How to estimate metal weight for sheet, tube, angle, channel, and beam',
    seoTitle: 'Metal Weight Estimate for Sheet, Tube, and Beam',
    description: 'Use theoretical profile area, density, length, and quantity to estimate material weight before quoting or shipping.',
    toolSlug: 'metal-weight-calculator',
    toolLabel: 'Metal Weight Calculator',
    readingTime: '4 min read',
    publishedAt: '2026-08-06',
    updatedAt: '2026-08-06',
    sections: [
      {
        heading: 'The core formula',
        body: 'Most profile weight estimates start with cross-section area multiplied by length, density, and quantity. The result is useful for early quoting, freight planning, and machine capacity checks.',
      },
      {
        heading: 'Why profile shape matters',
        body: 'Angle, channel, tube, and H beam profiles need different area formulas. Rolled corners and mill standards can make supplier tables differ from simplified geometry.',
      },
      {
        heading: 'Use supplier data for final purchasing',
        body: 'Theoretical weight is a planning reference. For purchase orders, confirm grade, tolerance, coating, mill certificate, and supplier weight table.',
      },
    ],
  },
  {
    slug: 'press-brake-tonnage-risk-check',
    category: 'Bending',
    title: 'Press brake tonnage risk check before production',
    description: 'How thickness, bend length, V die opening, material strength, and safety margin affect press brake tonnage.',
    toolSlug: 'press-brake-tonnage-calculator',
    toolLabel: 'Press Brake Tonnage Calculator',
    readingTime: '4 min read',
    publishedAt: '2026-08-06',
    updatedAt: '2026-08-06',
    sections: [
      {
        heading: 'Thickness dominates the estimate',
        body: 'Tonnage rises quickly as material thickness increases. Bend length, V die opening, and material factor also move the result.',
      },
      {
        heading: 'Tooling changes the risk',
        body: 'Die condition, punch radius, V opening, bend radius, and material tensile strength can make a simple estimate too optimistic.',
      },
      {
        heading: 'Leave margin near capacity',
        body: 'When the estimate approaches machine rating, review the job before production. Capacity margin protects tooling, machine accuracy, and operator safety.',
      },
    ],
  },
];

const insightCn = {
  'laser-cutting-cost-drivers': {
    category: '激光切割',
    title: '激光切割成本因素：切割长度、穿孔、气体与调机时间',
    // 基础（英文）对象上加了 seoTitle，本地化是"覆盖式合并"，不在这里显式覆盖就会
    // 让中文页顶着英文标题——这正是元数据长度测试第一次跑出来的问题。
    seoTitle: '激光切割成本因素：长度、穿孔与气体',
    description: '在获得正式车间报价前，梳理通常会影响激光切割成本的关键输入。',
    // 中文 SERP 的宽度约为 78 个汉字，原描述只用了三成。这一条是独立的元数据文案，
    // 内容全部取自本页正文，不新增任何事实。
    seoDescription: '从切割长度、穿孔次数、辅助气体与调机时间入手，梳理正式报价前会明显影响激光切割成本的几项输入。',
    toolLabel: '激光切割成本计算器',
    readingTime: '5 分钟阅读',
    sections: [
      { heading: '先从设备工时开始', body: '切割长度和切割速度决定基础切割时间。穿孔数量和单次穿孔时间会增加短暂延迟；孔位较多时，这些延迟会变得明显。' },
      { heading: '加入车间特有成本', body: '设备小时费率、辅助气体、调机时间、搬运、废料和去毛刺都会影响最终数字。比较外协与自制时，应把这些假设明确记录。' },
      { heading: '何时需要复核', body: '当材料昂贵、排版复杂、边缘质量要求严格，或估算将用于设备投资规划时，应请合格人员复核。' },
    ],
  },
  'metal-weight-for-structural-profiles': {
    category: '材料',
    title: '如何估算板材、管材、角钢、槽钢和型钢重量',
    seoTitle: '如何估算板材、管材与型钢重量',
    description: '在报价或运输前，使用理论截面积、密度、长度和数量估算材料重量。',
    seoDescription: '用理论截面积、材料密度、长度与数量估算板材、管材与型钢重量，供报价、运费规划与设备承载能力核算参考。',
    toolLabel: '材料重量计算器',
    readingTime: '4 分钟阅读',
    sections: [
      { heading: '核心公式', body: '大多数型材重量估算以截面积乘以长度、密度和数量为基础。结果可用于早期报价、运费规划和设备能力检查。' },
      { heading: '型材形状为何重要', body: '角钢、槽钢、管材和 H 型钢需要不同的面积公式。轧制圆角和钢厂标准会使供应商表格与简化几何计算存在差异。' },
      { heading: '采购时使用供应商数据', body: '理论重量只是规划参考。下采购订单前，请确认牌号、公差、涂层、材质证明和供应商重量表。' },
    ],
  },
  'press-brake-tonnage-risk-check': {
    category: '折弯',
    title: '生产前的折弯机吨位风险检查',
    description: '了解板厚、折弯长度、V 槽开口、材料强度和安全余量如何影响折弯机吨位。',
    seoDescription: '板厚、折弯长度、V 槽开口与材料强度如何影响折弯机吨位，以及估算接近设备额定能力时为什么要留出余量。',
    toolLabel: '折弯机吨位计算器',
    readingTime: '4 分钟阅读',
    sections: [
      { heading: '板厚主导估算结果', body: '材料变厚时，所需吨位会快速上升。折弯长度、V 槽开口和材料系数同样会影响结果。' },
      { heading: '模具会改变风险', body: 'V 槽开口、冲头圆角、模具状态、折弯半径和材料抗拉强度，都可能让简单估算过于乐观。' },
      { heading: '接近能力时保留余量', body: '当估算值接近设备额定能力时，应在生产前复核。能力余量有助于保护模具、设备精度和操作人员安全。' },
    ],
  },
};

export function getInsightBySlug(slug) {
  return insights.find((item) => item.slug === slug) || null;
}

export function getLocalizedInsight(slug, locale = 'en') {
  const insight = getInsightBySlug(slug);
  if (!insight || locale !== 'zh-CN') return insight;
  return { ...insight, ...(insightCn[insight.slug] || {}) };
}

export function getLocalizedInsights(locale = 'en') {
  if (locale !== 'zh-CN') return insights;
  return insights.map((item) => ({ ...item, ...(insightCn[item.slug] || {}) }));
}
