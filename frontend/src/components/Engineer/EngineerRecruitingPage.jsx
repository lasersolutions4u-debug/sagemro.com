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
    badge: 'SAGEMRO 工程师合作平台',
    networkLabel: '工业设备服务合作网络',
    title: '免费品牌与系统，工程师只专注技术',
    subtitle: '面向激光切割与金属成形设备行业：SAGEMRO 提供免费品牌授权、免费使用的工单/物料/客户管理系统，加上统一品牌宣传、供应链支持与视频、公众号、搜索引擎等多渠道推广；后台 AI 智能助理帮你管理工作、学习和答疑。第一年免加盟费。',
    primary: '提交合作意向',
    applyNow: '提交合作意向',
    signIn: '已合作工程师登录',
    returnToCustomer: '返回客户首页',
    customerHomeHref: 'https://sagemro.cn',
    navLinks: ['平台支持', '平台建设', '合作原则'],
    introVisualTitle: '品牌、系统、推广与 AI，一起给到工程师',
    introVisualRows: [
      ['免费品牌授权', 'BRAND'],
      ['免费管理系统', 'SYSTEM'],
      ['多渠道推广', 'MARKETING'],
      ['AI 工作助理', 'AI'],
    ],
    carouselKicker: '工程师最关心的三个问题',
    questionsLabel: '工程师关心的问题',
    questionSlides: [
      { id: 'Q1', question: '平台免费给我什么？', confirmation: '免费品牌授权、免费管理系统，第一年免加盟费' },
      { id: 'Q2', question: '收入怎么分配？', confirmation: '合作制平台，公平透明，多劳多得，收益空间不设上限' },
      { id: 'Q3', question: 'AI 在合作里做什么？', confirmation: '后台 AI 智能助理帮你管理工作、学习和答疑' },
    ],
    questionDetails: [
      {
        lead: '工单、物料、客户管理这些系统，SAGEMRO 已经交给第三方成熟产品承担，免费给合作工程师使用；你不需要自己搭平台，也不用额外买软件。',
        benefits: [['免费品牌授权', '以 SAGEMRO 品牌接单'], ['免费管理系统', '工单、物料、客户都现成'], ['第一年免加盟费', '加入门槛更低']],
        answerLabel: 'YOU BRING THE SKILL',
        answerTitle: '品牌、系统、推广和管理工具，都不用你操心',
        answerRows: [['免费品牌授权', '统一形象与信任背书，接单更省力。'], ['免费系统使用', '工单、物料、客户管理用成熟第三方系统。'], ['小程序与网站', '客户触达和资料沉淀由平台侧完成。']],
      },
      {
        lead: '合作制平台：客户来源、双方投入和实际交付逐笔记录，方案提前沟通，核算有据可查。',
        benefits: [['按单核算', '收入和成本都有依据'], ['贡献透明', '客户来源看得见'], ['长期合作', '具体方案单独沟通']],
        answerLabel: 'HOW YOU EARN',
        answerTitle: '多劳多得，贡献清晰，合作长期稳定',
        answerRows: [['现场工时服务', '体现工程师的直接技术价值'], ['配件与维修保养', '依据实际投入和成本核算'], ['设备与备件租赁', '结合资源与服务贡献核算']],
      },
      {
        lead: 'SAGEMRO 的 AI 只做一件事：给客户越来越靠谱、越来越专业的回复。由我们人工上传知识库内容与工单内容来喂养它，逐步形成 AI 智能体，替 SAGEMRO 品牌做对外宣传与专业答疑。',
        benefits: [['人工喂养', '知识库与工单内容由我们上传'], ['越用越专业', '回复质量持续提升'], ['品牌宣传', 'AI 智能体对外讲清 SAGEMRO 能力']],
        answerLabel: 'AI IN THIS PARTNERSHIP',
        answerStatus: '当前已有',
        answerTitle: 'AI 的目标只有一个：把专业回复做到越来越靠谱',
        answerRows: [['不做工单管理', '工单、评价、物料由第三方成熟系统承担。'], ['人工上传内容', '知识库与工单内容由我们维护，AI 从中学习。'], ['AI 工作助理', '帮你管理工作、学习和解答工作中的问题。']],
      },
    ],
    coreValueLabel: '核心价值',
    coreValueTitle: '把品牌、系统、推广和管理交给我们，你专注现场技术',
    platformSupportTitle: '平台直接给你',
    platformSupport: ['免费品牌授权', '免费管理系统', '小程序与网站', 'AI 工作助理'],
    platformSupportDetails: ['以 SAGEMRO 品牌对外承接服务，统一形象与信任背书', '工单、物料、客户管理使用成熟第三方系统，免费用', '客户触达与资料沉淀在平台侧完成', '后台 AI 智能助理帮你管理工作、学习和答疑'],
    engineerFocusTitle: '工程师专注',
    engineerFocus: ['故障诊断', '维修保养', '技术判断', '现场交付'],
    engineerFocusDetails: ['找到真正的问题', '完成专业服务', '制定可靠方案', '帮助客户恢复生产'],
    coreValueText: 'SAGEMRO 不再自建工单、评价与物料系统，改用第三方成熟产品免费提供给合作工程师；平台负责品牌、系统、推广与供应链，你专注诊断、维修、技术判断与现场交付。',
    payoffTitle: '工程师的核心价值，永远在现场解决问题',
    payoffText: '平台把品牌、系统、推广和管理接过去，让专业时间更值钱。',
    developmentTitle: '平台持续建设的四个方向',
    networkTitle: '品牌、推广、供应链与 AI，平台持续投入',
    developmentIntro: '平台把统一品牌宣传、多渠道推广、供应链管理和 AI 知识库运营持续做深，让合作工程师接单更容易、交付更有支撑。',
    developmentDirections: [
      { title: '统一品牌宣传', status: '持续开展' },
      { title: '视频、公众号与搜索引擎推广', status: '多渠道并行' },
      { title: '供应链与备件管理', status: '逐步建设' },
      { title: 'AI 知识库运营', status: '持续积累' },
    ],
    developmentDescriptions: ['统一对外形象、案例与专业内容输出。', '视频、公众号、搜索引擎等多渠道触达客户。', '聚合需求，提升采购效率与供应稳定性。', '人工上传知识库与工单内容，持续喂养 AI 智能体。'],
    flywheelTitle: '工程师越多，真实服务越多，AI 回复越专业，品牌越强',
    flywheelText: '真实服务沉淀为知识，知识让 AI 更专业，专业带来更多客户。',
    principlesTitle: '合作原则',
    cooperationPrinciples: [
      { title: '合作制平台', text: '不是雇佣关系，而是长期合作：客户来源、双方投入和实际收益清晰记录，合作方案提前沟通。' },
      { title: '公平透明，多劳多得', text: '每笔业务的客户来源、双方投入和实际交付都留痕，核算有据可查，收益空间不设上限。' },
      { title: '第一年免加盟费', text: '第一年不收取加盟费，先把服务与口碑做起来，后续合作方式由双方另行确认。' },
    ],
    finalCtaTitle: '加入 SAGEMRO 工程师网络',
    finalCtaText: '填写基本信息，运营团队审核后与你联系。',
    finalCtaAction: '提交合作意向',
    modalTitle: '提交工程师合作意向',
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
    note: '提交申请不会自动创建登录账号；审核通过后由运营团队联系你，并说明品牌授权与系统开通的后续步骤。',
    removeTag: '移除',
    closeApplication: '关闭申请表',
    regionSuggestions: ['华东', '华南', '华北', '长三角', '珠三角', '江苏', '浙江', '上海', '广东'],
    equipmentSuggestions: ['激光切割机', '折弯机', '激光器', '切割头'],
    skillSuggestions: ['数控报警排查', '伺服驱动维修', '设备保养', '现场排查'],
  },
  en: {
    badge: 'SAGEMRO Engineer Partner Platform',
    networkLabel: 'Industrial Service Partner Network',
    title: 'A free brand licence and free systems, so engineers focus on the work',
    subtitle: 'For laser cutting and metal forming equipment: SAGEMRO provides a free brand licence, free use of proven third-party work-order, material and customer systems, plus unified brand marketing, supply chain support and multi-channel promotion across video, official accounts and search. A back-office AI assistant helps you manage work, learn and answer on-the-job questions. No franchise fee in year one.',
    primary: 'Submit Cooperation Interest',
    applyNow: 'Submit Cooperation Interest',
    howItWorks: 'How It Works',
    signIn: 'Partner sign-in',
    returnToCustomer: 'Back to Customer Home',
    customerHomeHref: 'https://sagemro.com',
    navLinks: ['Platform support', 'Platform roadmap', 'Principles'],
    introVisualTitle: 'Brand, systems, promotion and AI for partner engineers',
    introVisualRows: [
      ['Free brand licence', 'BRAND'],
      ['Free systems', 'SYSTEM'],
      ['Multi-channel promotion', 'MARKETING'],
      ['AI work assistant', 'AI'],
    ],
    carouselKicker: 'Three questions engineers care about most',
    questionsLabel: 'Engineer questions',
    questionSlides: [
      { id: 'Q1', question: 'What does the platform give me for free?', confirmation: 'A free brand licence, free systems, and no franchise fee in year one' },
      { id: 'Q2', question: 'How is income shared?', confirmation: 'A cooperative platform: fair, transparent, more work means more return, with no fixed ceiling' },
      { id: 'Q3', question: 'What does AI do in this partnership?', confirmation: 'A back-office AI assistant helps you manage work, learn and answer questions' },
    ],
    questionDetails: [
      {
        lead: 'Work orders, materials and customer management are already covered by proven third-party products that SAGEMRO provides to partner engineers free of charge, so you do not have to build or buy your own systems.',
        benefits: [['Free brand licence', 'Serve customers under SAGEMRO'], ['Free systems', 'Work orders, materials, customers ready'], ['No year-one franchise fee', 'A lower barrier to join']],
        answerLabel: 'YOU BRING THE SKILL',
        answerTitle: 'Brand, systems, promotion and management tools without the overhead',
        answerRows: [['Free brand licence', 'A consistent identity and trust signal.'], ['Free systems in use', 'Work orders, materials and customers on proven third-party tools.'], ['Mini-program and website', 'Customer reach and records handled on the platform side.']],
      },
      {
        lead: 'A cooperative platform: customer source, contributions and actual delivery are recorded engagement by engagement, terms are agreed in advance, and the accounting is verifiable.',
        benefits: [['Per-engagement accounting', 'Revenue and cost have a basis'], ['Visible contribution', 'Customer source stays on record'], ['Long-term cooperation', 'Specific terms are discussed separately']],
        answerLabel: 'HOW YOU EARN',
        answerTitle: 'More work, more return, with clear records and long-term cooperation',
        answerRows: [['On-site labor', 'Reflects direct engineering value'], ['Parts and maintenance', 'Calculated from actual contribution and cost'], ['Equipment and spare rental', 'Based on resources and service contribution']],
      },
      {
        lead: 'SAGEMRO AI has exactly one goal: answers to customers that keep getting more reliable and more professional. We feed it by uploading knowledge-base and work-order content by hand, so it gradually becomes an AI agent that speaks for the SAGEMRO brand.',
        benefits: [['Fed by hand', 'We upload knowledge-base and work-order content'], ['Better over time', 'Answer quality keeps improving'], ['Brand promotion', 'The AI agent explains SAGEMRO capability']],
        answerLabel: 'AI IN THIS PARTNERSHIP',
        answerStatus: 'AVAILABLE NOW',
        answerTitle: 'One goal for AI: increasingly reliable professional answers',
        answerRows: [['No work-order management', 'Work orders, reviews and materials stay with proven third-party systems.'], ['Content uploaded by hand', 'We maintain the knowledge base and work-order content the AI learns from.'], ['AI work assistant', 'Helps you manage work, learn, and answer on-the-job questions.']],
      },
    ],
    coreValueLabel: 'Core value',
    coreValueTitle: 'Hand over brand, systems, promotion and management, and focus on the work on site',
    platformSupportTitle: 'Platform provides',
    platformSupport: ['Free brand licence', 'Free management systems', 'Mini-program and website', 'AI work assistant'],
    platformSupportDetails: ['Serve customers under the SAGEMRO brand with a consistent identity', 'Work orders, materials and customers on proven third-party systems, free to use', 'Customer reach and record capture handled on the platform side', 'A back-office AI assistant for work management, learning and questions'],
    engineerFocusTitle: 'Engineer focus',
    engineerFocus: ['Fault diagnosis', 'Maintenance and repair', 'Technical judgment', 'On-site delivery'],
    engineerFocusDetails: ['Find the real problem', 'Complete professional service', 'Develop a reliable solution', 'Help the customer restore production'],
    coreValueText: 'SAGEMRO no longer builds its own work-order, review or material systems; proven third-party products are provided to partner engineers free of charge. The platform handles brand, systems, promotion and supply chain, while you focus on diagnosis, repair, technical judgement and on-site delivery.',
    payoffTitle: 'An engineer\'s core value is always solving problems on site',
    payoffText: 'The platform takes on brand, systems, promotion and management so professional time is worth more.',
    developmentTitle: 'Four directions the platform keeps building',
    networkTitle: 'Brand, promotion, supply chain and AI: continuous platform investment',
    developmentIntro: 'The platform keeps deepening unified brand marketing, multi-channel promotion, supply-chain management and AI knowledge-base operations, so partner engineers win work more easily and deliver with more support.',
    developmentDirections: [
      { title: 'Unified brand marketing', status: 'Ongoing' },
      { title: 'Video, official account and search promotion', status: 'Multi-channel' },
      { title: 'Supply chain and spare parts', status: 'Building progressively' },
      { title: 'AI knowledge-base operations', status: 'Continuously developing' },
    ],
    developmentDescriptions: ['One consistent identity, case studies and professional content.', 'Reach customers through video, official accounts, search engines and more.', 'Aggregate demand to improve purchasing efficiency and supply stability.', 'Knowledge-base and work-order content uploaded by hand keeps feeding the AI agent.'],
    flywheelTitle: 'More engineers, more real service, more professional AI, stronger brand',
    flywheelText: 'Real service becomes knowledge; knowledge sharpens the AI; a sharper AI brings more customers.',
    principlesTitle: 'Cooperation principles',
    cooperationPrinciples: [
      { title: 'A cooperative platform', text: 'Not employment: a long-term partnership where customer source, contributions and returns are recorded clearly and terms are agreed in advance.' },
      { title: 'Fair, transparent, more work means more return', text: 'Every engagement keeps its customer source, contributions and delivery on record with verifiable accounting, and no ceiling on what you can earn.' },
      { title: 'No franchise fee in year one', text: 'No franchise fee for the first year: build the service and reputation first, then agree the next stage together.' },
    ],
    finalCtaTitle: 'Join the SAGEMRO Engineer Network',
    finalCtaText: 'Share your basic information and our operations team will contact you after review.',
    finalCtaAction: 'Submit Cooperation Interest',
    modalTitle: 'Submit Engineer Cooperation Interest',
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
    note: 'Submitting an application does not create a login account. After review, the operations team will contact you and explain the brand licence and system access steps.',
    equipmentSuggestions: ['Laser cutting machine', 'Press brake', 'Laser source', 'Cutting head'],
  },
};

