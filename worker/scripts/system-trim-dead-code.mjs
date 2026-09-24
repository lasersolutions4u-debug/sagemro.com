// 功能下线工具（2/2）：删除 worker/src/index.js 里已不可达的顶层函数，并收敛 import。
//
// 用 acorn 做真实语法分析，按 AST 范围精确删除（不做花括号计数，避免模板字符串/正则里的括号误判）。
// 可达性根 = 全部 export + 顶层非函数体里出现的名字（常量表/对象字面量间接引用）+ 入口函数。
// 依赖 frontend/node_modules 里的 acorn（本仓库已有）。
//
// 用法：
//   node scripts/system-trim-dead-code.mjs            # 只报告
//   node scripts/system-trim-dead-code.mjs --apply    # 删除 + 收敛 import + 报告孤立 lib
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const acorn = require('acorn');

const workerRoot = new URL('..', import.meta.url);
const indexPath = new URL('src/index.js', workerRoot);
const apply = process.argv.includes('--apply');

const source = readFileSync(indexPath, 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });

const candidates = new Map();
const exported = new Set();
for (const statement of ast.body) {
  const decl = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
  if (decl?.type !== 'FunctionDeclaration' || !decl.id) continue;
  candidates.set(decl.id.name, decl);
  if (statement.type === 'ExportNamedDeclaration') exported.add(decl.id.name);
}

const edges = new Map([...candidates.keys()].map((name) => [name, new Set()]));
const topLevelRefs = new Set();
const stack = [];

(function visit(node, parent) {
  if (!node || typeof node.type !== 'string') return;
  const isCandidateDecl = node.type === 'FunctionDeclaration' && node.id && candidates.get(node.id.name) === node;
  if (isCandidateDecl) stack.push(node.id.name);

  if (node.type === 'Identifier' && candidates.has(node.name)) {
    const isOwnDeclaration = parent?.type === 'FunctionDeclaration' && parent.id === node;
    const owner = stack[stack.length - 1];
    if (!isOwnDeclaration) {
      if (owner && owner !== node.name) edges.get(owner).add(node.name);
      else if (!owner) topLevelRefs.add(node.name);
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (['type', 'start', 'end', 'range'].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, node);
    } else if (value && typeof value.type === 'string') {
      visit(value, node);
    }
  }

  if (isCandidateDecl) stack.pop();
})(ast, null);

const ENTRY = ['routeRequest', 'withCorsHeaders', 'shouldUseCnDatabase', 'resolveAdminCredentials'];
const reachable = new Set();
const queue = [...exported, ...topLevelRefs, ...ENTRY.filter((name) => candidates.has(name))];
while (queue.length) {
  const name = queue.pop();
  if (!candidates.has(name) || reachable.has(name)) continue;
  reachable.add(name);
  for (const callee of edges.get(name) || []) if (!reachable.has(callee)) queue.push(callee);
}

const dead = [...candidates.entries()]
  .filter(([name]) => !reachable.has(name))
  .map(([, node]) => node)
  .sort((a, b) => b.start - a.start);
const deadLines = dead.reduce((sum, node) => sum + (source.slice(node.start, node.end).match(/\n/g) || []).length + 1, 0);
console.log(`顶层函数: ${candidates.size}，可达: ${reachable.size}，不可达: ${dead.length}（约 ${deadLines} 行）`);

if (!apply) {
  console.log('\n（未删除；加 --apply 执行）');
  process.exit(0);
}

let pruned = source;
for (const node of dead) {
  let start = node.start;
  const before = pruned.slice(0, start);
  const tailMatch = before.match(/(?:[ \t]*\/\/[^\n]*\n|[ \t]*\n)+$/);
  const tail = tailMatch ? tailMatch[0] : '';
  const onlyComments = tail.split('\n').every((line) => !line.trim() || line.trim().startsWith('//'));
  if (tail && onlyComments) start -= tail.length;
  pruned = `${pruned.slice(0, start)}${pruned.slice(node.end)}`;
}

const droppedImports = [];
pruned = pruned.split('\n').filter((line) => {
  const match = line.match(/^import\s+(?:([A-Za-z0-9_$]+)|\{([^}]*)\})\s+from\s+'([^']+)';/);
  if (!match) return true;
  const modulePath = match[3];
  const rawNames = match[1] ? [match[1]] : match[2].split(',').map((part) => part.trim()).filter(Boolean);
  const localNames = rawNames.map((part) => part.split(/\s+as\s+/).pop());
  const withoutLine = pruned.replace(line, '');
  const kept = rawNames.filter((_, index) => new RegExp(`\\b${localNames[index]}\\b`).test(withoutLine));
  if (kept.length === rawNames.length) return true;
  droppedImports.push({ modulePath, dropped: rawNames.filter((part) => !kept.includes(part)) });
  if (!kept.length) return false;
  return match[1] ? `import ${kept[0]} from '${modulePath}';` : `import { ${kept.join(', ')} } from '${modulePath}';`;
}).join('\n');

writeFileSync(indexPath, pruned, 'utf8');
console.log(`已删除 ${dead.length} 个不可达函数`);
for (const item of droppedImports) console.log(`  import 收敛: ${item.modulePath} 去掉 ${item.dropped.join(', ')}`);

// 报告已无人引用的 lib 模块（不自动删文件，确认后再手动 git rm）。
const libDir = new URL('src/lib/', workerRoot);
const toPath = (url) => path.join(url.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const consumers = [];
const collect = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') collect(full); continue; }
    if (/\.m?js$/.test(entry.name)) consumers.push(readFileSync(full, 'utf8'));
  }
};
collect(toPath(new URL('src/', workerRoot)));
collect(toPath(new URL('tests/', workerRoot)));
const orphanModules = readdirSync(libDir).filter((name) => name.endsWith('.js')
  && !consumers.some((text) => text.includes(name)));
console.log(`\n已无任何文件引用的 lib 模块（${orphanModules.length} 个）：`);
for (const name of orphanModules) {
  const size = statSync(new URL(`src/lib/${name}`, workerRoot)).size;
  console.log(`  ${String(Math.round(size / 1024)).padStart(4)} KB  src/lib/${name}`);
}
