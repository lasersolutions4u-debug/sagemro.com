/**
 * 公司实体的单一数据源。
 *
 * 为什么要有这个文件：法人名与 ICP 备案号原先只硬编码在 `Footer.jsx` 与 `LegalModal.jsx` 里，
 * 于是「页面底部」和「结构化数据」是两套各写各的值，而结构化数据里干脆一个都没有——
 * 搜索引擎与 AI 只能看到一个 SAGEMRO 名字加一个邮箱，无法确认这是真实经营实体。
 *
 * 现在两处都从这里取，改一个地方就同步。
 *
 * 🔴 2026-11-13 变更：国际站（sagemro.com）的运营主体改为 SAGEMRO LLC（Wyoming, United States），
 * 由它对外签发发票；中国站（sagemro.cn）仍是济南钰峭机械有限公司。
 * 两侧主体不同是事实，不是文案差异——所以 `LEGAL_ENTITY` 按 locale 分别取值，
 * 不要把 LLC 的句子搬到 CN，也不要让 COM 继续宣称济南主体在开票。
 */

export const LEGAL_ENTITY = {
  en: {
    name: 'SAGEMRO',
    legalName: 'SAGEMRO LLC',
    country: 'US',
    // 注册地址（Wyoming 注册代理地址，对外公布；发票抬头与此一致）。
    // 服务团队与备件在济南——注册地与服务地分开是这类公司的常态，页面把两件事分别写清。
    address: {
      street: '30 N Gould St Ste N',
      city: 'Sheridan',
      region: 'WY',
      postalCode: '82801',
      country: 'US',
      formatted: '30 N Gould St Ste N, Sheridan, WY 82801, United States',
    },
    // 国际站面向海外整机厂与渠道商；服务人员与备件都在济南。
    areaServed: 'Worldwide',
    serviceBase: 'Jinan, Shandong, China',
    description: 'SAGEMRO LLC, registered in Wyoming, United States, takes over the after-sales delivery that laser and metal forming equipment builders and their overseas dealers cannot cover themselves: in-warranty on-site service, export commissioning and customer training, and returned-part exchange flow. Service delivery, engineers, and parts are organized by our team in Jinan, China, and work is billed per project or per visit.',
    operatingEntityStatement: 'SAGEMRO LLC (Wyoming) operates this website and issues invoices to overseas customers; service delivery is supported by our team in Jinan, China.',
  },
  'zh-CN': {
    name: 'SAGEMRO',
    legalName: '济南钰峭机械有限公司',
    country: 'CN',
    address: null,
    areaServed: 'CN',
    serviceBase: 'Jinan, Shandong, China',
    description: 'SAGEMRO（济南钰峭机械有限公司）承接激光与金属成形设备整机厂自己做不过来的售后交付：保内上门、出口设备海外装机与调试、返修件流转与备件支持。工程师与备件由我们组织，按项目或按次结算。',
    operatingEntityStatement: '本站由济南钰峭机械有限公司运营，服务与备件由济南团队组织交付。',
  },
};

/** 工信部 ICP 备案号。只有中国版站点持有。 */
export const ICP_RECORD_NUMBER = '鲁ICP备2026032904号-1';
export const ICP_FILING_URL = 'https://beian.miit.gov.cn/';

export const SUPPORT_EMAIL = 'support@sagemro.com';

/**
 * 联系电话与工作时段。
 *
 * 🔴 2026-11-13 决定：**暂不对外公布电话**，联系以邮件为主。号码保留在这里，
 * 日后要放回页面时只改本文件与 /contact 页，不要在页面里另写一份。
 * 页面展示用 `PHONE_DISPLAY`（可读），`tel:` 链接用 `PHONE_TEL`（E.164）。
 */
export const PHONE_DISPLAY = '+86 186 1558 4520';
export const PHONE_TEL = '+8618615584520';

/** 对外承诺的响应时长与工作时段（按 UTC+8 计，节假日不计入）。 */
export const SUPPORT_TIMEZONE = 'UTC+8 (China Standard Time)';
export const SUPPORT_TIMEZONE_SHORT = 'UTC+8';
export const SUPPORT_HOURS_EN = 'Monday to Friday, 09:00–18:00 (UTC+8)';
export const SUPPORT_HOURS_CN = '周一至周五 09:00–18:00（UTC+8）';
/** 首屏渠道条这类窄位置用的短格式（不带时区，时区单独显示）。 */
export const SUPPORT_HOURS_SHORT_EN = 'Mon–Fri 09:00–18:00';
export const SUPPORT_HOURS_SHORT_CN = '周一至周五 09:00–18:00';
export const RESPONSE_TIME_EN = 'within one business day (public holidays excluded)';
export const RESPONSE_TIME_CN = '一个工作日内（不含法定节假日）';

/**
 * 社交分享卡（1200×630，见 frontend/public/og-sagemro.jpg）。
 * og:image 与 twitter:image 共用；构建期静态壳与客户端运行时都从这里取，避免两处各写一份。
 */
export const SOCIAL_IMAGE_PATH = '/og-sagemro.jpg';

/** og:locale 用的是下划线形式，和 html lang 的连字符不同。 */
export const OG_LOCALES = { en: 'en_US', 'zh-CN': 'zh_CN' };

export function getLegalEntity(locale) {
  return LEGAL_ENTITY[locale === 'zh-CN' ? 'zh-CN' : 'en'];
}

/** 按语言取展示用的工作时段与响应时长，避免每个组件各写一份。 */
export function getSupportCopy(locale) {
  const isCn = locale === 'zh-CN';
  return {
    hours: isCn ? SUPPORT_HOURS_CN : SUPPORT_HOURS_EN,
    hoursShort: isCn ? SUPPORT_HOURS_SHORT_CN : SUPPORT_HOURS_SHORT_EN,
    response: isCn ? RESPONSE_TIME_CN : RESPONSE_TIME_EN,
    timezone: SUPPORT_TIMEZONE_SHORT,
    email: SUPPORT_EMAIL,
  };
}
