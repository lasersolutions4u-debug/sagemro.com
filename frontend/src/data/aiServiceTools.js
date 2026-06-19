import {
  Activity,
  BadgeDollarSign,
  Cog,
  Gauge,
  HeartPulse,
  ScanSearch,
} from 'lucide-react';

export const aiServiceTools = [
  {
    id: 'diagnosis',
    icon: ScanSearch,
    title: 'Fault Diagnosis AI',
    shortTitle: 'Fault Diagnosis',
    description: 'Turn alarms, photos, and symptoms into a structured service request.',
    cta: 'Diagnose Fault',
    leadType: 'Repair Service',
    fields: [
      { name: 'equipment', label: 'Equipment type', placeholder: 'e.g. Fiber laser cutter' },
      { name: 'brandModel', label: 'Brand / model', placeholder: 'e.g. 3015 6kW, CypCut, Raycus' },
      { name: 'alarmCode', label: 'Alarm code', placeholder: 'e.g. Z-axis following error' },
      { name: 'symptom', label: 'Fault symptoms', type: 'textarea', placeholder: 'Describe what happened, when it started, and whether the machine is stopped.' },
      { name: 'material', label: 'Material / thickness / gas', placeholder: 'e.g. 6mm carbon steel, oxygen' },
      { name: 'region', label: 'Location', placeholder: 'City / country' },
      { name: 'urgency', label: 'Urgency', placeholder: 'Normal / urgent / stopped production' },
    ],
    promptIntro: 'Please act as SAGEMRO AI Equipment Diagnostic Assistant and create a safe preliminary diagnosis.',
    outputGuide: 'Return likely causes, risk level, stop-work advice, information needed, possible parts, and whether SAGEMRO official service is recommended.',
  },
  {
    id: 'cutting-parameters',
    icon: Gauge,
    title: 'Cutting Parameters AI',
    shortTitle: 'Cutting Parameters',
    description: 'Get safe reference ranges for material, thickness, power, gas, and quality issues.',
    cta: 'Generate Parameters',
    leadType: 'Process Tuning',
    fields: [
      { name: 'material', label: 'Material', placeholder: 'e.g. stainless steel, carbon steel, aluminum' },
      { name: 'thickness', label: 'Thickness', placeholder: 'e.g. 3mm' },
      { name: 'laserPower', label: 'Laser power', placeholder: 'e.g. 3000W' },
      { name: 'gas', label: 'Assist gas', placeholder: 'e.g. nitrogen / oxygen / air' },
      { name: 'nozzle', label: 'Nozzle / focus', placeholder: 'e.g. 1.5 single nozzle, focus unknown' },
      { name: 'qualityIssue', label: 'Current issue', type: 'textarea', placeholder: 'Burr, dross, not cutting through, burn marks, rough edge...' },
    ],
    promptIntro: 'Please act as SAGEMRO Cutting Process AI and provide conservative reference cutting parameters.',
    outputGuide: 'Return parameter ranges, focus/gas/speed advice, likely causes of quality issues, and when to request SAGEMRO process tuning.',
  },
  {
    id: 'parts-identification',
    icon: Cog,
    title: 'Parts Identification AI',
    shortTitle: 'Parts Identification',
    description: 'Identify consumables or spare parts and collect what is needed for manual confirmation.',
    cta: 'Identify Part',
    leadType: 'Spare Parts',
    fields: [
      { name: 'partPhoto', label: 'Photo / marking description', type: 'textarea', placeholder: 'Describe the photo, marking, code, or nameplate text.' },
      { name: 'machineInfo', label: 'Machine / cutting head', placeholder: 'e.g. BM111, BLT, Precitec, Raytools' },
      { name: 'partUse', label: 'Where it is used', placeholder: 'e.g. protective lens, ceramic ring, sensor cable' },
      { name: 'quantity', label: 'Quantity needed', placeholder: 'e.g. 20 pcs' },
      { name: 'shippingRegion', label: 'Shipping region', placeholder: 'Country / city' },
    ],
    promptIntro: 'Please act as SAGEMRO Spare Parts Identification AI and help identify the likely part category.',
    outputGuide: 'Return likely part category, possible model, compatibility risks, missing confirmation info, and next step for SAGEMRO parts confirmation.',
  },
  {
    id: 'repair-estimate',
    icon: BadgeDollarSign,
    title: 'Repair Estimate AI',
    shortTitle: 'Repair Estimate',
    description: 'Estimate cost level and service complexity without making a binding quote.',
    cta: 'Estimate Repair',
    leadType: 'Repair Quote',
    fields: [
      { name: 'faultType', label: 'Fault type', placeholder: 'e.g. laser power drop, cutting head crash, chiller alarm' },
      { name: 'machineAge', label: 'Machine age', placeholder: 'e.g. 4 years' },
      { name: 'downtime', label: 'Production status', placeholder: 'Running / unstable / stopped' },
      { name: 'history', label: 'Repair history', type: 'textarea', placeholder: 'Previous repairs, replaced parts, repeated faults.' },
      { name: 'location', label: 'Location', placeholder: 'City / country' },
    ],
    promptIntro: 'Please act as SAGEMRO Repair Estimate AI and provide a non-binding cost-level assessment.',
    outputGuide: 'Return low/medium/high cost level, key cost drivers, likely parts or labor, information needed for a formal SAGEMRO quote, and safety notes.',
  },
  {
    id: 'machine-selection',
    icon: Activity,
    title: 'Machine Selection AI',
    shortTitle: 'Machine Selection',
    description: 'Recommend laser power, bed size, automation, and route qualified new-machine leads to Euchio.',
    cta: 'Select Machine',
    leadType: 'New Machine',
    fields: [
      { name: 'materials', label: 'Materials', placeholder: 'e.g. carbon steel, stainless steel, aluminum' },
      { name: 'thicknessRange', label: 'Thickness range', placeholder: 'e.g. 1-20mm' },
      { name: 'sheetSize', label: 'Sheet size', placeholder: 'e.g. 1500x3000mm' },
      { name: 'capacity', label: 'Production capacity', placeholder: 'Daily/monthly output target' },
      { name: 'budget', label: 'Budget range', placeholder: 'Optional' },
      { name: 'automation', label: 'Automation needs', placeholder: 'Manual / exchange table / loading system' },
      { name: 'country', label: 'Installation country', placeholder: 'Country / region' },
    ],
    promptIntro: 'Please act as SAGEMRO Machine Selection AI and create a preliminary laser cutting machine configuration.',
    outputGuide: 'Return recommended power range, table size, automation, auxiliary equipment, whether repair/upgrade/new purchase is better, and note that Euchio can follow up for a formal project quote.',
  },
  {
    id: 'health-report',
    icon: HeartPulse,
    title: 'Equipment Health Report AI',
    shortTitle: 'Health Report',
    description: 'Create a health score and maintenance plan from usage, faults, and repair history.',
    cta: 'Create Report',
    leadType: 'Maintenance Plan',
    fields: [
      { name: 'machine', label: 'Machine profile', placeholder: 'Brand, model, power, year' },
      { name: 'usage', label: 'Usage intensity', placeholder: 'e.g. 10 hours/day, 6 days/week' },
      { name: 'faultFrequency', label: 'Recent fault frequency', placeholder: 'e.g. 3 stops in the last month' },
      { name: 'maintenance', label: 'Maintenance history', type: 'textarea', placeholder: 'Cleaning, lens replacement, chiller service, previous repairs.' },
      { name: 'qualityIssues', label: 'Quality issues', placeholder: 'Burr, unstable power, poor accuracy, repeated alarms' },
    ],
    promptIntro: 'Please act as SAGEMRO Equipment Health Report AI and create a practical maintenance and lifecycle assessment.',
    outputGuide: 'Return health score, risk components, recommended maintenance, suggested spare parts kit, maintenance-plan opportunity, and possible upgrade/new-machine signal.',
  },
];

