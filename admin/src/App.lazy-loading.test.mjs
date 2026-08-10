import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8');

test('authenticated admin pages are lazy loaded behind one suspense boundary', () => {
  const lazyPages = [
    'DashboardPage',
    'UsersPage',
    'EngineersPage',
    'WorkOrdersPage',
    'RatingsPage',
    'LeadsPage',
    'EngineerApplicationsPage',
    'MaterialsPage',
    'KnowledgePage',
    'MaterialRequisitionsPage',
    'StaffAccountsPage',
    'PromotionAnalyticsPage',
  ];

  assert.match(app, /import \{ lazy, Suspense,/);
  assert.match(app, /<Suspense fallback=\{<AdminPageLoading \/>\}>/);
  for (const page of lazyPages) {
    assert.match(app, new RegExp(`const ${page} = lazy\\(\\(\\) => import\\('\\./pages/${page}\\.jsx'\\)`));
    assert.doesNotMatch(app, new RegExp(`import \\{ ${page} \\} from './pages/${page}\\.jsx'`));
  }

  assert.match(app, /import \{ LoginPage \} from '\.\/pages\/LoginPage';/);
  assert.match(app, /loadingPage: 'Loading page'/);
  assert.match(app, /loadingPage: '页面加载中'/);
  assert.match(app, /aria-label=\{t\.loadingPage\}/);
});

test('promotion analytics remains one bilingual, role-scoped navigation entry', () => {
  assert.match(app, /promotionAnalytics: 'Promotion Analytics'/);
  assert.match(app, /promotionAnalytics: '推广分析'/);
  assert.match(app, /\{ key: 'dashboard'[\s\S]*\{ key: 'promotionAnalytics'/);
  assert.match(app, /OPERATIONS_NAV_KEYS[\s\S]*'promotionAnalytics'/);
  assert.match(app, /case 'promotionAnalytics': return <PromotionAnalyticsPage \/>;/);
  assert.doesNotMatch(app, /key: 'promotionOverview'/);
  assert.doesNotMatch(app, /key: 'promotionChannels'/);
});
