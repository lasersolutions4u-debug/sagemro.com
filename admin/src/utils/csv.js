// 共享 CSV 工具。
//
// 知识库批量导入与物料批量导入都要解析带引号、带换行的 UTF-8 CSV
// （知识条目的 content 列里就含 Markdown 表格换行），所以两处必须用同一份实现，
// 不能各写一个「看起来差不多」的版本——那种差异只会在某一行数据上爆出来。

export function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** RFC4180 风格解析：支持双引号包裹、单元格内换行与转义引号（""）。 */
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((items) => items.some((item) => item.trim()));
}

/** 去掉 Excel 另存 UTF-8 CSV 时写在开头的 BOM，否则第一列表头会变成 "\uFEFFmarket"。 */
export function stripBom(text) {
  return String(text ?? '').replace(/^\uFEFF/, '');
}
