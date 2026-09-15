# SAGEMRO P1-A Implementation Plan（已暂停，保留历史）

> **暂停门槛：** Joe 已同意聚焦海外和最小业务闭环。本计划不再作为开工入口；不要创建下方新函数或执行下方代码修改。先验证已有海外流程，只有具体问题证明需要本次抽取时才重新评估。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans only if this historical plan is explicitly reactivated. Steps use checkbox (`- [ ]`) syntax for tracking. 本计划不授权生产操作、提交、推送或额外代理。

## 当前接续动作：验证已有流程，不执行下方改造

- [ ] 确认工作目录和 git 状态，保留现有未提交改动；不切分支、不撤销代码。
- [ ] 核对 `worker/package.json` 的现有测试入口、测试内容及所需环境；仅使用本地/内存环境和虚构数据，不安装依赖或调用生产 smoke。
- [ ] 在 `worker/` 分别运行以下已有测试；预期均通过。失败时先说明原因，不能自动扩大到架构重写或环境变更。

```powershell
node --test tests/service-request-intake.test.mjs tests/service-request-create-api.test.mjs
node --test tests/business-workspace.test.mjs
node --test tests/payment-approval-flow.test.mjs tests/quote-execution-api.test.mjs
npm run test:business-execution
```

- [ ] 这些测试只能证明对应接口/规则。再核对并选择现有本地浏览器测试覆盖请求、报价、付款、派工、报告的路径；缺失环节先明确报告，不宣称已跑通端到端。
- [ ] 输出仅区分“已验证可用、实际阻塞、尚未验证”；若发现阻塞，提出一个最小修复批次及测试，不自动恢复旧 P0–P6 扩建路线。
- [ ] 不修改国内发布流程、数据库或域名；共享服务的现有 CN 兼容性测试仍保留。

以下 Goal、Architecture 和 Task 1–4 均为暂停前的历史内容，不是当前执行指令。

**Goal:** 把现有商务人员可见范围规则提取为一个受测试保护的共用函数，为统一客户、线索、工单页面提供基础，不扩大现有权限。

**Architecture:** 只抽取 `businessWorkspace.js` 中对已校验组织成员的筛选逻辑。身份、市场、有效上下级、地域、对象归属、scope version 和 SQL 条件仍由现有服务端负责。纯函数不能单独充当完整授权器。

**Tech Stack:** 原生 JavaScript ESM、Node.js 24 `node:test`、现有 Worker 测试；不安装或升级依赖。

**关联需求：** 总方案 R02/R03/R04/R05 的基础子任务。该批完成不等于统一后台、CRM、审批或收益系统已经完成。

**设计依据：** `docs/superpowers/specs/2026-09-08-unified-admin-crm-workflow-design.md`。

## 1. 执行前检查

- [ ] 确认用户已审阅总体方案并同意开始本地实现；本轮文档编制不替代该确认。
- [ ] 工作目录必须是 `C:/Users/Admin/.config/superpowers/worktrees/sagemro.com/business-service-workflow`；先读本地 AGENTS、`git status --short`、`git branch --show-current`、`git rev-parse HEAD`。
- [ ] 保留现有三个未提交界面/测试修改及旧 rollout 文档。本批不涉及它们，不切分支、不 stash、不撤销。
- [ ] 检查 `node --version` 符合现有项目 Node 24 要求；不更改运行环境。缺环境或依赖时解释阻碍后停止，不自行安装。
- [ ] 重新读取 `worker/src/lib/businessWorkspace.js` 的 `scope()`，确认下方替换块仍匹配。若已变化，先更新计划，不照旧套补丁。

执行前说明：本地四文件变更，新增两文件、修改两文件，不动生产、数据库、配置、依赖及界面。若实现范围扩大至超过五文件，须重新说明并确认。

## 2. 文件责任与禁改范围

