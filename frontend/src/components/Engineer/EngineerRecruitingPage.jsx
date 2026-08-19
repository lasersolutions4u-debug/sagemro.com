/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  Wrench,
  X,
} from 'lucide-react';
import { submitEngineerApplication } from '../../services/api';
import { setSeoMetadata } from '../../utils/seo';

export const ENGINEER_RECRUITING_COPY = {
  cn: {
    badge: 'SAGEMRO 工程师合作网络',
    networkLabel: '工业设备服务网络',
    title: '让专业工程师价值最大化',
    subtitle: '面向激光切割机及金属成形设备行业，SAGEMRO 连接服务需求、工程师协作、供应链与 AI 知识能力，逐步建设覆盖全国的设备维修保养、升级改造等专业服务网络。',
    primary: '提交服务意向',
    applyNow: '提交服务意向',
    signIn: '工程师登录',
    returnToCustomer: '返回客户首页',
    customerHomeHref: 'https://sagemro.cn',
    navLinks: ['工程师合作', 'AI 与知识库', '合作原则'],
    introVisualTitle: '工业现场服务协作网络',
    introVisualRows: [
      ['服务机会', 'SERVICE'],
      ['工程师协作', 'ENGINEER'],
      ['供应链支持', 'SUPPLY'],
      ['AI 与知识', 'KNOWLEDGE'],
    ],
    carouselKicker: '工程师最关心的三个问题',
    questionsLabel: '工程师关心的问题',
    questionSlides: [
      { id: 'Q1', question: '我能接到什么单？', confirmation: '带着客户来，平台帮你把服务做完整' },
      { id: 'Q2', question: '收入怎么算？', confirmation: '工时价值优先，每笔业务清晰核算' },
      { id: 'Q3', question: 'AI 在合作中做什么？', confirmation: '派工前，先看 AI 整理的接单摘要' },
    ],
    questionDetails: [
      {
        lead: '希望获得更多订单，平台也会根据技术能力、服务区域和可用时间协调匹配服务机会。',
        benefits: [['已有客户', '接入平台协作'], ['平台订单', '按能力协调匹配'], ['共同开发', '贡献清晰记录']],
        answerLabel: 'YOU BRING THE SKILL',
        answerTitle: '你负责专业服务，平台连接订单协调、工具备件协作和服务记录',
        answerRows: [['客户来源清晰', '服务机会和双方投入都有记录。'], ['交付支持逐步完善', '连接订单、工具备件与服务报告。'], ['服务履历持续积累', '真实交付形成个人专业记录。']],
      },
      {
        lead: '工时服务、配件、维修保养和租赁等业务，结合客户来源、实际投入、成本与合作约定逐笔确认。',
        benefits: [['按单核算', '收入成本有依据'], ['贡献记录', '客户来源看得见'], ['合作确认', '具体方案单独沟通']],
        answerLabel: 'HOW YOU EARN',
        answerTitle: '专业交付创造收入，清晰记录支撑长期合作',
        answerRows: [['现场工时服务', '体现工程师的直接技术价值'], ['配件与维修保养', '依据实际投入和成本核算'], ['设备与备件租赁', '结合资源与服务贡献核算']],
      },
      {
        lead: '客户现象、设备信息、已有记录和 AI 初步整理集中呈现，减少反复沟通，让工程师更快进入有价值的现场服务。',
        benefits: [['信息更完整', '接单前了解背景'], ['风险提前看', '关注已有安全提示'], ['经验持续沉淀', '真实服务形成知识']],
        answerLabel: 'CURRENT CAPABILITY',
        answerStatus: '当前已有',
        answerTitle: 'AI 先整理接单信息，工程师带着更完整的上下文到现场',
        answerRows: [['客户现象与设备信息', '把已知问题和设备背景集中展示。'], ['AI 接单摘要', '整理重点信息并提示需要关注的风险。'], ['服务记录回流', '真实交付持续完善知识库与 AI。']],
      },
    ],
    coreValueLabel: '核心价值',
    coreValueTitle: '少处理琐事，多专注有价值的现场服务',
    platformSupportTitle: '平台协作',
    platformSupport: ['订单与沟通', '工具与配件', '记录与报告', '核算与结算'],
    platformSupportDetails: ['需求确认、进度协调', '准备与资源协作', '信息整理、报告生成', '业务记录、收益核算'],
    engineerFocusTitle: '工程师专注',
    engineerFocus: ['故障诊断', '维修保养', '技术判断', '现场交付'],
    engineerFocusDetails: ['找到真正的问题', '完成专业服务', '制定可靠方案', '帮助客户恢复生产'],
    coreValueText: '平台协助处理订单协调、信息整理、工具备件、服务报告和结算跟进。工程师把更多时间用在诊断、维修、技术判断和现场交付。',
    payoffTitle: '工程师的核心价值，在现场解决问题',
    payoffText: '平台连接协作环节，让专业时间产生更高价值。',
    developmentTitle: '共同建设的四个方向',
    networkTitle: '平台持续建设更大的服务网络',
    developmentIntro: '订单、区域服务、供应链、营销和知识能力相互连接，为工程师创造更多服务机会和更完整的交付支持。',
    developmentDirections: [
      { title: '全国共享客服中心', status: '逐步布局' },
      { title: '配件集采与供应链', status: '逐步建设' },
      { title: '新媒体营销与获客', status: '持续开展' },
      { title: 'AI 与知识库运营', status: '持续积累' },
    ],
    developmentDescriptions: ['连接区域工程师、工具备件与服务协作。', '聚合服务需求，提升采购效率与供应稳定性。', '统一开展内容、品牌与客户开发。', '整理服务记录，形成接单摘要与可复用知识。'],
    flywheelTitle: '工程师越多，真实服务越多，平台能力持续增强',
    flywheelText: '服务数据推动 AI，规模推动供应链与营销。',
    principlesTitle: '合作原则',
    cooperationPrinciples: [
      { title: '着眼长期服务和共同成长', text: '以长期合作为目标，让工程师、平台与客户在持续服务中共同受益。' },
      { title: '公平、诚信、透明', text: '客户来源、双方投入和业务收益清晰记录，合作方案提前沟通，核算有据可查。' },
      { title: '尊重数据价值', text: 'AI 时代，数据是核心价值。详实的服务记录和报告，既形成工程师的专业履历，也持续推动 AI 成长。' },
    ],
    finalCtaTitle: '加入 SAGEMRO 工程师网络',
    finalCtaText: '填写基本信息，运营团队审核后与你联系。',
    finalCtaAction: '提交合作意向',
    modalTitle: '提交工程师服务意向',
    fields: {
      name: '姓名',
      phone: '手机 / 电话',
      email: '邮箱',
      whatsapp: 'WhatsApp / 微信',
      country: '国家',
      city: '常驻城市',
      regions: '可服务区域',
      equipment: '熟悉设备',
      skills: '服务项目',
      experience: '现场服务经验',
    },
    placeholders: {
      name: '请输入姓名',
      phone: '便于运营团队联系',
      email: '请输入常用邮箱',
      whatsapp: '可选',
      country: '中国 / 马来西亚 / 美国...',
      city: '例如：苏州 / Chicago',
      regions: '例如：江苏、浙江、上海',
      equipment: '例如：激光切割机、折弯机、激光器',
      skills: '例如：数控报警排查、伺服驱动维修、设备保养',
      experience: '请简单说明服务年限、熟悉品牌、典型案例或希望加入的原因',
    },
    checks: ['愿意跨城服务', '可周末服务', '可夜间紧急支持', '自备基础工具'],
    required: '必填',
    submit: '提交申请',
    submitting: '正在提交...',
    success: '申请已收到。SAGEMRO 运营团队会审核资料，并在匹配合适区域后联系你。',
    failure: '提交失败，请稍后重试。',
    note: '提交申请不会自动创建登录账号。审核通过后，服务代表会收到 SAGEMRO 发出的账号激活链接。',
    removeTag: '移除',
    closeApplication: '关闭申请表',
    regionSuggestions: ['华东', '华南', '华北', '长三角', '珠三角', '江苏', '浙江', '上海', '广东'],
    equipmentSuggestions: ['激光切割机', '折弯机', '激光器', '切割头'],
    skillSuggestions: ['数控报警排查', '伺服驱动维修', '设备保养', '现场排查'],
  },
  en: {
    badge: 'SAGEMRO Engineer Partner Network',
    networkLabel: 'Industrial Service Network',
    title: 'Maximize the Value of Professional Engineers',
    subtitle: 'For the laser cutting and metal forming equipment industry, SAGEMRO connects service demand, engineer collaboration, supply chain support, and AI knowledge capabilities to develop a professional maintenance and upgrade service network.',
    primary: 'Submit Service Interest',
    applyNow: 'Submit Service Interest',
    howItWorks: 'How It Works',
    signIn: 'I already have an engineer account',
    returnToCustomer: 'Back to Customer Home',
    customerHomeHref: 'https://sagemro.com',
    navLinks: ['Engineer Partnership', 'AI & Knowledge', 'Principles'],
    introVisualTitle: 'Industrial field-service collaboration network',
    introVisualRows: [
      ['Service opportunities', 'SERVICE'],
      ['Engineer collaboration', 'ENGINEER'],
      ['Supply chain support', 'SUPPLY'],
      ['AI & knowledge', 'KNOWLEDGE'],
    ],
    carouselKicker: 'Three questions engineers care about most',
    questionsLabel: 'Engineer questions',
    questionSlides: [
      { id: 'Q1', question: 'What service work can I take?', confirmation: 'Bring the customer relationship; the platform helps complete the service workflow' },
      { id: 'Q2', question: 'How is income calculated?', confirmation: 'Field-service time comes first, with clear accounting for every engagement' },
      { id: 'Q3', question: 'What does AI do in the partnership?', confirmation: 'Review an AI-organized service brief before dispatch' },
    ],
    questionDetails: [
      {
        lead: 'Engineers seeking more work can also receive opportunities coordinated by technical capability, service region, and availability.',
        benefits: [['Existing customers', 'Connect them to platform collaboration'], ['Platform opportunities', 'Matched by capability'], ['Joint development', 'Contributions are recorded clearly']],
        answerLabel: 'YOU BRING THE SKILL',
        answerTitle: 'You deliver professional service; the platform connects order coordination, tools, parts, and service records',
        answerRows: [['Clear opportunity sources', 'Service opportunities and contributions are recorded.'], ['Improving delivery support', 'Connect orders, tools, parts, and reports.'], ['A growing service history', 'Real delivery builds your professional record.']],
      },
      {
        lead: 'Field-service time, parts, maintenance, and rental work are confirmed engagement by engagement against source, contribution, cost, and agreed terms.',
        benefits: [['Per-engagement accounting', 'Revenue and cost have a basis'], ['Contribution records', 'Opportunity sources stay visible'], ['Terms confirmed', 'Specific arrangements are discussed separately']],
        answerLabel: 'HOW YOU EARN',
        answerTitle: 'Professional delivery creates income; clear records support long-term cooperation',
        answerRows: [['On-site labor', 'Reflects direct engineering value'], ['Parts and maintenance', 'Calculated from actual contribution and cost'], ['Equipment and spare rental', 'Based on resources and service contribution']],
      },
      {
        lead: 'Customer symptoms, equipment information, existing records, and an initial AI summary are presented together, reducing repeated communication before valuable field work.',
        benefits: [['More complete context', 'Understand the background before accepting'], ['Risks visible earlier', 'Review available safety prompts'], ['Experience keeps compounding', 'Real service becomes reusable knowledge']],
        answerLabel: 'CURRENT CAPABILITY',
        answerStatus: 'AVAILABLE NOW',
        answerTitle: 'AI organizes dispatch information so engineers arrive with more complete context',
        answerRows: [['Customer symptoms and equipment', 'Known issues and equipment context in one place.'], ['AI dispatch summary', 'Organizes key facts and highlights known risks.'], ['Service records return', 'Real delivery keeps improving the knowledge base and AI.']],
      },
    ],
    coreValueLabel: 'Core value',
    coreValueTitle: 'Spend less time on administration and more on valuable field service',
    platformSupportTitle: 'Platform support',
    platformSupport: ['Orders and communication', 'Tools and parts', 'Records and reports', 'Accounting and settlement'],
    platformSupportDetails: ['Requirements and progress coordination', 'Preparation and resource collaboration', 'Information organization and reporting', 'Business records and income accounting'],
    engineerFocusTitle: 'Engineer focus',
    engineerFocus: ['Fault diagnosis', 'Maintenance and repair', 'Technical judgment', 'On-site delivery'],
    engineerFocusDetails: ['Find the real problem', 'Complete professional service', 'Develop a reliable solution', 'Help the customer restore production'],
    coreValueText: 'The platform helps with order coordination, information, tools and parts, service reports, and settlement follow-up. Engineers spend more time on diagnosis, repair, technical judgment, and field delivery.',
    payoffTitle: 'An engineer\'s core value is solving problems on site',
    payoffText: 'The platform connects the collaboration steps so professional time creates more value.',
    developmentTitle: 'Four development directions',
    networkTitle: 'The platform is building a larger service network',
    developmentIntro: 'Orders, regional service, supply chain, marketing, and knowledge capabilities work together to create more opportunities and stronger delivery support.',
    developmentDirections: [
      { title: 'National shared service center', status: 'Expanding progressively' },
      { title: 'Parts sourcing and supply chain', status: 'Building progressively' },
      { title: 'Digital marketing and customer acquisition', status: 'Ongoing' },
      { title: 'AI and knowledge-base operations', status: 'Continuously developing' },
    ],
    developmentDescriptions: ['Connect regional engineers, tools, parts, and service collaboration.', 'Aggregate service demand to improve purchasing efficiency and supply stability.', 'Coordinate content, brand building, and customer development.', 'Organize service records into dispatch summaries and reusable knowledge.'],
    flywheelTitle: 'More engineers create more real service and a stronger platform',
    flywheelText: 'Service data advances AI; scale strengthens supply chain and marketing.',
    principlesTitle: 'Cooperation principles',
    cooperationPrinciples: [
      { title: 'Long-term service and shared growth', text: 'We aim for sustained cooperation in which engineers, the platform, and customers benefit from ongoing service.' },
      { title: 'Fairness, integrity, and transparency', text: 'Customer sources, contributions, and business returns are recorded clearly, with cooperation terms discussed in advance.' },
      { title: 'Respect for data value', text: 'Detailed service records build an engineer\'s professional history while continuously improving AI-supported knowledge.' },
    ],
    finalCtaTitle: 'Join the SAGEMRO Engineer Network',
    finalCtaText: 'Share your basic information and our operations team will contact you after review.',
    finalCtaAction: 'Submit Cooperation Interest',
    modalTitle: 'Submit Engineer Service Interest',
    fields: {
      name: 'Name',
      phone: 'Phone',
      email: 'Email',
      whatsapp: 'WhatsApp',
      country: 'Country',
      city: 'Base city',
      regions: 'Service regions',
      equipment: 'Equipment specialties',
      skills: 'Service items',
      experience: 'Field service experience',
    },
    placeholders: {
      name: 'Your full name',
      phone: 'Best number for operations follow-up',
      email: 'Enter your primary email address',
      whatsapp: 'Optional',
      country: 'US / Mexico / Malaysia...',
      city: 'Chicago / Kuala Lumpur...',
      regions: 'Illinois, Indiana, Wisconsin...',
      equipment: 'Laser cutting machine, press brake, laser source...',
      skills: 'CNC alarm diagnosis, servo repair, maintenance...',
      experience: 'Briefly share your service years, familiar brands, typical cases, or why you want to join',
    },
    checks: ['Can travel', 'Weekend support', 'Night emergency support', 'Own basic tools'],
    required: 'Required',
    submit: 'Submit Application',
    submitting: 'Submitting...',
    success: 'Application received. The SAGEMRO operations team will review your information and contact you when there is a suitable regional match.',
    failure: 'Submission failed. Please try again.',
    note: 'Submitting an application does not create a login account. Approved representatives receive an account activation link from SAGEMRO after review.',
    equipmentSuggestions: ['Laser cutting machine', 'Press brake', 'Laser source', 'Cutting head'],
  },
};

