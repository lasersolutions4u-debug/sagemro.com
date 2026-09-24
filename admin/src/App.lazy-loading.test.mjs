import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8');

// 后台已裁剪为知识中枢：导航只保留 用户统计 / 注册用户 / 知识库 / 知识候选 / 内部员工账号。
const lazyPages = [
  'DashboardPage',
  'UsersPage',
  'KnowledgePage',
  'KnowledgeCandidatesPage',
  'StaffAccountsPage',
];

test('authenticated admin pages are lazy loaded behind one suspense boundary', () => {
  assert.match(app, /import \{ lazy, Suspense,/);
  assert.match(app, /<Suspense fallback=\{<AdminPageLoading \/>\}>/);
  for (const page of lazyPages) {
    assert.match(app, new RegExp(`const ${page} = lazy\\(\\(\\) => import\\('\\./pages/${page}\\.jsx'\\)`));
    assert.doesNotMatch(app, new RegExp(`import \\{ ${page} \\} from './pages/${page}\\.jsx'`));
  }

  assert.match(app, /import \{ LoginPage \} from '\.\/pages\/LoginPage';/);
});

test('the console no longer ships business, work-order, material, promotion, or rating navigation', () => {
  for (const removed of [
    'WorkOrdersPage',
    'EngineerApplicationsPage',
    'EngineersPage',
    'MaterialsPage',
    'MaterialRequisitionsPage',
    'PromotionAnalyticsPage',
    'RatingsPage',
    'LeadsPage',
    'BusinessWorkspacePage',
    'BusinessRecordsPage',
  ]) {
    assert.doesNotMatch(app, new RegExp(removed), `${removed} must not be imported by the trimmed console`);
  }
  assert.doesNotMatch(app, /businessWorkspace/);
  assert.doesNotMatch(app, /promotionAnalytics/);
});

test('the knowledge console is bilingual and keeps the knowledge entries scoped by role', () => {
  assert.match(app, /knowledge: 'Knowledge Base'/);
  assert.match(app, /knowledge: '知识库'/);
  assert.match(app, /knowledgeCandidates: 'Knowledge Candidates'/);
  assert.match(app, /knowledgeCandidates: '知识候选'/);
  assert.match(app, /staffAccounts: 'Internal Staff'/);
  assert.match(app, /staffAccounts: '内部员工账号'/);
  // 非管理员内部员工只保留知识库维护入口。
  assert.match(app, /user\.staffRole !== 'admin'\) return getNavItems\(t\)\.filter\(\(item\) => item\.key === 'knowledge'\)/);
});
