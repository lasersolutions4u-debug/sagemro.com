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
    badge: '客服工程师品牌共创平台',
    networkLabel: '客服工程师品牌共创平台',
    title: '客服工程师品牌共创，让技术价值充分体现',
    subtitle: '这是一个面向客服工程师的品牌共创平台：以合作制为基础，与合作工程师共担共享、合作共赢。技术在这里的价值，是更多服务机会、更高收入保障、更公平透明的分配体系，以及没有上限的成长空间。',
    primary: '申请加入品牌共创',
    applyNow: '申请加入品牌共创',
    signIn: '已合作工程师登录',
    returnToCustomer: '返回客户首页',
    customerHomeHref: 'https://sagemro.cn',
    navLinks: ['为什么选择这里', '我能获得什么', '合作方式'],
    introVisualTitle: '品牌、系统、渠道、供应链，平台都搭好了',
    introVisualRows: [
      ['品牌授权', 'BRAND'],
      ['管理系统', 'SYSTEM'],
      ['多渠道推广', 'MARKETING'],
      ['供应链支持', 'SUPPLY'],
    ],
    carouselKicker: '工程师最关心的三个问题',
    questionsLabel: '工程师关心的问题',
    questionSlides: [
      { id: 'Q1', question: '为什么选择这个平台？', confirmation: '品牌共创、合作制，机会、收入与分配都看得清楚' },
      { id: 'Q2', question: '我能获得什么？', confirmation: '更多服务机会、更高收入保障、公平透明的分配与成长空间' },
      { id: 'Q3', question: '客户为什么选择我？', confirmation: '你代表的是 SAGEMRO 品牌，客户看到的是平台背书加你的专业记录' },
    ],
    questionDetails: [
      {
        lead: '一个人接活，客户心里没底；只做平台上的一个工号，又攒不下自己的口碑。SAGEMRO 把品牌、系统、渠道和管理搭好，工程师带着技术上门服务，双方在同一个品牌下共创——这就是这个平台存在的理由。',
        benefits: [['品牌共创', '以 SAGEMRO 品牌对外承接服务'], ['合作制', '共担共享，合作共赢'], ['轻装上阵', '系统与后台由平台承担']],
        answerLabel: 'WHY THIS PLATFORM',
        answerTitle: '你出技术，平台出品牌、系统与渠道',
        answerRows: [['品牌', '统一的对外形象和信任背书，客户愿意先听你说。'], ['系统', '工单、物料、客户管理由平台提供，开箱即用。'], ['渠道', '小程序、官网与推广带来的咨询，由平台承接后交给你。']],
      },
      {
        lead: '技术的价值不该被埋没。在这里，它换来的是更多的服务机会、更有保障的收入、更公平透明的分配，以及一个不设上限的成长空间。',
        benefits: [['服务机会', '平台推广与客户渠道持续带来需求'], ['收入保障', '按单核算，收入与成本都有依据'], ['分配透明', '客户来源、投入与交付逐笔留痕']],
        answerLabel: 'WHAT YOU GET',
        answerTitle: '更多机会、更高保障、更公平的分配',
        answerRows: [['更多机会', '品牌宣传与多渠道推广持续带来客户。'], ['收入保障', '按单核算，投入与成本都有据可查。'], ['成长空间', '从技术交付到区域协作，成长不设上限。']],
      },
      {
        lead: '客户选的不只是一个人，而是一个敢负责的品牌。你以 SAGEMRO 的身份上门，背后是统一的形象、清楚的服务标准和可查的服务记录；做得越久，客户越认你，回头客和转介绍也越多。',
        benefits: [['品牌背书', '客户面对的是 SAGEMRO，而不是陌生个人'], ['服务留痕', '每次服务形成专业履历与口碑'], ['持续复购', '客户记住你，回头客和转介绍更多']],
        answerLabel: 'WHY CUSTOMERS PICK YOU',
        answerStatus: '当前已有',
        answerTitle: '客户认的是品牌，留下的是你的口碑',
        answerRows: [['品牌', '以 SAGEMRO 身份服务，客户更容易建立信任。'], ['记录', '服务过程留痕，逐步形成你的专业履历。'], ['口碑', '老客户复购与转介绍，是最稳的客户来源。']],
      },
    ],
    coreValueLabel: '我能获得什么',
    coreValueTitle: '琐碎的交给平台，值钱的留给你',
    platformSupportTitle: '平台提供',
    platformSupport: ['品牌授权', '管理系统', '小程序与网站', 'AI 工作助理'],
    platformSupportDetails: ['以 SAGEMRO 品牌承接服务，统一形象与信任背书', '工单、物料、客户管理由平台提供的成熟系统承担', '客户咨询与资料沉淀由平台承接', '后台 AI 助理帮你管理事务、学习技术、解答问题'],
    engineerFocusTitle: '工程师专注',
    engineerFocus: ['故障诊断', '维修保养', '技术判断', '现场交付'],
    engineerFocusDetails: ['找到真正的问题', '把服务做到位', '给出可靠方案', '帮客户恢复生产'],
    coreValueText: '工单、物料、客户管理由平台提供的成熟系统承担，你不必自己搭平台，也不用额外买软件。品牌、系统、渠道、供应链由平台负责，你专注诊断、维修、技术判断与现场交付——这才是客户真正愿意付钱的地方。',
    payoffTitle: '技术的价值，最终要在现场兑现',
    payoffText: '平台接走品牌、系统、推广与管理，让每一小时专业时间都花在值钱的地方。',
    developmentTitle: '平台还在为你做的四件事',
    networkTitle: '品牌、渠道、供应链与知识库，平台持续投入',
    developmentIntro: '统一品牌宣传、多渠道推广、供应链管理与服务知识库建设，平台一件件做深，让合作工程师更容易被客户找到、交付更有底气。',
    developmentDirections: [
      { title: '统一品牌宣传', status: '持续推进' },
      { title: '视频、公众号与搜索引擎推广', status: '多渠道并行' },
      { title: '供应链与备件管理', status: '逐步建设' },
      { title: '服务知识库建设', status: '持续积累' },
    ],
    developmentDescriptions: ['统一的对外形象、案例与专业内容输出，让客户先认识 SAGEMRO。', '视频、公众号、搜索引擎一起发力，让需要服务的客户找得到你。', '聚合需求、集中采购，缩短备件等待时间。', '把服务记录整理成可复用的经验，让新人少走弯路。'],
    flywheelTitle: '工程师越多，真实服务越多，品牌越硬，客户越多',
    flywheelText: '服务沉淀成口碑，口碑带来更多客户，更多客户带来更多服务机会。',
    principlesTitle: '我们怎么合作',
    cooperationPrinciples: [
      { title: '一起做，不是打工', text: '合作制而非雇佣制：品牌共创、共担共享，客户来源、双方投入与实际收益逐笔记录。' },
      { title: '账目透明，多劳多得', text: '每笔业务的来源、投入与交付都留痕，核算有据可查；收益空间不设上限，干得多就拿得多。' },
      { title: '第一年免加盟费', text: '第一年不收加盟费，先把服务和口碑做起来，之后的合作方式双方另行确认。' },
    ],
    finalCtaTitle: '一起把 SAGEMRO 的服务品牌做起来',
    finalCtaText: '留下基本信息，运营团队会尽快与你沟通合作细节。',
    finalCtaAction: '申请加入品牌共创',
    modalTitle: '申请加入品牌共创计划',
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
    badge: 'SAGEMRO Service Engineer Brand Program',
    networkLabel: 'Service Engineer Brand Program',
    title: 'Co-create the service brand. Earn what your skill is worth.',
    subtitle: 'SAGEMRO is a brand co-creation platform for customer service engineers, built on a cooperative model where both sides share the work and the upside. Here your technical skill turns into more service opportunities, steadier income, a fairer and more transparent split, and room to grow without a ceiling.',
    primary: 'Apply to Co-create',
    applyNow: 'Apply to Co-create',
    howItWorks: 'How It Works',
    signIn: 'Partner sign-in',
    returnToCustomer: 'Back to Customer Home',
    customerHomeHref: 'https://sagemro.com',
    navLinks: ['Why this platform', 'What you get', 'How we work together'],
    introVisualTitle: 'Brand, systems, channels and supply chain, all set up for you',
    introVisualRows: [
      ['Brand licence', 'BRAND'],
      ['Systems', 'SYSTEM'],
      ['Multi-channel promotion', 'MARKETING'],
      ['Supply chain', 'SUPPLY'],
    ],
    carouselKicker: 'The three questions engineers ask most',
    questionsLabel: 'Engineer questions',
    questionSlides: [
      { id: 'Q1', question: 'Why this platform?', confirmation: 'A co-created brand on a cooperative model, with clearer opportunity, income and splits' },
      { id: 'Q2', question: 'What do I get?', confirmation: 'More service opportunities, steadier income, a transparent split and room to grow' },
      { id: 'Q3', question: 'Why would customers choose me?', confirmation: 'You show up as SAGEMRO, backed by a known brand and your own service record' },
    ],
    questionDetails: [
      {
        lead: 'Working alone, customers hesitate. Working as an anonymous ID on someone else\'s platform, you build no reputation of your own. SAGEMRO sets up the brand, the systems, the channels and the back office; you bring the technical service, and both sides build one brand together. That is what this platform is for.',
        benefits: [['Shared brand', 'Serve customers under the SAGEMRO name'], ['Cooperative model', 'Shared work, shared upside'], ['No overhead', 'Systems and back office carried by the platform']],
        answerLabel: 'WHY THIS PLATFORM',
        answerTitle: 'You bring the engineering. We bring the brand, the systems and the channels.',
        answerRows: [['Brand', 'A recognised identity and trust signal that gets you heard.'], ['Systems', 'Work orders, materials and customers provided by the platform, ready to use.'], ['Channels', 'Enquiries from the website and our promotion come through the platform and are routed to you.']],
      },
      {
        lead: 'Technical skill should not stay invisible. Here it converts into more service opportunities, steadier income, a fairer and more transparent split, and growth with no ceiling.',
        benefits: [['Opportunity', 'Platform promotion and channels keep bringing demand'], ['Income you can plan on', 'Per-engagement accounting for both revenue and cost'], ['Transparent split', 'Customer source, contribution and delivery on record']],
        answerLabel: 'WHAT YOU GET',
        answerTitle: 'More opportunity, steadier income, a fairer split',
        answerRows: [['More opportunity', 'Brand marketing and multi-channel promotion keep bringing customers.'], ['Steadier income', 'Per-engagement accounting with contribution and cost on record.'], ['Room to grow', 'From hands-on delivery to regional collaboration, with no ceiling.']],
      },
      {
        lead: 'Customers are not only choosing a person; they are choosing a brand willing to stand behind the work. You arrive as SAGEMRO, backed by a consistent identity, clear service standards and a service record that can be checked. The longer you serve, the more customers ask for you by name.',
        benefits: [['Brand behind you', 'Customers deal with SAGEMRO, not a stranger'], ['Service on record', 'Every job builds your professional track record'], ['Repeat business', 'Customers remember you and refer you on']],
        answerLabel: 'WHY CUSTOMERS PICK YOU',
        answerStatus: 'AVAILABLE NOW',
        answerTitle: 'Customers trust the brand; what stays with them is your reputation',
        answerRows: [['Brand', 'Serving as SAGEMRO makes trust easier to establish.'], ['Track record', 'Logged service builds your professional history step by step.'], ['Word of mouth', 'Repeat and referred work is the steadiest customer source there is.']],
      },
    ],
    coreValueLabel: 'What you get',
    coreValueTitle: 'Hand over the overhead. Keep the work that pays.',
    platformSupportTitle: 'Provided by the platform',
    platformSupport: ['Brand licence', 'Management systems', 'Mini-program and website', 'AI work assistant'],
    platformSupportDetails: ['Serve under the SAGEMRO brand with a consistent identity and trust signal', 'Work orders, materials and customers handled on systems provided by the platform', 'Customer enquiries and records captured on the platform side', 'A back-office AI assistant for admin, learning and on-the-job questions'],
    engineerFocusTitle: 'Engineer focus',
    engineerFocus: ['Fault diagnosis', 'Maintenance and repair', 'Technical judgment', 'On-site delivery'],
    engineerFocusDetails: ['Find the real problem', 'Deliver the service properly', 'Commit to a reliable solution', 'Get the customer back into production'],
    coreValueText: 'Work orders, materials and customer management run on proven systems provided by the platform, so you never build or buy your own. Brand, systems, channels and supply chain sit with the platform, while diagnosis, repair, technical judgement and on-site delivery stay with you — the part customers actually pay for.',
    payoffTitle: 'Your technical value is proven on site, every time',
    payoffText: 'The platform takes on brand, systems, promotion and admin, so every professional hour goes where it earns.',
    developmentTitle: 'Four more things the platform keeps building',
    networkTitle: 'Brand, channels, supply chain and knowledge: continuous investment',
    developmentIntro: 'Unified brand marketing, multi-channel promotion, supply-chain management and a shared service knowledge base, deepened one by one, so partner engineers are easier for customers to find and better backed on site.',
    developmentDirections: [
      { title: 'Unified brand marketing', status: 'Ongoing' },
      { title: 'Video, official account and search promotion', status: 'Multi-channel parallel' },
      { title: 'Supply chain and spare parts', status: 'In progress' },
      { title: 'Service knowledge base', status: 'Compounding' },
    ],
    developmentDescriptions: ['One consistent public identity, case studies and expert content, so customers meet SAGEMRO first.', 'Video, official accounts and search engines working together so customers who need service can find you.', 'Aggregating demand and buying centrally to cut spare-part waiting time.', 'Service records turned into reusable experience, so newer engineers take fewer wrong turns.'],
    flywheelTitle: 'More engineers, more real service, a stronger brand, more customers',
    flywheelText: 'Service settles into reputation; reputation brings more customers; more customers mean more work.',
    principlesTitle: 'How we work together',
    cooperationPrinciples: [
      { title: 'Partners, not employees', text: 'A cooperative model rather than employment: we co-create the brand and share both the work and the upside, with customer source, contribution and returns recorded engagement by engagement.' },
      { title: 'Transparent books, more work means more return', text: 'Every engagement keeps its source, contribution and delivery on record with verifiable accounting — and no ceiling on what you can earn.' },
      { title: 'No franchise fee in year one', text: 'No franchise fee for the first year: build the service and the reputation first, then agree the next stage together.' },
    ],
    finalCtaTitle: 'Co-create the service brand with us',
    finalCtaText: 'Leave your details and our operations team will walk you through the rest.',
    finalCtaAction: 'Apply to Co-create',
    modalTitle: 'Apply to Co-create the Brand',
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
  }
};

