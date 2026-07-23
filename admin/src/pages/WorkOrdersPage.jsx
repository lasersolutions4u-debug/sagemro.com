import { Component, useState, useEffect } from 'react';

class DetailErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4">
          <h4 className="font-medium text-red-600">Render Error</h4>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-red-500">{this.state.error?.message || 'Unknown error'}</pre>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Stack: {this.state.error?.stack || 'N/A'}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  assignAdminWorkOrder,
  assignAdminWorkOrderRegionalLead,
  approveAdminWorkOrderPricing,
  approveAdminWorkOrderBalance,
  approveAdminWorkOrderPaymentStart,
  archiveAdminWorkOrder,
  confirmAdminOnsiteConversion,
  getAdminWorkOrder,
  getAdminWorkOrderMessages,
  getAdminUsers,
  getAdminWorkOrders,
  overrideAdminArrival,
  postAdminWorkOrderMessage,
  rejectAdminWorkOrderPricing,
  searchAdminServiceLocations,
  updateAdminWorkOrderPayout,
} from '../services/api';
import { runtimeConfig } from '../config/runtime';
import { FieldWorkAdminPanel } from '../components/FieldWorkAdminPanel';
import { formatApiDateTime } from '../utils/dateTime';
import {
  formatAiSummary,
  formatEngineerOption,
  formatListValue,
  formatQuoteNote,
  money,
  parseJsonValue,
} from './workOrderDisplay';

const STATUS_MAP = {
  pending: { color: 'var(--color-info)' },
  pending_dispatch: { color: 'var(--color-warning)' },
  assigned: { color: 'var(--color-warning)' },
  in_progress: { color: 'var(--color-warning)' },
  payment_review: { color: 'var(--color-warning)' },
  pending_payment: { color: 'var(--color-warning)' },
  pricing: { color: 'var(--color-primary)' },
  in_service: { color: 'var(--color-info)' },
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
      <span className="font-semibold text-[var(--color-primary)]">{money(value)} USD</span>
    </div>
  );
}

