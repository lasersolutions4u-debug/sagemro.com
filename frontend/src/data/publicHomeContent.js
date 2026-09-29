const zhContent = {
  // 主入口：整机厂（付费甲方，见 docs/research/2026-09-29-双线选择决策备忘录.md）
  hero: {
    eyebrow: '面向激光与金属成形设备整机厂',
    title: '承接整机厂售后交付，不占你的编制。',
    description: '承接保内上门、出厂调试与安装、出口设备海外装机与调试、返修件流转与备件支持。工程师由我们组织，按项目或按次结算。',
  },
  audiences: {
    maker: {
      cta: '提交协作需求',
      secondaryCta: '查看协作边界',
    },
    // 次入口：设备用户。文案保持既有口径不变。
    user: {
      eyebrow: '设备用户',
      title: '设备出现故障？从问题判断到服务执行，帮你明确下一步。',
      description: '面向激光切割机、折弯机及相关工业设备，提供故障诊断、维修、系统改造、移位安装、维护保养、旧设备评估与备件支持。',
      cta: '提交服务需求',
    },
  },
  makerEngagements: {
    eyebrow: '整机厂协作',
    title: '三类售后交付，都可以按次承接',
    columns: {
      context: '你现在的处境',
      approach: '我们怎么接',
      need: '需要你提供',
    },
    items: [
      {
        key: 'in-warranty',
        title: '保内上门',
        context: '质保期内上门由你自派人，人工与差旅占掉大部分服务成本，人力还被质保义务锁住。',
        approach: '按次承接上门服务，工程师由我们组织；服务记录与检测结论留档并回传。',
        need: '机型与功率段、故障现象与报警、客户现场位置、质保状态',
      },
      {
        key: 'overseas',
        title: '出口设备海外交付',
        context: '出口设备分散在不同国家，自建驻地团队覆盖不到，临时派人成本与周期都高。',
        approach: '先远程判断，再按国家与可用资源确认现场方案；装机、调试、客户培训与保内响应由我们组织交付。',
        need: '出口国别、机型与数量、交付时间窗、当地联系人',
      },
      {
        key: 'rma',
        title: '返修件流转',
        context: '客户等不起换新件的采购周期，整机停机的损失却由客户承担。',
        approach: '先发可用件恢复生产，坏件回收维修后入库周转；检测数据与保修条款随件留档。',
        need: '部件型号、故障判定依据、是否需要交换件、保修口径',
      },
    ],
  },
  makerWorkflow: {
    title: '协作怎么走',
    steps: [
      { key: 'scope', title: '说明机型与需求范围', detail: '设备类型、品牌型号、数量、所在地区与服务时间要求。' },
      { key: 'terms', title: '确认服务范围与结算方式', detail: '按项目或按次报价，写明服务边界、差旅与备件口径，双方确认后启动。' },
      { key: 'mobilize', title: '组织工程师与备件', detail: '由我们安排执行工程师与所需备件；关键部件只用正品。' },
      { key: 'handover', title: '交付并留档', detail: '交付记录、检测数据与服务结论留档，后续问题可追溯。' },
    ],
  },
  makerBoundary: {
    title: '协作边界',
    items: [
      { key: 'no-name-use', detail: '未经书面许可，我们不使用任何整机厂或客户的名称、案例与数据做宣传。' },
      { key: 'no-blanket-promise', detail: '不对未检测的设备状态做统一承诺；诊断、报价与安全要求以技术确认结果为准。' },
      { key: 'case-by-case', detail: '海外交付按国家、地区与可用服务资源逐案确认，不预先承诺时效。' },
      { key: 'genuine-parts', detail: '关键部件只用正品件；替代件须事先书面确认并说明质保差异。' },
    ],
  },
  makerFaqs: {
    title: '整机厂协作常见问题',
    items: [
      { key: 'maker-scope', question: '你们能承接哪一段服务？', answer: '三类：保内上门、出口设备的海外装机与调试、返修件流转与备件支持。具体范围按机型、地区与服务资源逐案确认，不做超出服务能力的承诺。' },
      { key: 'maker-settlement', question: '怎么结算？', answer: '按项目或按次报价，写明服务边界、差旅与备件口径。不采用按人天计价的模糊结算方式。' },
      { key: 'maker-engineers', question: '执行工程师是你们自己的吗？', answer: '由我们组织的合作工程师执行，统一服务标准与验收口径；服务记录与检测数据留档并回传。' },
      { key: 'maker-overseas', question: '海外交付你们怎么组织？', answer: '先远程判断，再按国家、机型与可用服务资源确认现场方案。不预先承诺时效，也不做未经验证的交付承诺。' },
    ],
  },
  problemLinks: {
    items: [
      { key: 'fault', label: '设备故障或停机' },
      { key: 'accuracy', label: '精度或加工质量异常' },
      { key: 'upgrade', label: '系统需要升级改造' },
      { key: 'relocation', label: '设备拆机或移位' },
      { key: 'maintenance', label: '需要检测与保养' },
      { key: 'parts', label: '需要耗材或备件' },
    ],
  },
  services: {
    items: [
      { key: 'repair', title: '设备维修与故障诊断' },
      { key: 'upgrade', title: '系统升级与设备改造' },
      { key: 'relocation', title: '拆机、移位与重新安装' },
      { key: 'maintenance', title: '设备检测与预防性维护' },
      { key: 'assessment', title: '旧设备评估与处置支持' },
      { key: 'parts', title: '耗材、备件与更换调试' },
    ],
  },
  reasons: {
    items: [
      { key: 'service-first', title: '从服务问题出发', detail: '先明确故障现象和服务目标，再确定下一步。' },
      { key: 'matched', title: '明细报价，确认后执行', detail: '根据地区、设备和项目单独报价，列明服务范围和费用，客户确认后再启动。' },
      { key: 'coverage', title: '覆盖境内外需求', detail: '国内全国协调，国际先远程判断，再确认可执行方案。' },
      { key: 'clear-scope', title: '质保与跟进有据可查', detail: '维修、改造和配件服务的质保与后续跟进，以具体方案或报价中的约定为准。' },
    ],
  },
  process: {
    steps: [
      { key: 'describe', title: '描述设备与问题' },
      { key: 'review', title: '整理服务请求' },
      { key: 'confirm', title: '技术人员确认' },
      { key: 'execute', title: '安排服务执行' },
    ],
    boundary: 'AI 仅协助整理信息；实际诊断、报价、派工和安全要求由技术人员确认。',
  },
  faqs: {
    items: [
      { key: 'equipment', question: '支持哪些设备和品牌？', answer: '主要面向激光切割机、激光器、折弯机、剪板机、控制与驱动系统及相关辅助设备。不以单一品牌限定服务范围，具体能否执行根据品牌、型号、地区和项目资料确认。' },
      { key: 'information', question: '提交请求需要哪些信息？', answer: '建议提供设备类型、品牌型号、报警代码、故障现象、发生时间、已做检查、现场位置，以及在安全条件下拍摄的清晰照片或视频。' },
      { key: 'remote', question: '可以先远程判断吗？', answer: '可以。我们会先根据提交信息整理问题并安排技术确认；远程判断不代替现场检测，也不直接构成最终诊断。' },
      { key: 'onsite', question: '可以安排现场服务吗？', answer: '国内可全国协调；国际项目先进行远程评估，再根据国家、地区、设备和可用服务资源确认现场方案。' },
      { key: 'timing', question: '多久能安排技术确认或上门？', answer: '提交资料后先进行请求整理和技术确认。具体响应和现场时间取决于紧急程度、地区、设备、备件与人员资源，以确认结果为准。' },
      { key: 'pricing', question: '上门检测和服务怎么收费？', answer: '根据地区、设备和项目单独报价。差旅、检测、维修、改造、备件与调试等项目会在方案或明细报价中说明，客户确认后再启动。' },
      { key: 'warranty', question: '维修、改造或备件有质保吗？', answer: '质保范围、期限、适用条件和不包含项会在具体方案或报价中明确，不对未检测的设备状态做统一承诺。' },
      { key: 'parts', question: '可以协助寻找备件吗？', answer: '可以协助核对备件型号、兼容性和更换条件。供应范围、价格、交期及调试内容以具体报价为准。' },
      { key: 'upgrade', question: '旧设备可以升级或评估处置吗？', answer: '可以先评估控制系统、驱动、机械状态、接口、安全与工艺目标，再判断继续使用、局部升级、系统改造或处置支持是否合适。' },
      { key: 'quote', question: '如何获得方案和报价？', answer: '提交统一服务请求后，我们会根据地区、设备和项目单独核实范围，提供明细方案或报价，确认后再执行。' },
    ],
  },
  tools: {
    items: [
      { key: 'fault-checklist', title: '故障信息清单' },
      { key: 'maintenance-guide', title: '维护检查指南' },
      { key: 'request-guide', title: '服务请求指南' },
    ],
  },
  insights: {
    items: [
      { key: 'diagnosis', title: '故障诊断要点' },
      { key: 'maintenance', title: '预防性维护建议' },
      { key: 'relocation', title: '设备移位注意事项' },
    ],
  },
  // 品牌页已下线：不再在公开站列举任何设备品牌名。
  // 工单/服务请求页已下线：落地页只保留「和 AI 助手对话」这一个站外入口，
  // 站内转化走咨询线索表单（PublicSiteShell 的「咨询」按钮）。
  requestCtas: {
    assist: {
      label: 'AI 协助填写',
      href: 'https://ai.sagemro.cn/?mode=assist',
    },
  },
  contact: { email: 'support@sagemro.com' },
};

