import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const market = process.env.SAGEMRO_BUILD_MARKET === 'com' ? 'com' : 'cn';
const lang = market === 'com' ? 'en' : 'zh-CN';
const indexPath = resolve('dist/index.html');

const html = readFileSync(indexPath, 'utf8');
const nextHtml = html.replace(/<html\s+lang="[^"]*"/, `<html lang="${lang}"`);

writeFileSync(indexPath, nextHtml);
console.log(`Set frontend build market=${market}, html lang=${lang}`);
