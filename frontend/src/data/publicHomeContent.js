const zhContent = {
  hero: {
    eyebrow: '激光与金属成形设备服务',
    title: '设备出现故障？从问题判断到服务执行，帮你明确下一步。',
    description: '面向激光切割机、折弯机及相关工业设备，提供故障诊断、维修、系统改造、移位安装、维护保养、旧设备评估与备件支持。',
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
  brands: {
    groups: [
      { key: 'laser', title: '激光设备', items: ['激光切割机', '激光焊接机'] },
      { key: 'forming', title: '金属成形设备', items: ['折弯机', '剪板机'] },
      { key: 'systems', title: '系统与部件', items: ['控制系统', '辅助设备'] },
    ],
  },
  requestCtas: {
    assist: {
      label: '协助填写服务请求',
      href: 'https://ai.sagemro.cn/service-request?mode=assist',
    },
    manual: {
      label: '手动填写服务请求',
      href: 'https://ai.sagemro.cn/service-request?mode=manual',
    },
  },
  contact: { email: 'support@sagemro.com' },
};

const enContent = {
  hero: {
    eyebrow: 'Laser and metal-forming equipment service',
    title: 'Equipment problem? Clarify the next step from initial assessment to service delivery.',
    description: 'Service support for laser cutters, press brakes, and related industrial equipment, including diagnostics, repair, upgrades, relocation, maintenance, used-equipment assessment, and parts.',
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
  brands: {
    groups: [
      { key: 'laser', title: 'Laser equipment', items: ['Laser cutting machines', 'Laser welding machines'] },
      { key: 'forming', title: 'Metal-forming equipment', items: ['Press brakes', 'Shearing machines'] },
      { key: 'systems', title: 'Systems and components', items: ['Control systems', 'Auxiliary equipment'] },
    ],
  },
  requestCtas: {
    assist: {
      label: 'Get help preparing a service request',
      href: 'https://ai.sagemro.com/service-request?mode=assist',
    },
    manual: {
      label: 'Complete the service request manually',
      href: 'https://ai.sagemro.com/service-request?mode=manual',
    },
  },
  contact: { email: 'support@sagemro.com' },
};

export const getPublicHomeContent = (isChina) => structuredClone(isChina ? zhContent : enContent);