const enContent = {
  hero: {
    eyebrow: 'Laser and metal-forming equipment service',
    title: 'Equipment down? Get a clear next step — from assessment to service delivery.',
    description: 'Service support for laser cutters, press brakes, and related industrial equipment, including diagnostics, repair, upgrades, relocation, maintenance, used-equipment assessment, and parts.',
  },
  // 渠道商入口只在国际站出现；CN 不露出招商内容（见定位方案 §3 纪律）。
  partnerEntry: {
    eyebrow: 'Dealers and service partners',
    title: 'A service and parts backstop for the machines you sell.',
    description: 'We support overseas dealers and agents handling Chinese-built laser and metal-forming equipment — remote diagnosis, spare parts, exchange units, and coordinated field service.',
    cta: 'See how partner support works',
    href: '/partners/',
  },
  // /partners/ 整页文案。与首页 partnerEntry 同源，SEO 路由也从这里取，避免两处漂移。
  partnerPage: {
    eyebrow: 'For overseas dealers and service partners',
    title: 'A service and parts backstop for the machines you sell.',
    description: 'We support dealers and agents handling Chinese-built laser and metal-forming equipment — remote diagnosis, spare parts, exchange units, and coordinated field service, so a fault does not cost you the account.',
    sections: [
      { key: 'coverage', heading: 'What partner support covers', body: 'Remote diagnosis before a trip is booked. Spare parts and exchange units to cut downtime. Coordinated field service where a site visit is unavoidable. Escalation to the equipment maker with the evidence already collected.' },
      { key: 'need', heading: 'What we need from you', body: 'Machine brand and model. Alarm code or fault symptom. Machine year or serial. Site country and access conditions.' },
      { key: 'boundary', heading: 'Boundaries', body: 'We work with equipment makers and their existing dealer networks. We do not recruit exclusive agents and do not claim exclusivity we do not hold. We do not replace the original manufacturer warranty obligations. Field-service feasibility is confirmed case by case; no lead time is promised in advance.' },
    ],
    form: {
      title: 'Become a service partner',
      fields: {
        name: 'Your name',
        company: 'Company',
        email: 'Email',
        phone: 'Phone',
        country: 'Country',
        message: 'What you sell and where',
      },
      submit: 'Send partner application',
      success: 'Thank you. We will contact you to confirm coverage for your region.',
      error: 'The application could not be sent. Please try again, or email support@sagemro.com.',
    },
  },
  problemLinks: {
    items: [
      { key: 'fault', label: 'Equipment fault or downtime' },
      { key: 'accuracy', label: 'Accuracy or quality issue' },
      { key: 'upgrade', label: 'System or equipment upgrade' },
      { key: 'relocation', label: 'Dismantling or relocation' },
      { key: 'maintenance', label: 'Inspection or maintenance' },
      { key: 'parts', label: 'Consumables or spare parts' },
    ],
  },
  services: {
    items: [
      { key: 'repair', title: 'Equipment repair and fault diagnosis' },
      { key: 'upgrade', title: 'System upgrades and equipment retrofits' },
      { key: 'relocation', title: 'Dismantling, relocation, and reinstallation' },
      { key: 'maintenance', title: 'Inspection and preventive maintenance' },
      { key: 'assessment', title: 'Used-equipment assessment and disposal support' },
      { key: 'parts', title: 'Consumables, spare parts, and commissioning' },
    ],
  },
  reasons: {
    items: [
      { key: 'service-first', title: 'Service-first approach', detail: 'Start with the operating issue and desired service outcome.' },
      { key: 'matched', title: 'Itemized quotation before work starts', detail: 'Pricing is prepared separately for the region, equipment, and project, with the service scope and costs itemized for customer confirmation.' },
      { key: 'coverage', title: 'Domestic and international support', detail: 'Local coverage is coordinated by region; international requests start with remote assessment.' },
      { key: 'clear-scope', title: 'Defined warranty and follow-up', detail: 'Warranty and follow-up terms for repair, retrofit, and parts work are defined in the specific proposal or quotation.' },
    ],
  },
  process: {
    steps: [
      { key: 'describe', title: 'Describe the equipment and issue' },
      { key: 'review', title: 'Prepare the service request' },
      { key: 'confirm', title: 'Technical review and confirmation' },
      { key: 'execute', title: 'Coordinate service delivery' },
    ],
    boundary: 'AI only helps organize submitted information. A technician confirms diagnosis, quotation, assignment, and safety requirements.',
  },
  faqs: {
    items: [
      { key: 'equipment', question: 'Which equipment types and brands are supported?', answer: 'We primarily support laser cutters, laser sources, press brakes, shears, control and drive systems, and related auxiliary equipment. Service is not limited to one brand; feasibility depends on the exact brand, model, region, and project evidence.' },
      { key: 'information', question: 'What information should I provide?', answer: 'Provide the equipment type, brand and model, complete alarm code, symptom, timing, checks already made, site location, and clear photos or video where safe.' },
      { key: 'remote', question: 'Can the issue be assessed remotely first?', answer: 'Yes. Submitted information can be organized for technical review first. Remote assessment does not replace on-site inspection or constitute a final diagnosis.' },
      { key: 'onsite', question: 'Can on-site service be arranged?', answer: 'International field work is reviewed by country, region, equipment, and available service resources after an initial remote assessment.' },
      { key: 'timing', question: 'How soon can technical review or field service be arranged?', answer: 'The request is organized and reviewed first. Response and field-service timing depend on urgency, country, equipment, parts, and available personnel, and are confirmed for the individual project.' },
      { key: 'pricing', question: 'How are inspection and service charges determined?', answer: 'Pricing is prepared separately for the region, equipment, and project. Travel, inspection, repair, retrofit, parts, and commissioning items are stated in the proposal or itemized quotation before work starts.' },
      { key: 'warranty', question: 'Is warranty available for repair, retrofit, or parts work?', answer: 'The applicable warranty scope, period, conditions, and exclusions are stated in the specific proposal or quotation. No uniform promise is made before the equipment and scope are reviewed.' },
      { key: 'parts', question: 'Can you help source spare parts?', answer: 'We can help match part numbers, compatibility, and replacement conditions. Supply, price, lead time, and commissioning scope are defined in the quotation.' },
      { key: 'upgrade', question: 'Can older equipment be upgraded or assessed for disposition?', answer: 'Controls, drives, mechanical condition, interfaces, safety, and process goals can be reviewed before deciding whether continued use, a partial upgrade, a retrofit, or disposition support is appropriate.' },
      { key: 'quote', question: 'How do I request a proposal or quotation?', answer: 'After the unified service request is submitted, scope is reviewed for the region, equipment, and project. An itemized proposal or quotation is confirmed before execution.' },
    ],
  },
  tools: {
    items: [
      { key: 'fault-checklist', title: 'Fault information checklist' },
      { key: 'maintenance-guide', title: 'Maintenance inspection guide' },
      { key: 'request-guide', title: 'Service request guide' },
    ],
  },
  insights: {
    items: [
      { key: 'diagnosis', title: 'Fault diagnosis essentials' },
      { key: 'maintenance', title: 'Preventive maintenance guidance' },
      { key: 'relocation', title: 'Equipment relocation considerations' },
    ],
  },
  requestCtas: {
    assist: {
      label: 'Get help preparing a service request',
      href: 'https://ai.sagemro.com/?mode=assist',
    },
  },
  contact: { email: 'support@sagemro.com' },
};

export const getPublicHomeContent = (isChina) => structuredClone(isChina ? zhContent : enContent);
