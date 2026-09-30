/**
 * 主题聚合分组（/topics/ 页）。
 *
 * 关键词调研的结论是：外包 / 第三方 / 海外交付这几簇的搜索面几乎被招标公告与设备厂内部
 * 政策 PDF 占据，没有服务商落地页。但这一页**不新增任何事实**——它只把已经存在的服务页、
 * 工具页与洞察文章按主题重新聚合，用一组窄而明确的入口把长尾词接住，
 * 同时给爬虫一条比 sitemap 更强的内链路径。
 *
 * 两个刻意的设计决定：
 * 1. 成员只写**路径**，链接文字从目标页自己的标题解析（见 publicSeoRoutes.js）。
 *    这样标题改了不会出现"聚合页还挂着旧文字"的漂移。
 * 2. 分组是**人工确认过的**，不是按关键词自动聚类。自动聚类会把不相关的页面凑在一起，
 *    而每一组的成员都必须真的属于那个主题——契约测试会校验每条路径都能解析到真实路由。
 */

export const TOPIC_GROUPS = [
  {
    key: 'by-machine',
    labels: { en: 'By machine type', 'zh-CN': '按机型' },
    groups: [
      {
        key: 'laser-cutting-machine',
        labels: { en: 'Laser cutting machines', 'zh-CN': '激光切割机' },
        members: [
          '/services/laser-cutting-machine-repair',
          '/services/remote-diagnostics',
          '/services/preventive-maintenance',
          '/services/machine-relocation-installation',
          '/services/spare-parts-consumables',
          '/insights/laser-cutting-machine-maintenance-checklist',
          '/tools/laser-cutting-cost-calculator',
        ],
      },
      {
        key: 'press-brake',
        labels: { en: 'Press brakes', 'zh-CN': '折弯机' },
        members: [
          '/services/press-brake-repair',
          '/services/preventive-maintenance',
          '/insights/press-brake-tonnage-risk-check',
          '/tools/press-brake-v-die-bend-allowance-helper',
        ],
      },
      {
        key: 'laser-source-cutting-head',
        labels: { en: 'Laser sources and cutting heads', 'zh-CN': '激光器与切割头' },
        members: [
          '/services/spare-parts-consumables',
          '/services/third-party-service',
          '/insights/laser-protective-lens-burning',
        ],
      },
      {
        key: 'control-and-retrofit',
        labels: { en: 'Controls and retrofit', 'zh-CN': '控制系统与改造' },
        members: [
          '/services/equipment-system-retrofit',
          '/services/remote-diagnostics',
          '/services/third-party-service',
        ],
      },
    ],
  },
  {
    key: 'by-service-form',
    labels: { en: 'By service form', 'zh-CN': '按服务形态' },
    groups: [
      {
        key: 'oem-and-in-warranty',
        labels: { en: 'OEM partnership and in-warranty work', 'zh-CN': '整机厂合作与保内上门' },
        members: [
          '/services/oem-service-partner',
          '/services/after-sales-outsourcing',
          '/services/laser-cutting-machine-repair',
          '/services/press-brake-repair',
        ],
      },
      {
        key: 'overseas-delivery',
        labels: { en: 'Overseas delivery', 'zh-CN': '出口设备海外交付' },
        members: [
          '/services/overseas-delivery',
          '/services/machine-relocation-installation',
        ],
      },
      {
        key: 'parts-and-exchange',
        labels: { en: 'Parts and exchange units', 'zh-CN': '备件与返修件流转' },
        members: [
          '/services/spare-parts-consumables',
          '/services/used-equipment-evaluation',
        ],
      },
      {
        key: 'third-party',
        labels: { en: 'Third-party and multi-brand service', 'zh-CN': '第三方与多品牌服务' },
        members: [
          '/services/third-party-service',
          '/services/after-sales-outsourcing',
          '/services/remote-diagnostics',
        ],
      },
    ],
  },
  {
    key: 'by-issue',
    labels: { en: 'By problem type', 'zh-CN': '按问题类型' },
    groups: [
      {
        key: 'alarms-and-diagnosis',
        labels: { en: 'Alarms and fault diagnosis', 'zh-CN': '报警与故障诊断' },
        members: [
          '/services/laser-cutting-machine-repair',
          '/services/remote-diagnostics',
          '/services/third-party-service',
          '/insights/laser-protective-lens-burning',
        ],
      },
      {
        key: 'accuracy-and-quality',
        labels: { en: 'Accuracy and cut quality', 'zh-CN': '精度与加工质量' },
        members: [
          '/services/press-brake-repair',
          '/services/laser-cutting-machine-repair',
          '/insights/press-brake-tonnage-risk-check',
        ],
      },
      {
        key: 'maintenance',
        labels: { en: 'Preventive maintenance', 'zh-CN': '维护保养' },
        members: [
          '/services/preventive-maintenance',
          '/insights/laser-cutting-machine-maintenance-checklist',
        ],
      },
      {
        key: 'planning-and-cost',
        labels: { en: 'Planning and cost estimation', 'zh-CN': '规划与成本测算' },
        members: [
          '/tools/metal-weight-calculator',
          '/tools/laser-cutting-cost-calculator',
          '/insights/laser-cutting-cost-drivers',
          '/insights/metal-weight-for-structural-profiles',
        ],
      },
    ],
  },
];

export function getTopicGroups(locale) {
  const key = locale === 'zh-CN' ? 'zh-CN' : 'en';
  return TOPIC_GROUPS.map((section) => ({
    key: section.key,
    heading: section.labels[key],
    groups: section.groups.map((group) => ({
      key: group.key,
      heading: group.labels[key],
      members: [...group.members],
    })),
  }));
}