| 文件（相对上述工作目录） | 操作 | 责任 |
| --- | --- | --- |
| `worker/src/lib/businessAccessPolicy.js` | 新增 | 对已验证组织成员做岗位范围筛选 |
| `worker/tests/business-access-policy.test.mjs` | 新增 | 虚构人员矩阵和现有规则等价性测试 |
| `worker/src/lib/businessWorkspace.js` | 修改 | 以函数调用替换原内联筛选，不改其他授权链 |
| `worker/tests/business-workspace.test.mjs` | 修改 | 导入新测试，纳入既有完整测试入口 |

禁止修改 `index.js` 路由门禁、`businessIdentity.js` 身份算法、数据库/schema、`package.json`、发布配置和 Admin 导航。本批不增加岗位、不授权知识库、不改变业务写操作。

## 3. Task 1：先确认基线

- [ ] 在 `worker/` 运行：

```powershell
node --test tests/business-workspace.test.mjs
```

- [ ] 预期原有商务范围/报价接口测试通过。原有测试不通过则停止，记录实际失败，不降低校验或以本批重构掩盖已有问题。

## 4. Task 2：编写范围规则测试

- [ ] 新建 `worker/tests/business-access-policy.test.mjs`，内容如下。全部身份均为虚构信息，不使用真实员工数据。

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectBusinessOwners } from '../src/lib/businessAccessPolicy.js';

const profiles = Object.freeze([
  { id: 'd1', role: 'business_director', director_id: 'd1', grade: 1 },
  { id: 'm1', role: 'business_manager', director_id: 'd1', supervisor_staff_id: 'd1', grade: 1 },
  { id: 's1', role: 'business_specialist', director_id: 'd1', supervisor_staff_id: 'm1', grade: 3 },
  { id: 'm2', role: 'business_manager', director_id: 'd1', supervisor_staff_id: 'd1', grade: 3 },
  { id: 's2', role: 'business_specialist', director_id: 'd1', supervisor_staff_id: 'm2', grade: 1 },
  { id: 'd2', role: 'business_director', director_id: 'd2', grade: 3 },
  { id: 'm3', role: 'business_manager', director_id: 'd2', supervisor_staff_id: 'd2', grade: 1 },
  { id: 's3', role: 'business_specialist', director_id: 'd2', supervisor_staff_id: 'm3', grade: 1 },
].map(Object.freeze));

const ids = rows => rows.map(row => row.id);

test('director sees own hierarchy but not another director', () => {
  assert.deepEqual(ids(selectBusinessOwners('business_director', 'd1', profiles)), ['d1', 'm1', 's1', 'm2', 's2']);
});

test('manager sees self and direct specialists, not peer manager or their staff', () => {
  assert.deepEqual(ids(selectBusinessOwners('business_manager', 'm1', profiles)), ['m1', 's1']);
});

test('specialist sees only self regardless of grade', () => {
  assert.deepEqual(ids(selectBusinessOwners('business_specialist', 's1', profiles)), ['s1']);
});

test('authenticated admin path retains all prevalidated profiles', () => {
  assert.deepEqual(selectBusinessOwners('admin', null, profiles), profiles);
});

test('unknown role and missing business identity fail closed', () => {
  assert.deepEqual(selectBusinessOwners('unexpected_role', 'd1', profiles), []);
  assert.deepEqual(selectBusinessOwners('business_director', null, profiles), []);
  assert.deepEqual(selectBusinessOwners('business_specialist', '', profiles), []);
});

test('empty prevalidated membership yields no owners', () => {
  assert.deepEqual(selectBusinessOwners('business_manager', 'm1', []), []);
});