function payoutLabel(status) {
  const labels = {
    not_ready: 'Not ready',
    pending: 'Payout pending',
    processing: 'Processing',
    completed: 'Completed',
    exception: 'Exception',
  };
  return labels[status] || status || 'Not ready';
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

function arrivalCheckOutcome(check, t) {
  if (check.location_status === 'location_unavailable' || check.location_status === 'unavailable' || check.failure_reason === 'location_unavailable' || check.failure_reason === 'unavailable') {
    return { label: t.arrivalLocationUnavailable, tone: 'text-[var(--color-text-muted)]' };
  }
  if (check.within_geofence) return { label: t.arrivalPassed, tone: 'text-green-600' };
  return { label: t.arrivalOutsideGeofence, tone: 'text-red-600' };
}

const TEXT = {
  en: {
    statuses: {
      pending: 'Pending',
      pending_dispatch: 'Regional dispatch pending',
      assigned: 'Assigned',
      in_progress: 'In progress',
      pricing: 'Quote confirmation',
      pending_payment: 'Payment follow-up',
      payment_review: 'Payment review',
      in_service: 'In service',
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
    paymentStartApproved: (orderNo) => `Payment confirmed. Service can start: ${orderNo}`,
    paymentStartApproveFailed: 'Failed to approve service start',
    approvePaymentStart: 'Confirm payment & start',
    paymentReviewTitle: 'Payment confirmation required',
    paymentReviewHint: 'Engineer has followed up payment. Confirm receipt before allowing service execution.',
    balancePaymentTitle: 'Service balance confirmation required',
    balancePaymentHint: 'The customer has requested the remaining service balance payment. Confirm receipt to settle the payment record.',
    approveBalancePayment: 'Confirm balance received',
    balancePaymentApproved: (orderNo) => `Service balance confirmed: ${orderNo}`,
    balancePaymentApproveFailed: 'Failed to confirm service balance',
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
    approveFullOrder: 'Approve full order',
    return: 'Return',
    returnQuote: 'Return quote',
    viewQuoteDetail: 'Review full order',
    reviewQuoteFirst: 'Open the quote details before approving.',
    fullOrderReviewTitle: 'Full order review required',
    fullOrderReviewHint: 'Review the customer issue, AI summary, attachments, quote details, parts, quote subtotal price, and internal notes before approval.',
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
    quoteSubtotalPrice: 'Quote subtotal price',
    otherFeeNote: 'Other fee note',
    partsList: 'Parts list',
    aiPriceCheck: 'AI price check',
    noQuoteDetail: 'No quote detail',
    riskControlLabel: 'Risk control',
    aiSummaryTitle: 'Service Request Summary',
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
    arrivalLocationUnavailable: 'Location unavailable · photo evidence accepted',
    arrivalPassed: 'Passed',
    arrivalOutsideGeofence: 'Outside geofence',
    fieldToday: 'Checked in today',
    fieldOverdue: (count) => `${count} report overdue`,
    fieldExtension: 'Extension pending',
  },
  'zh-CN': {
    arrivalLocationUnavailable: '无法定位 · 已接受照片证据',
    arrivalPassed: '已通过',
    arrivalOutsideGeofence: '位于围栏外',
    fieldToday: '今日已签到',
    fieldOverdue: (count) => `${count} 份日报逾期`,
    fieldExtension: '延期待审批',
  },
};

function FieldWorkIndicators({ workOrder, t }) {
  if (!workOrder.field_checked_in_today && !workOrder.field_report_overdue_count && !workOrder.field_extension_pending) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {workOrder.field_checked_in_today && <span className="rounded-lg border border-[var(--color-success)]/40 px-2 py-1 text-xs text-[var(--color-success)]">{t.fieldToday}</span>}
      {workOrder.field_report_overdue_count > 0 && <span className="rounded-lg border border-[var(--color-error)]/40 px-2 py-1 text-xs text-[var(--color-error)]">{t.fieldOverdue(workOrder.field_report_overdue_count)}</span>}
      {workOrder.field_extension_pending && <span className="rounded-lg border border-[var(--color-warning)]/40 px-2 py-1 text-xs text-[var(--color-warning)]">{t.fieldExtension}</span>}
    </div>
  );
}

export function WorkOrdersPage({ readOnly = false }) {
  const t = { ...TEXT.en, ...(TEXT[runtimeConfig.locale] || {}) };
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
  const [adminSiteLocation, setAdminSiteLocation] = useState({
    service_address: '',
    service_latitude: '',
    service_longitude: '',
    service_accuracy_m: '',
    service_coordinate_system: 'wgs84',
    service_location_source: 'admin_customer_confirmation',
    note: '',
    reason: '',
  });
  const [adminLocationResults, setAdminLocationResults] = useState([]);
  const [adminLocationSearching, setAdminLocationSearching] = useState(false);
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
    if (readOnly) return;
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
  }, [readOnly]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const statusTabs = [
    { key: 'all', label: t.tabs.all },
    { key: 'pending', label: t.tabs.pending },
    { key: 'pending_dispatch', label: t.tabs.pending_dispatch },
    { key: 'in_progress', label: t.tabs.in_progress },
    { key: 'completed', label: t.tabs.completed },
  ];

  async function handleAssignRegionalLead(wo) {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
      setDetail((prev) => (
        prev?.id === wo.id
          ? {
              ...prev,
              status: 'pricing',
              quote_review_status: 'approved',
              pricing: prev.pricing ? { ...prev.pricing, status: 'submitted' } : prev.pricing,
            }
          : prev
      ));
      setMessage(t.quoteSent(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.quoteReviewFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleRejectPricing(wo) {
    if (readOnly) return;
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
      setDetail((prev) => (
        prev?.id === wo.id
          ? {
              ...prev,
              status: 'in_progress',
              quote_review_status: 'rejected',
              pricing: prev.pricing ? { ...prev.pricing, status: 'draft' } : prev.pricing,
            }
          : prev
      ));
      setMessage(t.quoteReturned(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.quoteReturnFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleApprovePaymentStart(wo) {
    if (readOnly) return;
    const note = window.prompt('Payment confirmation note (optional):') || '';
    setAssigningId(`${wo.id}:payment-start`);
    setMessage('');
    try {
      await approveAdminWorkOrderPaymentStart(wo.id, note);
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? { ...item, status: 'in_service' }
            : item
        )),
      }));
      setDetail((prev) => (
        prev?.id === wo.id
          ? { ...prev, status: 'in_service' }
          : prev
      ));
      setMessage(t.paymentStartApproved(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.paymentStartApproveFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleApproveBalancePayment(wo) {
    if (readOnly) return;
    const note = window.prompt('Balance payment confirmation note (optional):') || '';
    setAssigningId(`${wo.id}:balance-payment`);
    setMessage('');
    try {
      await approveAdminWorkOrderBalance(wo.id, note);
      setDetail((prev) => (
        prev?.id === wo.id
          ? { ...prev, balance_payment: prev.balance_payment ? { ...prev.balance_payment, status: 'completed' } : prev.balance_payment }
          : prev
      ));
      setMessage(t.balancePaymentApproved(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.balancePaymentApproveFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleArchive(wo) {
    if (readOnly) return;
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

  async function handleUpdatePayout(wo, status) {
    if (readOnly) return;
    const currentPayout = wo.payout || {};
    const amountInput = window.prompt('Engineer service payment amount in USD (optional):', currentPayout.amount || '');
    if (amountInput === null) return;
    const reference = window.prompt('Payment reference / transaction ID (optional):', currentPayout.transaction_reference || '') || '';
    const note = window.prompt('Internal payout note (optional):', currentPayout.internal_note || '') || '';
    setAssigningId(`${wo.id}:payout:${status}`);
    setMessage('');
    try {
      const response = await updateAdminWorkOrderPayout(wo.id, {
        status,
        amount: amountInput,
        currency: currentPayout.currency || 'USD',
        method: currentPayout.method || 'paypal',
        transaction_reference: reference,
        internal_note: note,
      });
      setDetail((prev) => (
        prev?.id === wo.id
          ? { ...prev, payout: response.payout, payout_status: response.payout_status }
          : prev
      ));
      setMessage(`Engineer service payment updated: ${payoutLabel(response.payout_status)}`);
    } catch (err) {
      setMessage(err.message || 'Failed to update engineer service payment');
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
      setAdminSiteLocation({
        service_address: detailData.service_address || '',
        service_latitude: detailData.service_latitude ?? '',
        service_longitude: detailData.service_longitude ?? '',
        service_accuracy_m: detailData.service_accuracy_m ?? '',
        service_coordinate_system: detailData.service_coordinate_system || 'wgs84',
        service_location_source: detailData.service_location_source || 'admin_customer_confirmation',
        note: detailData.onsite_conversion_confirmation_note || '',
        reason: '',
      });
      setAdminLocationResults([]);
    } catch (err) {
      setMessage(err.message || t.detailLoadFailed);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshOpenDetail(expectedWorkOrderId) {
    if (!expectedWorkOrderId) return;
    const [detailData, listData] = await Promise.all([
      getAdminWorkOrder(expectedWorkOrderId),
      getAdminWorkOrders(status, page, pageSize),
    ]);
    setDetail((current) => current?.id === expectedWorkOrderId ? detailData : current);
    setData(listData);
  }

  async function submitInternalNote() {
    if (readOnly) return;
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

  async function searchAdminLocation() {
    const query = adminSiteLocation.service_address.trim();
    if (query.length < 2) {
      setMessage('Enter the customer site address before searching.');
      return;
    }
    setAdminLocationSearching(true);
    try {
      const result = await searchAdminServiceLocations(query);
      setAdminLocationResults(result.results || []);
    } catch (err) {
      setAdminLocationResults([]);
      setMessage(err.message || 'Failed to search the service address.');
    } finally {
      setAdminLocationSearching(false);
    }
  }

  function selectAdminLocation(result) {
    setAdminSiteLocation((current) => ({
      ...current,
      service_address: result.address || result.label,
      service_latitude: result.latitude,
      service_longitude: result.longitude,
      service_accuracy_m: '',
      service_coordinate_system: result.coordinate_system,
      service_location_source: result.source,
    }));
    setAdminLocationResults([]);
  }

  async function handleAdminOnsiteConfirmation(wo) {
    if (readOnly) return;
    const latitude = Number(adminSiteLocation.service_latitude);
    const longitude = Number(adminSiteLocation.service_longitude);
    const missingCoordinates = adminSiteLocation.service_latitude === '' || adminSiteLocation.service_longitude === '';
    if (missingCoordinates || !adminSiteLocation.service_address.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setMessage('A complete site address and valid map coordinates are required.');
      return;
    }
    if (!adminSiteLocation.reason.trim()) {
      setMessage('Explain why Admin is confirming the location on behalf of the customer.');
      return;
    }

    setAssigningId(`${wo.id}:onsite-confirm`);
    setMessage('');
    try {
      await confirmAdminOnsiteConversion(wo.id, {
        ...adminSiteLocation,
        service_latitude: latitude,
        service_longitude: longitude,
        service_accuracy_m: adminSiteLocation.service_accuracy_m === ''
          ? null
          : Number(adminSiteLocation.service_accuracy_m),
      });
      setMessage(`On-site service location confirmed: ${wo.order_no}`);
      await openDetail(wo);
    } catch (err) {
      setMessage(err.message || 'Failed to confirm the on-site service location.');
    } finally {
      setAssigningId('');
    }
  }

  async function handleAdminArrivalOverride(wo) {
    if (readOnly) return;
    const reason = window.prompt('Reason for manually approving the engineer arrival check:') || '';
    if (!reason.trim()) return;
    setAssigningId(`${wo.id}:arrival-override`);
    setMessage('');
    try {
      await overrideAdminArrival(wo.id, reason.trim());
      setMessage(`Engineer arrival manually approved: ${wo.order_no}`);
      await openDetail(wo);
    } catch (err) {
      setMessage(err.message || 'Failed to approve the engineer arrival.');
    } finally {
      setAssigningId('');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
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

      <div className="-mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:mb-6 sm:flex-wrap sm:px-0">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`shrink-0 px-3 py-2 sm:px-4 rounded-lg text-sm font-medium transition-colors ${
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
          <div className="space-y-3 md:hidden">
            {data.list.length === 0 ? (
              <div className="rounded-xl bg-[var(--color-surface-elevated)] py-8 text-center text-sm text-[var(--color-text-muted)]">
                {t.empty}
              </div>
            ) : data.list.map((wo) => {
              const statusInfo = STATUS_MAP[wo.status] || { color: 'var(--color-text-muted)' };
              return (
                <article key={wo.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => openDetail(wo)}
                      className="min-w-0 break-all text-left font-mono text-sm font-semibold text-[var(--color-primary)]"
                    >
                      {wo.order_no}
                    </button>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-surface-elevated)] px-2 py-1 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                      {t.statuses[wo.status] || wo.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="font-medium">{wo.customer_name || '-'}</div>
                    {wo.customer_company && <div className="text-xs text-[var(--color-text-muted)]">{wo.customer_company}</div>}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-secondary)]">
                    <div>{t.headers.type}: {t.types[wo.type] || wo.type || '-'}</div>
                    <div>
                      {t.headers.urgency}: <span className={wo.urgency === 'critical' ? 'text-[var(--color-error)] font-medium' : wo.urgency === 'urgent' ? 'text-[var(--color-warning)]' : ''}>
                        {t.urgency[wo.urgency] || wo.urgency || '-'}
                      </span>
                    </div>
                    <div>{t.headers.regionalLead}: {wo.regional_lead_name || '-'}</div>
                    <div>{t.headers.engineer}: {wo.engineer_name || '-'}</div>
                    <div>
                      {t.headers.quoteArchive}: {wo.pricing_status
                        ? `${t.pricing[wo.pricing_status] || wo.pricing_status}${wo.pricing_total_amount || wo.pricing_subtotal ? ` / ${money(wo.pricing_total_amount || wo.pricing_subtotal)} USD` : ''}`
                        : t.noQuote}
                    </div>
                  </div>
                  <FieldWorkIndicators workOrder={wo} t={t} />
                  {wo.conflict_status === 'blocked' && (
                    <div className="mt-3 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
                      {wo.conflict_reason || t.conflictFallback}
                    </div>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      onClick={() => openDetail(wo)}
                      className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)]"
                    >
                      {wo.pricing_status === 'pending_review' ? (t.viewQuoteDetail || t.view) : t.view}
                    </button>
                    {!readOnly && wo.status === 'payment_review' && (
                      <button
                        onClick={() => handleApprovePaymentStart(wo)}
                        disabled={assigningId === `${wo.id}:payment-start`}
                        className="min-h-10 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {t.approvePaymentStart}
                      </button>
                    )}
                    {!readOnly && ['resolved', 'pending_review'].includes(wo.status) && (
                      <button
                        onClick={() => handleArchive(wo)}
                        disabled={assigningId === `${wo.id}:archive`}
                        className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
                      >
                        {t.archive}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                    {wo.created_at?.slice(0, 16)?.replace('T', ' ')}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.detail}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-[var(--color-text-muted)]">
                      {t.empty}
                    </td>
                  </tr>
                ) : (
                  data.list.map((wo) => {
                    const statusInfo = STATUS_MAP[wo.status] || { color: 'var(--color-text-muted)' };
                    return (
                      <tr key={wo.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50">
                        <td className="py-3 px-2">
                          <button
                            onClick={() => openDetail(wo)}
                            className="font-mono text-left text-[var(--color-primary)] hover:underline"
                          >
                            {wo.order_no}
                          </button>
                        </td>
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
                          <FieldWorkIndicators workOrder={wo} t={t} />
                        </td>
                        <td className="py-3 px-2">
                          <div className="min-w-[170px] space-y-2">
                            <div className="text-xs text-[var(--color-text-secondary)]">
                              {wo.pricing_status
                                ? `${t.pricing[wo.pricing_status] || wo.pricing_status}${wo.pricing_total_amount || wo.pricing_subtotal ? ` · ${money(wo.pricing_total_amount || wo.pricing_subtotal)} USD` : ''}`
                                : t.noQuote}
                            </div>
                            {wo.pricing_status === 'pending_review' && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    onClick={() => openDetail(wo)}
                                    className="rounded-lg border border-[var(--color-primary)]/40 px-2 py-1 text-xs text-[var(--color-primary)]"
                                  >
                                    {t.viewQuoteDetail || t.view}
                                  </button>
                                </div>
                              </div>
                            )}
                            {!readOnly && wo.status === 'payment_review' && (
                              <button
                                onClick={() => handleApprovePaymentStart(wo)}
                                disabled={assigningId === `${wo.id}:payment-start`}
                                className="rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)] disabled:opacity-50"
                              >
                                {t.approvePaymentStart}
                              </button>
                            )}
                            {!readOnly && ['resolved', 'pending_review'].includes(wo.status) && (
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
          <div role="dialog" aria-modal="true" aria-label={t.drawerTitle} className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden bg-[var(--color-surface)] shadow-2xl">
            <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-5">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-primary)]">Service Record</div>
                <h3 className="text-lg font-semibold">{t.drawerTitle}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.drawerSubtitle}</p>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                {t.close}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">

            {detailLoading ? (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loading}</div>
            ) : detail ? (
              <DetailErrorBoundary>
              <div className="space-y-4">
                {!readOnly && detail.pricing?.status === 'pending_review' && (
                  <section className="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="font-medium text-[var(--color-text)]">{t.fullOrderReviewTitle}</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.fullOrderReviewHint}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRejectPricing(detail)}
                          disabled={assigningId === `${detail.id}:reject`}
                          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] disabled:opacity-50"
                        >
                          {t.returnQuote || t.return}
                        </button>
                        <button
                          onClick={() => handleApprovePricing(detail)}
                          disabled={assigningId === `${detail.id}:approve`}
                          className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {t.approveFullOrder || t.approve}
                        </button>
                      </div>
                    </div>
                  </section>
                )}
                {!readOnly && detail.status === 'payment_review' && (
                  <section className="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="font-medium text-[var(--color-text)]">{t.paymentReviewTitle}</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.paymentReviewHint}</p>
                      </div>
                      <button
                        onClick={() => handleApprovePaymentStart(detail)}
                        disabled={assigningId === `${detail.id}:payment-start`}
                        className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {t.approvePaymentStart}
                      </button>
                    </div>
                  </section>
                )}
                {!readOnly && ['instructions_requested', 'pending_admin_confirmation'].includes(detail.balance_payment?.status) && (
                  <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="font-medium text-[var(--color-text)]">{t.balancePaymentTitle}</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.balancePaymentHint}</p>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          Amount: {detail.balance_payment.amount || detail.payment_policy?.balance_amount || 0} USD · Status: {detail.balance_payment.status}
                        </p>
                      </div>
                      <button
                        onClick={() => handleApproveBalancePayment(detail)}
                        disabled={assigningId === `${detail.id}:balance-payment`}
                        className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {t.approveBalancePayment}
                      </button>
                    </div>
                  </section>
                )}
                {!readOnly && detail.onsite_conversion_status === 'requested' && (
                  <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                    <div>
                      <h4 className="font-medium text-[var(--color-text)]">On-site conversion awaiting location confirmation</h4>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Admin may confirm on behalf of the customer only after independently verifying the address and map point. The reason is written to the audit log.
                      </p>
                      {detail.onsite_conversion_request_note && (
                        <p className="mt-2 rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-xs text-[var(--color-text)]">
                          Engineer request: {detail.onsite_conversion_request_note}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={adminSiteLocation.service_address}
                          onChange={(event) => setAdminSiteLocation((current) => ({ ...current, service_address: event.target.value }))}
                          placeholder="Exact customer site address"
                          className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                        />
                        <button
                          type="button"
                          onClick={searchAdminLocation}
                          disabled={adminLocationSearching}
                          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] disabled:opacity-50"
                        >
                          {adminLocationSearching ? 'Searching...' : 'Search map'}
                        </button>
                      </div>
                      {adminLocationResults.length > 0 && (
                        <div className="space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                          {adminLocationResults.map((result) => (
                            <button
                              type="button"
                              key={result.id}
                              onClick={() => selectAdminLocation(result)}
                              className="block w-full rounded-md px-2 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-primary)]/10"
                            >
                              {result.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input
                          inputMode="decimal"
                          value={adminSiteLocation.service_latitude}
                          onChange={(event) => setAdminSiteLocation((current) => ({ ...current, service_latitude: event.target.value }))}
                          placeholder="Latitude"
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                        />
                        <input
                          inputMode="decimal"
                          value={adminSiteLocation.service_longitude}
                          onChange={(event) => setAdminSiteLocation((current) => ({ ...current, service_longitude: event.target.value }))}
                          placeholder="Longitude"
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                        />
                        <select
                          value={adminSiteLocation.service_coordinate_system}
                          onChange={(event) => setAdminSiteLocation((current) => ({ ...current, service_coordinate_system: event.target.value }))}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                        >
                          <option value="wgs84">WGS84</option>
                          <option value="gcj02">GCJ-02</option>
                        </select>
                      </div>
                      <textarea
                        value={adminSiteLocation.note}
                        onChange={(event) => setAdminSiteLocation((current) => ({ ...current, note: event.target.value }))}
                        rows={2}
                        placeholder="Location confirmation note or arrival instructions"
                        className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                      />
                      <textarea
                        value={adminSiteLocation.reason}
                        onChange={(event) => setAdminSiteLocation((current) => ({ ...current, reason: event.target.value }))}
                        rows={2}
                        placeholder="Required: why Admin is confirming instead of the customer"
                        className="w-full resize-none rounded-lg border border-amber-500/40 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdminOnsiteConfirmation(detail)}
                        disabled={assigningId === `${detail.id}:onsite-confirm`}
                        className="w-full rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        Confirm location on behalf of customer
                      </button>
                    </div>
                  </section>
                )}
                {(detail.arrival_verification_required || detail.arrival_checks?.length > 0) && (
                  <section className="rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="font-medium text-[var(--color-text)]">Arrival verification audit</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Site: {detail.service_address || 'Location not confirmed'}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          Status: {detail.arrival_verified_at ? 'Verified' : 'Waiting for engineer check-in'}
                          {detail.arrival_override_reason ? ` · Admin override: ${detail.arrival_override_reason}` : ''}
                        </p>
                      </div>
                      {!readOnly && detail.arrival_verification_required && !detail.arrival_verified_at && (
                        <button
                          type="button"
                          onClick={() => handleAdminArrivalOverride(detail)}
                          disabled={assigningId === `${detail.id}:arrival-override`}
                          className="shrink-0 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
                        >
                          Manual arrival approval
                        </button>
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      {detail.arrival_checks?.length > 0 ? detail.arrival_checks.map((check) => {
                        const arrivalOutcome = arrivalCheckOutcome(check, t);
                        return <div key={check.id} className="grid min-w-0 gap-1 rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-xs text-[var(--color-text-secondary)] [overflow-wrap:anywhere] sm:grid-cols-4">
                          <span>{formatApiDateTime(check.created_at, runtimeConfig.locale)}</span>
                          <span>Distance: {check.distance_m ?? '-'} m</span>
                          <span>Allowed radius: {check.radius_m ?? '-'} m</span>
                          <span className={arrivalOutcome.tone}>{arrivalOutcome.label}</span>
                        </div>;
                      }) : (
                        <p className="text-xs text-[var(--color-text-muted)]">No engineer arrival attempts have been recorded.</p>
                      )}
                    </div>
                  </section>
                )}
                {(detail.arrival_verification_required || detail.onsite_conversion_status === 'confirmed' || detail.field_plan?.site_timezone || detail.field_days?.length > 0) && (
                  <FieldWorkAdminPanel
                    workOrder={detail}
                    readOnly={readOnly}
                    onRefresh={refreshOpenDetail}
                  />
                )}
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

                {!readOnly && (
                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-3 font-medium text-[var(--color-text)]">{t.headers.dispatch}</h4>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={t.regionalLeadOption}
                        value={selectedRegionalLeads[detail.id] || detail.assigned_regional_lead_id || ''}
                        onChange={(event) => setSelectedRegionalLeads((prev) => ({ ...prev, [detail.id]: event.target.value }))}
                        className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-xs text-[var(--color-text)]"
                      >
                        <option value="">{t.regionalLeadOption}</option>
                        {regionalLeads.map((lead) => (
                          <option key={lead.id} value={lead.id}>{formatEngineerOption(lead)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssignRegionalLead(detail)}
                        disabled={assigningId === `${detail.id}:lead`}
                        className="whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {assigningId === `${detail.id}:lead` ? t.assigning : t.assignRegion}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={t.engineerOption}
                        value={selectedEngineers[detail.id] || detail.engineer_id || ''}
                        onChange={(event) => setSelectedEngineers((prev) => ({ ...prev, [detail.id]: event.target.value }))}
                        className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-xs text-[var(--color-text)]"
                      >
                        <option value="">{t.engineerOption}</option>
                        {engineers.map((engineer) => (
                          <option key={engineer.id} value={engineer.id}>{formatEngineerOption(engineer)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssign(detail)}
                        disabled={assigningId === `${detail.id}:engineer`}
                        className="whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {assigningId === `${detail.id}:engineer` ? t.dispatching : t.directDispatch}
                      </button>
                    </div>
                  </div>
                </section>
                )}

                {detail.status === 'completed' && (
                  <section className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="font-medium text-[var(--color-text)]">Engineer service payment</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Internal closure is not complete until this work order's engineer payout is completed.
                        </p>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2">
                          <div>Status: {payoutLabel(detail.payout_status)}</div>
                          <div>Method: {detail.payout?.method === 'bank_swift' ? 'Bank transfer / SWIFT' : 'PayPal account'}</div>
                          <div>Amount: {detail.payout?.amount ? `${money(detail.payout.amount)} ${detail.payout.currency || 'USD'}` : '-'}</div>
                          <div>Reference: {detail.payout?.transaction_reference || '-'}</div>
                          <div>Paid at: {detail.payout?.paid_at ? new Date(detail.payout.paid_at).toLocaleString('en-US') : '-'}</div>
                          <div>Note: {detail.payout?.internal_note || '-'}</div>
                        </div>
                      </div>
                      {!readOnly && detail.payout_status !== 'completed' && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleUpdatePayout(detail, 'processing')}
                            disabled={assigningId === `${detail.id}:payout:processing`}
                            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] disabled:opacity-50"
                          >
                            Mark payout processing
                          </button>
                          <button
                            onClick={() => handleUpdatePayout(detail, 'completed')}
                            disabled={assigningId === `${detail.id}:payout:completed`}
                            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            Mark payout completed
                          </button>
                          <button
                            onClick={() => handleUpdatePayout(detail, 'exception')}
                            disabled={assigningId === `${detail.id}:payout:exception`}
                            className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-500 disabled:opacity-50"
                          >
                            Mark payout exception
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-2 font-medium">{t.aiSummaryTitle}</h4>
                  <div className="whitespace-pre-wrap rounded-lg bg-[var(--color-surface-elevated)] p-3 text-xs text-[var(--color-text-secondary)]">
                    {formatAiSummary(detail.ai_summary) || t.noAiSummary}
                  </div>
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
                                      <div className="text-[var(--color-text-muted)]">{[part.material_code, part.spec, part.brand].filter(Boolean).join(' · ') || '-'}</div>
                                    </td>
                                    <td className="px-3 py-2 text-right">{part.quantity || 1} {part.unit || 'pcs'}</td>
                                    <td className="px-3 py-2 text-right">{money(part.unit_price)} USD</td>
                                    <td className="px-3 py-2 text-right">{money(part.line_total || Number(part.quantity || 0) * Number(part.unit_price || 0))} USD</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3">
                          <div className="flex justify-between">
                            <span>{t.quoteSubtotalPrice || 'Quote subtotal price'}</span>
                            <span className="font-semibold text-[var(--color-primary)]">{money(subtotal)} USD</span>
                          </div>
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
                          <span>{item.sender_name || item.sender_type}{item.is_internal_note ? ` · ${t.internalNote}` : ''}</span>
                          <span className="text-[var(--color-text-muted)]">{item.created_at?.slice(0, 16)?.replace('T', ' ')}</span>
                        </div>
                        <div>{item.content}</div>
                      </div>
                    ))}
                  </div>
                  {!readOnly && (
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
                  )}
                </section>
              </div>
              </DetailErrorBoundary>
            ) : (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.noDetail}</div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
