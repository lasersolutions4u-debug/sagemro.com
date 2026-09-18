import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { readXlsx, normalizeRows, redRowIndexes } from './xlsx.js';
import { sheetToArticle, xlsxToArticles } from './xlsxToArticles.js';

const FIXTURE = new URL('../../tests/fixtures/sample-parameters.xlsx', import.meta.url);

async function loadFixture() {
  const buffer = readFileSync(FIXTURE);
  return readXlsx(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

test('读取 xlsx：工作表、表头与合并单元格填充', async () => {
  const { sheets } = await loadFixture();
  assert.deepEqual(sheets.map((s) => s.name), ['3000S', '中文 表名']);

  const sheet = sheets[0];
  const rows = normalizeRows(sheet.rows);
  assert.deepEqual(rows[0], ['材料', '厚度[mm]', '速度[m/min]', '功率 [W]', '气体']);
  // 合并单元格 A2:A3 的「碳钢」必须填到第二行，否则读者会以为没有材料
  assert.equal(rows[1][0], '碳钢');
  assert.equal(rows[2][0], '碳钢');
  // 气体列同样是合并的
  assert.equal(rows[1][4], 'N2/Air');
  assert.equal(rows[2][4], 'N2/Air');
  assert.equal(rows[3][4], 'O2');
  assert.equal(rows[4][4], 'O2');
});

test('红标：只认「本身有值且带红样式」的单元格', async () => {
  const { sheets } = await loadFixture();
  const sheet = sheets[0];
  // B4/B5 是真正的红标（有值 + 红字）→ 0 基行号 3、4
  assert.deepEqual([...redRowIndexes(sheet)].sort((a, b) => a - b), [3, 4]);
});

test('红标：空单元格带的红样式属于格式残留，不能算成红标行', async () => {
  const { sheets } = await loadFixture();
  const sheet = sheets[0];
  // A3 是合并续格：本身没有值，却带着红样式。若先做合并填充再判断，
  // 它会把第 3 行误判成红标 —— 那正是我们在这份真实数据上踩到的坑。
  assert.ok(sheet.redCells.has('2,0'), 'fixture 应当包含这个格式残留');
  assert.ok(!sheet.valueCells.has('2,0'), '该格本身没有值');
  assert.ok(!redRowIndexes(sheet).has(2), '不能因为格式残留把第 3 行标成红标');
});

test('每个工作表生成一条条目，标题取表名（含中文表名）', async () => {
  const workbook = await loadFixture();
  const { articles, skipped } = xlsxToArticles(workbook, {
    market: 'com', locale: 'zh-CN', category: 'cutting_parameters', source: 'sample-parameters.xlsx',
  });
  assert.equal(articles.length, 2);
  assert.deepEqual(skipped, []);
  assert.deepEqual(articles.map((a) => a.title), ['3000S', '中文 表名']);
  assert.ok(articles.every((a) => a.status === 'published'), '默认导入即发布');
  assert.ok(articles.every((a) => a.category === 'cutting_parameters'));
  assert.ok(articles.every((a) => a.content.includes('sample-parameters.xlsx')));
});

test('条目正文是 Markdown 表格，且红标行被单独标出', async () => {
  const workbook = await loadFixture();
  const { articles } = xlsxToArticles(workbook, { source: 'f.xlsx' });
  const content = articles[0].content;
  assert.match(content, /\| 材料 \| 厚度\[mm\] \| 速度\[m\/min\] \| 功率 \[W\] \| 气体 \| 标记 \|/);
  assert.match(content, /\| 碳钢 \| 2 \| 3\.8-4\.2 \| 2100 \| O2 \| \*\*红标·打样参数\*\* \|/);
  assert.match(content, /本表有 2 行红标参数/);
  // 非红标行不标
  assert.match(content, /\| 碳钢 \| 1 \| 28-35 \| 3000 \| N2\/Air \| {2}\|/);
});

test('尾部空列不会被渲染成「列N」', async () => {
  const workbook = await loadFixture();
  const { articles } = xlsxToArticles(workbook, { source: 'f.xlsx' });
  assert.doesNotMatch(articles[0].content, /列\d+/);
  assert.doesNotMatch(articles[1].content, /列\d+/);
});

test('没有红标的表不出现「标记」列', async () => {
  const workbook = await loadFixture();
  const { articles } = xlsxToArticles(workbook, { source: 'f.xlsx' });
  const second = articles[1].content;
  assert.doesNotMatch(second, /标记/);
  assert.match(second, /不锈钢/);
});

test('sheetToArticle：只有表头或全空的工作表会被跳过', () => {
  assert.equal(sheetToArticle({ name: '空表', rows: [], redCells: new Set(), valueCells: new Set() }), null);
  assert.equal(sheetToArticle({ name: '只有表头', rows: [['材料', '厚度']], redCells: new Set(), valueCells: new Set() }), null);
  const ok = sheetToArticle({ name: '有数据', rows: [['材料'], ['碳钢']], redCells: new Set(), valueCells: new Set() });
  assert.equal(ok.title, '有数据');
});

test('xlsxToArticles：空工作簿返回空结果而不是抛错', () => {
  assert.deepEqual(xlsxToArticles({ sheets: [] }, {}), { articles: [], skipped: [] });
  assert.deepEqual(xlsxToArticles(null, {}), { articles: [], skipped: [] });
});
