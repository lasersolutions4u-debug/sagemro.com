import { useState } from 'react';
import {
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
    badge: 'SAGEMRO 智能服务系统 · 认证服务代表计划',
    networkLabel: '认证服务代表网络',
    title: '让专业工程师被看见、被支持、被认真对待。',
    subtitle: 'SAGEMRO 正在建设面向激光切割机与钣金加工设备的第三方服务协作网络。我们寻找真正理解现场、设备和客户压力的工程师，由运营团队审核后分配账号，并在标准、派工、资料和成长上持续支持。',
    primary: '申请成为认证服务代表',
    applyNow: 'Apply now',
    signIn: '已有工程师账号，进入工作台',
    heroStats: [
      { value: 'Manual', label: 'review before account access' },
      { value: 'Regional', label: 'dispatch coordination' },
      { value: 'Field-first', label: 'service standards' },
    ],
    pillars: [
      { title: '人工审核，统一协作', text: '申请通过后由 SAGEMRO 分配账号，服务任务由 Admin 与区域负责人统一协调。' },
      { title: '尊重现场专业', text: '平台重点沉淀设备档案、AI 初诊、备件准备和服务报告，让工程师少做无效沟通。' },
      { title: '清晰排单协作', text: '工程师自己维护可服务时间，区域负责人和 Admin 派工时作为重要参考。' },
    ],
    valuesTitle: '我们相信：成就工程师，就是成就客户。',
    valuesText: '从 Admin 到区域负责人，核心任务是关心工程师的成长、利益与安全。工程师被支持得越充分，客户现场就越容易得到稳定、可靠、有温度的服务。',
    joinTitle: 'Why join SAGEMRO',
    joinIntro: '我们不是让工程师变成平台里的匿名劳动力，而是建设一个更专业、更清晰、更尊重现场经验的服务网络。',
    joinItems: [
      { title: 'Better prepared service visits', text: 'Before dispatch, engineers can receive customer symptoms, machine context, AI intake notes, and available records.' },
      { title: 'Less low-value back-and-forth', text: 'Structured service records, quote review, messages, and payment confirmation keep operations clearer.' },
      { title: 'A path beyond one-time jobs', text: 'Reliable engineers can grow into regional service partners as the network expands.' },
    ],
    lookForTitle: 'What we look for',
    lookForItems: [
      'Hands-on experience with laser cutting machines, press brakes, or sheet metal equipment.',
      'Clear communication with customers and SAGEMRO operations.',
      'Ability to document service findings, parts needs, and follow-up advice.',
      'Honest schedule signals, travel range, and emergency support capacity.',
    ],
    leadTitle: 'Regional Lead opportunity',
    leadText: 'Experienced representatives may be invited to become Regional Leads after trust is established. Regional Leads help coordinate local engineers, support dispatch decisions, and keep service standards consistent.',
    processTitle: 'How applications work',
    process: [
      { step: '01', title: 'Apply online', text: 'Share your service regions, skills, field experience, and availability signals.' },
      { step: '02', title: 'SAGEMRO reviews manually', text: 'Our operations team checks fit, experience, and regional coverage before any account is opened.' },
      { step: '03', title: 'Activation after approval', text: 'Approved representatives receive an account activation link from SAGEMRO.' },
      { step: '04', title: 'Start with coordinated service', text: 'Admin and Regional Leads coordinate dispatch, quote review, payment follow-up, and service standards.' },
    ],
    faqTitle: 'Frequently asked questions',
    faqs: [
      { q: 'Does applying create a login account?', a: 'No. Application and account access are separate. Accounts are opened only after SAGEMRO confirms cooperation.' },
      { q: 'Can I apply if I only cover one city or one state?', a: 'Yes. Clear local coverage is useful. We care more about reliable service capacity than large but vague coverage.' },
      { q: 'Is this only for laser cutting machines?', a: 'Laser cutting is a key category, but sheet metal equipment experience such as press brakes and related CNC service is also valuable.' },
      { q: 'How does payment work?', a: 'Customer payment is coordinated through SAGEMRO-approved payment instructions. Engineers follow up with customers and request Admin approval before starting service.' },
    ],
    modalTitle: 'Apply as a Certified Service Representative',
    fields: {
      name: '姓名',
      phone: '手机 / 电话',
      email: '邮箱',
      whatsapp: 'WhatsApp / 微信',
      country: '国家',
      city: '常驻城市',
      regions: '可服务区域',
      skills: '擅长设备 / 技能',
      experience: '现场服务经验',
    },
    placeholders: {
      name: '请输入姓名',
      phone: '便于运营团队联系',
      email: '可选',
      whatsapp: '可选',
      country: '中国 / 马来西亚 / 美国...',
      city: '例如：苏州 / Chicago',
      regions: '例如：江苏、浙江、上海',
      skills: '例如：激光器、切割头、总线报警、保养',
      experience: '请简单说明服务年限、熟悉品牌、典型案例或希望加入的原因',
    },
    checks: ['愿意跨城服务', '可周末服务', '可夜间紧急支持', '自备基础工具'],
    submit: '提交申请',
    submitting: '正在提交...',
    success: '申请已收到。SAGEMRO 运营团队会审核资料，并在匹配合适区域后联系你。',
    note: 'Submitting an application does not create a login account. Approved representatives receive an account activation link from SAGEMRO after review.',
  },
  en: {
    badge: 'SAGEMRO Service OS · Certified Representative Program',
    networkLabel: 'Service Representative Network',
    title: 'A service network built for engineers who take field work seriously.',
    subtitle: 'SAGEMRO is building an independent service coordination network for laser cutting machines and sheet metal equipment. We review each application manually, then support approved representatives with dispatch coordination, service standards, equipment context, and growth resources.',
    primary: 'Apply as a Certified Service Representative',
    applyNow: 'Apply now',
    signIn: 'I already have an engineer account',
    heroStats: [
      { value: 'Manual', label: 'review before account access' },
      { value: 'Regional', label: 'dispatch coordination' },
      { value: 'Field-first', label: 'service standards' },
    ],
    pillars: [
      { title: 'Reviewed access, coordinated service', text: 'Approved accounts are assigned by SAGEMRO. Admin and regional leads coordinate service tasks.' },
      { title: 'Field expertise respected', text: 'Equipment records, AI intake notes, parts preparation, and reports help reduce low-value back-and-forth.' },
      { title: 'Clear scheduling signals', text: 'Engineers maintain their own availability so dispatch decisions can respect real field capacity.' },
    ],
    valuesTitle: 'When engineers are supported well, customers are served well.',
    valuesText: 'Our operating idea is simple: care for the people who care for the machines. SAGEMRO supports regional leads and engineers with standards, coordination, safety awareness, and long-term growth.',
    joinTitle: 'Why join SAGEMRO',
    joinIntro: 'This is not a marketplace that treats field experts like anonymous labor. SAGEMRO is building a service network that respects real troubleshooting experience.',
    joinItems: [
      { title: 'Better prepared service visits', text: 'Before dispatch, engineers can receive customer symptoms, machine context, AI intake notes, and available records.' },
      { title: 'Less low-value back-and-forth', text: 'Structured service records, quote review, messages, and payment confirmation keep operations clearer.' },
      { title: 'A path beyond one-time jobs', text: 'Reliable engineers can grow into regional service partners as the network expands.' },
    ],
    lookForTitle: 'What we look for',
    lookForItems: [
      'Hands-on experience with laser cutting machines, press brakes, or sheet metal equipment.',
      'Clear communication with customers and SAGEMRO operations.',
      'Ability to document service findings, parts needs, and follow-up advice.',
      'Honest schedule signals, travel range, and emergency support capacity.',
    ],
    leadTitle: 'Regional Lead opportunity',
    leadText: 'Experienced representatives may be invited to become Regional Leads after trust is established. Regional Leads help coordinate local engineers, support dispatch decisions, and keep service standards consistent.',
    processTitle: 'How applications work',
    process: [
      { step: '01', title: 'Apply online', text: 'Share your service regions, skills, field experience, and availability signals.' },
      { step: '02', title: 'SAGEMRO reviews manually', text: 'Our operations team checks fit, experience, and regional coverage before any account is opened.' },
      { step: '03', title: 'Activation after approval', text: 'Approved representatives receive an account activation link from SAGEMRO.' },
      { step: '04', title: 'Start with coordinated service', text: 'Admin and Regional Leads coordinate dispatch, quote review, payment follow-up, and service standards.' },
    ],
    faqTitle: 'Frequently asked questions',
    faqs: [
      { q: 'Does applying create a login account?', a: 'No. Application and account access are separate. Accounts are opened only after SAGEMRO confirms cooperation.' },
      { q: 'Can I apply if I only cover one city or one state?', a: 'Yes. Clear local coverage is useful. We care more about reliable service capacity than large but vague coverage.' },
      { q: 'Is this only for laser cutting machines?', a: 'Laser cutting is a key category, but sheet metal equipment experience such as press brakes and related CNC service is also valuable.' },
      { q: 'How does payment work?', a: 'Customer payment is coordinated through SAGEMRO-approved payment instructions. Engineers follow up with customers and request Admin approval before starting service.' },
    ],
    modalTitle: 'Apply as a Certified Service Representative',
    fields: {
      name: 'Name',
      phone: 'Phone',
      email: 'Email',
      whatsapp: 'WhatsApp',
      country: 'Country',
      city: 'Base city',
      regions: 'Service regions',
      skills: 'Equipment / skills',
      experience: 'Field service experience',
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
      experience: 'Briefly share your service years, familiar brands, typical cases, or why you want to join',
    },
    checks: ['Can travel', 'Weekend support', 'Night emergency support', 'Own basic tools'],
    submit: 'Submit Application',
    submitting: 'Submitting...',
    success: 'Application received. The SAGEMRO operations team will review your information and contact you when there is a suitable regional match.',
    note: 'Submitting an application does not create a login account. Approved representatives receive an account activation link from SAGEMRO after review.',
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

function TagInput({ label, value, suggestions, placeholder, onChange }) {
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
              title="Remove"
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
            {copy.fields[field]}
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
        suggestions={REGION_SUGGESTIONS}
        placeholder={copy.placeholders.regions}
        onChange={(tags) => updateField('service_regions', tags)}
      />
      <TagInput
        label={copy.fields.skills}
        value={form.skill_tags}
        suggestions={SKILL_SUGGESTIONS}
        placeholder={copy.placeholders.skills}
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
      setError(err.message || 'Submit failed');
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
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark variant="logo" className="h-14 w-14 object-contain drop-shadow-[0_12px_24px_rgba(245,158,11,0.22)]" />
            <div>
              <div className="text-sm font-semibold text-white">SAGEMRO</div>
              <div className="text-xs text-white/70">{copy.networkLabel}</div>
            </div>
          </div>
          <button
            onClick={onOpenLogin}
            className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/15"
          >
            {copy.signIn}
          </button>
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
                    {copy.processTitle}
                  </a>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-[#efe6d8] bg-[#fffdf8] p-4">
                <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
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

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {copy.pillars.map((item, index) => {
              const Icon = [ShieldCheck, Wrench, Clock3][index] || CheckCircle2;
              return (
                <div key={item.title} className="rounded-2xl border border-[#efe6d8] bg-white p-5 shadow-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Icon size={18} />
                  </div>
                  <h2 className="text-sm font-semibold text-[#24170b]">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#735f48]">{item.text}</p>
                </div>
              );
            })}
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2rem] border border-[#2e2115]/10 bg-[#1d160f] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={18} className="text-amber-300" />
                {copy.valuesTitle}
              </div>
              <p className="mt-3 text-sm leading-7 text-white/72">{copy.valuesText}</p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <UsersRound size={18} className="text-amber-300" />
                  {copy.leadTitle}
                </div>
                <p className="mt-2 text-sm leading-7 text-white/70">{copy.leadText}</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#ece3d6] bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{copy.joinTitle}</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.joinTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-[#6a5844]">{copy.joinIntro}</p>
              <div className="mt-5 grid gap-3">
                {copy.joinItems.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-[#efe6d8] bg-[#fffdf8] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#24170b]">
                      <BadgeCheck size={17} className="text-amber-700" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#735f48]">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[2rem] border border-[#ece3d6] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                <MapPin size={15} />
                {copy.lookForTitle}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.lookForTitle}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {copy.lookForItems.map((item) => (
                  <div key={item} className="rounded-2xl border border-[#efe6d8] bg-[#fffdf8] p-4 text-sm leading-6 text-[#6a5844]">
                    <CheckCircle2 size={17} className="mb-2 text-amber-700" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div id="how-it-works" className="rounded-[2rem] border border-[#ece3d6] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                <ClipboardCheck size={15} />
                {copy.processTitle}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.processTitle}</h2>
              <div className="mt-5 space-y-3">
                {copy.process.map((item) => (
                  <div key={item.step} className="grid grid-cols-[42px_1fr] gap-3 rounded-2xl border border-[#efe6d8] bg-[#fffdf8] p-4">
                    <div className="font-mono text-sm font-semibold text-amber-700">{item.step}</div>
                    <div>
                      <div className="text-sm font-semibold text-[#24170b]">{item.title}</div>
                      <p className="mt-1 text-sm leading-6 text-[#735f48]">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
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
                aria-label="Close application form"
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