export function buildEngineerRecruitingSeo(locale) {
  const isCn = locale === 'cn';
  const canonicalHost = isCn ? 'https://engineer.sagemro.cn' : 'https://engineer.sagemro.com';
  const title = isCn
    ? '认证服务代表网络 | SAGEMRO'
    : 'Industrial Service Engineer Network | SAGEMRO';
  const description = isCn
    ? '加入 SAGEMRO 工程师合作网络，为激光切割机、折弯机和金属成形设备提供清晰、可记录的现场服务协作。'
    : 'Join SAGEMRO\'s industrial service engineer network for laser cutting and metal forming equipment field service.';

  return {
    title,
    description,
    canonical: `${canonicalHost}/`,
    lang: isCn ? 'zh-CN' : 'en',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: isCn ? 'SAGEMRO 认证服务代表网络' : 'SAGEMRO Industrial Service Engineer Network',
      description,
      provider: {
        '@type': 'Organization',
        name: 'SAGEMRO',
        url: isCn ? 'https://sagemro.cn/' : 'https://sagemro.com/',
      },
      areaServed: isCn ? 'China' : 'Worldwide',
      url: canonicalHost,
    },
  };
}

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

const REGION_SUGGESTIONS = [
  'North America',
  'Europe',
  'Southeast Asia',
  'Middle East',
  'Mexico',
  'Malaysia',
  'Illinois',
  'Indiana',
  'Wisconsin',
];

