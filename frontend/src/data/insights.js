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

export function getInsightBySlug(slug) {
  return insights.find((item) => item.slug === slug) || null;
}
