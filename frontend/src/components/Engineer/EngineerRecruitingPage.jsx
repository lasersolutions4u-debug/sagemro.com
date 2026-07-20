import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MapPin,
  ShieldCheck,
  UsersRound,
  Wrench,
  X,
} from 'lucide-react';
import { submitEngineerApplication } from '../../services/api';
import { BrandMark } from '../common/BrandMark';

const COPY = {
  cn: {
    badge: 'SAGEMRO 工程师服务协作网络',
    networkLabel: '服务工程师网络',
    title: '让工程师专注解决设备问题，不再被杂务拖住。',
    subtitle: 'SAGEMRO AI 先协助完成咨询分流、设备与故障信息整理、基础排查和服务记录准备。需要工程师介入时，你拿到的是更清晰的任务背景、风险提示和下一步，而不是一串零散消息。',
    primary: '申请成为服务合作伙伴',
    applyNow: '申请加入服务网络',
    howItWorks: '查看协作方式',
    signIn: '已有工程师账号，进入工作台',
    returnToCustomer: '返回客户服务首页',
    customerHomeHref: 'https://sagemro.cn',
    heroStats: [
      { value: 'AI 先分流', label: '先整理，再决定是否需要工程师' },
      { value: '任务先结构化', label: '设备、现象、风险和历史更清楚' },
      { value: '服务全程留痕', label: '报价、消息、结果和后续统一记录' },
    ],
    audienceTitle: '本地维修团队与个人工程师',
    audienceText: '无论你正在经营本地维修团队，还是以个人身份提供现场服务，都可以把 SAGEMRO 作为咨询分流、任务整理、服务协同和记录沉淀的工作入口。',
    problemTitle: '维修团队最贵的，不只是一次上门，而是工程师时间被不断打碎。',
    problemIntro: '传统服务模式把咨询、技术判断、客户沟通、调度、报价、记录和汇报都压在少数工程师身上。工程师越能干，越容易成为团队无法复制的单点。',
    problemItems: [
      { title: '零散咨询持续打断', text: '大量问题缺少设备型号、报警、现场条件和历史记录，工程师需要反复追问，真正用于技术判断的时间反而被压缩。' },
      { title: '信息不足就安排上门', text: '没有经过远程分流和范围确认，简单问题也可能直接变成差旅、等待和现场服务成本。' },
      { title: '工程师承担过多杂务', text: '进度沟通、资料整理、报价说明、图片归档、服务记录和汇报占用大量技术时间。' },
      { title: '客户、经验与材料依赖个人', text: '客户关系、判断过程、维修经验和常用物料信息留在个人微信与记忆里，人员变化就会影响服务连续性、采购效率和团队信誉。' },
    ],
    ownershipTitle: 'AI 接住流程，工程师负责判断。',
    ownershipIntro: 'AI 输出仅供参考，不构成最终诊断或现场操作依据。系统帮助减少重复劳动，但最终技术判断、高风险确认和现场责任仍由合适的人承担。',
    ownershipItems: [
      { label: 'AI 与系统负责', title: '收集、整理与辅助', text: '收集设备、报警、现象、历史和现场条件；提示缺失信息与风险；提供仅供参考的初步分析；提供工单、消息和服务记录的结构化整理支持。' },
      { label: '工程师负责', title: '判断、确认与执行', text: '完成最终技术判断、复杂问题的远程确认、高风险操作确认、现场服务，以及对最终结论和服务结果的确认。' },
      { label: 'SAGEMRO 负责', title: '协调、审核与记录', text: '运营团队负责派工协调、报价审核、付款确认和服务记录，并通过 Admin 与区域负责人维护服务范围和协作标准。' },
    ],
    workflowTitle: '从客户咨询到服务闭环',
    workflowIntro: '先在线分流，再决定是否需要工程师远程确认或现场服务。每一步都有上下文，减少工程师临时接手一堆散乱信息。',
    workflow: [
      { step: '01', title: '客户描述问题', text: '客户提交设备、报警、现象、图片、紧急程度和所在区域等已有信息。' },
      { step: '02', title: 'AI 补充关键信息', text: '系统结构化整理现场事实，追问缺失信息，并识别需要优先停机或人工确认的风险。' },
      { step: '03', title: '在线处理或升级人工', text: '适合在线处理的先提供参考建议；不确定、复杂或高风险问题进入工程师确认和服务流程。' },
      { step: '04', title: '工程师确认任务范围', text: '工程师查看设备、故障、历史、附件和 AI 整理结果，确认下一步、报价需求与是否上门。' },
      { step: '05', title: 'SAGEMRO 协调服务开始', text: 'Admin 和区域负责人协调派工、报价审核、客户确认、付款状态和开始服务授权。' },
      { step: '06', title: '结果记录与后续跟进', text: '系统提供结构化字段整理现场结果、材料需求和后续建议，由工程师填写或确认后进入统一服务记录。' },
    ],
    scaleTitle: '把个人经验，变成团队可以复用的服务能力。',
    scaleText: '优秀工程师仍然是服务核心，但客户沟通、判断依据和服务记录留在统一流程中，不能只存在于某个人的微信和记忆里。材料需求也可以随着案例持续沉淀。这样团队才能持续服务客户、复盘案例、培养新人，逐步改善材料协同，并建立稳定的品牌信誉。',
    scaleItems: [
      '减少对少数“技术好又会沟通”的全能工程师依赖',
      '让新成员接手时能看到已有判断和服务历史',
      '把报价、材料需求、现场结论和后续责任持续沉淀',
      '让服务质量来自工作流，而不只依赖个人关系',
    ],
    benefitsTitle: '合作能带来什么',
    benefitsIntro: 'SAGEMRO 不替代维修团队或工程师，而是帮助你把有限的技术时间放在更需要专业能力的地方。',
    benefitsItems: [
      { title: '减少重复追问', text: '接手前先看到客户描述、设备信息、报警、附件和已有服务记录。' },
      { title: '减少信息不足造成的非必要上门', text: '先通过结构化信息和远程确认判断是否真的需要现场服务。' },
      { title: '减少沟通与汇报负担', text: '系统提供统一的消息、任务上下文、服务结果、材料需求和后续事项记录结构。' },
      { title: '提高工程师有效工时', text: '把时间集中在技术确认、复杂排查、高风险事项和现场执行。' },
      { title: '形成团队服务资产', text: '客户上下文、判断过程和服务结果在统一流程中持续积累。' },
      { title: '改善成本与利润空间', text: '减少无效差旅和重复人工，让材料需求更集中、更容易复盘和协调。' },
    ],
    safetyTitle: '服务安全与责任边界',
    safetyText: 'AI 不能代替具备相应能力的工程师进行电气、激光、高压气体、液压、机械运动等高风险确认。涉及人身安全、设备安全或不确定操作时，应停止设备、隔离风险并由合适的人工确认。具体服务范围、现场责任和后续责任以确认后的工单、报价及合作约定为准。',
    joinTitle: '加入后的合作方式',
    joinIntro: '申请通过后，工程师或维修团队可根据服务区域、设备经验和可服务时间参与协作。每个任务都按照记录的范围、报价、付款状态和服务结果推进。',
    joinItems: [
      { title: '人工审核后开通', text: 'SAGEMRO 核实经验、区域覆盖和合作意愿后，才会开通工程师账号。' },
      { title: '按任务范围协作', text: '工程师接单前查看任务资料，确认能力、区域、时间、报价和服务方式是否匹配。' },
      { title: '统一协调与留痕', text: '报价审核、付款确认、消息、服务报告和后续事项都在流程中记录。' },
    ],
    lookForTitle: '我们寻找的工程师',
    lookForItems: [
      '激光和成型设备的实际维修经验',
      '能对高风险操作、现场条件和能力边界做诚实判断',
      '愿意使用结构化工单记录现场诊断、备件需求和后续建议',
      '诚实反馈可服务时间、出差范围和紧急支持能力',
    ],
    leadTitle: '区域负责人机会',
    leadText: '合作稳定后，资深工程师或服务团队负责人可能被邀请成为区域负责人，协调本地工程师、支持派工决策，并维护服务标准的一致性。',
    processTitle: '申请与开通流程',
    process: [
      { step: '01', title: '提交合作信息', text: '个人工程师填写服务区域、技能、现场经验和可服务时间；维修团队可在经验说明中介绍团队规模与能力。' },
      { step: '02', title: 'SAGEMRO 人工审核', text: '运营团队核实经验、区域覆盖、服务能力和合作意愿。' },
      { step: '03', title: '沟通合作边界', text: '双方确认服务范围、报价流程、付款确认、现场安全、记录要求和后续责任。' },
      { step: '04', title: '审核通过后激活', text: '确认合作后开通账号，并由 Admin 与区域负责人开始协调适合的服务任务。' },
    ],
    faqTitle: '常见问题',
    faqs: [
      { q: 'AI 会取代工程师吗？', a: '不会。AI 主要负责咨询分流、信息整理、初步分析和记录协助。最终技术判断、高风险确认、现场服务和最终结果仍由合适的工程师负责。' },
      { q: '所有客户咨询都会安排上门吗？', a: '不会。系统会先整理信息并进行初步分流。适合在线处理的先在线处理；不确定、复杂或高风险问题再由工程师确认是否需要上门。' },
      { q: 'AI 的初步分析可以作为最终诊断吗？', a: '不可以。AI 输出仅供参考，不能替代工程师对设备状态、现场安全和操作方案的确认。' },
      { q: '本地维修团队可以申请吗？', a: '可以。申请表以联系人为入口，请在现场服务经验中说明团队规模、成员能力、覆盖区域和希望采用的合作方式。' },
      { q: '提交申请会创建登录账号吗？', a: '不会。申请和账号开通是分开的。只有合作确认后才会开通账号。' },
      { q: '申请后会立即获得服务任务吗？', a: '不一定。通过审核的工程师或团队会在区域、设备经验、能力范围和可服务时间匹配时参与协作。' },
      { q: '只覆盖一个城市可以申请吗？', a: '可以。清晰的区域覆盖是有价值的。我们更看重可靠的服务能力而非大而模糊的覆盖范围。' },
      { q: '付款如何操作？', a: '客户付款通过 SAGEMRO 确认的付款指令协调。工程师跟进客户并在开始服务前请 Admin 确认。' },
    ],
    modalTitle: '申请加入服务网络',
    fields: {
      name: '姓名',
      phone: '手机 / 电话',
      email: '邮箱',
      whatsapp: 'WhatsApp / 微信',
      country: '国家',
      city: '常驻城市',
      regions: '可服务区域',
      skills: '擅长设备 / 技能',
      experience: '个人 / 团队服务能力',
    },
    placeholders: {
      name: '请输入姓名',
      phone: '便于运营团队联系',
      email: '可选',
      whatsapp: '可选',
      country: '中国 / 马来西亚 / 美国...',
      city: '例如：苏州',
      regions: '例如：江苏、浙江、上海',
      skills: '例如：激光器、切割头、总线报警、保养',
      experience: '请说明个人或团队规模、服务年限、熟悉品牌、典型案例和希望采用的合作方式',
    },
    checks: ['愿意跨城服务', '可周末服务', '可夜间紧急支持', '自备基础工具'],
    required: '必填',
    removeTag: '移除',
    closeForm: '关闭申请表',
    failure: '提交失败，请稍后重试。',
    regionSuggestions: ['华东', '华南', '华北', '华中', '西南', '东北', '江苏', '浙江', '山东'],
    skillSuggestions: ['激光切割机', '折弯机', '激光器', '切割头', '数控报警', '伺服驱动', '设备保养', '现场排查'],
    submit: '提交申请',
    submitting: '正在提交...',
    success: '申请已收到。SAGEMRO 运营团队会审核资料，并在匹配合适区域后联系你。',
    note: '提交申请不会创建登录账号。审核通过后，SAGEMRO 会发送账号激活链接。',
  },
  en: {
    badge: 'SAGEMRO Engineer Service Network',
    networkLabel: 'Engineer Service Network',
    title: 'Let engineers focus on equipment problems, not service admin.',
    subtitle: 'SAGEMRO AI helps triage inquiries, organize machine and fault details, support preliminary checks, and prepare service records. Engineers step in with clearer context, risk notes, and next actions instead of a trail of fragmented messages.',
    primary: 'Apply as a Service Partner',
    applyNow: 'Apply to the Service Network',
    howItWorks: 'See How We Work Together',
    signIn: 'I already have an engineer account',
    returnToCustomer: 'Back to customer service',
    customerHomeHref: 'https://sagemro.com',
    heroStats: [
      { value: 'AI triage first', label: 'organize the case before engineer involvement' },
      { value: 'Structured context', label: 'machine, symptoms, risks, and history' },
      { value: 'Recorded workflow', label: 'quotes, messages, outcomes, and follow-up' },
    ],
    audienceTitle: 'Local service teams and independent engineers',
    audienceText: 'Whether you run a local maintenance team or provide field service independently, SAGEMRO can serve as the shared entry point for inquiry triage, job preparation, service coordination, and record continuity.',
    problemTitle: 'The hidden cost in field service is fragmented engineer time.',
    problemIntro: 'Traditional service operations place inquiries, technical judgment, customer communication, dispatch, quoting, documentation, and reporting on a small number of engineers. The more capable the engineer, the more likely they become a bottleneck the team cannot reproduce.',
    problemItems: [
      { title: 'Fragmented inquiries interrupt technical work', text: 'Cases often arrive without machine models, alarms, site conditions, or service history. Engineers spend time repeatedly asking for context before they can think about the problem.' },
      { title: 'Incomplete information creates avoidable visits', text: 'Without remote triage and scope confirmation, a simple question can become travel, waiting, and unnecessary field-service cost.' },
      { title: 'Engineers carry too much service admin', text: 'Progress updates, document collection, quote explanations, image filing, service notes, and reports consume time that should go to technical work.' },
      { title: 'Customers, know-how, and material context depend on individuals', text: 'When customer context, diagnostic reasoning, and recurring material needs live in personal chat threads and memory, staff changes weaken continuity, purchasing efficiency, and trust.' },
    ],
    ownershipTitle: 'AI handles the workflow; engineers own the judgment.',
    ownershipIntro: 'AI output is preliminary and for reference only. It is not a final diagnosis or authorization for field action. The system reduces repetitive work, while qualified people retain technical judgment, high-risk confirmation, and field responsibility.',
    ownershipItems: [
      { label: 'AI and system', title: 'Collect, structure, and assist', text: 'Collect machine details, alarms, symptoms, history, and site conditions; identify missing context and risks; provide preliminary reference analysis; provide structured support for work orders, messages, and service records.' },
      { label: 'Engineer', title: 'Judge, confirm, and execute', text: 'Own final technical judgment, remote confirmation of complex cases, high-risk decisions, field service, and confirmation of the final findings and service outcome.' },
      { label: 'SAGEMRO operations', title: 'Coordinate, review, and record', text: 'Coordinate dispatch, review quotes, confirm payment and start authorization, keep service records, and maintain scope and service standards through Admin and Regional Leads.' },
    ],
    workflowTitle: 'A complete path from inquiry to service follow-up',
    workflowIntro: 'Triage online first, then decide whether engineer confirmation or field service is needed. Engineers receive context instead of inheriting an unstructured conversation.',
    workflow: [
      { step: '01', title: 'Customer describes the issue', text: 'The customer submits available machine details, alarms, symptoms, images, urgency, and location.' },
      { step: '02', title: 'AI fills the context gaps', text: 'The system structures the field facts, asks for missing information, and identifies risks that require shutdown or human confirmation.' },
      { step: '03', title: 'Resolve online or escalate to an engineer', text: 'Suitable cases receive preliminary online guidance. Uncertain, complex, or high-risk cases enter engineer confirmation and service coordination.' },
      { step: '04', title: 'Engineer confirms the scope', text: 'The engineer reviews the machine, fault, history, attachments, and AI-organized context before deciding next actions, quote needs, and whether a site visit is required.' },
      { step: '05', title: 'SAGEMRO authorizes service start', text: 'Admin and Regional Leads coordinate dispatch, quote review, customer confirmation, payment status, and service-start authorization.' },
      { step: '06', title: 'Record outcomes and follow-up', text: 'Structured fields capture field results, material needs, and next actions. The engineer completes or confirms the final record before it becomes part of service history.' },
    ],
    scaleTitle: 'Turn individual expertise into a service capability the team can reuse.',
    scaleText: 'Strong engineers remain at the center of service, but keep customer context, decision rationale, material needs, and service records in one workflow instead of personal chat threads and memory. Teams can then maintain continuity, review cases, develop new engineers, improve material coordination, and build a more reliable service reputation.',
    scaleItems: [
      'Reduce dependence on the few engineers who combine technical skill and customer communication',
      'Give the next engineer access to previous reasoning and service history',
      'Retain quotes, material needs, field findings, and follow-up responsibility',
      'Build service quality through a repeatable workflow, not only personal relationships',
    ],
    benefitsTitle: 'What the cooperation can improve',
    benefitsIntro: 'SAGEMRO does not replace the service team or engineer. It helps reserve limited technical time for work that truly requires expertise.',
    benefitsItems: [
      { title: 'Reduce repetitive questioning', text: 'Review customer descriptions, machine context, alarms, attachments, and available service history before taking over.' },
      { title: 'Reduce avoidable site visits caused by incomplete information', text: 'Use structured context and remote confirmation to decide whether field service is genuinely required.' },
      { title: 'Reduce communication and reporting load', text: 'The system provides one structure for messages, job context, service outcomes, material needs, and follow-up actions.' },
      { title: 'Increase useful engineer time', text: 'Concentrate effort on technical confirmation, complex troubleshooting, high-risk work, and field execution.' },
      { title: 'Create team service assets', text: 'Keep customer context, decision rationale, and service records in one workflow for future reuse.' },
      { title: 'Improve cost and margin control', text: 'Reduce avoidable travel and repeated labor while making recurring material needs easier to review and coordinate.' },
    ],
    safetyTitle: 'Service safety and responsibility boundaries',
    safetyText: 'AI cannot replace a qualified engineer for electrical, laser, high-pressure gas, hydraulic, mechanical-motion, or other high-risk confirmation. When personal safety, machine safety, or uncertain actions are involved, stop the machine, isolate the risk, and obtain suitable human confirmation. Specific scope, field responsibility, and follow-up responsibility are governed by the confirmed work order, quote, and cooperation terms.',
    joinTitle: 'How approved cooperation works',
    joinIntro: 'After review, engineers and service teams may participate when region, equipment experience, capability, and availability match. Each task follows a recorded scope, quote, payment status, and service outcome.',
    joinItems: [
      { title: 'Manual review before access', text: 'SAGEMRO reviews experience, service region, capability, and cooperation readiness before activating an account.' },
      { title: 'Cooperate within a confirmed scope', text: 'Review job context and confirm capability, region, timing, quote, and service mode before accepting work.' },
      { title: 'Coordinate and record the service', text: 'Quote review, payment confirmation, messages, service reports, and follow-up actions remain in the workflow.' },
    ],
    lookForTitle: 'What we look for',
    lookForItems: [
      'Real hands-on experience with laser and metal forming equipment',
      'Honest judgment about high-risk work, site conditions, and capability limits',
      'Willingness to document findings, material needs, and next actions in structured work orders',
      'Clear availability, travel range, and emergency-support capacity',
    ],
    leadTitle: 'Regional Lead opportunity',
    leadText: 'Experienced engineers or service-team leaders may be invited to support regional coordination after trust is established. Regional Leads may review local capacity, recommend engineers, support dispatch decisions, and maintain service standards.',
    processTitle: 'Application and activation',
    process: [
      { step: '01', title: 'Submit cooperation details', text: 'Independent engineers provide regions, skills, field experience, and availability. Service teams can describe team size and capability in the experience field.' },
      { step: '02', title: 'SAGEMRO performs a manual review', text: 'Operations reviews experience, regional coverage, service capability, and cooperation readiness.' },
      { step: '03', title: 'Confirm cooperation boundaries', text: 'Both sides confirm scope, quote workflow, payment confirmation, field safety, documentation requirements, and follow-up responsibility.' },
      { step: '04', title: 'Activate after approval', text: 'Approved engineers and service teams receive an account activation link, and Admin or Regional Leads begin coordinating suitable service work.' },
    ],
    faqTitle: 'Frequently asked questions',
    faqs: [
      { q: 'Will AI replace engineers?', a: 'No. AI supports inquiry triage, information structure, preliminary analysis, and record preparation. Final technical judgment, high-risk confirmation, field service, and final outcomes remain with qualified engineers.' },
      { q: 'Does every inquiry become a site visit?', a: 'No. The system first organizes the case and supports preliminary triage. Suitable cases stay online; uncertain, complex, or high-risk cases are escalated for engineer confirmation.' },
      { q: 'Is AI analysis a final diagnosis?', a: 'No. AI output is preliminary and for reference only. It cannot replace engineer confirmation of machine condition, field safety, or operating actions.' },
      { q: 'Can a local service team apply?', a: 'Yes. The application starts with one contact person. Describe the team size, member capabilities, service regions, and preferred cooperation model in the field-experience section.' },
      { q: 'Does applying create a login account?', a: 'No. Application and account access are separate. Accounts are opened only after SAGEMRO confirms cooperation.' },
      { q: 'Will I get service orders immediately?', a: 'Not necessarily. Approved engineers are considered when a request matches their region, equipment experience, and availability.' },
      { q: 'Who decides the service price?', a: 'The engineer submits a quote based on the job context. SAGEMRO reviews the quote before customer confirmation.' },
      { q: 'When does the engineer start work?', a: 'The engineer starts only after customer payment is confirmed or Admin approves the work order to start.' },
      { q: 'Can I apply if I only cover one city or state?', a: 'Yes. Clear local coverage is valuable. Reliable service capacity matters more than broad but uncertain coverage.' },
    ],
    modalTitle: 'Apply to the Service Network',
    fields: {
      name: 'Name',
      phone: 'Phone',
      email: 'Email',
      whatsapp: 'WhatsApp',
      country: 'Country',
      city: 'Base city',
      regions: 'Service regions',
      skills: 'Equipment / skills',
      experience: 'Individual / team capability',
    },
    placeholders: {
      name: 'Your full name',
      phone: 'Best number for operations follow-up',
      email: 'Optional',
      whatsapp: 'Optional',
      country: 'US / Mexico / Malaysia...',
      city: 'Chicago / Kuala Lumpur...',
      regions: 'Illinois, Indiana, Wisconsin...',
      skills: 'Laser source, cutting head, alarms, maintenance...',
      experience: 'Describe individual or team size, service years, familiar brands, typical cases, and preferred cooperation model',
    },
    checks: ['Can travel', 'Weekend support', 'Night emergency support', 'Own basic tools'],
    required: 'Required',
    removeTag: 'Remove',
    closeForm: 'Close application form',
    failure: 'Submission failed. Please try again.',
    regionSuggestions: ['North America', 'Europe', 'Southeast Asia', 'Middle East', 'Mexico', 'Malaysia', 'Illinois', 'Indiana', 'Wisconsin'],
    skillSuggestions: ['Laser cutting machine', 'Press brake', 'Laser source', 'Cutting head', 'CNC alarms', 'Servo drive', 'Maintenance', 'On-site troubleshooting'],
    submit: 'Submit Application',
    submitting: 'Submitting...',
    success: 'Application received. The SAGEMRO operations team will review your information and contact you when there is a suitable regional match.',
    note: 'Submitting an application does not create a login account. Approved engineers and service teams receive an account activation link from SAGEMRO after review.',
  },
};

