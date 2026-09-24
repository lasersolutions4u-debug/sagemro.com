// 功能下线工具（1/2）：按标记删除 worker/src/index.js 里 routeRequest 的整块路由分支。
//
// 背景：2026-09-24 系统裁剪为四站（营销落地页 / AI 门户 / 知识中枢 / 工程师招募页），
// 工单、物料、客户管理、商务、推广、评价、设备、通知、工程师工作台等路由整体下架。
// 标准流程：
//   1) node scripts/system-trim-routes.mjs --apply      # 删路由分支
//   2) node --check src/index.js                        # 花括号配对可能提前收敛，必须核对
//   3) 手工清理：早退门禁里的 business 判断、/api/admin/ 角色门禁、块内残留的孤立 `}` 与注释
//   4) node scripts/system-trim-dead-code.mjs --apply   # 删不可达函数与孤立 lib
//   5) 同步 src/lib/routes.js 的 isKnownProtectedRoute，再跑 npm test
//
// 用法：
//   node scripts/system-trim-routes.mjs            # 只报告会删哪些分支
//   node scripts/system-trim-routes.mjs --apply    # 执行删除
import { readFile, writeFile } from 'node:fs/promises';

const REMOVED_MARKERS = [
  '/api/service-request-assist',
  '/api/admin/business/',
  '/api/admin/analytics/',
  '/api/admin/engineers/',
  '/api/admin/engineer-applications',
  '/api/admin/material-requests',
  '/api/admin/upsell-requests',
  '/api/admin/materials',
  '/api/admin/workorders',
  '/api/admin/ratings',
  '/api/admin/platform-ratings',
  '/api/admin/customer-ratings',
  '/api/admin/leads',
  '/api/inbox',
  '/api/materials',
  '/api/material-requests',
  '/api/material-requisitions',
  '/api/upsell-requests',
  '/api/leads/machine',
  '/api/location/search',
  '/api/workorders',
  '/api/customers/',
  '/api/devices',
  '/api/notifications',
  '/api/engineers',
  '/api/push-subscription',
];

const apply = process.argv.includes('--apply');
const path = new URL('../src/index.js', import.meta.url);
const lines = (await readFile(path, 'utf8')).split('\n');

const start = lines.findIndex((line) => line.startsWith('async function routeRequest('));
if (start < 0) throw new Error('routeRequest not found');
const end = lines.findIndex((line, index) => index > start && line.replace(/\r$/, '') === '}');
if (end < 0) throw new Error('routeRequest end not found');

const isRouteLine = (line) => /^ {4,8}if \(path/.test(line);
const kept = [];
const dropped = [];
const body = lines.slice(start + 1, end);

for (let i = 0; i < body.length; i += 1) {
  const line = body[i];
  // 正则字面量里的路径写作 \/api\/xxx，先去转义再匹配标记。
  const probe = line.replace(/\\/g, '');
  const matched = isRouteLine(line) && REMOVED_MARKERS.some((marker) => probe.includes(marker));

  if (!isRouteLine(line) || !matched) {
    kept.push(line);
    continue;
  }

  // 整块删除：`if (...) {` 走花括号配对，单语句形式吃到分号为止。
  let index = i;
  if (line.trimEnd().endsWith('{')) {
    let depth = 0;
    for (; index < body.length; index += 1) {
      depth += (body[index].match(/\{/g) || []).length;
      depth -= (body[index].match(/\}/g) || []).length;
      if (depth <= 0) break;
    }
  } else {
    while (index + 1 < body.length && !body[index].trimEnd().endsWith(';')) index += 1;
  }
  dropped.push(line.trim());
  i = index;
}

console.log(`${apply ? '已删除' : '可删除'} ${dropped.length} 个路由分支：`);
for (const branch of dropped) console.log(`  - ${branch.slice(0, 110)}`);
if (!apply) {
  console.log('\n（未修改文件；加 --apply 执行）');
  process.exit(0);
}
await writeFile(path, [...lines.slice(0, start + 1), ...kept, ...lines.slice(end)].join('\n'), 'utf8');
console.log('\n已写回。下一步：node --check src/index.js，再跑 node scripts/system-trim-dead-code.mjs --apply。');
