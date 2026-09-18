// 浏览器端 .xlsx 读取器：把 Excel 变成「可以变成知识条目的表格」。
//
// 为什么不用现成库
// ----------------
// 我们需要两样标准库拿不到的东西：
//   1. **合并单元格** —— 参数表的材料列是跨行合并的，空白格不代表「没有值」。
//      不处理就会把参数张冠李戴（我们在这份数据上已经踩过一次）。
//   2. **字体颜色** —— 红色字体是厂商约定：「打样参数，不推荐大批量生产」。
//      SheetJS 社区版读不到颜色（那是收费功能），丢了红标等于把极限参数当常规推荐给客户。
//
// .xlsx 本质是一个 ZIP + 若干 XML。浏览器自带解压（DecompressionStream）和 XML 能力，
// 所以这里不引入任何依赖，自己解压 + 自己解析，两样信息都拿得到。
//
// 依赖的浏览器能力：DecompressionStream('deflate-raw')（Chrome 103+ / Safari 16.4+ / Firefox 113+）。

const textDecoder = new TextDecoder('utf-8');

/* ------------------------------------------------------------------ ZIP */

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('xlsx_unsupported_browser');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 解析 ZIP 的中央目录，返回 { 文件名: {method, offset, size} } */
function readZipEntries(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // 从尾部向前找 End of Central Directory 签名 0x06054b50
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('xlsx_not_a_zip');
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries = {};
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('xlsx_bad_central_directory');
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = textDecoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries[name] = { method, compressedSize, localOffset };
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipFile(buffer, entries, name) {
  const entry = entries[name];
  if (!entry) return null;
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // 本地文件头：文件名与扩展字段长度可能与中央目录不同，必须重新读
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const raw = bytes.subarray(start, start + entry.compressedSize);
  const out = entry.method === 0 ? raw : await inflateRaw(raw);
  return textDecoder.decode(out);
}

/* ------------------------------------------------------------------ XML */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, body) ? ENTITIES[body] : match;
  });
}

/**
 * 极小的 XML 扫描器：只做我们要的三件事——按标签名取元素、读属性、取文本。
 * xlsx 内部 XML 是机器生成的，结构规整，不需要完整的 XML 解析器，
 * 也因此这段代码在浏览器和 Node 里行为完全一致（便于单元测试）。
 */
function eachElement(xml, tagName, visit) {
  const open = new RegExp(`<${tagName}(\\s[^>]*?)?(/?)>`, 'g');
  let match;
  while ((match = open.exec(xml)) !== null) {
    const attrs = parseAttrs(match[1] || '');
    if (match[2] === '/') { visit(attrs, ''); continue; }
    const close = xml.indexOf(`</${tagName}>`, open.lastIndex);
    const inner = close === -1 ? '' : xml.slice(open.lastIndex, close);
    visit(attrs, inner);
    if (close !== -1) open.lastIndex = close + tagName.length + 3;
  }
}

function parseAttrs(text) {
  const attrs = {};
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = re.exec(text)) !== null) attrs[match[1]] = decodeEntities(match[2]);
  return attrs;
}

function elementText(xml, tagName) {
  let value = '';
  eachElement(xml, tagName, (_attrs, inner) => { if (!value) value = inner; });
  return value;
}

/* --------------------------------------------------------------- 单元格 */

