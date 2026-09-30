// 本文件由 scripts/generateHomeFeaturedTools.mjs 生成，请勿手改。
// 重新生成：npm run generate:home-featured-tools
//
// 存在的理由：首页只需要 3 个工具卡片的 { id, slug, label, description }，而
// data/industryTools.js 有 61 KB（全部工具的 SEO 证据 + 计算器）。首页是静态导入的，
// 直接 import 那个模块会把 61 KB 放进入口分块，让每一个营销页都多付一次。
//
// 正确性由 tests/home-featured-tools.test.mjs 保证：生成物与 getLocalizedTool 的输出逐字段一致。

export const HOME_FEATURED_TOOL_IDS = ["cutting-speed","auxiliary-sizing","metal-weight"];

const TOOLS = {
  "en": [
    {
      "id": "cutting-speed",
      "slug": "laser-cutting-speed-reference",
      "label": "Laser Cutting Speed Reference",
      "description": "Compare rough speed ranges by material, thickness, assist gas, and laser power for planning checks."
    },
    {
      "id": "auxiliary-sizing",
      "slug": "laser-chiller-dust-collector-sizing-checklist",
      "label": "Chiller and Dust Collector Sizing",
      "description": "Estimate chiller capacity and dust collector airflow reference from laser power, table size, hours, and dust load."
    },
    {
      "id": "metal-weight",
      "slug": "metal-weight-calculator",
      "label": "Metal Weight Calculator",
      "description": "Estimate sheet, plate, tube, angle, channel, beam, and bar weight from material density and dimensions."
    }
  ],
  "zh-CN": [
    {
      "id": "cutting-speed",
      "slug": "laser-cutting-speed-reference",
      "label": "激光切割速度参考",
      "description": "按材料、厚度、辅助气体和激光功率对比规划阶段的速度范围。"
    },
    {
      "id": "auxiliary-sizing",
      "slug": "laser-chiller-dust-collector-sizing-checklist",
      "label": "冷水机和除尘器选型参考",
      "description": "按激光功率、台面尺寸、工作时长和粉尘负荷估算冷却能力与除尘风量参考。"
    },
    {
      "id": "metal-weight",
      "slug": "metal-weight-calculator",
      "label": "材料重量计算器",
      "description": "按材料密度和尺寸估算板材、管材、角钢、槽钢、型钢和棒材重量。"
    }
  ]
};

/** 返回首页工具卡片的本地化数据（每次调用都是新对象，调用方改它不会污染缓存）。 */
export function getHomeFeaturedTools(locale = 'en') {
  const table = TOOLS[locale] ?? TOOLS.en;
  return table.map((tool) => ({ ...tool }));
}
