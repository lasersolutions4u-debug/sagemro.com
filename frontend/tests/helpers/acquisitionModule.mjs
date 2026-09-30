/**
 * 共享测试辅助：把源码模块以 data: URL 方式加载，以便替换掉 `react` / `services/api` /
 * 数据模块这些依赖。
 *
 * data: URL 模块**没有 base URL**，因此任何相对的 import 说明符都必须在替换时
 * 改成绝对 file:// URL，否则会解析失败。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';

export const root = path.resolve(import.meta.dirname, '../..');

const funnelAnalyticsModule = pathToFileURL(path.join(root, 'src/services/funnelAnalytics.js')).href;

export function asDataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

export async function loadApi() {
  const source = readFileSync(path.join(root, 'src/services/api.js'), 'utf8')
    .replace("from './funnelAnalytics'", `from '${funnelAnalyticsModule}'`)
    .replace("if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;", "return 'https://api.example.test';");
  const transformed = await transformWithOxc(source, 'api.js', { lang: 'js', format: 'esm' });
  return import(asDataUrl(transformed.code));
}

export async function loadAcquisitionTracking(track) {
  const reactModule = pathToFileURL((await import('node:module')).createRequire(import.meta.url).resolve('react')).href;
  const routeIndexModule = pathToFileURL(path.join(root, 'src/data/publicSeoRouteIndex.js')).href;
  const apiModule = asDataUrl(`export const trackFunnelEvent = ${track.toString()};`);
  const source = readFileSync(path.join(root, 'src/hooks/useAcquisitionTracking.js'), 'utf8')
    .replace("from 'react'", `from '${reactModule}'`)
    .replace("from '../data/publicSeoRouteIndex.js'", `from '${routeIndexModule}'`)
    .replace("from '../services/api'", `from '${apiModule}'`);
  const transformed = await transformWithOxc(source, 'useAcquisitionTracking.js', { lang: 'js', format: 'esm' });
  return import(asDataUrl(transformed.code));
}
