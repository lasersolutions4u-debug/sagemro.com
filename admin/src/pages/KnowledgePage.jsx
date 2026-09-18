import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileUp, FileText, HelpCircle, Plus, Search, Upload, X, XCircle } from 'lucide-react';
import {
  createAdminKnowledge,
  getAdminKnowledge,
  importAdminKnowledgeBatch,
  updateAdminKnowledge,
} from '../services/api';
import { runtimeConfig } from '../config/runtime';
import { useAdminLocale } from '../config/locale';
import { parseCsvRows, stripBom, csvCell } from '../utils/csv';
import { readXlsx } from '../utils/xlsx';
import { xlsxToArticles } from '../utils/xlsxToArticles';

const CATEGORIES = [
  'fault',
  'cutting_parameters',
  'parts',
  'maintenance',
  'machine_selection',
  'health',
  'safety',
  'other',
];

const STATUSES = ['draft', 'published', 'archived'];

const EMPTY_FORM = {
  market: '',
  locale: '',
  category: 'fault',
  title: '',
  content: '',
  source: '',
  applicable_equipment: '',
  applicable_brand: '',
  applicable_model: '',
  risk_level: 'medium',
  status: 'draft',
};

// 批量导入 CSV 的列约定。前三列是必需项，其余可选。
const BATCH_REQUIRED_COLUMNS = ['category', 'title', 'content'];
const BATCH_COLUMNS = [
  'market', 'locale', 'category', 'title', 'content', 'source',
  'applicable_equipment', 'applicable_brand', 'applicable_model', 'risk_level', 'status',
];

