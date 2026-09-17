import assert from 'node:assert/strict';
import test from 'node:test';

import { csvCell, parseCsvRows, stripBom } from './csv.js';

test('解析普通 CSV', () => {
  const rows = parseCsvRows('a,b\n1,2\n3,4');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2'], ['3', '4']]);
});

test('引号内的逗号不会被当成分隔符', () => {
  const rows = parseCsvRows('title,content\n"含,逗号的标题",正文');
  assert.deepEqual(rows[1], ['含,逗号的标题', '正文']);
});

test('引号内的换行会保留在同一个单元格里（知识条目正文含表格换行）', () => {
  const rows = parseCsvRows('title,content\n"标题","第一行\n第二行"');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], '第一行\n第二行');
});

test('转义双引号 "" 还原为一个引号', () => {
  const rows = parseCsvRows('a\n"他说""你好"""');
  assert.equal(rows[1][0], '他说"你好"');
});

test('CRLF 与空行处理', () => {
  const rows = parseCsvRows('a,b\r\n1,2\r\n\r\n3,4\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2'], ['3', '4']]);
});

test('去除 Excel 写入的 BOM', () => {
  assert.equal(stripBom('\uFEFFmarket'), 'market');
  assert.deepEqual(parseCsvRows(stripBom('\uFEFFmarket,title\ncom,t'))[0], ['market', 'title']);
});

test('csvCell 只在必要时加引号，并正确转义', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(null), '');
});

test('写出再读回是等价的（往返测试）', () => {
  const rows = [
    ['title', 'content'],
    ['6000W 碳钢切割参数（O2）', '| 厚度 | 速度 |\n| --- | --- |\n| 3 | 3.6-4.2 |'],
    ['含,逗号', '含"引号"'],
  ];
  const text = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  assert.deepEqual(parseCsvRows(text), rows);
});
