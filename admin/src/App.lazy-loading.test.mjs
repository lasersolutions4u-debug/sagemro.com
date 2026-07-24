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
  ];

  assert.match(app, /import \{ lazy, Suspense,/);
  assert.match(app, /<Suspense fallback=\{<AdminPageLoading \/>\}>/);
  for (const page of lazyPages) {
    assert.match(app, new RegExp(`const ${page} = lazy\\(\\(\\) => import\\('\\./pages/${page}\\.jsx'\\)`));
    assert.doesNotMatch(app, new RegExp(`import \\{ ${page} \\} from './pages/${page}\\.jsx'`));
  }

  assert.match(app, /import \{ LoginPage \} from '\.\/pages\/LoginPage';/);
});
