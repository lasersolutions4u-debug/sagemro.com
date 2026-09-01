import { getPublicHomeContent } from '../../data/publicHomeContent';
import { getLocalizedTool, industryTools } from '../../data/industryTools';
import { PublicSiteShell } from './PublicSiteShell';

const serviceRoutes = {
  repair: '/services/laser-cutting-machine-repair/',
  upgrade: '/services/equipment-system-retrofit/',
  relocation: '/services/machine-relocation-installation/',
  maintenance: '/services/preventive-maintenance/',
  assessment: '/services/used-equipment-evaluation/',
  parts: '/services/spare-parts-consumables/',
};

const problemRoutes = {
  fault: serviceRoutes.repair,
  accuracy: '/services/press-brake-repair/',
  upgrade: serviceRoutes.upgrade,
  relocation: serviceRoutes.relocation,
  maintenance: serviceRoutes.maintenance,
  parts: serviceRoutes.parts,
};

const featuredToolIds = ['cutting-speed', 'auxiliary-sizing', 'metal-weight'];

const insightRoutes = {
  diagnosis: '/insights/laser-protective-lens-burning/',
  maintenance: '/insights/laser-cutting-machine-maintenance-checklist/',
  relocation: '/insights/',
};

const serviceDescriptions = {
  cn: {
    repair: '报警、停机、运动异常、光路与加工质量问题的资料梳理、远程判断和维修协调。',
    upgrade: '围绕控制系统、驱动、总线、硬件与工艺需求，评估升级边界和实施条件。',
    relocation: '从拆机标记、运输条件到重新安装和调试，按设备与现场制定执行清单。',
    maintenance: '根据设备状态、维护记录和运行环境，规划检查重点与预防性维护。',
    assessment: '协助整理设备状态、配置和可用性信息，为继续使用、改造或处置提供参考。',
    parts: '根据设备型号、现有部件和故障信息核对备件，协调更换后的安装与调试。',
  },
  com: {
    repair: 'Organize alarms, downtime, motion, optical-path, and cut-quality evidence for assessment and repair coordination.',
    upgrade: 'Review controls, drives, buses, hardware, and process goals to define a practical retrofit scope.',
    relocation: 'Plan dismantling records, transport conditions, reinstallation, and commissioning for the machine and site.',
    maintenance: 'Use machine condition, service history, and operating context to define inspection and preventive work.',
    assessment: 'Structure condition, configuration, and usability information to support continued use, retrofit, or disposition decisions.',
    parts: 'Match parts against the machine, installed component, and fault evidence, then coordinate replacement and commissioning.',
  },
};

const labels = {
  cn: {
    problemEyebrow: '从现场问题开始',
    problemTitle: '你现在需要解决什么？',
    servicesEyebrow: '服务项目',
    servicesTitle: '围绕设备全生命周期解决实际问题',
    learnMore: '查看服务范围',
    reasonsEyebrow: '客户最关心的四件事',
    reasonsTitle: '能不能做、怎么报价、如何落地、后续谁负责',
    processEyebrow: '统一服务流程',
    processTitle: '一份请求贯穿判断、报价与执行',
    brandsEyebrow: '设备与品牌支持',
    brandsTitle: '按设备、系统与部件能力匹配服务',
    brandsBody: '不以单一品牌限定服务范围。请提交铭牌、型号、控制系统与故障信息，我们据此确认是否具备服务条件。',
    viewBrands: '查看品牌支持',
    toolsEyebrow: '工具',
    toolsTitle: '先把关键数据整理清楚',
    insightsEyebrow: '技术洞察',
    insightsTitle: '了解常见问题和安全边界',
    viewResource: '查看资源',
    faqEyebrow: '常见问题',
    faqTitle: '提交请求前，你可能想先确认这些',
    ctaEyebrow: '发起服务请求',
    ctaTitle: '把设备、问题和联系方式集中提交',
    ctaBody: '无论选择手动填写还是由 AI 协助整理，最终都进入同一份服务请求，由技术人员确认下一步。',
  },
  com: {
    problemEyebrow: 'Start with the site issue',
    problemTitle: 'What do you need to resolve now?',
    servicesEyebrow: 'Services',
    servicesTitle: 'Practical support across the equipment lifecycle',
    learnMore: 'Review service scope',
    reasonsEyebrow: 'Four questions customers ask first',
    reasonsTitle: 'Can it be done, how is it priced, how is it delivered, and what follows?',
    processEyebrow: 'One service workflow',
    processTitle: 'One request connects assessment, quotation, and delivery',
    brandsEyebrow: 'Equipment and brand support',
    brandsTitle: 'Match service capability to the machine, system, and component',
    brandsBody: 'Support is not limited to one brand. Share the nameplate, model, control system, and fault evidence so service feasibility can be confirmed.',
    viewBrands: 'Explore brand support',
    toolsEyebrow: 'Tools',
    toolsTitle: 'Organize key operating data first',
    insightsEyebrow: 'Insights',
    insightsTitle: 'Understand common issues and safe boundaries',
    viewResource: 'Open resource',
    faqEyebrow: 'Frequently asked questions',
    faqTitle: 'What you may want to confirm before submitting',
    ctaEyebrow: 'Start a service request',
    ctaTitle: 'Submit the equipment, issue, and contact details together',
    ctaBody: 'Whether completed manually or organized with AI assistance, the information enters one service request for technician confirmation.',
  },
};

