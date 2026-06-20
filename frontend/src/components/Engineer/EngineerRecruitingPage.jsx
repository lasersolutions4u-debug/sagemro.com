import { useState } from 'react';
import { ArrowRight, CalendarCheck, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';
import { submitEngineerApplication } from '../../services/api';
import { BrandMark } from '../common/BrandMark';

const COPY = {
  cn: {
    badge: 'SAGEMRO Service OS · 认证服务代表计划',
    title: '让专业工程师被看见、被支持、被认真对待。',
    subtitle: 'SAGEMRO 正在建设面向激光切割机与钣金加工设备的官方服务网络。我们寻找真正理解现场、设备和客户压力的工程师，由运营团队审核后分配账号，并在标准、派工、资料和成长上持续支持。',
    primary: '申请成为认证服务代表',
    signIn: '已有工程师账号，进入工作台',
    pillars: [
      { title: '官方审核，统一协作', text: '申请通过后由 SAGEMRO 分配账号，服务任务由 Admin 与区域负责人统一协调。' },
      { title: '尊重现场专业', text: '平台重点沉淀设备档案、AI 初诊、备件准备和服务报告，让工程师少做无效沟通。' },
      { title: '清晰排单协作', text: '工程师自己维护可服务时间，区域负责人和 Admin 派工时作为重要参考。' },
    ],
    valuesTitle: '我们相信：成就工程师，就是成就客户。',
    valuesText: '从 Admin 到区域负责人，核心任务是关心工程师的成长、利益与安全。工程师被支持得越充分，客户现场就越容易得到稳定、可靠、有温度的服务。',
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
    note: '提交申请不会自动创建账号。工程师账号仅在确认合作关系后由 SAGEMRO 分配。',
  },
  en: {
    badge: 'SAGEMRO Service OS · Certified Representative Program',
    title: 'A service network built for engineers who take field work seriously.',
    subtitle: 'SAGEMRO is building an official service network for laser cutting machines and sheet metal equipment. We review each application manually, then support approved representatives with dispatch coordination, service standards, equipment context, and growth resources.',
    primary: 'Apply as a Certified Service Representative',
    signIn: 'I already have an engineer account',
    pillars: [
      { title: 'Reviewed access, coordinated service', text: 'Approved accounts are assigned by SAGEMRO. Admin and regional leads coordinate service tasks.' },
      { title: 'Field expertise respected', text: 'Equipment records, AI intake notes, parts preparation, and reports help reduce low-value back-and-forth.' },
      { title: 'Clear scheduling signals', text: 'Engineers maintain their own availability so dispatch decisions can respect real field capacity.' },
    ],
    valuesTitle: 'When engineers are supported well, customers are served well.',
    valuesText: 'Our operating idea is simple: care for the people who care for the machines. SAGEMRO supports regional leads and engineers with standards, coordination, safety awareness, and long-term growth.',
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
    note: 'Submitting an application does not create a login account. Engineer accounts are assigned only after SAGEMRO confirms cooperation.',
  },
};

function getLocale() {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.cn')) return 'cn';
  return 'en';
}

function splitList(value) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function EngineerRecruitingPage({ onOpenLogin }) {
  const locale = getLocale();
  const copy = COPY[locale];
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    whatsapp: '',
    country: '',
    city: '',
    service_regions: '',
    skill_tags: '',
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
        service_regions: splitList(form.service_regions),
        skill_tags: splitList(form.skill_tags),
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
        service_regions: '',
        skill_tags: '',
        experience_summary: '',
      }));
    } catch (err) {
      setError(err.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-[#fbfaf7] text-[#17120b]">
      <div className="absolute inset-x-0 top-0 h-[430px] overflow-hidden bg-[#14100b]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,_rgba(245,158,11,0.36),_transparent_34%),radial-gradient(circle_at_80%_0%,_rgba(252,211,77,0.18),_transparent_32%),linear-gradient(135deg,_#14100b_0%,_#2b1b0d_58%,_#4a2a0e_100%)]" />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute -bottom-32 left-1/2 h-64 w-[92%] -translate-x-1/2 rounded-[100%] bg-[#fbfaf7]" />
      </div>
      <div className="relative mx-auto max-w-7xl px-5 py-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark className="h-11 w-11 drop-shadow-[0_12px_24px_rgba(245,158,11,0.22)]" />
            <div>
              <div className="text-sm font-semibold text-white">SAGEMRO</div>
              <div className="text-xs text-white/70">Service Representative Network</div>
            </div>
          </div>
          <button
            onClick={onOpenLogin}
            className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/15"
          >
            {copy.signIn}
          </button>
        </header>

        <main className="grid gap-6 py-10 lg:grid-cols-[1.06fr_0.94fr] lg:items-start">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/92 p-6 shadow-[0_24px_80px_rgba(48,31,12,0.14)] backdrop-blur-xl lg:p-8">
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-bl-[4rem] bg-amber-100/60 blur-2xl" />
            <div className="relative inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
              {copy.badge}
            </div>
            <h1 className="relative mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#17120b] md:text-[3.35rem]">
              {copy.title}
            </h1>
            <p className="relative mt-5 max-w-2xl text-base leading-8 text-[#6a5844]">
              {copy.subtitle}
            </p>
            <div className="relative mt-7 grid gap-3 md:grid-cols-3">
              {copy.pillars.map((item) => (
                <div key={item.title} className="rounded-2xl border border-[#efe6d8] bg-[#fffdf8] p-4 shadow-sm">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <CheckCircle2 size={17} />
                  </div>
                  <h2 className="text-sm font-semibold text-[#24170b]">{item.title}</h2>
                  <p className="mt-2 text-xs leading-6 text-[#735f48]">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="relative mt-6 rounded-2xl border border-[#2e2115]/10 bg-[#1d160f] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={18} className="text-amber-300" />
                {copy.valuesTitle}
              </div>
              <p className="mt-3 text-sm leading-7 text-white/72">{copy.valuesText}</p>
            </div>
          </section>

          <section id="apply" className="rounded-[2rem] border border-[#ece3d6] bg-white p-5 shadow-[0_24px_80px_rgba(48,31,12,0.12)] lg:p-6">
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-[#f0e6d7] pb-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-amber-700">{copy.primary}</div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#21160c]">{copy.primary}</h2>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-700 shadow-sm">
                <Wrench size={22} />
              </div>
            </div>

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
                      required={field === 'name'}
                    />
                  </label>
                ))}
              </div>
              <label className="block text-[13px] font-semibold text-[#312317]">
                {copy.fields.regions}
                <input
                  value={form.service_regions}
                  onChange={(event) => updateField('service_regions', event.target.value)}
                  placeholder={copy.placeholders.regions}
                  className="mt-1.5 w-full rounded-xl border border-[#eadfce] bg-[#fffdf8] px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]"
                />
              </label>
              <label className="block text-[13px] font-semibold text-[#312317]">
                {copy.fields.skills}
                <input
                  value={form.skill_tags}
                  onChange={(event) => updateField('skill_tags', event.target.value)}
                  placeholder={copy.placeholders.skills}
                  className="mt-1.5 w-full rounded-xl border border-[#eadfce] bg-[#fffdf8] px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]"
                />
              </label>
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
          </section>
        </main>
      </div>
    </div>
  );
}
