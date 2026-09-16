/**
 * Market selection for the frontend build.
 *
 * The public build is locale-driven: the locale decides the prerendered language,
 * the sitemap and llms.txt host, and the Baiduspider policy — allowed for
 * sagemro.cn, disallowed for sagemro.com. Until now that locale was inferred from
 * the `lang` attribute of the checked-out `index.html`, which meant a single
 * checkout could only ever produce one market, and the two markets had to live on
 * separate branches.
 *
 * `SAGEMRO_BUILD_MARKET` makes the choice explicit so one checkout can build both
 * markets correctly. The default stays `com`, so every existing invocation keeps
 * producing exactly what it produced before.
 */

import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { join } from 'node:path';

export const DEFAULT_MARKET = 'com';
export const MARKETS = {
  com: { locale: 'en', lang: 'en', host: 'https://sagemro.com' },
  cn: { locale: 'zh-CN', lang: 'zh-CN', host: 'https://sagemro.cn' },
};

/**
 * @param {unknown} value explicit market argument or SAGEMRO_BUILD_MARKET
 * @returns {'com' | 'cn'}
 */
export function resolveMarket(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_MARKET;
  if (typeof value !== 'string' || !Object.hasOwn(MARKETS, value)) {
    throw new Error(`Unsupported SAGEMRO_BUILD_MARKET: ${String(value)} (expected ${Object.keys(MARKETS).join(' or ')})`);
  }
  return value;
}

/**
 * Overlay a market's static assets onto a built artifact.
 *
 * Market-specific files live in `public-<market>/` beside the shared `public/`
 * directory rather than inside it, because Vite copies `public/` into every
 * artifact for every market. Keeping them separate is what guarantees that a
 * China-only file cannot change the international artifact, not even by a byte.
 *
 * @returns {Promise<boolean>} whether an overlay directory existed
 */
export async function copyMarketAssets({ frontendDir, distDir, market }) {
  const source = join(frontendDir, `public-${resolveMarket(market)}`);
  if (!existsSync(source)) return false;
  await cp(source, distDir, { recursive: true, force: true });
  return true;
}
