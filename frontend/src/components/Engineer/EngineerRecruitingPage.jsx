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
  UsersRound,
  Wrench,
  X,
} from 'lucide-react';
import { submitEngineerApplication } from '../../services/api';
import { BrandMark } from '../common/BrandMark';
import { EngineerOverviewVideo } from './EngineerOverviewVideo';

const COPY = {
  cn: {
    badge: 'SAGEMRO 工程师服务协作网络',
    networkLabel: '工程师工作台',
    title: '设备维保最佳方案：AI知识飞轮+工程师技能实践',
    subtitle: 'AI 做前期沟通，形成详细工单需求，然后由工程师具体执行。减少重复沟通和无效上门，让技术服务更纯粹高效；平台知识结构化，AI 总结学习后更懂客户，形成正向的成长飞轮。',
    primary: '申请加入服务网络',
    applyNow: '申请加入',
    howItWorks: '查看合作方式',
    signIn: '工程师登录',
    returnToCustomer: '返回客户首页',
    customerHomeHref: 'https://sagemro.cn',
    overviewLabel: '20 秒了解协作模式',
    heroFlow: [
      { role: 'AI 系统', title: '咨询接待，任务整理', text: '收集设备信息、报警信息、故障现象、现场条件和维修记录，分析出缺少的信息和潜在风险。' },
      { role: '工程师', title: '确认方案，解决问题', text: '完成最终技术判断，提供报价，选择服务方式，分析风险，并执行远程处理或现场操作。' },
      { role: '运营管理', title: '协调流程，沉淀记录', text: '协调派工、报价审核、付款确认和服务跟进，统一保存沟通记录、工单资料、总结报告和后续事项。' },
    ],
    benefitsTitle: '一个越来越懂客户的AI，让技术服务更高效',
    benefitsIntro: 'AI 不替代工程师，而是把基础技术咨询、高频重复问答、工单资料整理和流程记录接过来，让工程师有限的时间用在真正需要他们专业判断的地方。',
    benefitsItems: [
      { label: '效率', title: '专注于技术服务', text: '客户的问题由 AI 先了解清楚并形成详细工单。工程师接手前就能看到设备信息、报警、现场状况和已有记录，更快确认方案和解决问题。' },
      { label: '成本', title: '减少反复沟通，避免无效上门', text: '避免反复就是最好的降本之道。持续进化的 AI 会越来越懂客户，帮助判断适合远程服务还是上门服务，以及需要什么配件和额外支持。' },
      { label: '技能', title: '知识技能持续进化，服务能力无限增长', text: '设备问题分析、材料需求、处理技巧和经验教训都留在系统里，并通过 AI 进行结构化整理，形成共享且持续进化的服务技能。' },
    ],
    audienceTitle: '合作信息一览',
    audienceItems: [
      { label: '适合谁', value: '激光及金属成型设备维保工程师' },
      { label: '如何加入', value: '提交资料 → 人工审核 → 确认规则 → 开通账号' },
      { label: '完整说明', value: '合作规则、责任边界和常见问题可按需展开查看' },
    ],
    problemTitle: '维修保养工作最大的消耗，是工程师琐事缠身、时间碎片化所带来的人效降低',
    problemIntro: '很多维修团队把接咨询、判断问题、回复客户、安排人员、做报价、整理记录和写汇报，全压在少数几个工程师身上。工程师越能干，越容易被各种事情反复打断，团队也越难复制他的能力。',
    problemItems: [
      { title: '零散咨询不停打断工作', text: '客户常常只发来一句话或一张照片，没有设备型号、报警、现场情况和维修记录。工程师被反复追问，真正用来做技术判断和解决问题的时间反而越来越少。' },
      { title: '沟通不到位就往现场跑', text: '没有先做远程沟通和工作范围确认，小问题也可能变成一次上门服务，产生不必要的人工成本和差旅费用。' },
      { title: '工程师被各种杂务缠身', text: '回复咨询、进度、找资料、解释报价、整理图片、补服务记录和写汇报，都在占用本该用于技术工作的时间。' },
      { title: '客户和经验都跟着个人走', text: '客户情况、判断过程、维修经验和常用物料都留在个人微信和记忆里。一旦人员变化，服务衔接、采购效率和客户信任都会受影响。' },
    ],
    workflowTitle: '从客户咨询到服务闭环',
    workflowIntro: '先在线把情况问清，再决定是继续远程处理，还是安排工程师确认或上门。工程师接手时能直接看到前因后果，不用从一堆聊天记录里重新找线索。',
    workflow: [
      { step: '01', title: 'AI 引导客户说明现场问题', text: '通过自然语言沟通，AI 会收集和整理客户的设备信息、报警、故障现象、图片、紧急程度和所在区域。' },
      { step: '02', title: 'AI 把缺失的信息问清楚', text: 'AI 会分析和整理现场情况，追问缺失信息，并识别安全边界，建议可远程操作，或者需要先停机或尽快由人工确认。' },
      { step: '03', title: '能在线处理的先在线处理', text: '在安全范围内，AI 会针对适合远程处理的问题直接提供参考建议；拿不准、较复杂或风险较高的问题，会自动建立工单，发送给 SAGEMRO 运营团队。' },
      { step: '04', title: 'SAGEMRO 运营协调开始服务', text: '运营团队按照设备信息、地区、紧急程度和工程师资源情况进行工单分配；有区域负责人的地区，会先分配给区域负责人再做二次协调。' },
      { step: '05', title: '工程师确认怎么处理', text: '工程师查看设备、故障、维修记录、附件和 AI 整理的参考信息，再与客户确认关键问题，判断物料、上门需求、费用并进行报价。' },
      { step: '06', title: 'SAGEMRO 运营进行工单确认', text: '运营团队和区域负责人协调派工、审核报价、确认客户意见和付款状态，并确认何时开始服务。' },
      { step: '07', title: '工程师完成任务，总结汇报', text: '工程师完成服务并提交总结，由客户查看、评论和确认结果；工程师同时提供材料需求和后续建议，异议由运营团队和区域负责人协助处理。' },
      { step: '08', title: 'AI 自动学习，增强系统知识和技能', text: 'AI 按隐私与安全规则收集和整理工单、沟通、附件和总结报告，形成结构化服务知识；客户私有设备信息也会被记录，便于后续沟通、跟进和提醒。' },
    ],
    scaleTitle: '把个人经验，变成团队可以复用的服务能力',
    scaleText: '优秀工程师仍然是服务核心，但客户情况、判断过程和服务记录都留在系统里，不再只存在于某个人的微信和记忆中。用过哪些备件、后续还需要什么材料，也能跟着案例一起留下来。这样团队才能持续服务客户、复盘案例、带新人，逐步改善材料配合，并建立稳定的口碑。',
    scaleAssetLine: '形成团队服务的知识和技能资产',
    scaleItems: [
      '不再过度依赖少数“技术好又会沟通”的全能工程师',
      '换人接手时，也能看到前面的判断和维修记录',
      '报价、材料需求、现场结论和后续责任都有记录',
      '服务质量靠一套稳定流程，而不只是靠个人关系',
    ],
    sharedTitle: '从单打独斗，到共享规模化能力',
    sharedIntro: '除了提高单次服务效率，SAGEMRO 还希望逐步连接供应链、市场推广和工程师培训资源，让个人工程师和本地维修团队也能获得过去只有较大服务组织才具备的支持能力。',
    sharedItems: [
      { title: '共享更有竞争力的供应链', text: '通过集中需求、合格供应商、品牌授权渠道、区域备货和统一质量要求，逐步提升备件与耗材的交付效率、质量稳定性和采购议价能力，减少小团队各自寻找货源、判断质量和承担库存风险的成本。' },
      { title: '共享品牌和市场获客能力', text: '当下不管是短视频、直播、搜索推广还是线下市场开发，成本都越来越高。SAGEMRO 借助 AI 的能力，统一建设品牌内容、推广渠道和客户入口，合作伙伴可以共享市场服务机会，减少获客成本，把更多精力放在本地交付和客户服务上。' },
      { title: '共享持续进阶的工程师培训', text: '培训不仅包括线上知识和案例学习，也将逐步增加线下实操、设备培训和服务规范训练，帮助工程师持续提升技术能力、安全意识和客户服务水平。' },
    ],
    standardTitle: '逐步建立可信的工程师能力标准',
    standardText: '随着培训、线下实操和服务验证不断积累，SAGEMRO 将逐步建立可以被客户识别和信任的工程师能力标准，形成清晰、可信的专业能力标签。',
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
      { q: 'AI 会取代工程师吗？', a: '不会。AI 主要帮助处理咨询、补充信息、做初步分析和整理记录，只会对工程师有帮助，不可能取代。复杂技术方案、高风险操作、必须的现场服务以及可靠的结果交付，必须由具备相应能力的工程师完成。' },
      { q: '客户一咨询，就一定要收费吗？', a: '不一定。系统会先把情况问清楚。简单的远程处理原则上可以免费服务，AI 会尽可能引导客户自行解决；如果客户需要人工服务，工程师可按具体情况评估是否收费。必须上门解决的服务，没有特殊情况应当收费。' },
      { q: 'AI 的分析能当作最终诊断吗？', a: '不能。AI 生成的内容仅供参考，不能替代工程师对设备状态、现场安全和操作方案的确认。我们的方向，是让 AI 在安全边界内提供更有参考价值的信息，由客户和工程师作出判断与选择。' },
      { q: '本地维修团队可以申请吗？', a: '可以。负责人和团队内工程师都可以提交申请，并设置团队归属。请在申请中介绍团队规模、服务能力、覆盖区域和期望的合作方式。' },
      { q: '提交申请后会直接创建账号吗？', a: '不会。提交申请和开通账号是两回事，双方确认合作后才会开通账号。' },
      { q: '审核通过后会马上有任务吗？', a: '不一定。只有当服务区域、设备经验、能力范围和可服务时间都匹配时，才会协调相应任务。' },
      { q: '只服务一个城市也可以申请吗？', a: '可以。稳定、可靠的本地服务能力，比范围很大但不确定能否及时到场更有价值。' },
      { q: '服务价格由谁确定？', a: '工程师根据任务情况提交报价，SAGEMRO 审核后再交由客户确认。开始服务前，还需要确认客户付款，或由运营团队明确同意开工。' },
    ],
    finalTitle: '让工程师把时间用在真正需要技术的地方',
    finalText: '提交你的服务区域、设备经验和可服务时间。SAGEMRO 会先进行人工审核，再与你确认合作范围和具体规则。',
    finalLogin: '登录',
    modalTitle: '申请加入',
    modalIntro: '请如实填写个人或团队的服务区域、设备经验和可服务时间。提交申请不会立即创建登录账号，审核通过并确认合作后再开通账号。',
    fields: {
      name: '姓名',
      phone: '手机 / 电话',
      email: '邮箱',
      whatsapp: 'WhatsApp / 微信',
      country: '国家',
      city: '常驻城市',
      regions: '可服务区域',
      skills: '擅长设备 / 服务技能',
      experience: '个人 / 团队服务能力说明',
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
      experience: '请说明个人或团队规模、服务年限、熟悉品牌、典型案例、可服务时间和希望采用的合作方式',
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
    success: '申请已收到。SAGEMRO 运营团队会审核资料，并在确认合作条件后与你联系。',
    note: '提交申请不会创建登录账号。审核通过后，SAGEMRO 会发送账号激活链接。',
  },
  en: {
    badge: 'SAGEMRO Engineer Service Network',
    networkLabel: 'Engineer Workspace',
    title: 'A better equipment service model: AI knowledge flywheel + engineer expertise',
    subtitle: 'AI handles the early conversation and prepares a detailed service request; engineers take over for technical execution. Less repeated communication and fewer avoidable visits make service work more focused and efficient, while structured knowledge helps the AI understand customers better over time.',
    primary: 'Apply to the Service Network',
    applyNow: 'Apply to Join',
    howItWorks: 'See How Cooperation Works',
    signIn: 'Engineer Login',
    returnToCustomer: 'Back to Customer Home',
    customerHomeHref: 'https://sagemro.com',
    overviewLabel: 'The model in 20 seconds',
    heroFlow: [
      { role: 'AI system', title: 'Intake and task preparation', text: 'Collect machine details, alarms, symptoms, site conditions, and service history, then identify missing information and potential risks.' },
      { role: 'Engineer', title: 'Confirm the plan and solve the problem', text: 'Make the final technical judgment, prepare the quote, choose the service approach, assess risk, and carry out remote or on-site work.' },
      { role: 'Operations management', title: 'Coordinate the workflow and retain records', text: 'Coordinate dispatch, quote review, payment confirmation, and follow-up while keeping messages, work-order files, reports, and next actions together.' },
    ],
    benefitsTitle: 'An AI that learns the customer makes technical service more efficient',
    benefitsIntro: 'AI does not replace engineers. It takes on basic technical inquiries, repeated questions, work-order preparation, and workflow records so limited engineer time stays focused on professional judgment.',
    benefitsItems: [
      { label: 'Efficiency', title: 'Stay focused on technical service', text: 'AI gathers the customer context and prepares a detailed work order. Engineers see machine details, alarms, site conditions, and prior records before they take over.' },
      { label: 'Cost', title: 'Reduce avoidable site visits caused by incomplete information', text: 'Less repetition is one of the clearest ways to control service cost. A learning AI helps distinguish remote work from field service and clarify parts or additional support before dispatch.' },
      { label: 'Capability', title: 'Let service knowledge keep improving', text: 'Problem analysis, material needs, service techniques, and lessons learned stay in the system, where AI can structure them into shared and continually improving service knowledge.' },
    ],
    audienceTitle: 'Cooperation at a glance',
    audienceItems: [
      { label: 'Who it is for', value: 'Local service teams and independent engineers for laser and metal forming equipment' },
      { label: 'How to join', value: 'Submit details → Manual review → Confirm terms → Activate account' },
      { label: 'Full details', value: 'Cooperation terms, responsibility boundaries, and FAQs are available below' },
    ],
    problemTitle: 'The hidden cost in field service is fragmented engineer time',
    problemIntro: 'Traditional service operations place inquiries, technical judgment, customer communication, dispatch, quoting, documentation, and reporting on a small number of engineers. The more capable the engineer, the more likely they become a bottleneck the team cannot reproduce.',
    problemItems: [
      { title: 'Fragmented inquiries interrupt technical work', text: 'Cases often arrive without machine models, alarms, site conditions, or service history. Engineers spend time repeatedly asking for context before they can think about the problem.' },
      { title: 'Incomplete information creates avoidable visits', text: 'Without remote triage and scope confirmation, a simple question can become travel, waiting, and unnecessary field-service cost.' },
      { title: 'Engineers carry too much service admin', text: 'Progress updates, document collection, quote explanations, image filing, service notes, and reports consume time that should go to technical work.' },
      { title: 'Customers, know-how, and material context depend on individuals', text: 'When customer context, diagnostic reasoning, and recurring material needs live in personal chat threads and memory, staff changes weaken continuity, purchasing efficiency, and trust.' },
    ],
    workflowTitle: 'A complete path from inquiry to service follow-up',
    workflowIntro: 'Triage online first, then decide whether engineer confirmation or field service is needed. Engineers receive context instead of inheriting an unstructured conversation.',
    workflow: [
      { step: '01', title: 'AI guides the customer through the issue', text: 'Natural-language intake gathers and organizes machine details, alarms, symptoms, images, urgency, and location.' },
      { step: '02', title: 'AI fills the context gaps', text: 'AI structures the case, asks for missing information, identifies safety boundaries, and flags when shutdown or prompt human confirmation is required.' },
      { step: '03', title: 'Resolve online or escalate to an engineer', text: 'Within safe boundaries, suitable cases receive reference guidance. Uncertain, complex, or high-risk cases become work orders for SAGEMRO operations.' },
      { step: '04', title: 'Operations coordinates the service', text: 'Operations matches the request by machine, region, urgency, and engineer capacity, with Regional Leads coordinating local assignment where available.' },
      { step: '05', title: 'Engineer confirms the service approach', text: 'The engineer reviews the machine, fault, history, attachments, and AI-organized context, then confirms materials, field-service needs, cost, and quote.' },
      { step: '06', title: 'Operations confirms the work order', text: 'Operations and Regional Leads coordinate dispatch, review the quote, confirm customer approval and payment status, and authorize the service start.' },
      { step: '07', title: 'Engineer completes and reports the work', text: 'The engineer completes the task and submits the service summary. The customer reviews the result, while materials, follow-up, and any dispute remain coordinated in the workflow.' },
      { step: '08', title: 'AI learns from structured service data', text: 'Subject to privacy and security rules, AI structures work-order details, messages, attachments, and reports into service knowledge while retaining customer-specific equipment context for future support.' },
    ],
    scaleTitle: 'Turn individual expertise into a service capability the team can reuse',
    scaleText: 'Strong engineers remain at the center of service. Keep customer context, decision rationale, and service records in one workflow instead of personal chat threads and memory. Teams can then maintain continuity, review cases, develop new engineers, improve material coordination, and build a more reliable service reputation.',
    scaleAssetLine: 'Build team-owned knowledge and skill assets',
    scaleItems: [
      'Reduce dependence on the few engineers who combine technical skill and customer communication',
      'Give the next engineer access to previous reasoning and service history',
      'Retain quotes, material needs, field findings, and follow-up responsibility',
      'Build service quality through a repeatable workflow, not only personal relationships',
    ],
    sharedTitle: 'From working alone to sharing the advantages of scale',
    sharedIntro: 'Beyond making each service task more efficient, SAGEMRO aims to connect supply-chain, marketing, and engineer-development resources so independent engineers and local teams can share capabilities once available mainly to larger service organizations.',
    sharedItems: [
      { title: 'Shared supply chain capability', text: 'Aggregated demand, qualified suppliers, authorized channels, regional stock, and common quality requirements can improve delivery, consistency, and purchasing leverage while reducing sourcing and inventory risk for smaller teams.' },
      { title: 'Shared brand and customer acquisition', text: 'Video, livestreaming, search advertising, and field marketing are increasingly expensive. SAGEMRO uses AI to build shared content, channels, and customer entry points so partners can reduce duplicated acquisition cost and focus on local delivery.' },
      { title: 'Progressive engineer training', text: 'Training will extend beyond online knowledge and case review to include hands-on practice, equipment training, and service standards that strengthen technical skill, safety awareness, and customer service.' },
    ],
    standardTitle: 'Building a trusted engineer capability standard over time',
    standardText: 'As training, hands-on practice, and verified service experience accumulate, SAGEMRO aims to build clear professional capability markers that customers can understand and trust.',
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
      { q: 'Does every inquiry require a fee?', a: 'No. The system first clarifies the case. Simple remote guidance may be free, while engineers assess charges when a customer requests human service. Field service is normally paid unless a specific exception applies.' },
      { q: 'Is AI analysis a final diagnosis?', a: 'No. AI output is preliminary and for reference only. It cannot replace engineer confirmation of machine condition, field safety, or operating actions.' },
      { q: 'Can a local service team apply?', a: 'Yes. The application starts with one contact person. Describe the team size, member capabilities, service regions, and preferred cooperation model in the field-experience section.' },
      { q: 'Does applying create a login account?', a: 'No. Application and account access are separate. Accounts are opened only after SAGEMRO confirms cooperation.' },
      { q: 'Will I get service orders immediately?', a: 'Not necessarily. Approved engineers are considered when a request matches their region, equipment experience, and availability.' },
      { q: 'Who decides the service price?', a: 'The engineer submits a quote based on the job context. SAGEMRO reviews the quote before customer confirmation.' },
      { q: 'When does the engineer start work?', a: 'The engineer starts only after customer payment is confirmed or Admin approves the work order to start.' },
      { q: 'Can I apply if I only cover one city or state?', a: 'Yes. Clear local coverage is valuable. Reliable service capacity matters more than broad but uncertain coverage.' },
    ],
    finalTitle: 'Put engineer time where technical skill is truly needed',
    finalText: 'Share your service region, equipment experience, and availability. SAGEMRO will review the application manually and confirm the cooperation scope and rules with you.',
    finalLogin: 'Login',
    modalTitle: 'Apply to Join',
    modalIntro: 'Describe your individual or team service regions, equipment experience, and availability accurately. Applying does not create an account; access is opened only after review and cooperation confirmation.',
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
      <div className="absolute inset-x-0 top-0 h-[31rem] bg-[#17110c]" />

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
          <section className="overflow-hidden rounded-lg border border-[#e6ded3] bg-white px-5 py-7 shadow-[0_18px_52px_rgba(35,24,14,0.12)] md:px-8 md:py-10 lg:px-10 lg:py-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)] lg:items-center lg:gap-10">
              <div>
                <div className="inline-flex border border-amber-300 bg-[#fffaf0] px-3 py-2 text-xs font-semibold uppercase text-amber-800">
                  {copy.badge}
                </div>
                <h1 className="mt-6 max-w-[46rem] text-[32px] font-semibold leading-[1.16] text-[#17110b] md:text-5xl md:leading-[1.12]">
                  {copy.title}
                </h1>
                <p className="mt-5 max-w-[44rem] text-[15px] leading-7 text-[#76695d] md:text-base md:leading-8">
                  {copy.subtitle}
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={openApply}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#21160c] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(33,22,12,0.22)] transition hover:bg-[#3b2612]"
                  >
                    {copy.applyNow}
                    <ArrowRight size={16} />
                  </button>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#eadfce] bg-white px-5 py-3 text-sm font-semibold text-[#3b2612] transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    {copy.howItWorks || copy.processTitle}
                  </a>
                </div>
              </div>
              <div className="border-t border-[#e6d8c7] pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <div className="grid gap-5">
                  {copy.heroFlow.map((item, index) => (
                    <div key={item.role} className="border-l-2 border-amber-500 pl-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase text-amber-800">{item.role}</div>
                        <div className="font-mono text-xs text-[#a68d70]">0{index + 1}</div>
                      </div>
                      <div className="mt-2 text-base font-semibold text-[#21160c]">{item.title}</div>
                      <div className="mt-1 text-xs leading-5 text-[#7d6a56]">{item.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8" aria-labelledby="engineer-overview-title">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px w-10 bg-amber-600" />
              <h2 id="engineer-overview-title" className="text-sm font-semibold text-[#3b2612]">
                {copy.overviewLabel}
              </h2>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#2f3d4f] bg-[#111722] shadow-[0_18px_50px_rgba(17,23,34,0.18)]">
              <EngineerOverviewVideo locale={locale} />
            </div>
          </section>

          <section id="how-it-works" className="mt-10">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase text-amber-700">01</div>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#21160c]">{copy.benefitsTitle}</h2>
              <p className="mt-4 text-base leading-8 text-[#6a5844]">{copy.benefitsIntro}</p>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {copy.benefitsItems.map((item) => (
                <div key={item.title} className="border-t-2 border-amber-500 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-amber-800">{item.label}</div>
                  <h3 className="mt-3 text-lg font-semibold text-[#24170b]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#735f48]">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 bg-[#17110c] px-6 py-6 text-white md:px-8">
            <h2 className="text-xs font-semibold uppercase text-amber-300">{copy.audienceTitle}</h2>
            <div className="mt-5 grid md:grid-cols-3">
              {copy.audienceItems.map((item, index) => (
                <div
                  key={item.label}
                  className={`border-t border-white/15 py-5 md:border-l md:border-t-0 md:px-6 md:py-1 ${index === 0 ? 'md:border-l-0 md:pl-0' : ''}`}
                >
                  <div className="text-xs font-semibold uppercase text-amber-400">{item.label}</div>
                  <p className="mt-2 text-sm leading-6 text-white/70">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-4">
            <details className="group border border-[#e7dccd] bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-5">
                  <div className="max-w-4xl">
                    <div className="text-xs font-semibold uppercase text-amber-700">02</div>
                    <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#21160c]">{copy.problemTitle}</h2>
                    <p className="mt-3 text-sm leading-7 text-[#6a5844]">{copy.problemIntro}</p>
                  </div>
                  <ArrowRight size={20} className="mt-2 shrink-0 text-amber-700 transition group-open:rotate-90" />
                </div>
              </summary>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {copy.problemItems.map((item, index) => {
                  const Icon = [Clock3, MapPin, ClipboardCheck, UsersRound][index] || Wrench;
                  return (
                    <div key={item.title} className="border-t border-[#d9c7ad] bg-[#fffdf8] px-5 py-6">
                      <Icon size={20} className="text-amber-700" />
                      <h3 className="mt-4 text-base font-semibold text-[#24170b]">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[#735f48]">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </details>

            <details className="group border border-[#e7dccd] bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-5">
                  <div className="max-w-4xl">
                    <div className="text-xs font-semibold uppercase text-amber-700">03</div>
                    <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#21160c]">{copy.workflowTitle}</h2>
                    <p className="mt-3 text-sm leading-7 text-[#6a5844]">{copy.workflowIntro}</p>
                  </div>
                  <ArrowRight size={20} className="mt-2 shrink-0 text-amber-700 transition group-open:rotate-90" />
                </div>
              </summary>
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {copy.workflow.map((item) => (
                  <div key={item.step} className="border border-[#e8ddce] bg-[#fffdf8] p-5">
                    <div className="font-mono text-sm font-semibold text-amber-700">{item.step}</div>
                    <h3 className="mt-4 text-base font-semibold text-[#24170b]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#735f48]">{item.text}</p>
                  </div>
                ))}
              </div>
            </details>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-[#eee2cf] p-6 lg:p-8">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-800">
                <UsersRound size={16} />
                04
              </div>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#21160c]">{copy.scaleTitle}</h2>
              <p className="mt-4 text-sm leading-7 text-[#5f4d3b]">{copy.scaleText}</p>
              <div className="mt-5 border-y border-[#d7c3a7] py-3 text-sm font-semibold text-[#4f3b27]">{copy.scaleAssetLine}</div>
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
              <div className="text-xs font-semibold uppercase text-amber-700">05</div>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#21160c]">{copy.sharedTitle}</h2>
              <p className="mt-4 text-sm leading-7 text-[#6a5844]">{copy.sharedIntro}</p>
              <div className="mt-5 grid gap-4">
                {copy.sharedItems.map((item) => (
                  <div key={item.title} className="border-t border-[#e8ddce] pt-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#24170b]">
                      <BadgeCheck size={17} className="shrink-0 text-amber-700" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#735f48]">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-l-2 border-amber-500 bg-amber-50 px-4 py-3">
                <div className="text-sm font-semibold text-[#24170b]">{copy.standardTitle}</div>
                <p className="mt-2 text-sm leading-6 text-[#735f48]">{copy.standardText}</p>
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="border border-[#e7dccd] bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase text-amber-700">06</div>
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
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-700">
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
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-700">
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

          <section className="mt-6 border border-[#ece3d6] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase text-amber-700">{copy.faqTitle}</div>
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
                <details key={item.q} className="border border-[#efe6d8] bg-[#fffdf8] p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-[#24170b]">{item.q}</summary>
                  <p className="mt-2 text-sm leading-6 text-[#735f48]">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-6 bg-[#21160c] px-6 py-8 text-white lg:flex lg:items-end lg:justify-between lg:gap-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold leading-tight">{copy.finalTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-white/70">{copy.finalText}</p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <button onClick={openApply} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-[#21160c] hover:bg-amber-400">
                {copy.applyNow}
                <ArrowRight size={16} />
              </button>
              <button onClick={onOpenLogin} className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                {copy.finalLogin}
              </button>
            </div>
          </section>
        </main>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#120b05]/70 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] border border-[#eadfce] bg-white shadow-[0_28px_90px_rgba(18,11,5,0.34)]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#f0e6d7] bg-white/95 p-5 backdrop-blur">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-amber-700">{copy.primary}</div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.modalTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#735f48]">{copy.modalIntro}</p>
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
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