export function buildEngineerRecruitingSeo(locale) {
  const isCn = locale === 'cn';
  const canonicalHost = isCn ? 'https://engineer.sagemro.cn' : 'https://engineer.sagemro.com';
  const title = isCn
    ? '客服工程师品牌共创 | SAGEMRO'
    : 'Service Engineer Brand Co-creation | SAGEMRO';
  const description = isCn
    ? 'SAGEMRO 客服工程师品牌共创平台：合作制、合作共赢。以 SAGEMRO 品牌承接服务，平台提供系统、渠道与供应链支持，工程师获得更多服务机会、更高收入保障与公平透明的分配体系。'
    : 'SAGEMRO is a brand co-creation platform for customer service engineers: a cooperative model with more service opportunities, steadier income, a fairer and more transparent split and room to grow, plus brand, systems, channels and supply chain provided by the platform.';

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
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-[#ef8244]">SAGEMRO SERVICE ENGINEER BRAND PROGRAM</div>
              <h1 className="mt-[22px] max-w-[690px] text-[40px] font-black leading-[1.17] tracking-[-0.05em] text-[#153e3c] sm:text-[55px]">{copy.title}</h1>
              <p className="mt-5 max-w-[690px] text-[15px] leading-[1.85] text-[#697a76]">{copy.subtitle}</p>
              <div className="mt-[30px] flex flex-wrap items-center gap-[22px]">
                <button type="button" onClick={openApply} className="bg-[#ef8244] px-5 py-[15px] text-xs font-black text-[#173b38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153e3c]">{copy.primary}</button>
                <a href="#focus" className="border-b border-[#8ba19c] pb-1 text-xs font-extrabold text-[#153e3c]">{copy.navLinks[0]} →</a>
              </div>
            </div>
            <aside className="relative m-0 flex min-h-[360px] flex-col justify-between bg-[#052e2f] p-7 text-white before:absolute before:left-0 before:top-0 before:h-[5px] before:w-[74px] before:bg-[#ef8244] lg:m-[42px_38px_42px_0] lg:p-[35px]">
              <div>
                <div className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#95d7c8]">SAGEMRO BRAND CO-CREATION</div>
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
              <div><div className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#ef8244]">WHAT THE PLATFORM PROVIDES</div><h2 className="mt-[18px] max-w-2xl text-[35px] font-black leading-[1.27] tracking-[-0.04em] sm:text-[43px]">{copy.coreValueTitle}</h2></div>
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
              <div><div className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#ef8244]">WHAT WE KEEP BUILDING FOR YOU</div><h2 className="mt-[18px] text-[35px] font-black leading-[1.27] tracking-[-0.04em] sm:text-[43px]">{copy.networkTitle}</h2></div>
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
            <div className="mt-[21px] flex flex-col gap-2 bg-[#153e3c] px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between"><div><b className="text-[13px]">{copy.flywheelTitle}</b><br /><span className="text-[10px] text-[#bcd1cd]">{copy.flywheelText}</span></div><code className="font-mono text-[9px] text-[#95d7c8]">SERVICE → REPUTATION → MORE CUSTOMERS</code></div>
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