const SKILL_SUGGESTIONS = [
  'Laser cutting machine',
  'Press brake',
  'Laser source',
  'Cutting head',
  'CNC alarms',
  'Servo drive',
  'Maintenance',
  'On-site troubleshooting',
];

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
    <div className="block text-[13px] font-semibold text-[#183b32]">
      {label}
      <div className="mt-1.5 border border-[#d8d1c3] bg-[#faf7ef] px-3 py-2.5 transition focus-within:border-[#d85f2d] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(216,95,45,0.12)]">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full border border-[#c7d5ce] bg-[#edf3ef] px-2.5 py-1 text-xs font-medium text-[#164d3f] transition hover:border-[#d85f2d] hover:text-[#a6421d]"
              title={removeLabel}
              aria-label={`${removeLabel}: ${tag}`}
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
            className="min-w-[180px] flex-1 bg-transparent text-sm text-[#17332c] outline-none placeholder:text-[#6b645b]"
            aria-label={label}
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
              aria-pressed={selected}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                selected
                  ? 'border-[#d85f2d] bg-[#fff0e8] text-[#9c3b17]'
                  : 'border-[#d8d1c3] bg-white text-[#5d625c] hover:border-[#7b9d91] hover:text-[#164d3f]'
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
          <label key={field} className="block text-[13px] font-semibold text-[#183b32]">
            <span className="flex items-center gap-1">
              {copy.fields[field]}
              {(field === 'name' || field === 'phone' || field === 'email') && (
                <span className="text-xs font-medium text-[#a6421d]">{copy.required}</span>
              )}
            </span>
            <input
              type={field === 'email' ? 'email' : 'text'}
              inputMode={field === 'phone' || field === 'whatsapp' ? 'tel' : undefined}
              autoComplete={{
                name: 'name',
                phone: 'tel',
                email: 'email',
                whatsapp: 'tel',
                country: 'country-name',
                city: 'address-level2',
              }[field]}
              value={form[field]}
              onChange={(event) => updateField(field, event.target.value)}
              placeholder={copy.placeholders[field]}
              className="mt-1.5 w-full border border-[#d8d1c3] bg-[#faf7ef] px-3 py-2.5 text-sm text-[#17332c] outline-none transition placeholder:text-[#6b645b] focus:border-[#d85f2d] focus:bg-white focus:shadow-[0_0_0_3px_rgba(216,95,45,0.12)]"
              required={field === 'name' || field === 'phone' || field === 'email'}
            />
          </label>
        ))}
      </div>
      <TagInput
        label={copy.fields.regions}
        value={form.service_regions}
        suggestions={copy.regionSuggestions || REGION_SUGGESTIONS}
        placeholder={copy.placeholders.regions}
        removeLabel={copy.removeTag || 'Remove'}
        onChange={(tags) => updateField('service_regions', tags)}
      />
      <TagInput
        label={copy.fields.equipment}
        value={form.equipment_types}
        suggestions={copy.equipmentSuggestions || SKILL_SUGGESTIONS}
        placeholder={copy.placeholders.equipment}
        removeLabel={copy.removeTag || 'Remove'}
        onChange={(tags) => updateField('equipment_types', tags)}
      />
      <TagInput
        label={copy.fields.skills}
        value={form.skill_tags}
        suggestions={copy.skillSuggestions || SKILL_SUGGESTIONS}
        placeholder={copy.placeholders.skills}
        removeLabel={copy.removeTag || 'Remove'}
        onChange={(tags) => updateField('skill_tags', tags)}
      />
      <label className="block text-[13px] font-semibold text-[#183b32]">
        {copy.fields.experience}
        <textarea
          value={form.experience_summary}
          onChange={(event) => updateField('experience_summary', event.target.value)}
          placeholder={copy.placeholders.experience}
          rows={5}
          className="mt-1.5 w-full border border-[#d8d1c3] bg-[#faf7ef] px-3 py-2.5 text-sm text-[#17332c] outline-none transition placeholder:text-[#6b645b] focus:border-[#d85f2d] focus:bg-white focus:shadow-[0_0_0_3px_rgba(216,95,45,0.12)]"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ['can_travel', copy.checks[0]],
          ['can_weekend', copy.checks[1]],
          ['can_night', copy.checks[2]],
          ['has_tools', copy.checks[3]],
        ].map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 border border-[#d8d1c3] bg-[#faf7ef] px-3 py-2 text-sm text-[#4f5e57] transition hover:border-[#7b9d91] hover:bg-[#edf3ef]">
            <input
              type="checkbox"
              checked={form[field]}
              onChange={(event) => updateField(field, event.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>

      {message && (
        <div role="status" aria-live="polite" className="border-l-4 border-[#2e765f] bg-[#edf7f2] px-3 py-2 text-sm text-[#1f604d]">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 bg-[#bd4c20] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#963916] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd4c20] disabled:opacity-60"
      >
        {submitting ? copy.submitting : copy.submit}
        {!submitting && <ArrowRight size={16} />}
      </button>
      <p className="flex gap-2 text-xs leading-5 text-[#68736d]">
        <CalendarCheck size={16} className="mt-0.5 shrink-0 text-[#d85f2d]" />
        <span>{copy.note}</span>
      </p>
    </form>
  );
}

export function EngineerRecruitingPage({ onOpenLogin }) {
  const locale = getLocale();
  const copy = ENGINEER_RECRUITING_COPY[locale];
  const { questionSlides } = copy;
  const [activeQuestion, setActiveQuestion] = useState(2);
  const selectedQuestion = questionSlides[activeQuestion];
  const selectedQuestionDetail = copy.questionDetails[activeQuestion];
  useEffect(() => {
    setSeoMetadata(buildEngineerRecruitingSeo(locale));
  }, [locale]);
  const [modalOpen, setModalOpen] = useState(false);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const applicationTriggerRef = useRef(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    whatsapp: '',
    country: '',
    city: '',
    service_regions: [],
    equipment_types: [],
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

  useEffect(() => {
    if (!modalOpen || typeof document === 'undefined') return undefined;

    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    if (!applicationTriggerRef.current) applicationTriggerRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleDialogKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setModalOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = [...dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      applicationTriggerRef.current?.focus?.();
      applicationTriggerRef.current = null;
    };
  }, [modalOpen]);

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
        equipment_types: splitTagList(form.equipment_types),
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
        equipment_types: [],
        skill_tags: [],
        experience_summary: '',
        can_travel: false,
        can_weekend: false,
        can_night: false,
        has_tools: false,
      }));
    } catch (err) {
      setError(copy.failure || err.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openApply = (event) => {
    if (typeof document !== 'undefined') {
      applicationTriggerRef.current = event?.currentTarget || document.activeElement;
    }
    setMessage('');
    setError('');
    setModalOpen(true);
  };

  return (
    <div className="min-h-[100dvh] bg-[#dfe5e1] px-1.5 py-1.5 text-[#153e3c] [font-family:'IBM_Plex_Sans','Noto_Sans_SC','Segoe_UI',sans-serif] sm:px-5 sm:py-5">
      <div className="mx-auto max-w-[1280px] overflow-hidden border border-[#cbd5d0] bg-[#fbfaf5] shadow-[0_30px_90px_rgba(20,58,52,0.16)]">
        <header className="flex h-[72px] items-center justify-between border-b border-[#dde1d9] px-5 sm:px-[42px]">
          <a href={copy.customerHomeHref} aria-label={copy.returnToCustomer} className="font-mono text-[15px] font-bold tracking-[0.19em]">SAGEMRO</a>
          <div className="flex items-center gap-4 sm:gap-7">
            <nav className="hidden items-center gap-7 lg:flex" aria-label={copy.networkLabel}>
              <a href="#focus" className="text-xs text-[#566d69] hover:text-[#153e3c]">{copy.navLinks[0]}</a>
              <a href="#network" className="text-xs text-[#566d69] hover:text-[#153e3c]">{copy.navLinks[1]}</a>
              <a href="#principles" className="text-xs text-[#566d69] hover:text-[#153e3c]">{copy.navLinks[2]}</a>
            </nav>
            <button type="button" onClick={onOpenLogin} className="hidden text-xs font-semibold text-[#566d69] hover:text-[#153e3c] sm:block">{copy.signIn}</button>
            <button type="button" onClick={openApply} className="bg-[#153e3c] px-4 py-3 text-xs font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ef8244]">{copy.applyNow}</button>
          </div>
        </header>

        <main>
          <section className="grid min-h-[470px] border-b-[12px] border-[#d7ded9] bg-[#fbfaf5] lg:grid-cols-[1.12fr_0.88fr]">
            <div className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:px-[70px] lg:py-[68px]">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-[#ef8244]">SAGEMRO INDUSTRIAL SERVICE NETWORK</div>
              <h1 className="mt-[22px] max-w-[690px] text-[40px] font-black leading-[1.17] tracking-[-0.05em] text-[#153e3c] sm:text-[55px]">{copy.title}</h1>
              <p className="mt-5 max-w-[690px] text-[15px] leading-[1.85] text-[#697a76]">{copy.subtitle}</p>
              <div className="mt-[30px] flex flex-wrap items-center gap-[22px]">
                <button type="button" onClick={openApply} className="bg-[#ef8244] px-5 py-[15px] text-xs font-black text-[#173b38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153e3c]">{copy.primary}</button>
                <a href="#focus" className="border-b border-[#8ba19c] pb-1 text-xs font-extrabold text-[#153e3c]">{copy.navLinks[0]} →</a>
              </div>
            </div>
            <aside className="relative m-0 flex min-h-[360px] flex-col justify-between bg-[#052e2f] p-7 text-white before:absolute before:left-0 before:top-0 before:h-[5px] before:w-[74px] before:bg-[#ef8244] lg:m-[42px_38px_42px_0] lg:p-[35px]">
              <div>
                <div className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#95d7c8]">SAGEMRO SERVICE OS</div>
                <h2 className="mt-[26px] max-w-xs text-[31px] font-black leading-[1.35] tracking-[-0.035em]">{copy.introVisualTitle}</h2>
              </div>
              <div className="border-t border-white/15">
                {copy.introVisualRows.map(([label, code]) => (
                  <div key={code} className="flex justify-between gap-5 border-b border-white/15 py-[13px]">
                    <b className="text-xs">{label}</b><span className="font-mono text-[9px] font-semibold tracking-[0.08em] text-[#8fc9bd]">{code}</span>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <div className="flex min-h-[66px] flex-col justify-center gap-2 border-b border-[#d4dbd6] bg-[#eef0e8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-[42px]">
            <span className="font-mono text-[9px] font-semibold tracking-[0.16em] text-[#ef8244]">ENGINEER QUESTIONS</span>
            <b className="text-[13px]">{copy.carouselKicker}</b>
          </div>

          <section className="relative min-h-[555px] overflow-hidden bg-[linear-gradient(128deg,#052e2f,#064b49)] text-white before:absolute before:inset-0 before:bg-[repeating-linear-gradient(0deg,transparent_0_51px,rgba(255,255,255,0.03)_51px_52px)]">
            <article className="relative z-10 grid min-h-[555px] lg:grid-cols-[58%_42%]">
              <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-[70px] lg:py-[62px]">
                <div className="text-sm font-black text-[#95d7c8]"><span className="mr-3 font-mono text-[#ef8244]">0{activeQuestion + 1}</span>{selectedQuestion.question}</div>
                <h2 className="mt-[23px] max-w-[680px] text-[38px] font-black leading-[1.18] tracking-[-0.048em] sm:text-[52px]">{selectedQuestion.confirmation}</h2>
                <p className="mt-5 max-w-[680px] text-base leading-[1.8] text-[#cfe1dd]">{selectedQuestionDetail.lead}</p>
                <div className="mt-[27px] flex flex-wrap gap-3">
                  {selectedQuestionDetail.benefits.map(([title, detail]) => (
                    <div key={title} className="min-w-[142px] border-t-2 border-[#8bcbbd] pt-[9px]">
                      <b className="block text-xs">{title}</b><span className="text-[10px] text-[#9dbab4]">{detail}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-[30px] flex items-center gap-5">
                  <button type="button" onClick={openApply} className="bg-[#ef8244] px-[21px] py-[14px] text-xs font-extrabold text-white">{copy.primary}</button>
                  <a href="#focus" className="text-xs text-[#c7dcd8]">{copy.navLinks[0]} →</a>
                </div>
              </div>
              <aside className="relative m-0 flex flex-col justify-center bg-[#f1ecdf] p-7 text-[#153e3c] before:absolute before:left-0 before:top-0 before:h-[5px] before:w-[70px] before:bg-[#ef8244] lg:m-[44px_38px_44px_10px] lg:p-[34px]">
                <div className="text-[10px] font-semibold tracking-[0.12em] text-[#887f70]">{selectedQuestionDetail.answerLabel}{selectedQuestionDetail.answerStatus && <span className="ml-2 inline-block bg-[#dce8e2] px-2 py-1 font-mono text-[8px] text-[#0b6965]">{selectedQuestionDetail.answerStatus}</span>}</div>
                <h3 className="my-[18px] text-[26px] font-black leading-[1.45]">{selectedQuestionDetail.answerTitle}</h3>
                {selectedQuestionDetail.answerRows.map(([title, detail], index) => (
                  <div key={title} className="flex gap-[14px] border-t border-[#d1cabd] py-[13px]">
                    <i className="font-mono text-[10px] font-semibold not-italic leading-7 text-[#ef8244]">0{index + 1}</i>
                    <div><b className="text-xs">{title}</b><p className="mt-1 text-[10px] leading-[1.55] text-[#69756f]">{detail}</p></div>
                  </div>
                ))}
              </aside>
            </article>
          </section>

          <section className="grid bg-[#052e2f] sm:grid-cols-3">
            {questionSlides.map((item, index) => {
              const isActive = activeQuestion === index;
              return (
                <button key={item.id} type="button" aria-pressed={isActive} onClick={() => setActiveQuestion(index)} className={`border-b border-r border-white/10 px-[26px] py-5 text-left text-white transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ef8244] ${isActive ? 'bg-[#0c5d59] shadow-[inset_0_4px_#ef8244]' : 'bg-[#063b3b] hover:bg-[#084746]'}`}>
                  <small className={`font-mono text-[10px] font-semibold tracking-[0.1em] ${isActive ? 'text-[#ffb27f]' : 'text-[#95d7c8]'}`}>{item.id} / QUESTION 0{index + 1}</small>
                  <b className="mt-2 block text-[13px]">{item.question}</b>
                  <span className="sr-only">{item.confirmation}</span>
                </button>
              );
            })}
          </section>
          <div className="h-3 bg-[#d7ded9]" />

          <section id="focus" className="bg-[#f1ecdf] px-6 py-14 sm:px-10 lg:px-[68px] lg:py-[72px]">
            <div className="grid items-end gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:gap-[55px]">
              <div><div className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#ef8244]">MORE TIME ON VALUABLE SERVICE</div><h2 className="mt-[18px] max-w-2xl text-[35px] font-black leading-[1.27] tracking-[-0.04em] sm:text-[43px]">{copy.coreValueTitle}</h2></div>
              <p className="m-0 text-[13px] leading-[1.8] text-[#697a76]">{copy.coreValueText}</p>
            </div>
            <div className="mt-[34px] grid border-y border-[#cfc8bb] lg:grid-cols-[1fr_72px_1fr]">
              <div className="py-7">
                <div className="mb-[19px] flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.1em] text-[#82796b]"><ClipboardCheck size={15} />{copy.platformSupportTitle}</div>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-x-[18px]">
                  {copy.platformSupport.map((item, index) => <div key={item} className="border-l-[3px] border-[#b6b1a6] pl-[11px]"><b className="block text-[13px]">{item}</b><span className="text-[10px] text-[#727c76]">{copy.platformSupportDetails[index]}</span></div>)}
                </div>
              </div>
              <div className="hidden place-items-center text-[#ef8244] lg:grid"><ArrowRight size={24} /></div>
              <div className="border-t border-[#cfc8bb] py-7 lg:border-t-0 lg:pl-[27px]">
                <div className="mb-[19px] flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.1em] text-[#ef8244]"><Wrench size={15} />{copy.engineerFocusTitle}</div>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-x-[18px]">
                  {copy.engineerFocus.map((item, index) => <div key={item} className="border-l-[3px] border-[#ef8244] pl-[11px]"><b className="block text-[13px]">{item}</b><span className="text-[10px] text-[#727c76]">{copy.engineerFocusDetails[index]}</span></div>)}
                </div>
              </div>
            </div>
            <div className="mt-[25px] flex flex-col gap-2 bg-[#052e2f] px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between"><strong className="text-[17px]">{copy.payoffTitle}</strong><span className="text-[11px] text-[#bdd1cd]">{copy.payoffText}</span></div>
          </section>

          <section id="network" className="bg-[#fbfaf5] px-6 py-14 sm:px-10 lg:px-[68px] lg:py-[72px]">
            <div className="grid items-end gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:gap-[55px]">
              <div><div className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#ef8244]">PLATFORM GROWTH DIRECTION</div><h2 className="mt-[18px] text-[35px] font-black leading-[1.27] tracking-[-0.04em] sm:text-[43px]">{copy.networkTitle}</h2></div>
              <p className="m-0 text-[13px] leading-[1.8] text-[#697a76]">{copy.developmentIntro}</p>
            </div>
            <div className="mt-[37px] grid border-l border-t border-[#cfd5cf] sm:grid-cols-2 lg:grid-cols-4">
              {copy.developmentDirections.map((item, index) => (
                <article key={item.title} className="min-h-[190px] border-b border-r border-[#cfd5cf] p-5">
                  <div className="flex items-start justify-between gap-3"><code className="font-mono text-xs text-[#ef8244]">0{index + 1}</code><em className="bg-[#dce7e1] px-2 py-1 text-[9px] not-italic text-[#0b6965]">{item.status}</em></div>
                  <h3 className="mt-[22px] text-[17px] font-black">{item.title}</h3><p className="mt-[9px] text-[11px] leading-[1.7] text-[#697a76]">{copy.developmentDescriptions[index]}</p>
                </article>
              ))}
            </div>
            <div className="mt-[21px] flex flex-col gap-2 bg-[#153e3c] px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between"><div><b className="text-[13px]">{copy.flywheelTitle}</b><br /><span className="text-[10px] text-[#bcd1cd]">{copy.flywheelText}</span></div><code className="font-mono text-[9px] text-[#95d7c8]">SERVICE → DATA → AI → MORE OPPORTUNITY</code></div>
          </section>

          <section id="principles" className="bg-[#f1ecdf] px-6 py-14 sm:px-10 lg:px-[68px] lg:py-[72px]">
            <div className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#ef8244]">COOPERATION PRINCIPLES</div>
            <h2 className="mt-[18px] text-[35px] font-black leading-[1.27] tracking-[-0.04em] sm:text-[43px]">{copy.principlesTitle}</h2>
            <div className="mt-[31px] grid border-l border-t border-[#ccc6ba] md:grid-cols-3">
              {copy.cooperationPrinciples.map((item, index) => (
                <article key={item.title} className="min-h-[190px] border-b border-r border-[#ccc6ba] p-6"><code className="font-mono text-[10px] text-[#ef8244]">0{index + 1}</code><h3 className="mt-[21px] text-xl font-black">{item.title}</h3><p className="mt-[11px] text-xs leading-[1.75] text-[#697a76]">{item.text}</p></article>
              ))}
            </div>
          </section>

          <section id="apply" className="bg-[#fbfaf5] px-6 py-14 sm:px-10 lg:px-[68px] lg:py-[58px]">
            <div className="flex min-h-[205px] flex-col items-start justify-center gap-8 bg-[#052e2f] px-7 py-10 text-white sm:flex-row sm:items-center sm:justify-between lg:px-[45px]">
              <div><div className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#95d7c8]">WORK WITH SAGEMRO</div><h2 className="mt-4 text-[34px] font-black tracking-[-0.04em] sm:text-[39px]">{copy.finalCtaTitle}</h2><p className="mt-2 text-[13px] text-[#c7dbd5]">{copy.finalCtaText}</p></div>
              <button type="button" onClick={openApply} className="inline-flex items-center gap-8 bg-[#ef8244] px-5 py-[17px] text-[13px] font-black text-[#173b38]">{copy.finalCtaAction}<ArrowRight size={17} /></button>
            </div>
          </section>
        </main>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#071b16]/80 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-5">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="engineer-application-title"
            className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden border border-[#8fa098] bg-white shadow-[0_32px_100px_rgba(4,18,14,0.48)]"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#c9d1cc] bg-[#0d2b24] p-5 text-white sm:p-6">
              <div className="border-l-2 border-[#d85f2d] pl-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f09a70]">{copy.primary}</div>
                <h2 id="engineer-application-title" className="mt-1 text-2xl font-black tracking-[-0.025em]">{copy.modalTitle}</h2>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                onClick={() => setModalOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-white/30 text-white transition hover:border-[#ef824e] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ef824e]"
                aria-label={copy.closeApplication || 'Close application form'}
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 sm:p-6">
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