const zhAiServiceToolText = {
  diagnosis: {
    title: '故障诊断 AI',
    shortTitle: '故障诊断',
    description: '把报警、图片和故障现象整理成可跟进的服务申请。',
    cta: '诊断故障',
    leadType: '维修服务',
    fields: [
      { label: '设备类型', placeholder: '例如：光纤激光切割机' },
      { label: '品牌 / 型号', placeholder: '例如：3015 6kW，CypCut，Raycus' },
      { label: '报警代码', placeholder: '例如：Z 轴随动异常' },
      { label: '故障现象', placeholder: '描述发生了什么、何时开始、设备是否停机。' },
      { label: '材料 / 厚度 / 气体', placeholder: '例如：6mm 碳钢，氧气' },
      { label: '所在地', placeholder: '城市 / 国家' },
      { label: '紧急程度', placeholder: '普通 / 紧急 / 已停产' },
    ],
    promptIntro: '请作为 SAGEMRO AI 设备故障诊断助手，生成安全、审慎的初步诊断。',
    outputGuide: '请返回可能原因、风险等级、停机/停工建议、还需要补充的信息、可能涉及的备件，以及是否建议提交 SAGEMRO 官方服务。',
  },
  'cutting-parameters': {
    title: '切割参数 AI',
    shortTitle: '切割参数',
    description: '根据材料、厚度、功率、气体和质量问题给出安全参考范围。',
    cta: '生成参数',
    leadType: '工艺调试',
    fields: [
      { label: '材料', placeholder: '例如：不锈钢、碳钢、铝' },
      { label: '厚度', placeholder: '例如：3mm' },
      { label: '激光功率', placeholder: '例如：3000W' },
      { label: '辅助气体', placeholder: '例如：氮气 / 氧气 / 空气' },
      { label: '喷嘴 / 焦点', placeholder: '例如：1.5 单喷，焦点不确定' },
      { label: '当前质量问题', placeholder: '毛刺、挂渣、切不透、烧边、断面粗糙等。' },
    ],
    promptIntro: '请作为 SAGEMRO 切割工艺 AI，提供保守、安全的切割参数参考。',
    outputGuide: '请返回参数范围、焦点/气体/速度建议、质量问题的可能原因，以及何时建议申请 SAGEMRO 工艺调试。',
  },
  'parts-identification': {
    title: '备件识别 AI',
    shortTitle: '备件识别',
    description: '识别易损件或备件类别，并收集人工确认所需信息。',
    cta: '识别备件',
    leadType: '备件需求',
    fields: [
      { label: '图片 / 标识描述', placeholder: '描述照片、铭牌、编码或零件标识。' },
      { label: '设备 / 切割头信息', placeholder: '例如：BM111、BLT、Precitec、Raytools' },
      { label: '使用位置', placeholder: '例如：保护镜片、陶瓷环、传感器线' },
      { label: '需求数量', placeholder: '例如：20 件' },
      { label: '收货地区', placeholder: '国家 / 城市' },
    ],
    promptIntro: '请作为 SAGEMRO 备件识别 AI，帮助判断可能的备件类别。',
    outputGuide: '请返回可能的备件类别、可能型号、兼容性风险、缺失确认信息，以及 SAGEMRO 备件确认的下一步。',
  },
  'repair-estimate': {
    title: '维修预估 AI',
    shortTitle: '维修预估',
    description: '评估维修复杂度和费用等级，但不生成具有约束力的报价。',
    cta: '预估维修',
    leadType: '维修报价',
    fields: [
      { label: '故障类型', placeholder: '例如：激光功率下降、切割头撞机、冷水机报警' },
      { label: '设备年限', placeholder: '例如：4 年' },
      { label: '生产状态', placeholder: '运行中 / 不稳定 / 已停机' },
      { label: '维修历史', placeholder: '此前维修、更换过的部件、是否重复故障。' },
      { label: '所在地', placeholder: '城市 / 国家' },
    ],
    promptIntro: '请作为 SAGEMRO 维修预估 AI，提供非约束性的费用等级评估。',
    outputGuide: '请返回低/中/高费用等级、主要成本驱动因素、可能的备件或人工、正式报价还需要的信息，以及安全提示。',
  },
  'machine-selection': {
    title: '新机选型 AI',
    shortTitle: '新机选型',
    description: '推荐激光功率、台面尺寸、自动化配置，并把有效新机线索转给 Euchio。',
    cta: '新机选型',
    leadType: '新机项目',
    fields: [
      { label: '加工材料', placeholder: '例如：碳钢、不锈钢、铝' },
      { label: '厚度范围', placeholder: '例如：1-20mm' },
      { label: '板材尺寸', placeholder: '例如：1500x3000mm' },
      { label: '产能目标', placeholder: '每天 / 每月产量目标' },
      { label: '预算范围', placeholder: '可选' },
      { label: '自动化需求', placeholder: '人工上下料 / 交换台 / 上下料系统' },
      { label: '安装国家 / 地区', placeholder: '国家 / 地区' },
    ],
    promptIntro: '请作为 SAGEMRO 新机选型 AI，生成初步激光切割设备配置建议。',
    outputGuide: '请返回建议功率范围、台面尺寸、自动化配置、辅助设备、维修/升级/购新哪种路径更合适，并说明 Euchio 可继续跟进正式项目报价。',
  },
  'health-report': {
    title: '设备健康报告 AI',
    shortTitle: '健康报告',
    description: '根据使用强度、故障和维修历史生成健康评分与保养计划。',
    cta: '生成报告',
    leadType: '保养计划',
    fields: [
      { label: '设备档案', placeholder: '品牌、型号、功率、年份' },
      { label: '使用强度', placeholder: '例如：每天 10 小时，每周 6 天' },
      { label: '近期故障频率', placeholder: '例如：最近一个月停机 3 次' },
      { label: '保养历史', placeholder: '清洁、镜片更换、冷水机保养、过往维修。' },
      { label: '质量问题', placeholder: '毛刺、功率不稳、精度差、反复报警' },
    ],
    promptIntro: '请作为 SAGEMRO 设备健康报告 AI，生成实用的保养和生命周期评估。',
    outputGuide: '请返回健康评分、风险组成、建议保养项目、建议备件包、保养计划机会，以及潜在升级/新机信号。',
  },
};

export function getLocalizedAiServiceTools(locale = 'en') {
  if (locale !== 'zh-CN') return aiServiceTools;

  return aiServiceTools.map((tool) => {
    const local = zhAiServiceToolText[tool.id];
    if (!local) return tool;

    return {
      ...tool,
      ...local,
      fields: tool.fields.map((field, index) => ({
        ...field,
        ...(local.fields[index] || {}),
      })),
    };
  });
}

export function buildAiToolPrompt(tool, values, copy = {}) {
  const notProvided = copy.notProvided || 'Not provided';
  const details = tool.fields
    .map((field) => `${field.label}: ${values[field.name] || notProvided}`)
    .join('\n');

  return `${tool.promptIntro}

${copy.promptContext || `Business context:
- SAGEMRO is an official service team for laser cutting and sheet metal equipment, not a loose matchmaking platform.
- AI advice is preliminary and must avoid unsafe repair instructions, absolute diagnosis, or binding price commitments.
- If on-site confirmation is needed, guide the user to request SAGEMRO official service.`}

User input:
${details}

Required output:
${tool.outputGuide}

${copy.promptFooter || 'Also create a short structured summary suitable for a service request or sales lead.'}`;
}
