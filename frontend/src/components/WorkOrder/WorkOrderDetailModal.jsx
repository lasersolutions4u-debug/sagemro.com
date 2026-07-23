import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import {
  getWorkOrder,
  submitRating,
  resolveWorkOrder,
  cancelWorkOrder,
  submitEngineerReview,
  getEngineerReview,
  checkInWorkOrder,
  requestOnsiteConversion,
  confirmOnsiteConversion,
  searchServiceLocations,
  requestWorkOrderPaymentStart,
  createMachineLead,
} from '../../services/api';
import { statusConfig, urgencyConfig, typeLabels, categoryConfig, categoryL2Labels, formatSlaRemaining } from '../../data/workOrderConfig.js';
import { toastSuccess, toastError, toastWarning, confirmDialog } from '../../utils/feedback';
import { Stars } from './Stars';
import { MessagePanel } from './MessagePanel';
import { EngineerPricingPanel, CustomerPricingPanel } from './PricingPanels';
import { RepairRecordPanel } from './RepairRecordPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { MaterialRequisitionPanel } from './MaterialRequisitionPanel';
import { PaymentModal } from '../Payment/PaymentModal';
import { formatCustomerDeviceLine } from '../../utils/workOrderDisplay';
import { canEngineerViewCustomerContact, redactContactInfo } from '../../utils/contactRedaction';
import { isCnLocale } from '../../utils/locale';
import { formatGeolocationError, getBrowserLocation, isBrowserGeolocationError } from '../../utils/browserGeolocation';
import { Loader2, LocateFixed, MapPin, Search } from 'lucide-react';

function hasServiceReportContent(record) {
  if (!record) return false;
  const hasText = Boolean(record.symptom || record.diagnosis || record.solution);
  const hasLabor = Number(record.labor_hours || 0) > 0;
  let hasParts = false;
  try {
    const parts = JSON.parse(record.parts_used || '[]');
    hasParts = Array.isArray(parts) && parts.some((part) => part?.name);
  } catch {
    hasParts = false;
  }
  return hasText || hasLabor || hasParts;
}

function payoutLabel(status) {
  const labels = {
    not_ready: 'Payout not ready',
    pending: 'Payout pending',
    processing: 'Payout processing',
    completed: 'Payout completed',
    exception: 'Payout exception',
  };
  return labels[status] || status || 'Payout not ready';
}

const MACHINE_NEED_TYPES = [
  'Laser cutting machine',
  'Laser welding machine',
  'Press brake',
  'Production line',
  'Other complete machine',
];

function createEmptyEquipmentNeed() {
  return { type: '', quantity: '1', specification: '', note: '' };
}