test('matches existing inline rule for valid callers and does not mutate inputs', () => {
  for (const [role, actorId] of [
    ['admin', null], ['business_director', 'd1'],
    ['business_manager', 'm1'], ['business_specialist', 's1'],
  ]) {
    const expected = role === 'admin' ? profiles : profiles.filter(row => row.id === actorId
      || (role === 'business_director' && row.director_id === actorId)
      || (role === 'business_manager' && row.supervisor_staff_id === actorId && row.role === 'business_specialist'));
    assert.deepEqual(selectBusinessOwners(role, actorId, profiles), expected);
  }
  assert.equal(profiles.length, 8);
});
```

- [ ] 为获得明确断言失败，先新建 `worker/src/lib/businessAccessPolicy.js` 的最小占位实现 `export function selectBusinessOwners() { return []; }`，不要接入生产代码。
- [ ] 在 `worker/` 运行 `node --test tests/business-access-policy.test.mjs`。预期总监、经理、专员、管理员和等价性测试失败，原因是返回空数组，而不是环境/导入错误。
- [ ] 记录预期的测试红灯；若是其他错误，先解释原因，不连续尝试修补无关环境。

## 5. Task 3：最小实现并接入原查询

- [ ] 将占位文件替换为以下完整实现：

```javascript
export function selectBusinessOwners(role, actorId, validProfiles) {
  if (role === 'admin') return validProfiles;
  if (!actorId || !['business_director', 'business_manager', 'business_specialist'].includes(role)) return [];
  return validProfiles.filter(row => row.id === actorId
    || (role === 'business_director' && row.director_id === actorId)
    || (role === 'business_manager' && row.supervisor_staff_id === actorId && row.role === 'business_specialist'));
}
```

该函数的输入契约：`validProfiles` 必须由既有 `resolveBusinessHierarchy` 在当前市场校验后产生。函数不接受客户端自报角色作为授权依据，不执行市场筛选，不确认人员是否有效，也不确认客户/工单属于谁；这些检查不可从调用方删除。

- [ ] 在 `businessWorkspace.js` 顶部新增导入：

```javascript
import { selectBusinessOwners } from './businessAccessPolicy.js';
```

- [ ] 仅将 `scope()` 中以下三行替换：

```javascript
  const allowed = role === 'admin' ? valid : valid.filter(row => row.id === actor.id
    || (role === 'business_director' && row.director_id === actor.id)
    || (role === 'business_manager' && row.supervisor_staff_id === actor.id && row.role === 'business_specialist'));
```

替换结果：

```javascript
  const allowed = selectBusinessOwners(role, actor?.id ?? null, valid);
```

- [ ] 不修改紧随其后的地域过滤、范围版本、对象 SQL 约束或组织资料投影。
- [ ] 在 `business-workspace.test.mjs` 现有测试导入附近增加：

```javascript
import './business-access-policy.test.mjs';
```

现有 `service-os-auth.test.mjs` 已导入 `business-workspace.test.mjs`，后者在现有 npm 测试链中执行，因此无需更改依赖或 package 测试脚本。

## 6. Task 4：分层验证

- [ ] 在 `worker/` 运行单元与原接口测试，分别记录结果：

```powershell
node --test tests/business-access-policy.test.mjs
node --test tests/business-workspace.test.mjs
```

预期所有测试通过。新单元测试只证明筛选规则；原接口测试负责覆盖真实身份、市场和对象访问链，两者不能互相替代。

- [ ] 在 `worker/` 运行现有完整 `npm test`，包含 pretest 与评估脚本。预期通过；发现不相关失败也必须记录，不能宣布整体验证通过。
- [ ] 运行 `git diff --check`，检查这四个文件的 diff，不将其他未提交改动算作本批实现。
- [ ] 人工核对：没有放宽管理员或商务权限；没有改掉市场、有效上下级、地域、记录归属和并发范围版本检查；没有新建真实账号、订单或通知。
- [ ] 本批完成时仅报告本地变更及真实测试结果。首批不部署；之后如进入发布，仍要通过项目完整 CI，包括适用前端/Admin 构建和回归。

## 7. 后续批次交接与停止条件

首批通过后，下一批才设计“能力授权 + 共享页面数据适配”：不能把新函数直接接到无范围限制的全量接口上，也不能只把商务菜单放开。

以下情况暂停并更新方案：当前代码已经演进导致替换不等价；需要增加第五个以外文件；发现已有权限漏洞或数据异常；需要安装依赖；需要切分支、提交或操作生产。

本批无迁移、无新 API、无新权限和 UI 改动。成果是可复用且有回归保护的范围基础，不宣称业务改造已经完成。
