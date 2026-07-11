export const insights = [
  {
    slug: 'laser-cutting-cost-drivers',
    category: 'Laser cutting',
    title: 'Laser cutting cost drivers: cut length, pierces, gas, and setup time',
    description: 'A practical breakdown of the inputs that usually move laser cutting cost before a formal shop quote.',
    toolSlug: 'laser-cutting-cost-calculator',
    toolLabel: 'Laser Cutting Cost Calculator',
    readingTime: '5 min read',
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
    description: 'Use theoretical profile area, density, length, and quantity to estimate material weight before quoting or shipping.',
    toolSlug: 'metal-weight-calculator',
    toolLabel: 'Metal Weight Calculator',
    readingTime: '4 min read',
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
    title: '激光切割成本主要由哪些因素决定：切割长度、穿孔、气体和调机时间',
    description: '在正式报价前，先把通常影响激光切割成本的输入项拆开看清楚。',
    toolLabel: '激光切割成本计算器',
    readingTime: '5 分钟阅读',
    sections: [
      {
        heading: '先从设备时间开始',
        body: '切割长度和切割速度决定基础切割时间。穿孔数量和单次穿孔时间看似很短，但在孔很多的零件上会明显影响总工时。',
      },
      {
        heading: '再加入车间自身成本',
        body: '设备小时费率、辅助气体、调机时间、搬运、废料和去毛刺都会改变最终数字。比较外协和自有产能时，这些假设应保持可见。',
      },
      {
        heading: '什么时候需要复核',
        body: '当材料价格高、排版复杂、边缘质量要求高，或估算结果用于设备投资规划时，建议让有经验的人员复核。',
      },
    ],
  },
  'metal-weight-for-structural-profiles': {
    category: '材料',
    title: '如何估算板材、管材、角钢、槽钢和型钢重量',
    description: '用理论截面积、密度、长度和数量，在报价或运输前估算材料重量。',
    toolLabel: '材料重量计算器',
    readingTime: '4 分钟阅读',
    sections: [
      {
        heading: '核心公式',
        body: '多数型材重量估算从截面积乘以长度、密度和数量开始。结果适合早期报价、运输规划和设备能力检查。',
      },
      {
        heading: '为什么型材形状很重要',
        body: '角钢、槽钢、管材和 H 型钢需要不同的面积公式。轧制圆角和钢厂标准会让供应商表格与简化几何结果不同。',
      },
      {
        heading: '最终采购要看供应商数据',
        body: '理论重量是规划参考。用于采购订单前，应确认牌号、公差、涂层、材质证明和供应商重量表。',
      },
    ],
  },
  'press-brake-tonnage-risk-check': {
    category: '折弯',
    title: '生产前的折弯吨位风险检查',
    description: '板厚、折弯长度、V 槽开口、材料强度和安全余量如何影响折弯吨位。',
    toolLabel: '折弯机吨位计算器',
    readingTime: '4 分钟阅读',
    sections: [
      {
        heading: '板厚对估算影响最大',
        body: '材料厚度增加时，所需吨位会上升很快。折弯长度、V 槽开口和材料系数也会影响结果。',
      },
      {
        heading: '模具会改变风险',
        body: '模具状态、上模半径、V 槽开口、折弯半径和材料抗拉强度，都可能让简单估算过于乐观。',
      },
      {
        heading: '接近设备能力时要留余量',
        body: '当估算值接近设备额定能力时，应在生产前复核。能力余量有助于保护模具、设备精度和操作安全。',
      },
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
