// 把一个 .xlsx 变成知识条目。
//
// 设计取舍（这些决定是为了「效果好」，不是为了少写代码）：
//   * **一个工作表 = 一条条目**。参数表天然按机型/规格分表，这正好是使用者心里的一条知识。
//     不按材料块再拆，是因为普通使用者上传的表不一定有「材料」列，硬拆会猜错。
//   * **合并单元格先填满再渲染**：源表用合并表达「整块共用同一值」，
//     不填会在条目里留一片空白，读者会以为没有数据。
//   * **红标必须保留**：厂商用红色字体表示「打样参数，不推荐大批量生产」。
//     丢了红标，等于把极限参数当成常规推荐给客户。红标行在表里单独标一列。
//   * **首行当表头**，其余当数据行；空表返回 null，由调用方跳过。

import { normalizeRows, redRowIndexes } from './xlsx.js';

const RED_LABEL = '红标·打样参数';

function cellText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** 把网格渲染成 Markdown 表格；redRows 用 0 基行号 */
function toMarkdown(rows, redRows) {
  // 去掉尾部「表头与所有数据行都为空」的列：源文件常留一个空尾列，
  // 渲染出来会变成一个无意义的「列N」，让人以为漏了数据。
  const widthLimit = Math.max(...rows.map((row) => row.length), 1);
  let width = widthLimit;
  while (width > 1 && rows.every((row) => !cellText(row[width - 1]))) width -= 1;

  const header = rows[0] || [];
  const body = rows.slice(1);
  const hasRed = redRows.size > 0;
  const columns = Array.from({ length: width }, (_, i) => cellText(header[i]) || `列${i + 1}`);
  if (hasRed) columns.push('标记');
  const lines = [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
  ];
  body.forEach((row, index) => {
    const cells = Array.from({ length: width }, (_, i) => cellText(row[i]) || '—');
    if (hasRed) cells.push(redRows.has(index + 1) ? `**${RED_LABEL}**` : '');
    lines.push(`| ${cells.join(' | ')} |`);
  });
  return lines.join('\n');
}

/**
 * @param {{name: string, rows: any[][], redCells: Set<string>, valueCells: Set<string>}} sheet
 * @param {{ market: string, locale: string, category: string, source: string }} meta
 * @returns {{ title: string, content: string, redRows: number } | null}
 */
export function sheetToArticle(sheet, meta = {}) {
  const rows = normalizeRows(sheet.rows);
  while (rows.length && rows[0].every((cell) => !cellText(cell))) rows.shift();
  if (rows.length < 2) return null;

  const redRows = redRowIndexes(sheet);
  const redCount = redRows.size;
  const lines = [
    `来源工作表：${sheet.name}`,
    '',
    toMarkdown(rows, redRows),
    '',
  ];
  if (redCount) {
    lines.push(`本表有 ${redCount} 行红标参数：仅适合小批量生产，不推荐大批量生产加工。`);
    lines.push('');
  }
  lines.push('说明：');
  lines.push(`- 本条目由上传的 Excel 自动转换，原始文件：${meta.source || '未记录'}。`);
  lines.push('- 表格参数为参考测试参数，实际批量切割受机床、系统、切割头、气压、材料影响，以现场工艺人员调试为准。');
  lines.push(`- 红标（${RED_LABEL}）表示打样参数，最高速度为极限速度，不建议批量生产使用。`);

  return {
    title: cellText(sheet.name) || '未命名工作表',
    content: lines.join('\n'),
    redRows: redCount,
  };
}

/**
 * @param {{sheets: Array}} workbook readXlsx 的返回值
 * @param {{ market, locale, category, source, riskLevel?, status? }} meta
 */
export function xlsxToArticles(workbook, meta = {}) {
  const articles = [];
  const skipped = [];
  for (const sheet of workbook?.sheets || []) {
    const article = sheetToArticle(sheet, meta);
    if (!article) { skipped.push(sheet.name); continue; }
    articles.push({
      market: meta.market || 'com',
      locale: meta.locale || 'en',
      category: meta.category || 'other',
      title: article.title,
      content: article.content,
      source: meta.source || '',
      applicable_equipment: meta.applicableEquipment || '',
      applicable_brand: meta.applicableBrand || '',
      applicable_model: meta.applicableModel || '',
      risk_level: meta.riskLevel || 'medium',
      status: meta.status || 'published',
      redRows: article.redRows,
    });
  }
  return { articles, skipped };
}