// ========== 主组件 ==========
export function WorkOrderDetailModal({ isOpen, onClose, workOrder, onRateSuccess, onConfirmed, userType, userId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('info');
  const [ratings, setRatings] = useState({ timeliness: 5, technical: 5, communication: 5, professional: 5 });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 工程师评价客户
  const [showEngineerReview, setShowEngineerReview] = useState(false);
  const [engineerReview, setEngineerReview] = useState(null);
  const [engReviewRatings, setEngReviewRatings] = useState({ cooperation: 5, communication: 5, payment: 5, environment: 5 });
  const [engReviewComment, setEngReviewComment] = useState('');
  const [engReviewSubmitting, setEngReviewSubmitting] = useState(false);
  const [paymentStartSubmitting, setPaymentStartSubmitting] = useState(false);
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false);
  const [onsiteRequestNote, setOnsiteRequestNote] = useState('');
  const [onsiteSubmitting, setOnsiteSubmitting] = useState(false);
  const [siteLocation, setSiteLocation] = useState({
    service_address: '',
    service_latitude: null,
    service_longitude: null,
    service_accuracy_m: null,
    service_coordinate_system: 'wgs84',
    service_location_source: 'customer_browser',
    note: '',
  });
  const [siteLocationResults, setSiteLocationResults] = useState([]);
  const [siteLocationSearching, setSiteLocationSearching] = useState(false);
  const [siteLocationLocating, setSiteLocationLocating] = useState(false);
  const [machineLeadForm, setMachineLeadForm] = useState({
    equipment_needs: [createEmptyEquipmentNeed()],
    customer_intent: '',
    contact_name: '',
    contact_phone: '',
    region: '',
  });
  const [machineLeadSubmitting, setMachineLeadSubmitting] = useState(false);
  const [balancePaymentOpen, setBalancePaymentOpen] = useState(false);
  const [materialRequisitionBusy, setMaterialRequisitionBusy] = useState(false);
  const workOrderId = workOrder?.id;
  const materialRequisitionBusyMessage = isCnLocale()
    ? '请等待物料申请操作完成后再离开。'
    : 'Wait for the material requisition operation to finish before leaving.';
  const handleMaterialRequisitionBusyChange = useCallback((busy) => {
    setMaterialRequisitionBusy(busy);
  }, []);

  const loadDetail = useCallback(async () => {
    if (!workOrderId) return;
    setLoading(true);
    try {
      const data = await getWorkOrder(workOrderId);
      setDetail(data);
      setSiteLocation({
        service_address: data.service_address || '',
        service_latitude: data.service_latitude ?? null,
        service_longitude: data.service_longitude ?? null,
        service_accuracy_m: data.service_accuracy_m ?? null,
        service_coordinate_system: data.service_coordinate_system || 'wgs84',
        service_location_source: data.service_location_source || 'customer_browser',
        note: '',
      });
      // 加载工程师评价
      if (userType === 'engineer') {
        try {
          const revData = await getEngineerReview(workOrderId);
          setEngineerReview(revData.review);
        } catch {
          // No prior engineer review is fine; keep the review section empty.
        }
      }
    } catch (e) {
      console.error('加载工单详情失败:', e);
    } finally {
      setLoading(false);
    }
  }, [workOrderId, userType]);

  useEffect(() => {
    if (isOpen && workOrderId) {
      loadDetail();
      // 客户侧：待评价/已解决状态自动跳转到评价 tab
      const initialStatus = workOrder.status;
      const autoTab = (userType === 'customer' &&
        (initialStatus === 'pending_review' || initialStatus === 'resolved'))
        ? 'rating' : 'info';
      setTab(autoTab);
    }
  }, [isOpen, workOrder, workOrderId, userType, loadDetail]);

  const handleSubmitRating = async () => {
    if (!detail?.engineer_id || !detail?.customer_id) { toastWarning('Work order information is incomplete'); return; }
    setSubmitting(true);
    try {
      await submitRating({
        work_order_id: detail.id,
        engineer_id: detail.engineer_id,
        customer_id: detail.customer_id,
        rating_timeliness: ratings.timeliness,
        rating_technical: ratings.technical,
        rating_communication: ratings.communication,
        rating_professional: ratings.professional,
        comment,
      });
      toastSuccess('Service confirmed. Your review helps SAGEMRO match better engineers. Thank you.');
      onRateSuccess?.();
      loadDetail();
    } catch (e) {
      toastError('Review submission failed: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFinalReport = async () => {
    if (detail?.arrival_verification_required && !detail?.arrival_verified_at) {
      toastWarning('Please check in at the customer site before submitting the final service report.');
      return;
    }
    if (!hasServiceReportContent(detail?.repair_record)) {
      setTab('repairRecord');
      toastWarning('Please save the service report before submitting the final report.');
      return;
    }
    if (!(await confirmDialog('Submit the final service report to the customer for confirmation and review?'))) return;
    try {
      await resolveWorkOrder(workOrder.id, userId);
      toastSuccess('Final service report sent to the customer for confirmation.');
      setTab('info');
      loadDetail();
      onConfirmed?.();
    } catch (e) {
      toastError('Operation failed: ' + e.message);
    }
  };

  const handleArrivalCheck = async () => {
    setArrivalSubmitting(true);
    try {
      const { coords } = await getBrowserLocation();
      await checkInWorkOrder(workOrder.id, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: coords.accuracy,
        coordinate_system: 'wgs84',
        location_source: 'browser',
      });
      toastSuccess('Arrival verified. You may begin or complete the service task.');
      await loadDetail();
    } catch (error) {
      toastError(isBrowserGeolocationError(error) ? formatGeolocationError(error, false) : (error.message || 'Unable to verify arrival.'));
    } finally {
      setArrivalSubmitting(false);
    }
  };

  const handleRequestOnsite = async () => {
    const note = onsiteRequestNote.trim();
    if (!note) {
      toastWarning('Explain why an on-site visit is required.');
      return;
    }
    setOnsiteSubmitting(true);
    try {
      await requestOnsiteConversion(workOrder.id, note);
      setOnsiteRequestNote('');
      toastSuccess('On-site visit requested. Waiting for the customer to confirm the service location.');
      await loadDetail();
    } catch (e) {
      toastError(e.message || 'Unable to request an on-site visit.');
    } finally {
      setOnsiteSubmitting(false);
    }
  };

  const captureConversionLocation = async () => {
    setSiteLocationLocating(true);
    try {
      const { coords } = await getBrowserLocation();
      setSiteLocation((current) => ({
        ...current,
        service_latitude: coords.latitude,
        service_longitude: coords.longitude,
        service_accuracy_m: coords.accuracy,
        service_coordinate_system: 'wgs84',
        service_location_source: 'customer_browser',
      }));
    } catch (error) {
      toastError(formatGeolocationError(error, false));
    } finally {
      setSiteLocationLocating(false);
    }
  };

  const searchConversionLocation = async () => {
    const query = siteLocation.service_address.trim();
    if (query.length < 2) {
      toastWarning('Enter the customer site address before searching.');
      return;
    }
    setSiteLocationSearching(true);
    try {
      const result = await searchServiceLocations(query);
      setSiteLocationResults(result.results || []);
    } catch (e) {
      setSiteLocationResults([]);
      toastError(e.message || 'Unable to search the service address.');
    } finally {
      setSiteLocationSearching(false);
    }
  };

  const selectConversionLocation = (result) => {
    setSiteLocation((current) => ({
      ...current,
      service_address: result.address || result.label,
      service_latitude: result.latitude,
      service_longitude: result.longitude,
      service_accuracy_m: null,
      service_coordinate_system: result.coordinate_system,
      service_location_source: result.source,
    }));
    setSiteLocationResults([]);
  };

  const handleConfirmOnsite = async () => {
    if (!siteLocation.service_address.trim()
      || siteLocation.service_latitude === null
      || siteLocation.service_longitude === null) {
      toastWarning('Confirm the exact customer site address and map location first.');
      return;
    }
    setOnsiteSubmitting(true);
    try {
      await confirmOnsiteConversion(workOrder.id, siteLocation);
      toastSuccess('Service location confirmed. The engineer must check in after arriving on site.');
      await loadDetail();
    } catch (e) {
      toastError(e.message || 'Unable to confirm the service location.');
    } finally {
      setOnsiteSubmitting(false);
    }
  };

  const updateEquipmentNeed = (index, field, value) => {
    setMachineLeadForm((current) => ({
      ...current,
      equipment_needs: current.equipment_needs.map((need, needIndex) => (
        needIndex === index ? { ...need, [field]: value } : need
      )),
    }));
  };

  const addEquipmentNeed = () => {
    setMachineLeadForm((current) => ({
      ...current,
      equipment_needs: [...current.equipment_needs, createEmptyEquipmentNeed()],
    }));
  };

  const removeEquipmentNeed = (index) => {
    setMachineLeadForm((current) => ({
      ...current,
      equipment_needs: current.equipment_needs.length > 1
        ? current.equipment_needs.filter((_, needIndex) => needIndex !== index)
        : [createEmptyEquipmentNeed()],
    }));
  };

  const handleSubmitMachineLead = async () => {
    const equipmentNeeds = machineLeadForm.equipment_needs.filter((need) => (
      need.type.trim() || need.quantity.trim() || need.specification.trim() || need.note.trim()
    ));
    if (equipmentNeeds.length === 0) {
      toastWarning('Please add at least one complete-machine equipment need.');
      return;
    }
    if (!machineLeadForm.customer_intent.trim()) {
      toastWarning('Please describe the customer whole-machine purchase intent.');
      return;
    }
    setMachineLeadSubmitting(true);
    try {
      await createMachineLead({
        work_order_id: workOrder.id,
        equipment_needs: equipmentNeeds,
        machine_type: equipmentNeeds.map((need) => need.type).filter(Boolean).join('; '),
        customer_intent: machineLeadForm.customer_intent,
        contact_name: machineLeadForm.contact_name || detail?.customer_name || '',
        contact_phone: machineLeadForm.contact_phone || detail?.customer_phone || '',
        region: machineLeadForm.region || detail?.region || detail?.customer_region || '',
      });
      toastSuccess('Machine lead submitted to Admin.');
      setMachineLeadForm({
        equipment_needs: [createEmptyEquipmentNeed()],
        customer_intent: '',
        contact_name: '',
        contact_phone: '',
        region: '',
      });
    } catch (e) {
      toastError('Machine lead submission failed: ' + e.message);
    } finally {
      setMachineLeadSubmitting(false);
    }
  };

  if (!workOrder) return null;

  // 使用 detail 中的最新状态（loadDetail 刷新后），回退到 prop 中的初始状态
  const effectiveStatus = detail?.status || workOrder.status;
  const status = statusConfig[effectiveStatus] || { text: effectiveStatus, color: 'bg-gray-500' };
  const urgency = urgencyConfig[workOrder.urgency] || urgencyConfig.normal;
  const isEngineer = userType === 'engineer';
  const isCustomer = userType === 'customer';
  const assignedEngineerId = detail?.id === workOrder.id
    ? detail.engineer_id
    : workOrder.engineer_id;
  const isAssignedEngineer = isEngineer
    && Boolean(assignedEngineerId)
    && String(assignedEngineerId) === String(userId);
  const shouldShowCustomerContact = !isEngineer || canEngineerViewCustomerContact(effectiveStatus);
  const customerPhoneDisplay = shouldShowCustomerContact ? detail?.customer_phone : detail?.customer_phone ? 'XXX' : '';

  const tabs = [
    { key: 'info', label: 'Details' },
    { key: 'messages', label: 'Messages' },
  ];

  // 核价Tab：工程师看表单，客户看报价确认（含待付款状态）
  const pricingStatuses = ['assigned', 'in_progress', 'pricing', 'pending_payment', 'payment_review', 'in_service'];
  if (pricingStatuses.includes(effectiveStatus)) {
    tabs.push({ key: 'pricing', label: isEngineer ? 'Submit Quote' : 'Confirm Quote' });
  }

  // 评价Tab：客户对服务进行评价（resolved/pending_review 可评价，completed 查看已有评价）
  const canRate = effectiveStatus === 'resolved' || effectiveStatus === 'pending_review';
  const hasRating = detail?.rating;
  if (isCustomer && (canRate || (effectiveStatus === 'completed' && hasRating))) {
    tabs.push({ key: 'rating', label: 'Review' });
  }

  // 维修记录Tab：工程师在服务中及之后可见，客户在有记录时可见
  const hasRepairRecord = detail?.repair_record;
  const repairStatuses = ['in_service', 'pricing', 'resolved', 'pending_review', 'completed'];
  if ((isEngineer && repairStatuses.includes(effectiveStatus)) || (isCustomer && hasRepairRecord)) {
    tabs.push({ key: 'repairRecord', label: 'Service Report' });
  }
  if (isAssignedEngineer) {
    tabs.push({ key: 'materialRequisition', label: isCnLocale() ? '物料领用申请' : 'Material Requisition' });
  }
  if (isEngineer) {
    tabs.push({ key: 'machineLead', label: 'Machine Lead' });
  }

  const renderInfoTab = () => (
    <div className="space-y-4">
      {isEngineer && ['resolved', 'pending_review', 'completed'].includes(effectiveStatus) && (
        <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Engineer service payment</h3>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                This internal closure is handled by Admin after customer confirmation.
              </p>
            </div>
            <span className="rounded-full bg-[var(--color-surface-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
              {payoutLabel(detail?.payout_status)}
            </span>
          </div>
          {detail?.payout && (
            <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-3">
              <div>Method: {detail.payout.method === 'bank_swift' ? 'Bank transfer / SWIFT' : 'PayPal account'}</div>
              <div>Amount: {detail.payout.amount ? `${detail.payout.amount} ${detail.payout.currency || 'USD'}` : '-'}</div>
              <div>Reference: {detail.payout.transaction_reference || '-'}</div>
            </div>
          )}
        </div>
      )}

      {isCustomer && ['resolved', 'pending_review', 'completed'].includes(effectiveStatus) && Number(detail?.payment_policy?.balance_amount || 0) > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Service balance</h3>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Remaining service balance: {detail.payment_policy.balance_amount} USD. Pay after the service report is submitted.
              </p>
            </div>
            {detail?.balance_payment?.status === 'completed' ? (
              <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-600">Payment confirmed</span>
            ) : (
              <button
                onClick={() => setBalancePaymentOpen(true)}
                className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                {detail?.balance_payment?.status === 'awaiting_customer' ? 'Pay service balance' : 'View balance payment'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="break-all font-medium text-[var(--color-text-primary)]">{detail?.order_no || workOrder.id}</span>
          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-0.5 text-xs text-white rounded ${status.color}`}>{status.text}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${urgency.color}`}>{urgency.text}</span>
          </div>
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">Issue Type: {typeLabels[workOrder.type] || workOrder.type}</div>
        {(workOrder.category_l1 && workOrder.category_l1 !== 'other') && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            Equipment Category: {categoryConfig[workOrder.category_l1]?.label || workOrder.category_l1}
            {workOrder.category_l2 && workOrder.category_l2 !== 'other' && (
              <span className="ml-1">· {categoryL2Labels[workOrder.category_l2] || workOrder.category_l2}</span>
            )}
          </div>
        )}
        <div className="text-sm text-[var(--color-text-secondary)]">Submitted: {workOrder.created_at ? new Date(workOrder.created_at).toLocaleString('en-US') : '-'}</div>
        {detail?.sla_deadline && (() => {
          const sla = detail.sla_status || {};
          const remaining = formatSlaRemaining(sla);
          const slaColor = sla.status === 'breached' ? 'text-red-500' : sla.status === 'at_risk' ? 'text-yellow-500' : 'text-green-500';
          return (
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-4">
              <span className="text-[var(--color-text-secondary)]">SLA Deadline: {new Date(detail.sla_deadline).toLocaleString('en-US')}</span>
              {remaining && <span className={slaColor}>{remaining}</span>}
            </div>
          );
        })()}
        {detail?.engineer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            SAGEMRO Engineer: <span className="text-[var(--color-primary)]">{detail.engineer_name}</span>
            {detail.engineer_phone && <span className="ml-1 opacity-70">{detail.engineer_phone}</span>}
          </div>
        )}
        {isCustomer && formatCustomerDeviceLine(detail || workOrder) && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            Machine: <span className="text-[var(--color-text-primary)]">{formatCustomerDeviceLine(detail || workOrder)}</span>
          </div>
        )}
        {detail?.customer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            Customer: <span className="text-[var(--color-primary)]">{detail.customer_name}</span>
            {detail.customer_phone && <span className="ml-1 opacity-70">{customerPhoneDisplay}</span>}
          </div>
        )}
        {isEngineer && detail?.service_address && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            Customer site: <span className="text-[var(--color-text-primary)]">{detail.service_address}</span>
          </div>
        )}
      </div>

      {isEngineer && detail && effectiveStatus === 'in_service' && detail.service_mode !== 'onsite' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">On-site visit required</h3>
              {detail?.onsite_conversion_status === 'requested' ? (
                <div className="mt-2 space-y-2 text-xs text-[var(--color-text-secondary)]">
                  <p>The customer must confirm the exact service address and map point before site check-in is enabled.</p>
                  {detail.onsite_conversion_request_note && (
                    <p className="rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-[var(--color-text-primary)]">
                      Request note: {detail.onsite_conversion_request_note}
                    </p>
                  )}
                  <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-700">
                    Waiting for customer location confirmation
                  </span>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={onsiteRequestNote}
                    onChange={(event) => setOnsiteRequestNote(event.target.value)}
                    rows={3}
                    placeholder="Explain why remote support cannot complete the task and what should be prepared for the visit."
                    className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <button
                    type="button"
                    onClick={handleRequestOnsite}
                    disabled={onsiteSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {onsiteSubmitting && <Loader2 size={16} className="animate-spin" />}
                    Request on-site visit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCustomer && detail?.onsite_conversion_status === 'requested' && (
        <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Confirm the on-site service location</h3>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  The engineer requested an on-site visit. Confirm the exact gate, building, or workshop location before dispatch.
                </p>
                {detail.onsite_conversion_request_note && (
                  <p className="mt-2 rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-xs text-[var(--color-text-primary)]">
                    Engineer note: {detail.onsite_conversion_request_note}
                  </p>
                )}
              </div>
              <input
                type="text"
                value={siteLocation.service_address}
                onChange={(event) => {
                  setSiteLocation((current) => ({
                    ...current,
                    service_address: event.target.value,
                    service_latitude: null,
                    service_longitude: null,
                    service_accuracy_m: null,
                  }));
                  setSiteLocationResults([]);
                }}
                placeholder="Exact customer site address, gate, building, or workshop"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={searchConversionLocation}
                  disabled={siteLocationSearching}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
                >
                  {siteLocationSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Search address
                </button>
                <button
                  type="button"
                  onClick={captureConversionLocation}
                  disabled={siteLocationLocating}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
                >
                  {siteLocationLocating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                  Use current location
                </button>
              </div>
              {siteLocationResults.length > 0 && (
                <div className="space-y-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                  {siteLocationResults.map((result) => (
                    <button
                      type="button"
                      key={result.id}
                      onClick={() => selectConversionLocation(result)}
                      className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-primary)]/10"
                    >
                      {result.label}
                    </button>
                  ))}
                </div>
              )}
              {siteLocation.service_latitude !== null && siteLocation.service_longitude !== null && (
                <p className="text-xs font-medium text-green-600">
                  Map point confirmed{siteLocation.service_accuracy_m ? ` · ±${Math.round(siteLocation.service_accuracy_m)} m` : ''}
                </p>
              )}
              <textarea
                value={siteLocation.note}
                onChange={(event) => setSiteLocation((current) => ({ ...current, note: event.target.value }))}
                rows={2}
                placeholder="Optional arrival instructions, contact person, or gate information"
                className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
              />
              <button
                type="button"
                onClick={handleConfirmOnsite}
                disabled={onsiteSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                {onsiteSubmitting && <Loader2 size={16} className="animate-spin" />}
                Confirm location and on-site visit
              </button>
            </div>
          </div>
        </div>
      )}

      {isEngineer && detail?.arrival_verification_required && effectiveStatus === 'in_service' && (
        <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Arrival verification</h3>
          {detail.arrival_verified_at ? (
            <p className="mt-2 text-xs text-green-600">Arrival verified. You may begin or complete the service task.</p>
          ) : (
            <button
              type="button"
              onClick={handleArrivalCheck}
              disabled={arrivalSubmitting}
              className="mt-3 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {arrivalSubmitting ? 'Getting current location...' : 'Check in at customer site'}
            </button>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Fault Description</h3>
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">
          {isEngineer ? redactContactInfo(workOrder.description) : workOrder.description}
        </div>
      </div>

      {detail?.ai_summary && (() => {
        let aiData;
        try { aiData = typeof detail.ai_summary === 'string' ? JSON.parse(detail.ai_summary) : detail.ai_summary; } catch { return null; }
        return (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">AI Analysis</h3>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-[var(--color-text-primary)] space-y-2">
              {aiData.summary && <p>{aiData.summary}</p>}
              {aiData.required_specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-[var(--color-text-secondary)]">Matched Equipment:</span>
                  {aiData.required_specialties.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {detail?.attachments?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Attachments</h3>
          <AttachmentsPanel
            workOrderId={workOrder.id}
            userType={userType}
            userId={userId}
            readOnly
          />
        </div>
      )}

      {/* 工程师：标记服务完成 */}
      {isEngineer && (effectiveStatus === 'in_service' || effectiveStatus === 'pricing') && (
        <button
          data-testid="mark-service-complete-button"
          onClick={handleSubmitFinalReport}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium"
        >
          Submit Final Report to Customer
        </button>
      )}

      {/* 客户：取消工单 */}
      {isCustomer && ['pending', 'assigned', 'in_progress', 'pricing'].includes(effectiveStatus) && (
        <button
          data-testid="cancel-work-order-button"
          onClick={async () => {
            if (!(await confirmDialog('Are you sure you want to cancel this service request? This action cannot be undone.', { danger: true }))) return;
            try {
              await cancelWorkOrder(workOrder.id);
              toastSuccess('Service request cancelled');
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              toastError('Operation failed: ' + e.message);
            }
          }}
          className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium"
        >
          Cancel Service Request
        </button>
      )}

      {isEngineer && ['pending_payment', 'payment_review'].includes(effectiveStatus) && (
        <button
          onClick={async () => {
            if (!(await confirmDialog('Request Admin approval to start service after advance payment follow-up?'))) return;
            setPaymentStartSubmitting(true);
            try {
              await requestWorkOrderPaymentStart(workOrder.id, 'Engineer confirmed advance payment follow-up with the customer.');
              toastSuccess('Start request sent to Admin for advance payment confirmation.');
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              toastError('Start request failed: ' + e.message);
            } finally {
              setPaymentStartSubmitting(false);
            }
          }}
          disabled={paymentStartSubmitting || effectiveStatus === 'payment_review'}
          className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium"
        >
          {effectiveStatus === 'payment_review'
            ? 'Waiting for Admin Advance Payment Confirmation'
            : paymentStartSubmitting ? 'Submitting...' : 'Request Admin Approval to Start'}
        </button>
      )}

      {detail?.logs?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Progress</h3>
          <div className="space-y-2">
            {detail.logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
                <div>
                  <p className="text-[var(--color-text-primary)]">{log.content}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{new Date(log.created_at).toLocaleString('en-US')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 评价入口（resolved/pending_review状态，客户可见） */}
      {isCustomer && canRate && !hasRating && (
        <button
          data-testid="rate-work-order-button"
          onClick={() => setTab('rating')}
          className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium"
        >
          Confirm Service & Review
        </button>
      )}
      {isCustomer && hasRating && (
        <button
          onClick={() => setTab('rating')}
          className="w-full py-2.5 text-sm text-[var(--color-primary)] hover:underline"
        >
          View Review →
        </button>
      )}

      {/* 工程师评价客户（仅工程师可见） */}
      {isEngineer && (effectiveStatus === 'resolved' || effectiveStatus === 'completed' || effectiveStatus === 'pending_review') && engineerReview && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Your Review of the Customer</h3>
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
            {[
              { key: 'rating_cooperation', label: 'Cooperation' },
              { key: 'rating_communication', label: 'Communication' },
              { key: 'rating_payment', label: 'Payment Timeliness' },
              { key: 'rating_environment', label: 'Site Conditions' },
            ].map((dim) => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
                <Stars value={engineerReview[dim.key]} readonly />
              </div>
            ))}
            {engineerReview.comment && (
              <div className="pt-2 border-t border-blue-500/20 text-sm text-[var(--color-text-primary)]">{engineerReview.comment}</div>
            )}
            <div className="text-xs text-[var(--color-text-muted)]">This review is only visible to SAGEMRO internal operations</div>
          </div>
        </div>
      )}

      {isEngineer && (effectiveStatus === 'resolved' || effectiveStatus === 'completed' || effectiveStatus === 'pending_review') && !engineerReview && !showEngineerReview && (
        <button onClick={() => setShowEngineerReview(true)} className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium">
          Review Customer
        </button>
      )}

      {showEngineerReview && (
        <div className="space-y-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Review Customer</h3>
          <div className="text-xs text-[var(--color-text-muted)]">This review is only visible to SAGEMRO internal operations, not to the customer</div>
          {[
            { key: 'cooperation', label: 'Cooperation' },
            { key: 'communication', label: 'Communication' },
            { key: 'payment', label: 'Payment Timeliness' },
            { key: 'environment', label: 'Site Conditions' },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={engReviewRatings[dim.key]} onChange={(v) => setEngReviewRatings({ ...engReviewRatings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={engReviewComment} onChange={(e) => setEngReviewComment(e.target.value)} placeholder="Note customer cooperation details (optional)..." rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowEngineerReview(false)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">Cancel</button>
            <button
              onClick={async () => {
                if (!detail?.engineer_id || !detail?.customer_id) { toastWarning('Work order information is incomplete'); return; }
                setEngReviewSubmitting(true);
                try {
                  await submitEngineerReview(workOrder.id, {
                    engineer_id: detail.engineer_id,
                    customer_id: detail.customer_id,
                    rating_cooperation: engReviewRatings.cooperation,
                    rating_communication: engReviewRatings.communication,
                    rating_payment: engReviewRatings.payment,
                    rating_environment: engReviewRatings.environment,
                    comment: engReviewComment,
                  });
                  setShowEngineerReview(false);
                  toastSuccess('Service confirmed. Your review helps SAGEMRO operations improve service coordination. Thank you.');
                  loadDetail();
                } catch (e) {
                  toastError('Review submission failed: ' + e.message);
                } finally {
                  setEngReviewSubmitting(false);
                }
              }}
              disabled={engReviewSubmitting}
              className="flex-1 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl text-sm"
            >
              {engReviewSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderRatingTab = () => (
    <div className="space-y-4">
      {hasRating ? (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Your Review</h3>
          <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl space-y-2">
            {[
              { key: 'timeliness', label: 'Timeliness' },
              { key: 'technical', label: 'Technical Skill' },
              { key: 'communication', label: 'Communication' },
              { key: 'professional', label: 'Professionalism' },
            ].map((dim) => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
                <Stars value={detail.rating[`rating_${dim.key}`]} readonly />
              </div>
            ))}
            {detail.rating.comment && (
              <div className="pt-3 border-t border-[var(--color-border)] text-sm text-[var(--color-text-primary)]">{detail.rating.comment}</div>
            )}
            <div className="pt-1 text-xs text-[var(--color-text-muted)]">
              Reviewed: {detail.rating.created_at ? new Date(detail.rating.created_at).toLocaleString('en-US') : '-'}
            </div>
          </div>
        </div>
      ) : canRate ? (
        <div className="space-y-3 p-4 bg-[var(--color-surface-elevated)] rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Service Review</h3>
          {[
            { key: 'timeliness', label: 'Timeliness' },
            { key: 'technical', label: 'Technical Skill' },
            { key: 'communication', label: 'Communication' },
            { key: 'professional', label: 'Professionalism' },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={ratings[dim.key]} onChange={(v) => setRatings({ ...ratings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your service experience (optional)..." rows={3}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none" />
          <button
            data-testid="submit-rating-button"
            onClick={handleSubmitRating}
            disabled={submitting}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-xl font-medium"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">Review not available</div>
      )}
    </div>
  );

  const renderMachineLeadTab = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-4">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Whole-machine opportunity</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
          Use this only when the customer is considering one or more new complete machines such as laser cutting, laser welding, press brake, or production line equipment. Parts, consumables, peripherals, and retrofit opportunities stay in engineer value-added service workflows.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Equipment needs</h4>
          <button
            type="button"
            onClick={addEquipmentNeed}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
          >
            Add equipment
          </button>
        </div>
        {machineLeadForm.equipment_needs.map((need, index) => (
          <div key={index} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Equipment #{index + 1}</span>
              <button
                type="button"
                onClick={() => removeEquipmentNeed(index)}
                className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                Remove
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_0.5fr_1.3fr]">
              <label>
                <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Equipment type</span>
                <select
                  value={need.type}
                  onChange={(e) => updateEquipmentNeed(index, 'type', e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Select type</option>
                  {MACHINE_NEED_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Quantity</span>
                <input
                  value={need.quantity}
                  onChange={(e) => updateEquipmentNeed(index, 'quantity', e.target.value)}
                  placeholder="1"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Power / specification</span>
                <input
                  value={need.specification}
                  onChange={(e) => updateEquipmentNeed(index, 'specification', e.target.value)}
                  placeholder="3015 single table, 3000W"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </label>
              <label className="sm:col-span-3">
                <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Need notes</span>
                <input
                  value={need.note}
                  onChange={(e) => updateEquipmentNeed(index, 'note', e.target.value)}
                  placeholder="Timeline, preferred configuration, known constraints"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Region</span>
          <input
            value={machineLeadForm.region}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, region: e.target.value })}
            placeholder={detail?.region || detail?.customer_region || 'Country / city'}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Contact name</span>
          <input
            value={machineLeadForm.contact_name}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, contact_name: e.target.value })}
            placeholder={detail?.customer_name || 'Customer contact'}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Contact phone</span>
          <input
            value={machineLeadForm.contact_phone}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, contact_phone: e.target.value })}
            placeholder={shouldShowCustomerContact ? detail?.customer_phone || 'Phone' : 'Visible after service starts'}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Customer purchase intent *</span>
          <textarea
            value={machineLeadForm.customer_intent}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, customer_intent: e.target.value })}
            placeholder="Describe the customer's whole-machine demand, planned timeline, production goal, budget signals, and technical context Admin should review."
            rows={4}
            className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
      </div>

      <button
        onClick={handleSubmitMachineLead}
        disabled={machineLeadSubmitting}
        className="w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {machineLeadSubmitting ? 'Submitting...' : 'Submit to Admin'}
      </button>
    </div>
  );

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Work Order Details"
      size="2xl"
      closeDisabled={materialRequisitionBusy}
      closeDisabledTitle={materialRequisitionBusyMessage}
    >
      <div className="min-h-0">
        {materialRequisitionBusy && (
          <p role="status" className="sr-only">{materialRequisitionBusyMessage}</p>
        )}
        {/* Tab 切换 */}
        <div role="tablist" className="-mx-3 mb-4 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] px-3 pb-0 sm:mx-0 sm:px-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              disabled={materialRequisitionBusy && tab !== t.key}
              title={materialRequisitionBusy && tab !== t.key ? materialRequisitionBusyMessage : undefined}
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                tab === t.key
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-[var(--color-text-muted)]">Loading...</div>
        ) : (
          <>
            {tab === 'info' && renderInfoTab()}
            {tab === 'messages' && (
              <MessagePanel workOrderId={workOrder.id} userType={userType} userId={userId} />
            )}
            {tab === 'pricing' && isEngineer && (
              <EngineerPricingPanel
                workOrderId={workOrder.id}
                engineerId={userId}
                pricing={detail?.pricing || null}
                onSubmitted={() => { loadDetail(); onConfirmed?.(); }}
              />
            )}
            {tab === 'pricing' && isCustomer && (
              <CustomerPricingPanel
                workOrderId={workOrder.id}
                customerId={userId}
                onConfirmed={(nextTab) => {
                  if (nextTab) setTab(nextTab);
                  loadDetail();
                  onConfirmed?.();
                }}
              />
            )}
            {tab === 'rating' && renderRatingTab()}
            {tab === 'repairRecord' && (
              <RepairRecordPanel
                workOrderId={workOrder.id}
                userType={userType}
                repairRecord={detail?.repair_record || null}
                onSaved={() => loadDetail()}
                onSubmitComplete={handleSubmitFinalReport}
                canSubmitComplete={isEngineer && (effectiveStatus === 'in_service' || effectiveStatus === 'pricing')}
              />
            )}
            {tab === 'materialRequisition' && isAssignedEngineer && (
              <MaterialRequisitionPanel
                workOrderId={workOrder.id}
                onBusyChange={handleMaterialRequisitionBusyChange}
              />
            )}
            {tab === 'machineLead' && renderMachineLeadTab()}
          </>
        )}
      </div>
    </Modal>
    <PaymentModal
      isOpen={balancePaymentOpen}
      onClose={() => setBalancePaymentOpen(false)}
      workOrderId={workOrderId}
      customerId={userId}
      paymentStage="balance"
      onPaid={() => { setBalancePaymentOpen(false); loadDetail(); onConfirmed?.(); }}
    />
    </>
  );
}
