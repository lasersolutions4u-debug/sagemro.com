// 本文件由 scripts/generatePublicSeoRouteIndex.mjs 生成，请勿手改。
// 重新生成：npm run generate:seo-route-index
//
// 存在的理由：埋点判定（hooks/useAcquisitionTracking.js）只需要每页的 type / robots 与
// 「这个 slug 是不是已发布的故障诊断指南」，而这两件事原先要 import 132 KB 的
// publicSeoRoutes.js（全部路由正文）和 38 KB 的 diagnosticGuides.js —— 于是它们被挂在
// 每一个营销页的首屏上，包括根本不渲染路由正文的首页。
//
// 正确性由 tests/public-seo-route-index.test.mjs 保证：索引与源数据逐项比对，
// 并且对每条路由都比对「走索引」与「注入完整 route 对象」得到的埋点上下文完全一致。

const ROUTE_META = {
  "en": {
    "/": {
      "type": "home",
      "robots": "index,follow"
    },
    "/partners": {
      "type": "partners",
      "robots": "index,follow"
    },
    "/services": {
      "type": "services-hub",
      "robots": "index,follow"
    },
    "/services/laser-cutting-machine-repair": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/press-brake-repair": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/remote-diagnostics": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/preventive-maintenance": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/equipment-system-retrofit": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/machine-relocation-installation": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/used-equipment-evaluation": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/spare-parts-consumables": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/oem-service-partner": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/after-sales-outsourcing": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/overseas-delivery": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/third-party-service": {
      "type": "service",
      "robots": "index,follow"
    },
    "/tools": {
      "type": "tools-hub",
      "robots": "index,follow"
    },
    "/tools/metal-weight-calculator": {
      "type": "tool",
      "robots": "index,follow"
    },
    "/tools/laser-cutting-cost-calculator": {
      "type": "tool",
      "robots": "index,follow"
    },
    "/tools/press-brake-v-die-bend-allowance-helper": {
      "type": "tool",
      "robots": "index,follow"
    },
    "/insights": {
      "type": "insights-hub",
      "robots": "index,follow"
    },
    "/insights/laser-cutting-cost-drivers": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/insights/metal-weight-for-structural-profiles": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/insights/press-brake-tonnage-risk-check": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/insights/laser-protective-lens-burning": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/insights/laser-cutting-machine-maintenance-checklist": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/about/technical-review": {
      "type": "technical-review",
      "robots": "index,follow"
    },
    "/about": {
      "type": "about",
      "robots": "index,follow"
    },
    "/topics": {
      "type": "topics",
      "robots": "index,follow"
    }
  },
  "zh-CN": {
    "/": {
      "type": "home",
      "robots": "index,follow"
    },
    "/services": {
      "type": "services-hub",
      "robots": "index,follow"
    },
    "/services/laser-cutting-machine-repair": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/press-brake-repair": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/remote-diagnostics": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/preventive-maintenance": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/equipment-system-retrofit": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/machine-relocation-installation": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/used-equipment-evaluation": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/spare-parts-consumables": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/oem-service-partner": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/after-sales-outsourcing": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/overseas-delivery": {
      "type": "service",
      "robots": "index,follow"
    },
    "/services/third-party-service": {
      "type": "service",
      "robots": "index,follow"
    },
    "/tools": {
      "type": "tools-hub",
      "robots": "index,follow"
    },
    "/tools/metal-weight-calculator": {
      "type": "tool",
      "robots": "index,follow"
    },
    "/tools/laser-cutting-cost-calculator": {
      "type": "tool",
      "robots": "index,follow"
    },
    "/tools/press-brake-v-die-bend-allowance-helper": {
      "type": "tool",
      "robots": "index,follow"
    },
    "/insights": {
      "type": "insights-hub",
      "robots": "index,follow"
    },
    "/insights/laser-cutting-cost-drivers": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/insights/metal-weight-for-structural-profiles": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/insights/press-brake-tonnage-risk-check": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/insights/laser-protective-lens-burning": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/insights/laser-cutting-machine-maintenance-checklist": {
      "type": "insight",
      "robots": "index,follow"
    },
    "/about/technical-review": {
      "type": "technical-review",
      "robots": "index,follow"
    },
    "/about": {
      "type": "about",
      "robots": "index,follow"
    },
    "/topics": {
      "type": "topics",
      "robots": "index,follow"
    }
  }
};

const DIAGNOSTIC_GUIDE_SLUGS = {
  "en": [
    "laser-cutting-machine-maintenance-checklist",
    "laser-protective-lens-burning"
  ],
  "zh-CN": [
    "laser-cutting-machine-maintenance-checklist",
    "laser-protective-lens-burning"
  ]
};

/**
 * 与 publicSeoRoutes.getPublicSeoRoute 完全相同的路径归一化与 locale 兜底。
 * 只返回 { path, type, robots }。
 */
export function getPublicSeoRouteMeta(pathname, locale = 'en') {
  const table = ROUTE_META[locale === 'zh-CN' ? 'zh-CN' : 'en'];
  const normalizedPath = pathname === '/' ? '/' : String(pathname || '').replace(/\/$/, '');
  const meta = table[normalizedPath];
  return meta ? { path: normalizedPath, type: meta.type, robots: meta.robots } : null;
}

/**
 * 等价于 Boolean(getDiagnosticGuide(slug, locale))，含 locale 缺失时回落到 en 的行为。
 */
export function isDiagnosticGuideSlug(slug, locale = 'en') {
  if (typeof slug !== 'string' || !slug) return false;
  const slugs = DIAGNOSTIC_GUIDE_SLUGS[locale] ?? DIAGNOSTIC_GUIDE_SLUGS.en;
  return slugs.includes(slug);
}