const TEXT = {
  en: {
    title: 'Knowledge Base',
    subtitle: 'Review manuals, repair notes, parameter sheets, and external references before they are available in service conversations.',
    search: 'Search title, content, equipment, brand, or model',
    all: 'All',
    newArticle: 'New article',
    newBlankDraft: 'New blank draft',
    importText: 'Import',
    usageRules: 'Rules',
    close: 'Close',
    saveDraft: 'Save draft',
    update: 'Update article',
    publish: 'Publish',
    loading: 'Loading...',
    empty: 'No knowledge articles yet',
    total: (count) => `${count} articles`,
    formTitle: 'Article editor',
    source: 'Source',
    scope: 'Scope',
    status: 'Status',
    category: 'Category',
    titleLabel: 'Title',
    content: 'Knowledge content',
    equipment: 'Equipment',
    brand: 'Brand',
    model: 'Model',
    risk: 'Risk level',
    saved: 'Knowledge article saved.',
    newDraftReady: 'New draft ready. Fill the title and content in the editor.',
    imported: (name) => `Imported ${name} as a draft. Review before saving or publishing.`,
    importFailed: 'Import failed. Please use a UTF-8 text, Markdown, or CSV file.',
    batchImport: 'Bulk import',
    batchTitle: 'Bulk import from CSV',
    batchSubtitle: 'Upload a CSV (one row per article) or an Excel workbook (one worksheet per article). Nothing is written until you press Start import.',
    batchPick: 'Choose CSV or Excel file',
    batchNoFile: 'No file selected yet.',
    batchRows: (count) => `${count} rows detected`,
    batchSheets: (count) => `${count} worksheets → ${count} articles`,
    batchSkippedSheets: (names) => `Skipped worksheets without data: ${names}`,
    batchNoSheets: 'No worksheet with data was found in this file.',
    batchUnsupportedBrowser: 'This browser cannot unpack .xlsx. Use a newer Chrome / Edge / Safari, or save the file as CSV.',
    batchMissingColumns: (columns) => `Missing required columns: ${columns}`,
    batchAsDraft: 'Import as draft',
    batchAsPublished: 'Import and publish (recommended)',
    batchPublishWarning: 'Published articles become retrievable by AI immediately. Make sure the content has been checked.',
    batchTemplate: 'Download CSV template',
    batchStart: 'Start import',
    batchRunning: 'Importing...',
    batchDone: (result) => `Imported ${result.imported}, skipped ${result.skipped} duplicate(s), failed ${result.failed}.`,
    batchRowError: (row, error) => `Row ${row}: ${error}`,
    batchSkipped: 'Skipped: duplicate title',
    batchReadFailed: 'Could not read the file. Please use a UTF-8 encoded CSV file.',
    failed: 'Operation failed: ',
    candidateManaged: 'This candidate-derived article is managed by workflow. Please return to the Knowledge Candidates review desk; publishing is not available in the current phase.',
    categoryLabels: {
      fault: 'Equipment fault',
      cutting_parameters: 'Cutting parameters',
      parts: 'Parts & accessories',
      maintenance: 'Maintenance',
      machine_selection: 'Machine selection',
      health: 'Equipment health',
      safety: 'Safety',
      other: 'Other',
    },
    statusLabels: {
      draft: 'Draft',
      published: 'Published',
      archived: 'Archived',
    },
    usage: {
      title: 'Knowledge Base usage and rules',
      intro: 'Only reviewed and published material is available in service conversations. Use this library for manuals, repair notes, parameter sheets, and verified service references.',
      stepsTitle: 'Daily workflow',
      steps: [
        'Click New article, then fill title, category, source, applicable equipment, brand, model, risk level, and knowledge content.',
        'Use draft while editing or waiting for review. Draft and archived articles are not used by AI.',
        'Use published only after a person has checked the content. Published articles may be retrieved by AI in customer or service conversations.',
      ],
      templateTitle: 'Recommended content structure',
      template: [
        'Symptom or topic',
        'Applicable scope',
        'Known facts or parameters',
        'Recommended checks or handling steps',
        'Risk and escalation rules',
        'What AI must not promise',
      ],
      rulesTitle: 'Publishing rules',
      rules: [
        'Do not publish unverified web content, guessed parameters, prices, certifications, lead time, or compatibility claims.',
        'For safety, diagnosis, quote, and parts compatibility, AI can reference the knowledge but final confirmation must remain human-reviewed.',
        'Always record the source, such as manual name, supplier document, URL, file version, page, or internal service note.',
      ],
      uploadTitle: 'Manuals, specs, and parameter sheets',
      upload: 'You can import converted .md, .markdown, .txt, or .csv files into the editor as a draft. PDF, Word, and Excel source files should first be converted into Markdown or structured text. Large files should be split into smaller articles by equipment, fault, part, or parameter topic.',
    },
  },
  'zh-CN': {
    title: '知识库管理',
    subtitle: '说明书、维修记录、参数资料和外部参考资料经审核发布后，才可用于服务对话。',
    search: '搜索标题、内容、设备、品牌或型号',
    all: '全部',
    newArticle: '新建条目',
    newBlankDraft: '新建空白草稿',
    importText: '导入',
    usageRules: '规则',
    close: '关闭',
    saveDraft: '保存草稿',
    update: '更新条目',
    publish: '发布',
    loading: '加载中...',
    empty: '暂无知识条目',
    total: (count) => `共 ${count} 条`,
    formTitle: '知识条目编辑',
    source: '来源',
    scope: '适用范围',
    status: '状态',
    category: '分类',
    titleLabel: '标题',
    content: '知识内容',
    equipment: '设备',
    brand: '品牌',
    model: '型号',
    risk: '风险等级',
    saved: '知识条目已保存。',
    newDraftReady: '已进入新建草稿模式，请填写标题和知识内容。',
    imported: (name) => `已将 ${name} 导入为草稿，请审核后再保存或发布。`,
    importFailed: '导入失败。请使用 UTF-8 编码的文本、Markdown 或 CSV 文件。',
    batchImport: '批量导入',
    batchTitle: 'CSV 批量导入',
    batchSubtitle: '可以上传 CSV（一行一条知识）或 Excel（一个工作表一条知识）。点击开始导入前不会写入任何数据。',
    batchPick: '选择 CSV 或 Excel 文件',
    batchNoFile: '尚未选择文件。',
    batchRows: (count) => `识别到 ${count} 行数据`,
    batchSheets: (count) => `${count} 个工作表 → ${count} 条知识`,
    batchSkippedSheets: (names) => `已跳过没有数据的工作表：${names}`,
    batchNoSheets: '这个文件里没有找到含数据的工作表。',
    batchUnsupportedBrowser: '当前浏览器无法解析 .xlsx。请使用较新的 Chrome / Edge / Safari，或把文件另存为 CSV。',
    batchMissingColumns: (columns) => `缺少必需列：${columns}`,
    batchAsDraft: '导入为草稿',
    batchAsPublished: '导入并发布（推荐）',
    batchPublishWarning: '直接发布后 AI 立即可检索到这些内容，请确认已核对无误。',
    batchTemplate: '下载 CSV 模板',
    batchStart: '开始导入',
    batchRunning: '导入中...',
    batchDone: (result) => `成功 ${result.imported} 条，跳过重复 ${result.skipped} 条，失败 ${result.failed} 条。`,
    batchRowError: (row, error) => `第 ${row} 行：${error}`,
    batchSkipped: '已跳过：标题重复',
    batchReadFailed: '文件读取失败，请使用 UTF-8 编码的 CSV 文件。',
    failed: '操作失败：',
    candidateManaged: '该候选文章由工作流管理。请返回知识候选工作台处理，当前阶段不能发布。',
    categoryLabels: {
      fault: '设备故障',
      cutting_parameters: '切割参数',
      parts: '配件',
      maintenance: '维护保养',
      machine_selection: '选型',
      health: '设备健康',
      safety: '安全',
      other: '其他',
    },
    statusLabels: {
      draft: '草稿',
      published: '已发布',
      archived: '已归档',
    },
    usage: {
      title: '知识库使用方法和发布规则',
      intro: '只有经过人工审核并发布的知识，AI 才能调用。这里用于沉淀说明书、维修经验、参数表、规格表和售后处理规则。',
      stepsTitle: '日常操作流程',
      steps: [
        '点击新建条目，填写标题、分类、来源、适用设备、品牌、型号、风险等级和知识内容。',
        '还在整理或等待审核时使用 draft。draft 和 archived 状态不会被 AI 使用。',
        '人工确认无误后再发布为 published。published 内容才可能被 AI 在客户或售后对话中检索引用。',
      ],
      templateTitle: '推荐内容结构',
      template: [
        '问题现象或主题',
        '适用范围',
        '已确认事实或参数',
        '建议检查项或处理步骤',
        '风险与升级规则',
        'AI 不允许承诺的内容',
      ],
      rulesTitle: '发布规则',
      rules: [
        '不要发布未核实的网页内容，不要编造参数、价格、认证、交期、库存或兼容性结论。',
        '涉及安全、诊断、报价、配件兼容性时，AI 只能参考知识库，最终仍需人工确认。',
        '必须记录来源，例如说明书名称、供应商资料、网页链接、文件版本、页码或内部售后记录。',
      ],
      uploadTitle: '手册、规格表、参数表',
      upload: '现在可以把已转换好的 .md、.markdown、.txt、.csv 文件导入编辑器并生成草稿。PDF、Word、Excel 原文件建议先转换成 Markdown 或结构化文本。大文件建议按设备、故障、配件或参数主题拆成多个小条目。',
    },
  },
};

