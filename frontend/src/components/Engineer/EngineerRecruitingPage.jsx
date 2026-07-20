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
    subtitle: 'SAGEMRO AI 先帮你处理客户咨询，把设备、故障、报警和现场情况问清楚、整理好。需要工程师介入时，拿到的是一份信息更完整、风险更清楚的任务，而不是一串零散消息。',
    primary: '申请成为服务合作伙伴',
    applyNow: '申请加入服务网络',
    howItWorks: '查看协作方式',
    signIn: '已有工程师账号，进入工作台',
    returnToCustomer: '返回客户服务首页',
    customerHomeHref: 'https://sagemro.cn',
    heroStats: [
      { value: 'AI 先分流', label: '先把情况问清，再决定是否需要工程师' },
      { value: '任务先理清', label: '设备、现象、风险和维修记录一目了然' },
      { value: '过程有记录', label: '报价、沟通、结果和后续都能查到' },
    ],
    audienceTitle: '本地维修团队与个人工程师',
    audienceText: '无论你带着一支本地维修团队，还是自己做现场服务，都可以用 SAGEMRO 先处理咨询、理清任务、协调服务，并把每次维修过程和结果留在系统里。',
    problemTitle: '维修团队最大的消耗，是工程师琐事缠身、时间碎片化所带来的人效降低。',
    problemIntro: '很多维修团队把接咨询、判断问题、回复客户、安排人员、做报价、整理记录和写汇报，全压在少数几个工程师身上。工程师越能干，越容易被各种事情反复打断，团队也越难复制他的能力。',
    problemItems: [
      { title: '零散咨询不停打断工作', text: '客户常常只发来一句话或一张照片，没有设备型号、报警、现场情况和维修记录。工程师只能反复追问，真正用来判断问题的时间反而越来越少。' },
      { title: '情况没问清就往现场跑', text: '没有先做远程沟通和范围确认，小问题也可能变成一次差旅、等待和上门成本。' },
      { title: '工程师被大量杂事拖住', text: '回复进度、找资料、解释报价、整理图片、补服务记录和写汇报，都在占用本该用于技术工作的时间。' },
      { title: '客户和经验都跟着个人走', text: '客户情况、判断过程、维修经验和常用物料都留在个人微信和记忆里。一旦人员变化，服务衔接、采购效率和客户信任都会受影响。' },
    ],
    ownershipTitle: 'AI 先把问题理清，工程师专心确认方案和落地执行。',
    ownershipIntro: 'AI 生成的内容仅供参考，不能作为最终诊断或现场操作依据。系统负责减少重复沟通和整理工作，最终方案、高风险操作确认和现场责任仍由具备相应能力的工程师承担。',
    ownershipItems: [
      { label: 'AI 与系统负责', title: '把情况问清、资料理顺', text: '收集设备、报警、现象、维修记录和现场条件；发现缺少的信息和潜在风险；给出仅供参考的初步分析；协助整理工单、沟通内容和服务记录。' },
      { label: '工程师负责', title: '确认方案、处理问题', text: '完成最终技术判断，远程确认复杂问题，确认高风险操作，执行现场服务，并对最终结论和服务结果负责。' },
      { label: 'SAGEMRO 负责', title: '协调派工、审核和留档', text: '运营团队负责派工协调、报价审核、付款确认和服务记录，并和区域负责人一起维护服务范围和合作标准。' },
    ],
    workflowTitle: '从客户咨询到服务闭环',
    workflowIntro: '先在线把情况问清，再决定是继续远程处理，还是安排工程师确认或上门。工程师接手时能直接看到前因后果，不用从一堆聊天记录里重新找线索。',
    workflow: [
      { step: '01', title: '客户说明现场问题', text: '客户提交已有的设备信息、报警、故障现象、图片、紧急程度和所在区域。' },
      { step: '02', title: 'AI 把缺的信息问清楚', text: '系统整理现场情况，继续追问缺失信息，并识别是否需要先停机或尽快由人工确认。' },
      { step: '03', title: '能在线处理的先在线处理', text: '适合远程处理的先提供参考建议；拿不准、较复杂或风险较高的问题，再转给工程师确认。' },
      { step: '04', title: '工程师确认怎么处理', text: '工程师查看设备、故障、维修记录、附件和 AI 整理结果，确认下一步、是否需要报价以及要不要上门。' },
      { step: '05', title: 'SAGEMRO 协调开始服务', text: '运营团队和区域负责人协调派工、审核报价、确认客户意见和付款状态，并确认何时开始服务。' },
      { step: '06', title: '留下结果，继续跟进', text: '工程师填写或确认现场结果、材料需求和后续建议，系统统一保存，方便后续查询和继续处理。' },
    ],
    scaleTitle: '把个人经验，变成团队可以复用的服务能力。',
    scaleText: '优秀工程师仍然是服务核心，但客户情况、判断过程和服务记录都留在系统里，不再只存在于某个人的微信和记忆中。用过哪些备件、后续还需要什么材料，也能跟着案例一起留下来。这样团队才能持续服务客户、复盘案例、带新人，逐步改善材料配合，并建立稳定的口碑。',
    scaleItems: [
      '不再过度依赖少数“技术好又会沟通”的全能工程师',
      '换人接手时，也能看到前面的判断和维修记录',
      '报价、材料需求、现场结论和后续责任都有记录',
      '服务质量靠一套稳定流程，而不只是靠个人关系',
    ],
    benefitsTitle: '让工程师少做杂事，让团队更有效率。',
    benefitsIntro: 'SAGEMRO 不替代维修团队和工程师，而是把重复沟通、资料整理和流程记录接过来，让有限的技术时间用在真正需要专业判断的地方。',
    benefitsItems: [
      { title: '少做重复追问', text: '接手前先看到客户描述、设备信息、报警、附件和以前的服务记录。' },
      { title: '沟通清楚再上门，少跑没必要去的现场。', text: '先在线把信息补全，再由工程师确认是否真的需要到现场。' },
      { title: '少花时间沟通和写汇报', text: '消息、任务背景、服务结果、材料需求和后续事项，都按统一方式记录。' },
      { title: '把工程师时间用在技术上', text: '把精力集中在方案确认、复杂排查、高风险工作和现场执行。' },
      { title: '形成团队服务的知识和技能资产', text: '客户情况、判断过程和服务结果都留在系统里，后面还能继续使用。' },
      { title: '降低服务成本，留出更多利润', text: '减少无效差旅和重复人工，也让常用材料需求更容易汇总、复盘和协调。' },
    ],
    safetyTitle: '服务安全与责任边界',
    safetyText: '电气、激光、高压气体、液压、机械运动等高风险问题，必须由具备相应能力的工程师确认，AI 不能替代。只要涉及人身安全、设备安全或拿不准的操作，应先停机并隔离风险，再由合适的人员确认。具体服务范围、现场责任和后续责任，以双方确认的工单、报价和合作约定为准。',
    joinTitle: '通过审核后，怎么开展合作',
    joinIntro: '审核通过后，工程师或维修团队会根据服务区域、设备经验和可服务时间参与合作。每个任务都会先明确范围、报价、付款状态和服务结果，再按流程推进。',
    joinItems: [
      { title: '先审核，再开通账号', text: 'SAGEMRO 会先核实维修经验、服务区域和合作意愿，确认合适后再开通工程师账号。' },
      { title: '任务合适再接', text: '接单前先看清任务资料，确认自己的能力、区域、时间、报价和服务方式是否匹配。' },
      { title: '每一步都能查到记录', text: '报价审核、付款确认、沟通消息、服务报告和后续事项都会保留在系统里。' },
    ],
    lookForTitle: '我们寻找的工程师',
    lookForItems: [
      '激光和成型设备的实际维修经验',
      '面对高风险操作和复杂现场，能如实判断自己是否具备处理能力',
      '愿意按工单要求记录现场判断、备件需求和后续建议',
      '如实说明可服务时间、出差范围和紧急支持能力',
    ],
    leadTitle: '区域负责人机会',
    leadText: '合作稳定后，资深工程师或维修团队负责人有机会成为区域负责人，协助协调当地工程师、判断派工是否合适，并维护统一的服务标准。',
    processTitle: '申请与开通流程',
    process: [
      { step: '01', title: '提交合作资料', text: '个人工程师填写服务区域、擅长设备、现场经验和可服务时间；维修团队可以补充团队规模和整体能力。' },
      { step: '02', title: 'SAGEMRO 人工审核', text: '运营团队核实维修经验、覆盖区域、服务能力和合作意愿。' },
      { step: '03', title: '把合作规则谈清楚', text: '双方确认服务范围、报价流程、付款确认、现场安全、记录要求和后续责任。' },
      { step: '04', title: '审核通过，开通账号', text: '确认合作后开通账号，再由运营团队和区域负责人协调合适的服务任务。' },
    ],
    faqTitle: '常见问题',
    faqs: [
      { q: 'AI 会取代工程师吗？', a: '不会。AI 主要帮助处理咨询、补充信息、做初步分析和整理记录。最终方案、高风险操作、现场服务和服务结果，仍由具备相应能力的工程师负责。' },
      { q: '客户一咨询，就一定要上门吗？', a: '不一定。系统会先把情况问清楚。能在线处理的先在线处理；拿不准、较复杂或风险较高的问题，再由工程师确认是否需要上门。' },
      { q: 'AI 的分析能当作最终诊断吗？', a: '不能。AI 生成的内容仅供参考，不能替代工程师对设备状态、现场安全和操作方案的确认。' },
      { q: '本地维修团队可以申请吗？', a: '可以。由一位联系人提交申请，并在服务能力说明中介绍团队规模、成员能力、覆盖区域和希望采用的合作方式。' },
      { q: '提交申请后会直接创建账号吗？', a: '不会。提交申请和开通账号是两回事，双方确认合作后才会开通账号。' },
      { q: '审核通过后会马上有任务吗？', a: '不一定。只有当服务区域、设备经验、能力范围和可服务时间都匹配时，才会协调相应任务。' },
      { q: '只服务一个城市也可以申请吗？', a: '可以。稳定、可靠的本地服务能力，比范围很大但不确定能否及时到场更有价值。' },
      { q: '服务价格由谁确定？', a: '工程师根据任务情况提交报价，SAGEMRO 审核后再交由客户确认。开始服务前，还需要确认客户付款，或由运营团队明确同意开工。' },
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