function SectionHeading({ eyebrow, title }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d97706]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[#21160c] md:text-4xl">{title}</h2>
    </div>
  );
}

export function PublicHomePage({ isCn, onOpenLegal }) {
  const content = getPublicHomeContent(isCn);
  const market = isCn ? 'cn' : 'com';
  const copy = labels[market];
  const featuredTools = featuredToolIds
    .map((id) => industryTools.find((tool) => tool.id === id))
    .filter(Boolean)
    .map((tool) => getLocalizedTool(tool, isCn ? 'zh-CN' : 'en'));

  return (
    <PublicSiteShell isCn={isCn} onOpenLegal={onOpenLegal}>
      <section data-home-section="hero" className="relative overflow-hidden border-b border-[#e6dccf] bg-[#f7f3ed] px-5 py-16 md:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: 'linear-gradient(#e8ded2 1px, transparent 1px), linear-gradient(90deg, #e8ded2 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:px-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d97706]">{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.12] tracking-[-0.04em] text-[#21160c] md:text-6xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[#6b5a48] md:text-lg">{content.hero.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={content.requestCtas.assist.href} className="flex min-h-12 items-center justify-center rounded-lg bg-[#f59e0b] px-6 text-sm font-semibold text-[#21160c] shadow-sm transition-colors hover:bg-[#fbbf24]">
                {content.requestCtas.assist.label}
              </a>
              <a href={content.requestCtas.manual.href} className="flex min-h-12 items-center justify-center rounded-lg border border-[#c9b9a5] bg-[#fffdf8] px-6 text-sm font-semibold text-[#2d2116] transition-colors hover:border-[#d97706] hover:bg-white">
                {content.requestCtas.manual.label}
              </a>
            </div>
          </div>
          <aside className="self-end border-l-4 border-[#ea580c] bg-[#fffdf8] p-6 shadow-[0_18px_50px_rgba(45,33,22,0.10)]">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#c2410c]">{isCn ? '提交前准备' : 'Before submitting'}</p>
            <ul className="mt-5 space-y-4 text-sm leading-6 text-[#6b5a48]">
              {(isCn
                ? ['设备品牌与型号', '完整报警代码与故障现象', '现场地区、停机影响与联系方式']
                : ['Equipment brand and model', 'Complete alarm code and symptom', 'Site region, production impact, and contact details']
              ).map((item, index) => (
                <li key={item} className="flex gap-3"><span className="font-mono font-bold text-[#d97706]">0{index + 1}</span><span>{item}</span></li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section data-home-section="problems" className="border-b border-[#e6dccf] bg-[#fffdf8] px-5 py-14 md:py-20">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <SectionHeading eyebrow={copy.problemEyebrow} title={copy.problemTitle} />
          <div className="mt-8 grid gap-px overflow-hidden border border-[#e6dccf] bg-[#e6dccf] sm:grid-cols-2 lg:grid-cols-3">
            {content.problemLinks.items.map((item, index) => (
              <a key={item.key} href={problemRoutes[item.key]} className="group flex min-h-24 items-center justify-between gap-4 bg-white p-5 transition-colors hover:bg-[#fff5df]">
                <span className="text-base font-semibold">{item.label}</span>
                <span className="font-mono text-xs text-[#8a7864] group-hover:text-[#d97706]">0{index + 1} / →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section data-home-section="services" className="bg-[#f4ede3] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <SectionHeading eyebrow={copy.servicesEyebrow} title={copy.servicesTitle} />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {content.services.items.map((item, index) => (
              <article key={item.key} data-service-card={item.key} className="flex min-h-72 flex-col border border-[#e3d6c7] bg-[#fffdf8] p-6 shadow-[0_8px_30px_rgba(45,33,22,0.05)]">
                <span className="font-mono text-xs font-bold tracking-[0.14em] text-[#c2410c]">SVC / 0{index + 1}</span>
                <h3 className="mt-8 text-xl font-semibold leading-8">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[#756552]">{serviceDescriptions[market][item.key]}</p>
                <a href={serviceRoutes[item.key]} className="mt-auto flex min-h-11 items-end pt-5 text-sm font-semibold text-[#b45309] underline decoration-[#e7b65b] underline-offset-4">{copy.learnMore}</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section data-home-section="reasons" className="bg-[#1a1a1a] px-5 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#fbbf24]">{copy.reasonsEyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] md:text-4xl">{copy.reasonsTitle}</h2>
          </div>
          <div className="mt-10 grid gap-px bg-[#43382d] sm:grid-cols-2 lg:grid-cols-4">
            {content.reasons.items.map((item, index) => (
              <article key={item.key} className="min-h-56 bg-[#252525] p-6">
                <span className="font-mono text-xs text-[#fbbf24]">0{index + 1}</span>
                <h3 className="mt-8 text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#d8cec0]">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section data-home-section="process" className="bg-[#fffdf8] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <SectionHeading eyebrow={copy.processEyebrow} title={copy.processTitle} />
          <ol className="mt-10 grid gap-6 lg:grid-cols-4">
            {content.process.steps.map((step, index) => (
              <li key={step.key} className="relative border-t-2 border-[#f59e0b] pt-5">
                <span className="font-mono text-xs font-bold text-[#c2410c]">STEP 0{index + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              </li>
            ))}
          </ol>
          <p className="mt-10 border-l-4 border-[#f59e0b] bg-[#fff5d9] p-5 text-sm leading-7 text-[#62513e]">{content.process.boundary}</p>
        </div>
      </section>

      <section data-home-section="brands" className="border-y border-[#e6dccf] bg-[#f4ede3] px-5 py-16 md:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-3">
          <div>
            <SectionHeading eyebrow={copy.brandsEyebrow} title={copy.brandsTitle} />
            <p className="mt-5 text-sm leading-7 text-[#756552]">{copy.brandsBody}</p>
            <a href="/brands/" className="mt-6 inline-flex min-h-11 items-center font-semibold text-[#b45309] underline decoration-[#e7b65b] underline-offset-4">{copy.viewBrands}</a>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {content.brands.groups.map((group) => (
              <a key={group.key} href="/brands/" className="border border-[#e3d6c7] bg-[#fffdf8] p-5 transition-colors hover:border-[#d97706]">
                <h3 className="font-semibold">{group.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-[#756552]">
                  {group.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section data-home-section="tools" className="bg-[#fffdf8] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <SectionHeading eyebrow={copy.toolsEyebrow} title={copy.toolsTitle} />
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {featuredTools.map((tool) => (
              <a key={tool.id} href={`/tools/${tool.slug}/`} className="group border-b-2 border-[#e6dccf] bg-[#f7f3ed] p-6 transition-colors hover:border-[#ea580c]">
                <h3 className="text-lg font-semibold">{tool.label}</h3>
                <p className="mt-3 text-sm leading-6 text-[#6b5a48]">{tool.description}</p>
                <span className="mt-8 block text-sm font-semibold text-[#c2410c]">{copy.viewResource} →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section data-home-section="insights" className="bg-[#f4ede3] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <SectionHeading eyebrow={copy.insightsEyebrow} title={copy.insightsTitle} />
          <div className="mt-9 grid gap-px bg-[#e3d6c7] md:grid-cols-3">
            {content.insights.items.map((item, index) => (
              <a key={item.key} href={insightRoutes[item.key]} className="min-h-44 bg-[#fffdf8] p-6 transition-colors hover:bg-[#fff5df]">
                <span className="font-mono text-xs text-[#756552]">NOTE / 0{index + 1}</span>
                <h3 className="mt-8 text-lg font-semibold">{item.title}</h3>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section data-home-section="faqs" className="bg-[#fffdf8] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-[980px]">
          <SectionHeading eyebrow={copy.faqEyebrow} title={copy.faqTitle} />
          <div className="mt-9 divide-y divide-[#e6dccf] border-y border-[#e6dccf]">
            {content.faqs.items.map((item) => (
              <details key={item.key} className="group py-1">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-semibold marker:content-none">
                  {item.question}<span className="font-mono text-[#d97706] group-open:rotate-45">＋</span>
                </summary>
                <p className="max-w-3xl pb-6 pr-10 text-sm leading-7 text-[#756552]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section data-home-section="final-cta" className="bg-[#1a1a1a] px-5 py-16 text-white md:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#fbbf24]">{copy.ctaEyebrow}</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.025em] md:text-4xl">{copy.ctaTitle}</h2>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#d8cec0]">{copy.ctaBody}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={content.requestCtas.assist.href} className="flex min-h-12 items-center justify-center rounded-lg bg-[#f59e0b] px-6 text-sm font-semibold text-[#21160c] transition-colors hover:bg-[#fbbf24]">{content.requestCtas.assist.label}</a>
            <a href={content.requestCtas.manual.href} className="flex min-h-12 items-center justify-center rounded-lg border border-[#8a7864] px-6 text-sm font-semibold text-white transition-colors hover:border-[#fbbf24] hover:text-[#fbbf24]">{content.requestCtas.manual.label}</a>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