function columnIndex(ref) {
  const letters = /^([A-Z]+)/.exec(ref || '');
  if (!letters) return -1;
  let index = 0;
  for (const ch of letters[1]) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

function rowIndex(ref) {
  const digits = /(\d+)$/.exec(ref || '');
  return digits ? Number(digits[1]) - 1 : -1;
}

/** 富文本单元格：可能由多个 <t> 片段组成（内联字符串走这条路） */
function richText(xml) {
  let text = '';
  eachElement(xml, 't', (_attrs, run) => { text += decodeEntities(run); });
  return text;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  eachElement(xml, 'si', (_attrs, inner) => { out.push(richText(inner)); });
  return out;
}

/** 返回每个样式索引对应的字体颜色（形如 FFFF0000），用于识别红标 */
function parseRedStyles(xml) {
  if (!xml) return new Set();
  const section = /<fonts[\s>][\s\S]*?<\/fonts>/.exec(xml);
  if (!section) return new Set();
  const redFonts = new Set();
  let fontIndex = -1;
  eachElement(section[0], 'font', (_attrs, inner) => {
    fontIndex += 1;
    const color = /<color\b[^>]*\brgb="([0-9A-Fa-f]{8})"/.exec(inner);
    if (color && color[1].toUpperCase().endsWith('FF0000')) redFonts.add(fontIndex);
  });
  const cellXfs = /<cellXfs[\s>][\s\S]*?<\/cellXfs>/.exec(xml);
  const redStyleIndexes = new Set();
  if (cellXfs) {
    let styleIndex = -1;
    eachElement(cellXfs[0], 'xf', (attrs) => {
      styleIndex += 1;
      if (redFonts.has(Number(attrs.fontId))) redStyleIndexes.add(styleIndex);
    });
  }
  return redStyleIndexes;
}

function parseSheet(xml, sharedStrings, redStyleIndexes) {
  const rows = [];
  const redCells = new Set();
  // 只记录「本身在 XML 里就有值」的格。红标判定必须用它，不能用合并填充后的网格：
  // 参数表里存在**空单元格带红样式**的格式残留（实测 4000S 第 38 行），
  // 一旦先做合并填充，这些空格式就会被当成红标行，把参数误标成「不推荐批量生产」。
  const valueCells = new Set();
  const merges = [];
  const sheetData = /<sheetData[\s>][\s\S]*?<\/sheetData>/.exec(xml);
  if (sheetData) {
    eachElement(sheetData[0], 'row', (_rowAttrs, rowInner) => {
      eachElement(rowInner, 'c', (attrs, cellInner) => {
        const col = columnIndex(attrs.r);
        const row = rowIndex(attrs.r);
        if (col < 0 || row < 0) return;
        let value = '';
        if (attrs.t === 's') {
          value = sharedStrings[Number(elementText(cellInner, 'v'))] ?? '';
        } else if (attrs.t === 'inlineStr' || /<is[\s>]/.test(cellInner)) {
          // openpyxl 等实现会把字符串直接内联进工作表 XML；中文常以 &#26448; 这类
          // 数字字符引用出现，必须解码，否则条目里全是 &#26448;&#26009;。
          value = richText(cellInner);
        } else {
          value = decodeEntities(elementText(cellInner, 'v'));
        }
        if (!rows[row]) rows[row] = [];
        rows[row][col] = value;
        if (String(value).trim()) valueCells.add(`${row},${col}`);
        if (redStyleIndexes.has(Number(attrs.s))) redCells.add(`${row},${col}`);
      });
    });
  }
  const mergeSection = /<mergeCells[\s>][\s\S]*?<\/mergeCells>/.exec(xml);
  if (mergeSection) {
    eachElement(mergeSection[0], 'mergeCell', (attrs) => {
      const [from, to] = String(attrs.ref || '').split(':');
      if (!from || !to) return;
      merges.push({
        top: rowIndex(from), left: columnIndex(from),
        bottom: rowIndex(to), right: columnIndex(to),
      });
    });
  }
  return { rows, redCells, valueCells, merges };
}

/* ---------------------------------------------------------------- 对外 */

/**
 * 读一个 .xlsx，返回每个工作表：
 *   { name, rows, redCells, merges }
 * 其中 rows 已经把**合并单元格**向下/向右填满——源表用合并表达「整块共用同一值」，
 * 空格不等于没有值。
 */
export async function readXlsx(buffer) {
  const entries = readZipEntries(buffer);
  const [sharedXml, stylesXml, workbookXml, relsXml] = await Promise.all([
    readZipFile(buffer, entries, 'xl/sharedStrings.xml'),
    readZipFile(buffer, entries, 'xl/styles.xml'),
    readZipFile(buffer, entries, 'xl/workbook.xml'),
    readZipFile(buffer, entries, 'xl/_rels/workbook.xml.rels'),
  ]);
  const sharedStrings = parseSharedStrings(sharedXml);
  const redStyleIndexes = parseRedStyles(stylesXml);

  const relTargets = {};
  if (relsXml) {
    eachElement(relsXml, 'Relationship', (attrs) => { relTargets[attrs.Id] = attrs.Target; });
  }
  const sheets = [];
  if (workbookXml) {
    for (const attrs of (() => {
      const out = [];
      const section = /<sheets[\s>][\s\S]*?<\/sheets>/.exec(workbookXml);
      if (section) eachElement(section[0], 'sheet', (a) => out.push(a));
      return out;
    })()) {
      const target = String(relTargets[attrs['r:id']] || '').replace(/^\//, '');
      const path = target.startsWith('xl/') ? target : `xl/${target}`;
      const xml = await readZipFile(buffer, entries, path);
      if (!xml) continue;
      const parsed = parseSheet(xml, sharedStrings, redStyleIndexes);
      fillMerges(parsed);
      sheets.push({ name: attrs.name || path, ...parsed });
    }
  }
  return { sheets };
}

/** 把合并区域的值填满整个区域（源表的「整块共用同一值」约定） */
function fillMerges(sheet) {
  for (const merge of sheet.merges) {
    const source = (sheet.rows[merge.top] || [])[merge.left] ?? '';
    if (!source) continue;
    for (let row = merge.top; row <= merge.bottom; row += 1) {
      if (!sheet.rows[row]) sheet.rows[row] = [];
      for (let col = merge.left; col <= merge.right; col += 1) {
        if (!sheet.rows[row][col]) sheet.rows[row][col] = source;
      }
    }
  }
}

/** 把网格裁成规整的二维数组（去掉尾部空行空列） */
export function normalizeRows(rows) {
  const out = [];
  for (const row of rows) {
    if (!row) { out.push([]); continue; }
    const trimmed = [];
    for (let i = 0; i < row.length; i += 1) trimmed[i] = row[i] ?? '';
    out.push(trimmed);
  }
  while (out.length && out[out.length - 1].every((cell) => !String(cell).trim())) out.pop();
  return out;
}

/**
 * 红标行：该行存在「本身有值 且 带红字样式」的单元格。
 * 必须用 valueCells 而不是合并填充后的网格 —— 空单元格会残留红样式。
 */
export function redRowIndexes(sheet) {
  const rows = new Set();
  for (const key of sheet.redCells) {
    if (!sheet.valueCells.has(key)) continue;
    rows.add(Number(key.split(',')[0]));
  }
  return rows;
}