function getLocale() {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.cn')) return 'cn';
  return 'en';
}

function splitTagList(value) {
  const source = Array.isArray(value) ? value.join(',') : String(value || '');
  const normalized = source.replace(/[\uFF0C\uFF1B;\s]+/g, ',');
  return normalized
    .split(/[,，\s\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function TagInput({ label, value, suggestions, placeholder, removeLabel, onChange }) {
  const [draft, setDraft] = useState('');
  const tags = Array.isArray(value) ? value : splitTagList(value);

  const addTags = (text) => {
    const next = splitTagList(text).filter((tag) => !tags.includes(tag));
    if (next.length) onChange([...tags, ...next]);
    setDraft('');
  };

  const removeTag = (tag) => onChange(tags.filter((item) => item !== tag));

  return (
    <div className="block text-[13px] font-semibold text-[#312317]">
      {label}
      <div className="mt-1.5 rounded-xl border border-[#eadfce] bg-[#fffdf8] px-3 py-2.5 transition focus-within:border-amber-500 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
              title={removeLabel}
            >
              {tag} x
            </button>
          ))}
          <input
            value={draft}
            onChange={(event) => {
              const next = event.target.value;
              if (/[,，\s]$/.test(next)) addTags(next);
              else setDraft(next);
            }}
            onKeyDown={(event) => {
              if (event.key === ',' || event.key === ' ') {
                event.preventDefault();
                addTags(draft);
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                addTags(draft);
              }
              if (event.key === 'Backspace' && !draft && tags.length) {
                removeTag(tags[tags.length - 1]);
              }
            }}
            onBlur={() => addTags(draft)}
            placeholder={tags.length ? '' : placeholder}
            className="min-w-[180px] flex-1 bg-transparent text-sm outline-none placeholder:text-[#8a8178]"
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((item) => {
          const selected = tags.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(selected ? tags.filter((tag) => tag !== item) : [...tags, item])}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                selected
                  ? 'border-amber-500 bg-amber-100 text-amber-900'
                  : 'border-[#eadfce] bg-white text-[#6b5a48] hover:border-amber-300'
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ApplicationForm({ copy, form, submitting, message, error, updateField, handleSubmit }) {
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {['name', 'phone', 'email', 'whatsapp', 'country', 'city'].map((field) => (
          <label key={field} className="block text-[13px] font-semibold text-[#312317]">
            <span className="flex items-center gap-1">
              {copy.fields[field]}
              {(field === 'name' || field === 'phone') && (
                <span className="text-xs font-medium text-amber-700">{copy.required}</span>
              )}
            </span>
            <input
              value={form[field]}
              onChange={(event) => updateField(field, event.target.value)}
              placeholder={copy.placeholders[field]}
              className="mt-1.5 w-full rounded-xl border border-[#eadfce] bg-[#fffdf8] px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]"
              required={field === 'name' || field === 'phone'}
            />
          </label>
        ))}
      </div>
      <TagInput
        label={copy.fields.regions}
        value={form.service_regions}
        suggestions={copy.regionSuggestions}
        placeholder={copy.placeholders.regions}
        removeLabel={copy.removeTag}
        onChange={(tags) => updateField('service_regions', tags)}
      />
      <TagInput
        label={copy.fields.skills}
        value={form.skill_tags}
        suggestions={copy.skillSuggestions}
        placeholder={copy.placeholders.skills}
        removeLabel={copy.removeTag}
        onChange={(tags) => updateField('skill_tags', tags)}
      />
      <label className="block text-[13px] font-semibold text-[#312317]">
        {copy.fields.experience}
        <textarea
          value={form.experience_summary}
          onChange={(event) => updateField('experience_summary', event.target.value)}
          placeholder={copy.placeholders.experience}
          rows={5}
          className="mt-1.5 w-full rounded-xl border border-[#eadfce] bg-[#fffdf8] px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ['can_travel', copy.checks[0]],
          ['can_weekend', copy.checks[1]],
          ['can_night', copy.checks[2]],
          ['has_tools', copy.checks[3]],
        ].map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 rounded-xl border border-[#eadfce] bg-[#fffdf8] px-3 py-2 text-sm text-[#5e4d3d] transition hover:border-amber-300 hover:bg-amber-50/50">
            <input
              type="checkbox"
              checked={form[field]}
              onChange={(event) => updateField(field, event.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>

      {(message || error) && (
        <div className={`rounded-xl px-3 py-2 text-sm ${message ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message || error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#21160c] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(33,22,12,0.22)] transition hover:bg-[#3b2612] disabled:opacity-60"
      >
        {submitting ? copy.submitting : copy.submit}
        {!submitting && <ArrowRight size={16} />}
      </button>
      <p className="flex gap-2 text-xs leading-5 text-[#7d6a56]">
        <CalendarCheck size={16} className="mt-0.5 shrink-0 text-amber-700" />
        <span>{copy.note}</span>
      </p>
    </form>
  );
}

export function EngineerRecruitingPage({ onOpenLogin }) {
  const locale = getLocale();
  const copy = COPY[locale];
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    whatsapp: '',
    country: '',
    city: '',
    service_regions: [],
    skill_tags: [],
    experience_summary: '',
    can_travel: false,
    can_weekend: false,
    can_night: false,
    has_tools: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await submitEngineerApplication({
        ...form,
        service_regions: splitTagList(form.service_regions),
        skill_tags: splitTagList(form.skill_tags),
      });
      setMessage(copy.success);
      setForm((prev) => ({
        ...prev,
        name: '',
        phone: '',
        email: '',
        whatsapp: '',
        country: '',
        city: '',
        service_regions: [],
        skill_tags: [],
        experience_summary: '',
      }));
    } catch (err) {
      setError(locale === 'cn' ? copy.failure : (err.message || copy.failure));
    } finally {
      setSubmitting(false);
    }
  };

  const openApply = () => {
    setMessage('');
    setError('');
    setModalOpen(true);
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#fbfaf7] text-[#17120b]">
      <div className="absolute inset-x-0 top-0 h-[520px] overflow-hidden bg-[#14100b]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,_rgba(245,158,11,0.28),_transparent_34%),radial-gradient(circle_at_80%_0%,_rgba(252,211,77,0.18),_transparent_32%),linear-gradient(135deg,_#14100b_0%,_#2b1b0d_58%,_#4a2a0e_100%)]" />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute -bottom-32 left-1/2 h-64 w-[92%] -translate-x-1/2 rounded-[100%] bg-[#fbfaf7]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark variant="logo" className="h-14 w-14 object-contain drop-shadow-[0_12px_24px_rgba(245,158,11,0.22)]" />
            <div>
              <div className="text-sm font-semibold text-white">SAGEMRO</div>
              <div className="text-xs text-white/70">{copy.networkLabel}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              href={copy.customerHomeHref}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={15} />
              {copy.returnToCustomer}
            </a>
            <button
              onClick={onOpenLogin}
              className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/15"
            >
              {copy.signIn}
            </button>
          </div>
        </header>

        <main className="py-10">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/92 p-6 shadow-[0_24px_80px_rgba(48,31,12,0.14)] backdrop-blur-xl lg:p-9">
            <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-bl-[5rem] bg-amber-100/70 blur-2xl" />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_360px] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
                  {copy.badge}
                </div>
                <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-[#17120b] md:text-[3.4rem]">
                  {copy.title}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-[#6a5844]">
                  {copy.subtitle}
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={openApply}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#21160c] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(33,22,12,0.22)] transition hover:bg-[#3b2612]"
                  >
                    {copy.applyNow}
                    <ArrowRight size={16} />
                  </button>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#eadfce] bg-white px-5 py-3 text-sm font-semibold text-[#3b2612] transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    {copy.howItWorks || copy.processTitle}
                  </a>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-[#efe6d8] bg-[#fffdf8] p-4">
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {copy.heroStats.map((item) => (
                    <div key={item.label} className="rounded-2xl bg-white p-3 shadow-sm">
                      <div className="text-lg font-semibold text-[#21160c]">{item.value}</div>
                      <div className="mt-1 text-xs leading-5 text-[#7d6a56]">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 border-y border-[#e7dccd] py-6">
            <div className="grid gap-4 lg:grid-cols-[300px_1fr] lg:items-center">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#24170b]">
                <UsersRound size={18} className="text-amber-700" />
                {copy.audienceTitle}
              </div>
              <p className="text-base leading-8 text-[#5f4d3b]">{copy.audienceText}</p>
            </div>
          </section>

          <section className="mt-10">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">01</div>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#21160c]">{copy.problemTitle}</h2>
              <p className="mt-4 text-base leading-8 text-[#6a5844]">{copy.problemIntro}</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {copy.problemItems.map((item, index) => {
                const Icon = [Clock3, MapPin, ClipboardCheck, UsersRound][index] || Wrench;
                return (
                  <div key={item.title} className="border-t border-[#d9c7ad] bg-white px-5 py-6 shadow-sm">
                    <Icon size={20} className="text-amber-700" />
                    <h3 className="mt-4 text-base font-semibold text-[#24170b]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#735f48]">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="how-it-works" className="mt-10 bg-[#1d160f] px-6 py-8 text-white lg:px-8">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">02</div>
              <h2 className="mt-2 text-3xl font-semibold leading-tight">{copy.ownershipTitle}</h2>
              <p className="mt-4 text-base leading-8 text-white/72">{copy.ownershipIntro}</p>
            </div>
            <div className="mt-7 grid gap-px overflow-hidden border border-white/10 bg-white/10 lg:grid-cols-3">
              {copy.ownershipItems.map((item) => (
                <div key={item.label} className="bg-[#1d160f] p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">{item.label}</div>
                  <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/68">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">03</div>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#21160c]">{copy.workflowTitle}</h2>
              <p className="mt-4 text-base leading-8 text-[#6a5844]">{copy.workflowIntro}</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {copy.workflow.map((item) => (
                <div key={item.step} className="border border-[#e8ddce] bg-white p-5 shadow-sm">
                  <div className="font-mono text-sm font-semibold text-amber-700">{item.step}</div>
                  <h3 className="mt-4 text-base font-semibold text-[#24170b]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#735f48]">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-[#eee2cf] p-6 lg:p-8">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                <UsersRound size={16} />
                04
              </div>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#21160c]">{copy.scaleTitle}</h2>
              <p className="mt-4 text-sm leading-7 text-[#5f4d3b]">{copy.scaleText}</p>
              <div className="mt-5 space-y-3">
                {copy.scaleItems.map((item) => (
                  <div key={item} className="flex gap-3 border-t border-[#d7c3a7] pt-3 text-sm leading-6 text-[#5f4d3b]">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-amber-800" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#e7dccd] bg-white p-6 lg:p-8">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">05</div>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#21160c]">{copy.benefitsTitle}</h2>
              <p className="mt-4 text-sm leading-7 text-[#6a5844]">{copy.benefitsIntro}</p>
              <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
                {copy.benefitsItems.map((item) => (
                  <div key={item.title} className="border-t border-[#e8ddce] pt-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#24170b]">
                      <BadgeCheck size={17} className="shrink-0 text-amber-700" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#735f48]">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 border-l-4 border-amber-600 bg-amber-50 px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#24170b]">
              <ShieldCheck size={18} className="text-amber-700" />
              {copy.safetyTitle}
            </div>
            <p className="mt-2 max-w-6xl text-sm leading-7 text-[#6a5844]">{copy.safetyText}</p>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="border border-[#e7dccd] bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">06</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.joinTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-[#6a5844]">{copy.joinIntro}</p>
              <div className="mt-5 grid gap-3">
                {copy.joinItems.map((item) => (
                  <div key={item.title} className="border-l-2 border-amber-300 bg-[#fffdf8] p-4">
                    <div className="text-sm font-semibold text-[#24170b]">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-[#735f48]">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-[#e8ddce] pt-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#24170b]">
                  <UsersRound size={18} className="text-amber-700" />
                  {copy.leadTitle}
                </div>
                <p className="mt-2 text-sm leading-7 text-[#735f48]">{copy.leadText}</p>
              </div>
            </div>

            <div className="border border-[#e7dccd] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                <MapPin size={15} />
                {copy.lookForTitle}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.lookForTitle}</h2>
              <div className="mt-5 space-y-3">
                {copy.lookForItems.map((item) => (
                  <div key={item} className="flex gap-3 border-t border-[#e8ddce] pt-3 text-sm leading-6 text-[#6a5844]">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-amber-700" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 border border-[#e7dccd] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              <ClipboardCheck size={15} />
              {copy.processTitle}
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.processTitle}</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {copy.process.map((item) => (
                <div key={item.step} className="border-t-2 border-amber-300 pt-4">
                  <div className="font-mono text-sm font-semibold text-amber-700">{item.step}</div>
                  <div className="mt-3 text-sm font-semibold text-[#24170b]">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-[#735f48]">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[2rem] border border-[#ece3d6] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{copy.faqTitle}</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.faqTitle}</h2>
              </div>
              <button
                onClick={openApply}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#21160c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3b2612]"
              >
                {copy.applyNow}
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {copy.faqs.map((item) => (
                <div key={item.q} className="rounded-2xl border border-[#efe6d8] bg-[#fffdf8] p-4">
                  <div className="text-sm font-semibold text-[#24170b]">{item.q}</div>
                  <p className="mt-2 text-sm leading-6 text-[#735f48]">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#120b05]/70 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92dvh] w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-[#eadfce] bg-white shadow-[0_28px_90px_rgba(18,11,5,0.34)]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#f0e6d7] bg-white/95 p-5 backdrop-blur">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-amber-700">{copy.primary}</div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.modalTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#eadfce] text-[#5e4d3d] transition hover:border-amber-300 hover:bg-amber-50"
                aria-label={copy.closeForm}
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(92dvh-96px)] overflow-y-auto p-5">
              <ApplicationForm
                copy={copy}
                form={form}
                submitting={submitting}
                message={message}
                error={error}
                updateField={updateField}
                handleSubmit={handleSubmit}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
