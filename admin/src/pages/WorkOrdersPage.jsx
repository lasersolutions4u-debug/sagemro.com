import { useState, useEffect } from 'react';
import {
  assignAdminWorkOrder,
  assignAdminWorkOrderRegionalLead,
  approveAdminWorkOrderPricing,
  archiveAdminWorkOrder,
  getAdminWorkOrder,
  getAdminWorkOrderMessages,
  getAdminUsers,
  getAdminWorkOrders,
  postAdminWorkOrderMessage,
  rejectAdminWorkOrderPricing,
} from '../services/api';
import { runtimeConfig } from '../config/runtime';
import {
  formatEngineerOption,
  formatListValue,
  formatQuoteNote,
  getQuoteReviewRows,
  money,
  parseJsonValue,
} from './workOrderDisplay';

const STATUS_MAP = {
  pending: { color: 'var(--color-info)' },
  pending_dispatch: { color: 'var(--color-warning)' },
  assigned: { color: 'var(--color-warning)' },
  in_progress: { color: 'var(--color-warning)' },
  resolved: { color: 'var(--color-success)' },
  completed: { color: 'var(--color-success)' },
  rejected: { color: 'var(--color-error)' },
  cancelled: { color: 'var(--color-text-muted)' },
};

function formatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(1) : '-';
}

function averageScore(values) {
  const scores = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!scores.length) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function ScoreRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold text-[var(--color-primary)]">{formatScore(value)}</span>
    </div>
  );
}

function MoneyRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold text-[var(--color-primary)]">{money(value)} CNY</span>
    </div>
  );
}

function isImageAttachment(attachment) {
  return attachment?.file_type?.startsWith('image/');
}

function describeEngineer(engineer) {
  if (!engineer) return '';
  return [
    formatListValue(engineer.service_region || engineer.responsible_region),
    engineer.team_name,
    formatListValue(engineer.specialties),
    engineer.rating_avg ? `rating ${formatScore(engineer.rating_avg)}` : '',
  ].filter(Boolean).join(' · ');
}

function quoteParts(detail) {
  const items = Array.isArray(detail?.pricing?.material_items)
    ? detail.pricing.material_items
    : Array.isArray(detail?.material_items)
      ? detail.material_items.filter((item) => item.purpose === 'quote')
      : [];
  return items;
}

function quoteAiCheck(pricing) {
  const parsed = parseJsonValue(pricing?.ai_price_check);
  return parsed && typeof parsed === 'object' ? parsed : null;
}

