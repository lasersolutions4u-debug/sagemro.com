/**
 * 首屏模块图：从入口出发，只沿**静态** `import ... from '...'` 走。
 *
 * `lazy(() => import('...'))` 与任何 `await import(...)` 都是动态的，不会被跟随——
 * 这正是我们想区分的：动态分块是"按需"，静态 import 是"每个页面都要先下载"。
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const frontendRoot = path.resolve(import.meta.dirname, '../..');

const IMPORT_PATTERN = /(?:^|[\s;{(])import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
const SCRIPT_EXTENSIONS = ['.js', '.jsx', '.mjs'];

function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...SCRIPT_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SCRIPT_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate) && !candidate.endsWith(path.sep)) || null;
}

/** 返回 [{ file, relative, size }]，按大小降序。 */
export function walkStaticImports(entry = path.join(frontendRoot, 'src', 'App.jsx')) {
  const sizes = new Map();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (sizes.has(file)) continue;
    sizes.set(file, statSync(file).size);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const resolved = resolveSpecifier(file, match[1]);
      if (resolved && !sizes.has(resolved)) queue.push(resolved);
    }
  }
  return [...sizes.entries()]
    .map(([file, size]) => ({ file, relative: path.relative(frontendRoot, file).replace(/\\/g, '/'), size }))
    .sort((a, b) => b.size - a.size);
}
