import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('knowledge page exposes usage rules and makes new article action visible', async () => {
  const source = await readFile(new URL('./KnowledgePage.jsx', import.meta.url), 'utf8');

  assert.match(source, /importText: 'Import'/);
  assert.match(source, /newBlankDraft: 'New blank draft'/);
  assert.match(source, /Knowledge Base usage and rules/);
  assert.match(source, /accept=".md,.markdown,.txt,.csv"/);
  assert.match(source, /FileReader/);
  assert.match(source, /New draft ready/);
  assert.match(source, /titleInputRef\.current\?\.focus/);
  assert.match(source, /candidate_article_managed_by_workflow/);
  assert.match(source, /return to the Knowledge Candidates review desk/i);
  assert.match(source, /请返回知识候选工作台处理/);
});

test('knowledge page offers CSV bulk import that posts to the batch endpoint', async () => {
  const source = await readFile(new URL('./KnowledgePage.jsx', import.meta.url), 'utf8');

  // 入口与文件选择
  assert.match(source, /batchImport: 'Bulk import'/);
  assert.match(source, /batchImport: '批量导入'/);
  assert.match(source, /accept="\.csv,\.xlsx"/);
  assert.match(source, /parseCsvRows/);
  assert.match(source, /stripBom/);

  // 必需列校验：缺列时不许提交
  assert.match(source, /BATCH_REQUIRED_COLUMNS = \['category', 'title', 'content'\]/);

  // 状态选择与发布警告
  assert.match(source, /batchAsDraft: 'Import as draft'/);
  assert.match(source, /batchAsPublished: 'Import and publish \(recommended\)'/);
  assert.match(source, /batchStatus === 'published'/);
  assert.match(source, /batchPublishWarning/);

  // 默认就是「导入并发布」——商务同事上传后应当直接可用
  assert.match(source, /const \[batchStatus, setBatchStatus\] = useState\('published'\)/);
  assert.match(source, /setBatchStatus\('published'\)/);

  // 提供 CSV 模板下载，非技术同事不用自己猜列名
  assert.match(source, /batchTemplate: 'Download CSV template'/);
  assert.match(source, /batchTemplate: '下载 CSV 模板'/);
  assert.match(source, /const downloadBatchTemplate = \(\) => \{/);
  assert.match(source, /sagemro-knowledge-template\.csv/);
  assert.match(source, /onClick=\{downloadBatchTemplate\}/);

  // 逐行失败要能看到行号与原因
  assert.match(source, /t\.batchRowError\(row\.row, row\.error\)/);

  // 未选择文件 / 导入中时不允许提交
  assert.match(source, /disabled=\{!batchArticles\.length \|\| batchBusy\}/);
});

test('bulk import goes through the shared CSV parser and the admin API module', async () => {
  const page = await readFile(new URL('./KnowledgePage.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

  assert.match(page, /import \{ parseCsvRows, stripBom, csvCell \} from '\.\.\/utils\/csv'/);
  assert.doesNotMatch(page, /function parseCsvRows/, '不应再维护第二份 CSV 解析实现');
  assert.match(api, /export async function importAdminKnowledgeBatch\(articles, status\)/);
  assert.match(api, /'\/api\/admin\/knowledge\/batch'/);
});

test('non-admin staff can reach the knowledge base from the sidebar', async () => {
  const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');

  // 后台裁剪为知识中枢后，非 admin 内部员工（商务/运营/仓储/采购）只保留知识库维护入口。
  assert.match(app, /if \(user\.staffRole !== 'admin'\) return getNavItems\(t\)\.filter\(\(item\) => item\.key === 'knowledge'\)/);
  assert.doesNotMatch(app, /BUSINESS_RECORD_NAV_KEYS/);
  assert.doesNotMatch(app, /businessWorkspace/);
});

test('Excel 直传：浏览器端解析，一个工作表一条知识', async () => {
  const source = await readFile(new URL('./KnowledgePage.jsx', import.meta.url), 'utf8');

  // 在浏览器里解析，不把文件传到服务端
  assert.match(source, /import \{ readXlsx \} from '\.\.\/utils\/xlsx'/);
  assert.match(source, /import \{ xlsxToArticles \} from '\.\.\/utils\/xlsxToArticles'/);
  assert.match(source, /const isExcel = \/\\\.xlsx\$\/i\.test\(file\.name\)/);
  assert.match(source, /reader\.readAsArrayBuffer\(file\)/);

  // 工作表数、跳过空表、老浏览器兜底提示都要有
  assert.match(source, /batchSheets: \(count\) =>/);
  assert.match(source, /batchSkippedSheets/);
  assert.match(source, /batchUnsupportedBrowser/);
  assert.match(source, /xlsx_unsupported_browser/);
});