const TEXT = {
  en: {
    statuses: {
      pending: 'Pending',
      pending_dispatch: 'Regional dispatch pending',
      assigned: 'Assigned',
      in_progress: 'In progress',
      resolved: 'Resolved',
      completed: 'Completed',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
    },
    urgency: {
      normal: 'Normal',
      urgent: 'Urgent',
      critical: 'Critical',
    },
    types: {
      fault: 'Equipment fault',
      maintenance: 'Maintenance',
      parameter: 'Parameter tuning',
      other: 'Other',
    },
    pricing: {
      pending_review: 'Operations review pending',
      submitted: 'Sent to customer',
      confirmed: 'Customer confirmed',
      draft: 'Returned for revision',
    },
    tabs: {
      all: 'All',
      pending: 'Pending',
      pending_dispatch: 'Regional dispatch pending',
      in_progress: 'In progress',
      completed: 'Completed',
    },
    title: 'Service Orders',
    subtitle: 'The main flow is Admin to regional lead, then regional lead to engineer. Direct engineer dispatch remains as a compatibility operation and is restricted by conflict checks.',
    loading: 'Loading...',
    empty: 'No data',
    selectRegionalLead: 'Please select a regional lead first',
    assignedRegionalLead: (orderNo) => `Regional lead assigned: ${orderNo}`,
    assignRegionalLeadFailed: 'Failed to assign regional lead',
    selectEngineer: 'Please select an internal engineer first',
    assignedEngineer: (orderNo) => `Dispatched: ${orderNo}`,
    assignEngineerFailed: 'Dispatch failed',
    quoteSent: (orderNo) => `Reviewed quote sent to customer: ${orderNo}`,
    quoteReviewFailed: 'Quote review failed',
    rejectPrompt: 'Reason for return (optional, visible to engineer as an internal note):',
    quoteReturned: (orderNo) => `Quote returned for revision: ${orderNo}`,
    quoteReturnFailed: 'Failed to return quote',
    archived: (orderNo) => `Archived: ${orderNo}`,
    archiveFailed: 'Archive failed',
    detailLoadFailed: 'Failed to load service order detail',
    noteSaveFailed: 'Failed to save internal note',
    headers: {
      orderNo: 'Service No.',
      customer: 'Customer',
      regionalLead: 'Regional lead',
      engineer: 'Internal engineer',
      type: 'Type',
      urgency: 'Urgency',
      status: 'Status',
      quoteArchive: 'Quote / archive',
      createdAt: 'Created',
      dispatch: 'Dispatch',
      detail: 'Detail',
    },
    conflictFallback: 'Conflict exists',
    noQuote: 'No quote',
    approve: 'Approve',
    return: 'Return',
    viewQuoteDetail: 'Show details',
    reviewQuoteFirst: 'Open the quote details before approving.',
    archive: 'Archive',
    regionalLeadOption: 'Select regional lead',
    assigning: 'Assigning',
    assignRegion: 'Assign region',
    engineerOption: 'Select engineer',
    dispatching: 'Dispatching',
    directDispatch: 'Direct dispatch',
    searchEngineer: 'Search engineer by name, region, skill, or team',
    exportEngineers: 'Export engineer pool',
    view: 'View',
    previous: 'Previous',
    next: 'Next',
    drawerTitle: 'Service Control View',
    drawerSubtitle: 'Review customer communication, internal notes, AI summary, service report, and two-way reviews.',
    close: 'Close',
    customerLabel: 'Customer',
    engineerLabel: 'Engineer',
    quoteReviewLabel: 'Quote review',
    quoteDetailTitle: 'Quote Details',
    customerPays: 'Customer pays',
    internalSettlement: 'Internal settlement estimate',
    platformServiceFee: 'Platform service / management portion',
    settlementRule: 'Calculated from the engineer settlement rate. Example: 80% to internal settlement, 20% retained by platform.',
    otherFeeNote: 'Other fee note',
    partsList: 'Parts list',
    aiPriceCheck: 'AI price check',
    noQuoteDetail: 'No quote detail',
    riskControlLabel: 'Risk control',
    aiSummaryTitle: 'AI Intake Summary',
    noAiSummary: 'No AI summary',
    attachmentsTitle: 'Diagnostic Images & Attachments',
    attachmentCount: (count) => `${count} item(s)`,
    openAttachment: 'Open attachment',
    noAttachments: 'No diagnostic images or attachments',
    reportTitle: 'Service Report',
    reportFields: {
      symptom: 'Symptom',
      diagnosis: 'Diagnosis',
      solution: 'Solution',
      laborHours: 'Labor hours',
    },
    noReport: 'No service report',
    customerReviewTitle: 'Customer Service Review',
    average: 'Average',
    scoreRows: {
      timeliness: 'Timeliness',
      technical: 'Technical ability',
      communication: 'Communication',
      professional: 'Professionalism',
      cooperation: 'Cooperation',
      payment: 'Payment cooperation',
      environment: 'Site conditions',
    },
    noCustomerReview: 'Customer has not reviewed this service',
    engineerReviewTitle: 'Engineer Internal Customer Review',
    internalRiskNote: 'Internal risk-control material only. It is used for dispatch decisions, service preparation, and quality review, and is not visible to customers.',
    noEngineerReview: 'Engineer has not submitted a customer cooperation review',
    messagesTitle: 'Service Conversation & Internal Notes',
    messageCount: (count) => `${count} message(s)`,
    noMessages: 'No messages',
    internalNote: 'Internal note',
    notePlaceholder: 'Add an internal note. Visible only to Admin / regional lead / engineer, not to the customer.',
    saveNote: 'Save internal note',
    noDetail: 'No service order detail loaded',
  },
  'zh-CN': {
    statuses: {
      pending: '寰呭鐞?,
      pending_dispatch: '寰呭尯鍩熸淳宸?,
      assigned: '宸插垎閰?,
      in_progress: '澶勭悊涓?,
      resolved: '宸茶В鍐?,
      completed: '宸插畬鎴?,
      rejected: '宸叉嫆缁?,
      cancelled: '宸插彇娑?,
    },
    urgency: {
      normal: '鏅€?,
      urgent: '绱ф€?,
      critical: '闈炲父绱ф€?,
    },
    types: {
      fault: '璁惧鏁呴殰',
      maintenance: '璁惧淇濆吇',
      parameter: '鍙傛暟璋冭瘯',
      other: '鍏朵粬',
    },
    pricing: {
      pending_review: '寰呰繍钀ュ鏍?,
      submitted: '宸插彂瀹㈡埛纭',
      confirmed: '瀹㈡埛宸茬‘璁?,
      draft: '閫€鍥炰慨鏀?,
    },
    tabs: {
      all: '鍏ㄩ儴',
      pending: '寰呭鐞?,
      pending_dispatch: '寰呭尯鍩熸淳宸?,
      in_progress: '澶勭悊涓?,
      completed: '宸插畬鎴?,
    },
    title: '娲惧伐涓庢湇鍔¤川閲?,
    subtitle: '涓绘祦绋嬩负 Admin 鍒嗛厤缁欏尯鍩熻礋璐ｄ汉锛屽尯鍩熻礋璐ｄ汉鍐嶅垎缁欏叿浣撳伐绋嬪笀锛涚洿鎺ユ淳宸ョ▼甯堜綔涓哄吋瀹规搷浣滀繚鐣欙紝骞跺彈鍒╃泭鍐茬獊椋庢帶闄愬埗銆?,
    loading: '鍔犺浇涓?..',
    empty: '鏆傛棤鏁版嵁',
    selectRegionalLead: '璇峰厛閫夋嫨鍖哄煙璐熻矗浜?,
    assignedRegionalLead: (orderNo) => `宸插垎閰嶅尯鍩熻礋璐ｄ汉锛?{orderNo}`,
    assignRegionalLeadFailed: '鍒嗛厤鍖哄煙璐熻矗浜哄け璐?,
    selectEngineer: '璇峰厛閫夋嫨鍐呴儴宸ョ▼甯?,
    assignedEngineer: (orderNo) => `宸叉淳宸ワ細${orderNo}`,
    assignEngineerFailed: '娲惧伐澶辫触',
    quoteSent: (orderNo) => `宸插鏍告姤浠峰凡鍙戦€佺粰瀹㈡埛锛?{orderNo}`,
    quoteReviewFailed: '鎶ヤ环瀹℃牳澶辫触',
    rejectPrompt: '閫€鍥炲師鍥狅紙鍙€夛紝宸ョ▼甯堢鍙鍐呴儴澶囨敞锛夛細',
    quoteReturned: (orderNo) => `宸查€€鍥炴姤浠蜂慨鏀癸細${orderNo}`,
    quoteReturnFailed: '鎶ヤ环閫€鍥炲け璐?,
    archived: (orderNo) => `宸插綊妗ｏ細${orderNo}`,
    archiveFailed: '褰掓。澶辫触',
    detailLoadFailed: '宸ュ崟璇︽儏鍔犺浇澶辫触',
    noteSaveFailed: '鍐呴儴澶囨敞淇濆瓨澶辫触',
    headers: {
      orderNo: '鏈嶅姟缂栧彿',
      customer: '瀹㈡埛',
      regionalLead: '鍖哄煙璐熻矗浜?,
      engineer: '鍐呴儴宸ョ▼甯?,
      type: '绫诲瀷',
      urgency: '绱ф€?,
      status: '鐘舵€?,
      quoteArchive: '鎶ヤ环/褰掓。',
      createdAt: '鍒涘缓鏃堕棿',
      dispatch: '娲惧伐',
      detail: '璇︽儏',
    },
    conflictFallback: '瀛樺湪鍒╃泭鍐茬獊',
    noQuote: '鏆傛棤鎶ヤ环',
    approve: '閫氳繃',
    return: '閫€鍥?,
    archive: '褰掓。',
    regionalLeadOption: '閫夋嫨鍖哄煙璐熻矗浜?,
    assigning: '鍒嗛厤涓?,
    assignRegion: '鍒嗛厤鍖哄煙',
    engineerOption: '閫夋嫨宸ョ▼甯?,
    dispatching: '娲惧伐涓?,
    directDispatch: '鐩存帴娲惧伐',
    searchEngineer: '鎸夊鍚嶃€佸湴鍖恒€佹妧鑳芥垨鍥㈤槦鎼滅储宸ョ▼甯?,
    exportEngineers: '瀵煎嚭宸ョ▼甯堟睜',
    view: '鏌ョ湅',
    previous: '涓婁竴椤?,
    next: '涓嬩竴椤?,
    drawerTitle: '宸ュ崟鐩戠瑙嗗浘',
    drawerSubtitle: '鏌ョ湅瀹㈡埛娌熼€氥€佸唴閮ㄥ娉ㄣ€丄I 鎽樿銆佹湇鍔℃姤鍛婂拰鍙屽悜璇勪环銆?,
    close: '鍏抽棴',
    customerLabel: '瀹㈡埛',
    engineerLabel: '宸ョ▼甯?,
    quoteReviewLabel: '鎶ヤ环瀹℃牳',
    riskControlLabel: '椋庢帶',
    aiSummaryTitle: 'AI 鍒濊瘖鎽樿',
    noAiSummary: '鏆傛棤 AI 鎽樿',
    attachmentsTitle: '璇婃柇鍥剧墖涓庨檮浠?,
    attachmentCount: (count) => `${count} 涓猔,
    openAttachment: '鐐瑰嚮鏌ョ湅闄勪欢',
    noAttachments: '鏆傛棤璇婃柇鍥剧墖鎴栭檮浠?,
    reportTitle: '鏈嶅姟鎶ュ憡',
    reportFields: {
      symptom: '鐥囩姸',
      diagnosis: '璇婃柇',
      solution: '澶勭悊',
      laborHours: '宸ユ椂',
    },
    noReport: '鏆傛棤鏈嶅姟鎶ュ憡',
    customerReviewTitle: '瀹㈡埛鏈嶅姟璇勪环',
    average: '骞冲潎',
    scoreRows: {
      timeliness: '鍝嶅簲鍙婃椂',
      technical: '鎶€鏈兘鍔?,
      communication: '娌熼€氫綋楠?,
      professional: '涓撲笟褰㈣薄',
      cooperation: '閰嶅悎绋嬪害',
      payment: '浠樻閰嶅悎',
      environment: '鐜板満鏉′欢',
    },
    noCustomerReview: '瀹㈡埛灏氭湭璇勪环鏈鏈嶅姟',
    engineerReviewTitle: '宸ョ▼甯堝唴閮ㄥ鎴疯瘎浠?,
    internalRiskNote: '鍐呴儴椋庢帶璧勬枡锛屼粎鐢ㄤ簬娲惧伐鍒ゆ柇銆佹湇鍔″噯澶囧拰璐ㄩ噺澶嶇洏锛屽鎴蜂笉鍙銆?,
    noEngineerReview: '宸ョ▼甯堝皻鏈彁浜ゅ鎴峰崗浣滆瘎浠?,
    messagesTitle: '宸ュ崟浼氳瘽涓庡唴閮ㄥ娉?,
    messageCount: (count) => `${count} 鏉,
    noMessages: '鏆傛棤娑堟伅',
    internalNote: '鍐呴儴澶囨敞',
    notePlaceholder: '娣诲姞鍐呴儴澶囨敞锛屼粎 Admin / 鍖哄煙璐熻矗浜?/ 宸ョ▼甯堝彲瑙侊紝瀹㈡埛涓嶅彲瑙併€?,
    saveNote: '淇濆瓨鍐呴儴澶囨敞',
    noDetail: '鏈姞杞藉埌宸ュ崟璇︽儏',
  },
};