export function buildEngineerRecruitingSeo(locale) {
  const isCn = locale === 'cn';
  const canonicalHost = isCn ? 'https://engineer.sagemro.cn' : 'https://engineer.sagemro.com';
  const title = isCn
    ? '工程师合作网络 | SAGEMRO'
    : 'Engineer Partner Network | SAGEMRO';
  const description = isCn
    ? '免费品牌授权、免费工单/物料/客户管理系统、统一品牌宣传与多渠道推广，还有后台 AI 智能助理；第一年免加盟费，SAGEMRO 与工程师合作共赢。'
    : 'A free SAGEMRO brand licence, free work-order, material and customer systems, unified brand marketing, multi-channel promotion and a back-office AI assistant. No franchise fee in year one.';

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
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-[#ef8244]">SAGEMRO ENGINEER PARTNER PROGRAM</div>
              <h1 className="mt-[22px] max-w-[690px] text-[40px] font-black leading-[1.17] tracking-[-0.05em] text-[#153e3c] sm:text-[55px]">{copy.title}</h1>
              <p className="mt-5 max-w-[690px] text-[15px] leading-[1.85] text-[#697a76]">{copy.subtitle}</p>
              <div className="mt-[30px] flex flex-wrap items-center gap-[22px]">
                <button type="button" onClick={openApply} className="bg-[#ef8244] px-5 py-[15px] text-xs font-black text-[#173b38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153e3c]">{copy.primary}</button>
                <a href="#focus" className="border-b border-[#8ba19c] pb-1 text-xs font-extrabold text-[#153e3c]">{copy.navLinks[0]} →</a>
              </div>
            </div>
            <aside className="relative m-0 flex min-h-[360px] flex-col justify-between bg-[#052e2f] p-7 text-white before:absolute before:left-0 before:top-0 before:h-[5px] before:w-[74px] before:bg-[#ef8244] lg:m-[42px_38px_42px_0] lg:p-[35px]">
              <div>
                <div className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#95d7c8]">SAGEMRO PARTNER PLATFORM</div>
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
              <div><div className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#ef8244]">BRAND, SYSTEMS, PROMOTION AND AI, PROVIDED</div><h2 className="mt-[18px] max-w-2xl text-[35px] font-black leading-[1.27] tracking-[-0.04em] sm:text-[43px]">{copy.coreValueTitle}</h2></div>
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
              <div><div className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#ef8244]">WHAT THE PLATFORM KEEPS BUILDING</div><h2 className="mt-[18px] text-[35px] font-black leading-[1.27] tracking-[-0.04em] sm:text-[43px]">{copy.networkTitle}</h2></div>
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
