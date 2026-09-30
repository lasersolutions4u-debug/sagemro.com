/**
 * 公司实体的单一数据源。
 *
 * 为什么要有这个文件：法人名与 ICP 备案号原先只硬编码在 `Footer.jsx` 与 `LegalModal.jsx` 里，
 * 于是「页面底部」和「结构化数据」是两套各写各的值，而结构化数据里干脆一个都没有——
 * 搜索引擎与 AI 只能看到一个 SAGEMRO 名字加一个邮箱，无法确认这是真实经营实体。
 *
 * 现在两处都从这里取，改一个地方就同步。
 */

export const LEGAL_ENTITY = {
  en: {
    name: 'SAGEMRO',
    legalName: 'Jinan Euchio Machinery Co., Ltd.',
    country: 'CN',
    // 国际站面向海外整机厂与渠道商，不宣称在某一国有本地实体。
    areaServed: 'Worldwide',
    description: 'SAGEMRO takes over the after-sales delivery that laser and metal forming equipment builders and their overseas dealers cannot cover themselves: in-warranty on-site service, export commissioning and customer training, and returned-part exchange flow. Engineers and parts are organized by SAGEMRO, billed per project or per visit.',
  },
  'zh-CN': {
    name: 'SAGEMRO',
    legalName: '济南钰峭机械有限公司',
    country: 'CN',
    areaServed: 'CN',
    description: 'SAGEMRO（济南钰峭机械有限公司）承接激光与金属成形设备整机厂自己做不过来的售后交付：保内上门、出口设备海外装机与调试、返修件流转与备件支持。工程师与备件由我们组织，按项目或按次结算。',
  },
};

/** 工信部 ICP 备案号。只有中国版站点持有。 */
export const ICP_RECORD_NUMBER = '鲁ICP备2026032904号-1';
export const ICP_FILING_URL = 'https://beian.miit.gov.cn/';

export const SUPPORT_EMAIL = 'support@sagemro.com';

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