export function KnowledgePage() {
  const locale = useAdminLocale();
  const t = TEXT[locale] || TEXT.en;
  const defaultMarket = runtimeConfig.market;
  const defaultLocale = runtimeConfig.market === 'cn' ? 'zh-CN' : 'en';
  const [data, setData] = useState({ total: 0, list: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'all', category: 'all', search: '' });
  const [form, setForm] = useState({ ...EMPTY_FORM, market: defaultMarket, locale: defaultLocale });
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [batchArticles, setBatchArticles] = useState([]);
  const [batchIsExcel, setBatchIsExcel] = useState(false);
  const [batchSkippedSheets, setBatchSkippedSheets] = useState([]);
  const [batchStatus, setBatchStatus] = useState('published');
  const [batchResult, setBatchResult] = useState(null);
  const [batchError, setBatchError] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);
  const titleInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const pageSize = 50;

  const queryFilters = useMemo(() => ({
    market: defaultMarket,
    status: filters.status,
    category: filters.category,
    search: filters.search,
  }), [defaultMarket, filters]);

  const load = () => {
    setLoading(true);
    getAdminKnowledge(1, pageSize, queryFilters)
      .then(setData)
      .catch((error) => setMessage(t.failed + error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [queryFilters]);

  const resetForm = () => {
    setSelectedId('');
    setForm({ ...EMPTY_FORM, market: defaultMarket, locale: defaultLocale });
    setMessage(t.newDraftReady);
    window.setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const titleFromFilename = (filename) => filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();

  const importTextFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setSelectedId('');
      setForm({
        ...EMPTY_FORM,
        market: defaultMarket,
        locale: defaultLocale,
        title: titleFromFilename(file.name),
        content,
        source: file.name,
      });
      setMessage(t.imported(file.name));
      window.setTimeout(() => titleInputRef.current?.focus(), 0);
    };
    reader.onerror = () => setMessage(t.importFailed);
    reader.readAsText(file, 'UTF-8');
  };

  const resetBatch = () => {
    setBatchName('');
    setBatchArticles([]);
    setBatchIsExcel(false);
    setBatchSkippedSheets([]);
    setBatchResult(null);
    setBatchError('');
    setBatchStatus('published');
  };

  const readBatchFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const isExcel = /\.xlsx$/i.test(file.name);
    setBatchName(file.name);
    setBatchIsExcel(isExcel);
    setBatchResult(null);
    setBatchSkippedSheets([]);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (isExcel) {
          // Excel：一个工作表 = 一条知识。合并单元格与红字标记在浏览器端解析，
          // 不把文件传到服务端，也不引入第三方解析库。
          const workbook = await readXlsx(reader.result);
          const { articles, skipped } = xlsxToArticles(workbook, {
            market: defaultMarket,
            locale: defaultLocale,
            category: 'cutting_parameters',
            source: file.name,
            status: batchStatus,
          });
          setBatchArticles(articles);
          setBatchSkippedSheets(skipped);
          setBatchError(articles.length ? '' : t.batchNoSheets);
          return;
        }
        const rows = parseCsvRows(stripBom(String(reader.result || '')));
        if (!rows.length) {
          setBatchArticles([]);
          setBatchError(t.batchReadFailed);
          return;
        }
        const headers = rows[0].map((header) => header.trim());
        const missing = BATCH_REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
        if (missing.length) {
          setBatchArticles([]);
          setBatchError(t.batchMissingColumns(missing.join(', ')));
          return;
        }
        const articles = rows.slice(1).map((cells) => {
          const row = {};
          headers.forEach((header, index) => {
            if (BATCH_COLUMNS.includes(header)) row[header] = (cells[index] ?? '').trim();
          });
          return row;
        });
        setBatchArticles(articles);
        setBatchError('');
      } catch (error) {
        setBatchArticles([]);
        setBatchError(error?.message === 'xlsx_unsupported_browser' ? t.batchUnsupportedBrowser : t.batchReadFailed);
      }
    };
    reader.onerror = () => setBatchError(t.batchReadFailed);
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, 'UTF-8');
  };

  const downloadBatchTemplate = () => {
    const sample = {
      market: defaultMarket,
      locale: defaultLocale,
      category: 'cutting_parameters',
      title: '示例：6000W 碳钢切割参数（O2）—— 请整行替换或删除',
      content: '| 厚度(mm) | 速度(m/min) |\n| --- | --- |\n| 3 | 3.6-4.2 |',
      source: '厂商手册 第3章',
      applicable_equipment: '光纤激光切割机',
      applicable_brand: '',
      applicable_model: '6000W',
      risk_level: 'medium',
      status: 'published',
    };
    const rows = [BATCH_COLUMNS, BATCH_COLUMNS.map((column) => sample[column] ?? '')];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sagemro-knowledge-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const runBatchImport = async () => {
    if (!batchArticles.length) return;
    setBatchBusy(true);
    setBatchError('');
    try {
      const result = await importAdminKnowledgeBatch(batchArticles, batchStatus);
      setBatchResult(result);
      load();
    } catch (error) {
      setBatchError(t.failed + error.message);
    } finally {
      setBatchBusy(false);
    }
  };

  const editArticle = (article) => {
    setSelectedId(article.id);
    setForm({
      market: article.market || defaultMarket,
      locale: article.locale || defaultLocale,
      category: article.category || 'fault',
      title: article.title || '',
      content: article.content || '',
      source: article.source || '',
      applicable_equipment: article.applicable_equipment || '',
      applicable_brand: article.applicable_brand || '',
      applicable_model: article.applicable_model || '',
      risk_level: article.risk_level || 'medium',
      status: article.status || 'draft',
    });
    setMessage('');
  };

  const save = async (nextStatus = form.status) => {
    setSaving(true);
    setMessage('');
    const payload = { ...form, status: nextStatus };
    try {
      const result = selectedId
        ? await updateAdminKnowledge(selectedId, payload)
        : await createAdminKnowledge(payload);
      setSelectedId(result.article.id);
      setForm((prev) => ({ ...prev, status: result.article.status }));
      setMessage(t.saved);
      load();
    } catch (error) {
      setMessage(error.message === 'candidate_article_managed_by_workflow' ? t.candidateManaged : t.failed + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">{t.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-nowrap lg:justify-end">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt,.csv"
            onChange={importTextFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
          >
            <FileUp size={16} />
            {t.importText}
          </button>
          <button
            type="button"
            onClick={() => { resetBatch(); setBatchOpen(true); }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
          >
            <Upload size={16} />
            {t.batchImport}
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
          >
            <HelpCircle size={16} />
            {t.usageRules}
          </button>
        </div>
      </div>

      {batchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div role="dialog" aria-modal="true" aria-labelledby="knowledge-batch-title" className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
              <div>
                <h3 id="knowledge-batch-title" className="text-base font-semibold">{t.batchTitle}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{t.batchSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setBatchOpen(false)}
                aria-label={t.close}
                className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-4 px-5 py-5 text-sm leading-6">
              <input ref={batchInputRef} type="file" accept=".csv,.xlsx" onChange={readBatchFile} className="hidden" />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => batchInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
                >
                  <Upload size={16} />
                  {t.batchPick}
                </button>
                <span className="text-[var(--color-text-secondary)]">
                  {batchName
                    ? `${batchName} · ${batchIsExcel ? t.batchSheets(batchArticles.length) : t.batchRows(batchArticles.length)}`
                    : t.batchNoFile}
                </span>
                <button
                  type="button"
                  onClick={downloadBatchTemplate}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
                >
                  <FileText size={16} />
                  {t.batchTemplate}
                </button>
              </div>

              {batchSkippedSheets.length > 0 && (
                <div className="text-[var(--color-text-muted)]">{t.batchSkippedSheets(batchSkippedSheets.join('、'))}</div>
              )}

              {batchError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{batchError}</span>
                </div>
              )}

              <fieldset className="grid gap-2">
                <legend className="mb-1 text-[var(--color-text-secondary)]">{t.status}</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="knowledge-batch-status"
                    checked={batchStatus === 'published'}
                    onChange={() => setBatchStatus('published')}
                  />
                  {t.batchAsPublished}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="knowledge-batch-status"
                    checked={batchStatus === 'draft'}
                    onChange={() => setBatchStatus('draft')}
                  />
                  {t.batchAsDraft}
                </label>
              </fieldset>

              {batchStatus === 'published' && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-300">
                  {t.batchPublishWarning}
                </div>
              )}

              {batchResult && (
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2">
                    <CheckCircle2 size={16} className="shrink-0 text-green-400" />
                    <span>{t.batchDone(batchResult)}</span>
                  </div>
                  {(batchResult.results || []).some((row) => !row.ok) && (
                    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] px-3 py-2 text-[var(--color-text-secondary)]">
                      {(batchResult.results || []).filter((row) => !row.ok).map((row) => (
                        <li key={`batch-failed-${row.row}`}>{t.batchRowError(row.row, row.error)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBatchOpen(false)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
                >
                  {t.close}
                </button>
                <button
                  type="button"
                  onClick={runBatchImport}
                  disabled={!batchArticles.length || batchBusy}
                  className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {batchBusy ? t.batchRunning : t.batchStart}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div role="dialog" aria-modal="true" aria-labelledby="knowledge-help-title" className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
              <div>
                <h3 id="knowledge-help-title" className="text-base font-semibold">{t.usage.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{t.usage.intro}</p>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label={t.close}
                className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-5 px-5 py-5 text-sm leading-6 text-[var(--color-text-secondary)]">
              <section>
                <h4 className="mb-2 font-medium text-[var(--color-text)]">{t.usage.stepsTitle}</h4>
                <ol className="list-decimal space-y-1 pl-5">
                  {t.usage.steps.map((item) => <li key={item}>{item}</li>)}
                </ol>
              </section>
              <section>
                <h4 className="mb-2 font-medium text-[var(--color-text)]">{t.usage.templateTitle}</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {t.usage.template.map((item) => (
                    <div key={item} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h4 className="mb-2 font-medium text-[var(--color-text)]">{t.usage.rulesTitle}</h4>
                <ul className="list-disc space-y-1 pl-5">
                  {t.usage.rules.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
              <section className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-4 py-3">
                <h4 className="mb-1 font-medium text-[var(--color-text)]">{t.usage.uploadTitle}</h4>
                <p>{t.usage.upload}</p>
              </section>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-[var(--color-text-muted)]" size={16} />
              <input
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder={t.search}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <select
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm lg:w-44"
            >
              <option value="all">{t.all}</option>
              {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm lg:w-36"
            >
              <option value="all">{t.all}</option>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            </div>
          </div>

          <div className="mb-2 text-xs text-[var(--color-text-muted)]">{t.total(data.total)}</div>
          {loading ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loading}</div>
          ) : data.list.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-12 text-center text-sm text-[var(--color-text-muted)]">{t.empty}</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <tbody>
                  {data.list.map((article) => (
                    <tr
                      key={article.id}
                      onClick={() => editArticle(article)}
                      className={`cursor-pointer border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-elevated)] ${
                        selectedId === article.id ? 'bg-[var(--color-primary)]/10' : ''
                      }`}
                    >
                      <td className="w-10 px-3 py-4 align-top text-[var(--color-text-muted)]">
                        <FileText size={17} />
                      </td>
                      <td className="px-2 py-4">
                        <div className="font-medium text-[var(--color-text-primary)]">{article.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]">{article.content}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--color-text-secondary)]">
                          <span>{article.category}</span>
                          <span>{article.locale}</span>
                          <span>v{article.version}</span>
                          {article.applicable_brand && <span>{article.applicable_brand}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top text-right">
                        <span className={`rounded px-2 py-1 text-xs ${
                          article.status === 'published'
                            ? 'bg-green-500/10 text-green-400'
                            : article.status === 'archived'
                              ? 'bg-gray-500/10 text-gray-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {article.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={17} className="text-[var(--color-primary)]" />
              <h3 className="font-medium">{t.formTitle}</h3>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
            >
              <Plus size={13} />
              {t.newBlankDraft}
            </button>
          </div>
          <div className="grid gap-3">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.category}
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.status}
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.titleLabel}
              <input ref={titleInputRef} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.content}
              <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={8} className="mt-1 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm leading-6" />
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.source}
              <input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <input placeholder={t.equipment} value={form.applicable_equipment} onChange={(event) => setForm({ ...form, applicable_equipment: event.target.value })} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
              <input placeholder={t.brand} value={form.applicable_brand} onChange={(event) => setForm({ ...form, applicable_brand: event.target.value })} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
              <input placeholder={t.model} value={form.applicable_model} onChange={(event) => setForm({ ...form, applicable_model: event.target.value })} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
            </div>
            <input placeholder={t.risk} value={form.risk_level} onChange={(event) => setForm({ ...form, risk_level: event.target.value })} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => save(form.status)} disabled={saving} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium disabled:opacity-50">
              {selectedId ? t.update : t.saveDraft}
            </button>
            <button type="button" onClick={() => save('published')} disabled={saving} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {t.publish}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
