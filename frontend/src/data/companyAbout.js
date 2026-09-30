/**
 * /about/ 公司页文案。
 *
 * 审计（docs/research/2026-09-29-seo-geo-audit.md §3 第 11 行）指出：站点里只有
 * `/about/technical-review/`（内容审核政策），没有一页回答「SAGEMRO 是谁、做什么、边界在哪」。
 * 对 GEO 来说这是实体权威的缺口——AI 需要一个可引用的自我描述页，才能把这个名字解析成
 * 一个真实经营实体而不是一串文本。
 *
 * 本页**只写已核实的事实**：法人名与备案号来自 companyProfile.js（单一来源），
 * 业务与边界与首页、服务页口径一致。不写客户名称、不写案例、不写任何时效或能力承诺。
 */

const ABOUT = {
  en: {
    eyebrow: 'About SAGEMRO',
    h1: 'Who SAGEMRO is, and what we actually do',
    intro: 'SAGEMRO is the service brand of Jinan Euchio Machinery Co., Ltd. We take over the after-sales delivery that laser and metal forming equipment builders and their overseas dealers cannot cover with their own teams: in-warranty on-site service, export commissioning, and the exchange flow for returned parts.',
    // 正文首段可以长，meta description 必须短。原先两者是同一句话，于是 SERP 里拿到 305 字符
    // （必然被截断），而正文又不敢改短。这一条是专供元数据的独立文案。
    seoDescription: 'SAGEMRO is the service brand of Jinan Euchio Machinery Co., Ltd. We deliver after-sales for laser and metal forming equipment builders and their dealers.',
    sections: [
      {
        heading: 'What we take on',
        body: 'In-warranty on-site visits. Installation, commissioning, and customer training for exported machines. Returned-part and exchange-unit flow. Preventive maintenance, relocation, and retrofit support for equipment already in service.',
      },
      {
        heading: 'Who we work for',
        body: 'Equipment builders that need the after-sales delivered without adding headcount, and their overseas dealers and agents who need a service and parts backstop in territories they cannot staff. End users of laser cutting machines and press brakes also come to us directly for repair, maintenance, and relocation.',
      },
      {
        heading: 'What we are not',
        body: 'We do not build machines and we do not sell machines. We are an independent service provider; we do not claim authorization from any equipment maker, and we do not replace a manufacturer warranty obligation that the maker still holds.',
      },
      {
        heading: 'How work is organized',
        body: 'Engineers and parts are organized by SAGEMRO. Work is billed per project or per visit, with the service boundary, travel, and parts stated before anything starts. Service records, inspection data, and conclusions are archived and reported back to whoever commissioned the work.',
      },
      {
        heading: 'Where we operate',
        body: 'Domestically, field coverage is coordinated by region. For exported equipment, feasibility is confirmed per country and per project against the resources actually available there.',
      },
      {
        heading: 'Boundaries we state up front',
        body: 'We do not use the names, cases, or data of any equipment maker or customer in promotion without written permission. We do not make a uniform promise about the condition of equipment that has not been inspected. Feasibility and timing are confirmed for the individual project rather than promised in advance.',
      },
    ],
  },
  'zh-CN': {
    eyebrow: '关于 SAGEMRO',
    h1: 'SAGEMRO 是谁，我们实际做什么',
    intro: 'SAGEMRO 是济南钰峭机械有限公司的服务品牌。我们承接激光与金属成形设备整机厂及其海外渠道商自己团队覆盖不到的售后交付：保内上门、出口设备海外装机与调试、返修件流转。',
    seoDescription: 'SAGEMRO 是济南钰峭机械有限公司的服务品牌，承接激光与金属成形设备整机厂及其海外渠道商覆盖不到的售后交付。',
    sections: [
      {
        heading: '我们承接什么',
        body: '保内上门服务。出口设备的到货安装、调试与客户培训。返修件与交换件流转。在用设备的预防性维护、拆机移位与系统改造支持。',
      },
      {
        heading: '我们为谁服务',
        body: '需要在不增加编制的前提下把售后交付出去的整机厂，以及在没有常驻人员的地区需要服务与备件兜底的海外渠道商与代理商。激光切割机与折弯机的终端用户也会直接找我们做维修、保养与移机。',
      },
      {
        heading: '我们不是什么',
        body: '我们不造设备，也不卖设备。我们是独立服务方，不声称获得任何设备厂家的授权，也不替代厂家仍然承担的质保义务。',
      },
      {
        heading: '工作怎么组织',
        body: '工程师与备件由 SAGEMRO 组织。按项目或按次结算，服务边界、差旅与备件在执行前写明。服务记录、检测数据与结论留档，并回传给委托方。',
      },
      {
        heading: '我们在哪里交付',
        body: '国内按地区协调现场资源。出口设备按国家与项目逐案确认可行性，依据是当地实际可用的服务资源。',
      },
      {
        heading: '我们主动说明的边界',
        body: '未经书面许可，我们不使用任何整机厂或客户的名称、案例与数据做宣传。不对未检测的设备状态做统一承诺。可行性与时效按具体项目确认，不预先承诺。',
      },
    ],
  },
};

export function getCompanyAbout(locale) {
  const key = locale === 'zh-CN' ? 'zh-CN' : 'en';
  const content = ABOUT[key];
  return {
    ...content,
    sections: content.sections.map((section) => ({ ...section })),
  };
}