export function WorkOrdersPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [status, setStatus] = useState('all');
  const [data, setData] = useState({ total: 0, list: [] });
  const [engineers, setEngineers] = useState([]);
  const [regionalLeads, setRegionalLeads] = useState([]);
  const [selectedEngineers, setSelectedEngineers] = useState({});
  const [selectedRegionalLeads, setSelectedRegionalLeads] = useState({});
  const [assigningId, setAssigningId] = useState('');
  const [message, setMessage] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailMessages, setDetailMessages] = useState([]);
  const [internalNote, setInternalNote] = useState('');
  const [reviewedQuoteIds, setReviewedQuoteIds] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    setLoading(true);
    getAdminWorkOrders(status, page, pageSize)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => {
    getAdminUsers('engineer', 1, 50, { status: 'available' })
      .then((res) => {
        const list = res.list || [];
        setEngineers(list.filter((engineer) => engineer.engineer_role !== 'regional_lead'));
        setRegionalLeads(list.filter((engineer) => engineer.engineer_role === 'regional_lead'));
      })
      .catch(() => {
        setEngineers([]);
        setRegionalLeads([]);
      });
  }, []);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const statusTabs = [
    { key: 'all', label: t.tabs.all },
    { key: 'pending', label: t.tabs.pending },
    { key: 'pending_dispatch', label: t.tabs.pending_dispatch },
    { key: 'in_progress', label: t.tabs.in_progress },
    { key: 'completed', label: t.tabs.completed },
  ];

  async function handleAssignRegionalLead(wo) {
    const regionalLeadId = selectedRegionalLeads[wo.id];
    if (!regionalLeadId) {
      setMessage(t.selectRegionalLead);
      return;
    }
    setAssigningId(`${wo.id}:lead`);
    setMessage('');
    try {
      const res = await assignAdminWorkOrderRegionalLead(wo.id, regionalLeadId);
      const assigned = res.work_order || {};
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? {
                ...item,
                status: assigned.status || 'pending_dispatch',
                assigned_regional_lead_id: assigned.assigned_regional_lead_id,
                regional_lead_name: assigned.regional_lead_name || item.regional_lead_name,
              }
            : item
        )),
      }));
      setMessage(t.assignedRegionalLead(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.assignRegionalLeadFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleAssign(wo) {
    const engineerId = selectedEngineers[wo.id];
    if (!engineerId) {
      setMessage(t.selectEngineer);
      return;
    }
    setAssigningId(`${wo.id}:engineer`);
    setMessage('');
    try {
      const res = await assignAdminWorkOrder(wo.id, engineerId);
      const assigned = res.work_order || {};
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? {
                ...item,
                status: assigned.status || 'assigned',
                engineer_id: assigned.engineer_id || item.engineer_id,
                engineer_name: assigned.engineer_name || item.engineer_name,
                conflict_status: 'clear',
                conflict_reason: '',
              }
            : item
        )),
      }));
      setMessage(t.assignedEngineer(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.assignEngineerFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleApprovePricing(wo) {
    if (!reviewedQuoteIds[wo.id]) {
      setMessage(t.reviewQuoteFirst || 'Open the quote details before approving.');
      await openDetail(wo);
      return;
    }
    setAssigningId(`${wo.id}:approve`);
    setMessage('');
    try {
      await approveAdminWorkOrderPricing(wo.id);
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? { ...item, pricing_status: 'submitted', quote_review_status: 'approved', status: 'pricing' }
            : item
        )),
      }));
      setMessage(t.quoteSent(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.quoteReviewFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleRejectPricing(wo) {
    const note = window.prompt(t.rejectPrompt) || '';
    setAssigningId(`${wo.id}:reject`);
    setMessage('');
    try {
      await rejectAdminWorkOrderPricing(wo.id, note);
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? { ...item, pricing_status: 'draft', quote_review_status: 'rejected', status: 'in_progress' }
            : item
        )),
      }));
      setMessage(t.quoteReturned(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.quoteReturnFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleArchive(wo) {
    setAssigningId(`${wo.id}:archive`);
    setMessage('');
    try {
      await archiveAdminWorkOrder(wo.id);
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id ? { ...item, status: 'completed' } : item
        )),
      }));
      setMessage(t.archived(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.archiveFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function openDetail(wo) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setDetailMessages([]);
    if (wo.pricing_status === 'pending_review') {
      setReviewedQuoteIds((prev) => ({ ...prev, [wo.id]: true }));
    }
    try {
      const [detailData, messagesData] = await Promise.all([
        getAdminWorkOrder(wo.id),
        getAdminWorkOrderMessages(wo.id),
      ]);
      setDetail(detailData);
      setDetailMessages(messagesData.list || []);
    } catch (err) {
      setMessage(err.message || t.detailLoadFailed);
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitInternalNote() {
    if (!detail?.id || !internalNote.trim()) return;
    try {
      await postAdminWorkOrderMessage(detail.id, internalNote.trim(), true);
      const messagesData = await getAdminWorkOrderMessages(detail.id);
      setDetailMessages(messagesData.list || []);
      setInternalNote('');
    } catch (err) {
      setMessage(err.message || t.noteSaveFailed);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t.subtitle}
          </p>
        </div>
      </div>
      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === tab.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">{t.loading}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.orderNo}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.customer}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.regionalLead}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.engineer}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.type}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.urgency}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.status}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.quoteArchive}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.createdAt}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.dispatch}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.detail}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-[var(--color-text-muted)]">
                      {t.empty}
                    </td>
                  </tr>
                ) : (
                  data.list.map((wo) => {
                    const statusInfo = STATUS_MAP[wo.status] || { color: 'var(--color-text-muted)' };
                    return (
                      <tr key={wo.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50">
                        <td className="py-3 px-2 font-mono text-[var(--color-primary)]">{wo.order_no}</td>
                        <td className="py-3 px-2">
                          <div>{wo.customer_name || '-'}</div>
                          {wo.customer_company && <div className="text-xs text-[var(--color-text-muted)]">{wo.customer_company}</div>}
                        </td>
                        <td className="py-3 px-2">
                          <div>{wo.regional_lead_name || '-'}</div>
                          {wo.regional_lead_no && <div className="text-xs text-[var(--color-text-muted)]">{wo.regional_lead_no}</div>}
                        </td>
                        <td className="py-3 px-2">
                          <div>{wo.engineer_name || '-'}</div>
                          {wo.engineer_company && <div className="text-xs text-[var(--color-text-muted)]">{wo.engineer_company}</div>}
                          {wo.conflict_status === 'blocked' && (
                            <div className="mt-1 text-xs text-[var(--color-error)]">{wo.conflict_reason || t.conflictFallback}</div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-[var(--color-text-secondary)]">{t.types[wo.type] || wo.type}</td>
                        <td className="py-3 px-2">
                          <span className={wo.urgency === 'critical' ? 'text-[var(--color-error)] font-medium' : wo.urgency === 'urgent' ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}>
                            {t.urgency[wo.urgency] || wo.urgency}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                            {t.statuses[wo.status] || wo.status}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="min-w-[170px] space-y-2">
                            <div className="text-xs text-[var(--color-text-secondary)]">
                              {wo.pricing_status
                                ? `${t.pricing[wo.pricing_status] || wo.pricing_status}${wo.pricing_total_amount || wo.pricing_subtotal ? ` · ${money(wo.pricing_total_amount || wo.pricing_subtotal)} CNY` : ''}`
                                : t.noQuote}
                            </div>
                            {wo.pricing_status === 'pending_review' && (
                              <div className="space-y-2">
                                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2 text-[11px] text-[var(--color-text-secondary)]">
                                  {getQuoteReviewRows(wo).map(([label, value]) => (
                                    <div key={label} className="flex justify-between gap-3">
                                      <span>{label}</span>
                                      <span className="max-w-[150px] text-right text-[var(--color-text)]">{value}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    onClick={() => openDetail(wo)}
                                    className="rounded-lg border border-[var(--color-primary)]/40 px-2 py-1 text-xs text-[var(--color-primary)]"
                                  >
                                    {t.viewQuoteDetail || t.view}
                                  </button>
                                  <button
                                    onClick={() => handleApprovePricing(wo)}
                                    disabled={assigningId === `${wo.id}:approve`}
                                    className="rounded-lg bg-[var(--color-primary)] px-2 py-1 text-xs text-white disabled:opacity-50"
                                  >
                                    {t.approve}
                                  </button>
                                  <button
                                    onClick={() => handleRejectPricing(wo)}
                                    disabled={assigningId === `${wo.id}:reject`}
                                    className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] disabled:opacity-50"
                                  >
                                    {t.return}
                                  </button>
                                </div>
                              </div>
                            )}
                            {['resolved', 'pending_review'].includes(wo.status) && (
                              <button
                                onClick={() => handleArchive(wo)}
                                disabled={assigningId === `${wo.id}:archive`}
                                className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] disabled:opacity-50"
                              >
                                {t.archive}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-[var(--color-text-secondary)]">
                          {wo.created_at?.slice(0, 16)?.replace('T', ' ')}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex min-w-[320px] flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedRegionalLeads[wo.id] || wo.assigned_regional_lead_id || ''}
                                onChange={(event) => setSelectedRegionalLeads((prev) => ({ ...prev, [wo.id]: event.target.value }))}
                                className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-xs text-[var(--color-text)]"
                              >
                                <option value="">{t.regionalLeadOption}</option>
                                {regionalLeads.map((lead) => (
                                  <option key={lead.id} value={lead.id}>
                                    {formatEngineerOption(lead)}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAssignRegionalLead(wo)}
                                disabled={assigningId === `${wo.id}:lead`}
                                className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                {assigningId === `${wo.id}:lead` ? t.assigning : t.assignRegion}
                              </button>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <select
                                  value={selectedEngineers[wo.id] || wo.engineer_id || ''}
                                  onChange={(event) => setSelectedEngineers((prev) => ({ ...prev, [wo.id]: event.target.value }))}
                                  className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-xs text-[var(--color-text)]"
                                >
                                  <option value="">{t.engineerOption}</option>
                                  {engineers.map((engineer) => (
                                    <option key={engineer.id} value={engineer.id}>
                                      {formatEngineerOption(engineer)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssign(wo)}
                                  disabled={assigningId === `${wo.id}:engineer`}
                                  className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                >
                                  {assigningId === `${wo.id}:engineer` ? t.dispatching : t.directDispatch}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => openDetail(wo)}
                            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                          >
                            {t.view}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors"
              >
                {t.previous}
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors"
              >
                {t.next}
              </button>
            </div>
          )}
        </>
      )}

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailOpen(false)} />
          <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-primary)]">Service Record</div>
                <h3 className="text-lg font-semibold">{t.drawerTitle}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{t.drawerSubtitle}</p>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
              >
                {t.close}
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loading}</div>
            ) : detail ? (
              <div className="space-y-4">
                <section className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="font-mono text-[var(--color-primary)]">{detail.order_no}</div>
                    <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">{detail.status}</span>
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">{detail.description}</div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2">
                    <div>{t.customerLabel}: {detail.customer_name || '-'}</div>
                    <div>{t.engineerLabel}: {detail.engineer_name || '-'}</div>
                    <div>{t.quoteReviewLabel}: {detail.quote_review_status || '-'}</div>
                    <div>{t.riskControlLabel}: {detail.conflict_status || 'clear'}</div>
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-2 font-medium">{t.aiSummaryTitle}</h4>
                  <pre className="whitespace-pre-wrap rounded-lg bg-[var(--color-surface-elevated)] p-3 text-xs text-[var(--color-text-secondary)]">
                    {detail.ai_summary || t.noAiSummary}
                  </pre>
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-medium">{t.quoteDetailTitle || 'Quote Details'}</h4>
                    {detail.pricing?.status && (
                      <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">
                        {t.pricing[detail.pricing.status] || detail.pricing.status}
                      </span>
                    )}
                  </div>
                  {detail.pricing ? (() => {
                    const pricing = detail.pricing;
                    const parts = quoteParts(detail);
                    const subtotal = pricing.subtotal || pricing.total_amount || 0;
                    const commissionRate = detail.engineer_commission_rate || 0.8;
                    const internalSettlement = Math.round(subtotal * commissionRate);
                    const platformPart = Math.max(0, subtotal - internalSettlement);
                    const note = formatQuoteNote(pricing.parts_detail);
                    const aiCheck = quoteAiCheck(pricing);
                    return (
                      <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <MoneyRow label="Labor Fee" value={pricing.labor_fee || 0} />
                          <MoneyRow label="Parts Fee" value={pricing.parts_fee || 0} />
                          <MoneyRow label="Travel Fee" value={pricing.travel_fee || 0} />
                          <MoneyRow label="Other Fees" value={pricing.other_fee || 0} />
                        </div>
                        {note && (
                          <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3">
                            <div className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">{t.otherFeeNote || 'Other fee note'}</div>
                            <div>{note}</div>
                          </div>
                        )}
                        {parts.length > 0 && (
                          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                            <div className="bg-[var(--color-surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">
                              {t.partsList || 'Parts list'}
                            </div>
                            <table className="w-full text-xs">
                              <tbody>
                                {parts.map((part, index) => (
                                  <tr key={part.id || `${part.material_code || part.name}-${index}`} className="border-t border-[var(--color-border)]">
                                    <td className="px-3 py-2">
                                      <div className="text-[var(--color-text)]">{part.name_en || part.name || '-'}</div>
                                      <div className="text-[var(--color-text-muted)]">{[part.material_code, part.spec, part.brand].filter(Boolean).join(' 路 ') || '-'}</div>
                                    </td>
                                    <td className="px-3 py-2 text-right">{part.quantity || 1} {part.unit || 'pcs'}</td>
                                    <td className="px-3 py-2 text-right">{money(part.unit_price)} CNY</td>
                                    <td className="px-3 py-2 text-right">{money(part.line_total || Number(part.quantity || 0) * Number(part.unit_price || 0))} CNY</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3">
                          <div className="flex justify-between">
                            <span>{t.customerPays || 'Customer pays'}</span>
                            <span className="font-semibold text-[var(--color-text)]">{money(subtotal)} CNY</span>
                          </div>
                          <div className="mt-1 flex justify-between">
                            <span>{t.internalSettlement || 'Internal settlement estimate'} ({Math.round(commissionRate * 100)}%)</span>
                            <span className="font-semibold text-[var(--color-primary)]">{money(internalSettlement)} CNY</span>
                          </div>
                          <div className="mt-1 flex justify-between">
                            <span>{t.platformServiceFee || 'Platform service / management portion'} ({Math.round((1 - commissionRate) * 100)}%)</span>
                            <span>{money(platformPart)} CNY</span>
                          </div>
                          <div className="mt-2 text-xs text-[var(--color-text-muted)]">{t.settlementRule || 'Calculated from the engineer settlement rate.'}</div>
                        </div>
                        {aiCheck && (
                          <div className="rounded-lg border border-[var(--color-border)] p-3">
                            <div className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">{t.aiPriceCheck || 'AI price check'}</div>
                            <div className="font-medium text-[var(--color-text)]">{aiCheck.status || '-'}</div>
                            {(aiCheck.reason || aiCheck.ai_note) && (
                              <div className="mt-1 text-xs whitespace-pre-wrap">{aiCheck.reason || aiCheck.ai_note}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noQuoteDetail || t.noQuote}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-medium">{t.attachmentsTitle}</h4>
                    <span className="text-xs text-[var(--color-text-muted)]">{t.attachmentCount(detail.attachments?.length || 0)}</span>
                  </div>
                  {detail.attachments?.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {detail.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.r2_url}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]"
                        >
                          {isImageAttachment(attachment) ? (
                            <img
                              src={attachment.r2_url}
                              alt={attachment.file_name}
                              className="h-32 w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-32 items-center justify-center text-xs text-[var(--color-text-muted)]">
                              {t.openAttachment}
                            </div>
                          )}
                          <div className="p-2 text-xs text-[var(--color-text-secondary)]">
                            <div className="truncate" title={attachment.file_name}>{attachment.file_name}</div>
                            <div className="text-[var(--color-text-muted)]">{attachment.uploader_type || '-'}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noAttachments}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-2 font-medium">{t.reportTitle}</h4>
                  {detail.repair_record ? (
                    <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                      <div>{t.reportFields.symptom}: {detail.repair_record.symptom || '-'}</div>
                      <div>{t.reportFields.diagnosis}: {detail.repair_record.diagnosis || '-'}</div>
                      <div>{t.reportFields.solution}: {detail.repair_record.solution || '-'}</div>
                      <div>{t.reportFields.laborHours}: {detail.repair_record.labor_hours || 0}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noReport}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-medium">{t.customerReviewTitle}</h4>
                    {detail.rating && (
                      <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--color-primary)]">
                        {t.average} {formatScore(averageScore([
                          detail.rating.rating_timeliness,
                          detail.rating.rating_technical,
                          detail.rating.rating_communication,
                          detail.rating.rating_professional,
                        ]))}
                      </span>
                    )}
                  </div>
                  {detail.rating ? (
                    <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ScoreRow label={t.scoreRows.timeliness} value={detail.rating.rating_timeliness} />
                        <ScoreRow label={t.scoreRows.technical} value={detail.rating.rating_technical} />
                        <ScoreRow label={t.scoreRows.communication} value={detail.rating.rating_communication} />
                        <ScoreRow label={t.scoreRows.professional} value={detail.rating.rating_professional} />
                      </div>
                      {detail.rating.comment && (
                        <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3">
                          {detail.rating.comment}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noCustomerReview}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-medium">{t.engineerReviewTitle}</h4>
                    {detail.engineer_review && (
                      <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--color-primary)]">
                        {t.average} {formatScore(averageScore([
                          detail.engineer_review.rating_cooperation,
                          detail.engineer_review.rating_communication,
                          detail.engineer_review.rating_payment,
                          detail.engineer_review.rating_environment,
                        ]))}
                      </span>
                    )}
                  </div>
                  {detail.engineer_review ? (
                    <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ScoreRow label={t.scoreRows.cooperation} value={detail.engineer_review.rating_cooperation} />
                        <ScoreRow label={t.scoreRows.communication} value={detail.engineer_review.rating_communication} />
                        <ScoreRow label={t.scoreRows.payment} value={detail.engineer_review.rating_payment} />
                        <ScoreRow label={t.scoreRows.environment} value={detail.engineer_review.rating_environment} />
                      </div>
                      {detail.engineer_review.comment && (
                        <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3">
                          {detail.engineer_review.comment}
                        </div>
                      )}
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {t.internalRiskNote}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noEngineerReview}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-medium">{t.messagesTitle}</h4>
                    <span className="text-xs text-[var(--color-text-muted)]">{t.messageCount(detailMessages.length)}</span>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {detailMessages.length === 0 ? (
                      <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">{t.noMessages}</div>
                    ) : detailMessages.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-lg p-3 text-sm ${item.is_internal_note ? 'bg-amber-500/10 text-amber-700' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'}`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span>{item.sender_name || item.sender_type}{item.is_internal_note ? ` 路 ${t.internalNote}` : ''}</span>
                          <span className="text-[var(--color-text-muted)]">{item.created_at?.slice(0, 16)?.replace('T', ' ')}</span>
                        </div>
                        <div>{item.content}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      placeholder={t.notePlaceholder}
                      rows={3}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm focus:outline-none"
                    />
                    <button
                      onClick={submitInternalNote}
                      disabled={!internalNote.trim()}
                      className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {t.saveNote}
                    </button>
                  </div>
                </section>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.noDetail}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
