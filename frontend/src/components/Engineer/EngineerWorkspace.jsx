import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  Package,
  ReceiptText,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import {
  assignEngineerWorkOrder,
  acceptTicket,
  getEngineerCalendarEvents,
  getEngineerTeam,
  getEngineerTickets,
  rejectTicket,
  updateEngineerStatus,
} from '../../services/api';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';
import { Modal } from '../common/Modal';
import { EngineerAvailabilityCalendar } from './EngineerAvailabilityCalendar';
import {
  categoryConfig,
  categoryConfigCn,
  categoryL2Labels,
  categoryL2LabelsCn,
  typeLabels,
  typeLabelsCn,
} from '../../data/workOrderConfig';
import { redactContactInfo } from '../../utils/contactRedaction';
import { isCnLocale } from '../../utils/locale';

const STATUS_LABELS = {
  pending: 'Pending Confirmation',
  pending_dispatch: 'Pending Regional Dispatch',
  assigned: 'Pending Confirmation',
  in_progress: 'In Service',
  pricing: 'Pending Quote',
  in_service: 'In Service',
  resolved: 'Awaiting Customer Confirmation',
  pending_review: 'Pending Archive',
  completed: 'Completed',
};

const STATUS_LABELS_CN = {
  pending: '待确认',
  pending_dispatch: '待区域派工',
  assigned: '待确认派工',
  in_progress: '服务处理中',
  pricing: '待报价',
  in_service: '服务中',
  resolved: '待客户确认',
  pending_review: '待归档',
  completed: '已完成',
};

const CHECKLIST = [
  'Confirm customer issue, machine model, site contact, and arrival window',
  'Review the customer request summary and flag safety risks',
  'Check spare parts, tools, consumables, and protective equipment',
  'Record nameplate, alarm screen, and fault area photos on site',
  'Document service actions, parts replacement, and follow-up recommendations',
  'Submit the service report for customer confirmation',
];

const CHECKLIST_CN = [
  '确认客户问题、设备型号、现场联系人和到场时间',
  '核对客户需求摘要，并标记安全风险',
  '检查备件、工具、耗材和防护用品',
  '现场记录铭牌、报警画面和故障区域照片',
  '记录服务动作、配件更换和后续建议',
  '提交服务报告给客户确认',
];

const CALENDAR_PREVIEW_DAYS = 30;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_LABELS_CN = ['日', '一', '二', '三', '四', '五', '六'];

const WORKSPACE_COPY = {
  en: {
    regionalTitle: 'Regional Lead Workspace',
    engineerTitle: 'Engineer Workspace',
    subtitle: 'SAGEMRO Service Console',
    profileFallback: 'Engineer Profile',
    signOut: 'Sign Out',
    loadTasksFailed: 'Failed to load service tasks',
    loadTeamFailed: 'Failed to load team engineers',
    updateAvailabilityFailed: 'Failed to update availability',
    selectEngineerFirst: 'Please select a service engineer first',
    assigned: (orderNo) => `Assigned: ${orderNo}`,
    assignFailed: 'Failed to assign engineer',
    assignmentConfirmed: (orderNo) => `Assignment confirmed: ${orderNo}`,
    confirmFailed: 'Failed to confirm assignment',
    returnPrompt: 'Please enter the reason for returning this dispatch. It will be recorded for SAGEMRO operations.',
    returnReasonRequired: 'Please enter a return reason before submitting.',
    returned: (orderNo) => `Returned to dispatch: ${orderNo}`,
    returnFailed: 'Failed to return assignment',
    needsAction: 'Needs action',
    todayTasks: "Today's Tasks",
    pendingConfirmation: 'Pending Confirmation',
    inService: 'In Service',
    quotePending: 'Quote Pending',
    scheduledDates: 'Scheduled Dates',
    reportsDue: 'Reports Due',
    partsNeeds: 'Parts Needs',
    regionalQueue: 'Regional Queue',
    paymentFollowUp: 'Payment Follow-up',
    taskOverview: 'Task Overview',
    taskOverviewNote: 'Only service tasks assigned through SAGEMRO are shown here.',
    statuses: { available: 'Available', paused: 'Paused', offline: 'Offline' },
    calendarTitle: 'Scheduling Calendar',
    calendarNote: 'Update availability, blocked dates, and service windows.',
    openCalendar: 'Open calendar',
    calendarRange: 'Future 30 days · Scheduled dates',
    loadingShort: 'Loading',
    scheduledCount: (count) => `${count} scheduled`,
    serviceTasks: 'Service Tasks',
    loading: 'Loading...',
    emptyTasks: 'No assigned service tasks yet',
    customerFallback: 'Customer',
    regionFallback: 'Region pending',
    descriptionFallback: 'No service description yet',
    nextStep: 'Next step',
    customerIssue: 'Customer issue',
    safetyRisk: 'Safety risk',
    currentEngineer: 'Current engineer',
    highRisk: 'High risk',
    priority: 'Priority',
    standard: 'Standard',
    pendingRegionalAssignment: 'Pending regional assignment',
    viewTask: 'View / Handle Task',
    confirming: 'Confirming',
    confirmAssignment: 'Confirm Assignment',
    returning: 'Returning',
    returnToDispatch: 'Return to Dispatch',
    conflictCheck: 'Conflict check',
    conflictFallback: 'This engineer cannot receive this work order',
    regionalLeadAssignment: 'Regional Lead Assignment',
    selectTeamEngineer: 'Select team engineer',
    assigning: 'Assigning',
    assignEngineer: 'Assign Engineer',
    assignmentGuard: 'SAGEMRO blocks assignments when customer and engineer profiles show phone, company, or address conflicts.',
    contextTitle: 'Current Task Context',
    workOrder: 'Work Order',
    customerRegion: 'Customer / Region',
    machineServiceType: 'Machine / Service Type',
    nextStepLabel: 'Next Step',
    noActiveTask: 'No active task selected.',
    preparationTitle: 'Job Preparation',
    preparationFor: (orderNo) => `Preparation for ${orderNo}`,
    aiIntakeSummary: 'Service Request Summary',
    equipmentRecord: 'Customer Equipment Record',
    selectTaskHint: 'Select a service task to review customer issue, machine record, and preparation notes.',
    checklistTitle: 'Service Standard Checklist',
    modalCalendarTitle: 'My Scheduling Calendar',
    machinePending: 'Machine details pending',
    intakeFallback: 'Review the customer description, quote details, messages, attachments, and service report before taking action.',
    issueFallback: 'Review the customer issue and service context before taking action.',
    nextActions: {
      pending: 'Wait for SAGEMRO dispatch review.',
      pending_dispatch: 'Regional Lead should assign a qualified engineer.',
      assigned: 'Confirm assignment or return it with a reason.',
      in_progress: 'Prepare quote, site plan, and customer communication.',
      pricing: 'Submit or update the quote for Admin review.',
      pending_payment: 'Follow up with the customer and request Admin approval after payment.',
      payment_review: 'Wait for Admin payment confirmation before starting service.',
      in_service: 'Complete the service report and submit it to the customer.',
      resolved: 'Wait for customer confirmation and review.',
      pending_review: 'Wait for customer confirmation and review.',
      completed: 'Confirm payout status and archive your notes.',
      fallback: 'Open the task and review current details.',
    },
  },
  cn: {
    regionalTitle: '区域负责人工作台',
    engineerTitle: '工程师工作台',
    subtitle: 'SAGEMRO 服务工作台',
    profileFallback: '工程师资料',
    signOut: '退出登录',
    loadTasksFailed: '服务任务加载失败',
    loadTeamFailed: '团队工程师加载失败',
    updateAvailabilityFailed: '可服务状态更新失败',
    selectEngineerFirst: '请先选择服务工程师',
    assigned: (orderNo) => `已派工：${orderNo}`,
    assignFailed: '工程师派工失败',
    assignmentConfirmed: (orderNo) => `派工已确认：${orderNo}`,
    confirmFailed: '派工确认失败',
    returnPrompt: '请输入退回派工的原因，该原因会记录给 SAGEMRO 运营。',
    returnReasonRequired: '提交前请填写退回原因。',
    returned: (orderNo) => `已退回派工：${orderNo}`,
    returnFailed: '退回派工失败',
    needsAction: '待处理',
    todayTasks: '今日任务',
    pendingConfirmation: '待确认',
    inService: '服务中',
    quotePending: '待报价',
    scheduledDates: '已排期日期',
    reportsDue: '待提交报告',
    partsNeeds: '配件需求',
    regionalQueue: '区域队列',
    paymentFollowUp: '付款跟进',
    taskOverview: '任务概览',
    taskOverviewNote: '这里只显示通过 SAGEMRO 分配给你的服务任务。',
    statuses: { available: '可接单', paused: '暂停接单', offline: '离线' },
    calendarTitle: '排期日历',
    calendarNote: '维护可服务时间、不可服务日期和现场服务窗口。',
    openCalendar: '打开日历',
    calendarRange: '未来 30 天 · 已安排日期',
    loadingShort: '加载中',
    scheduledCount: (count) => `${count} 个已安排`,
    serviceTasks: '服务任务',
    loading: '加载中...',
    emptyTasks: '暂无已分配服务任务',
    customerFallback: '客户',
    regionFallback: '地区待补充',
    descriptionFallback: '暂无服务描述',
    nextStep: '下一步',
    customerIssue: '客户问题',
    safetyRisk: '安全风险',
    currentEngineer: '当前工程师',
    highRisk: '高风险',
    priority: '优先处理',
    standard: '常规',
    pendingRegionalAssignment: '等待区域派工',
    viewTask: '查看 / 处理任务',
    confirming: '确认中',
    confirmAssignment: '接受派工',
    returning: '退回中',
    returnToDispatch: '退回派工',
    conflictCheck: '冲突检查',
    conflictFallback: '该工程师暂不能接收这个工单',
    regionalLeadAssignment: '区域负责人派工',
    selectTeamEngineer: '选择团队工程师',
    assigning: '派工中',
    assignEngineer: '分配工程师',
    assignmentGuard: '当客户与工程师档案存在电话、公司或地址冲突时，SAGEMRO 会阻止派工。',
    contextTitle: '当前任务上下文',
    workOrder: '工单',
    customerRegion: '客户 / 地区',
    machineServiceType: '设备 / 服务类型',
    nextStepLabel: '下一步',
    noActiveTask: '暂无选中的任务。',
    preparationTitle: '服务准备',
    preparationFor: (orderNo) => `${orderNo} 的服务准备`,
    aiIntakeSummary: '工单信息摘要',
    equipmentRecord: '客户设备档案',
    selectTaskHint: '选择一个服务任务，查看客户问题、设备档案和准备要点。',
    checklistTitle: '服务标准检查清单',
    modalCalendarTitle: '我的排期日历',
    machinePending: '设备信息待补充',
    intakeFallback: '处理前请查看客户描述、报价、消息、附件和服务报告。',
    issueFallback: '处理前请查看客户问题和服务上下文。',
    nextActions: {
      pending: '等待 SAGEMRO 派工审核。',
      pending_dispatch: '区域负责人需要分配合适的工程师。',
      assigned: '接受派工，或填写原因退回。',
      in_progress: '准备报价、现场计划和客户沟通。',
      pricing: '提交或更新报价，等待 Admin 审核。',
      pending_payment: '跟进客户付款，并在付款后请求 Admin 批准开始服务。',
      payment_review: '等待 Admin 确认付款后再开始服务。',
      in_service: '完成服务报告并提交给客户确认。',
      resolved: '等待客户确认和评价。',
      pending_review: '等待客户确认和评价。',
      completed: '确认结算状态并归档记录。',
      fallback: '打开任务并查看当前详情。',
    },
  },
};

// This component is the first shared implementation slice for the future
// engineer.sagemro.com portal. The customer main site should not remain the
// long-term engineer entry.
function groupTickets(tickets) {
  return {
    today: tickets.filter((ticket) => ['assigned', 'in_progress', 'in_service'].includes(ticket.status)),
    needsAction: tickets.filter((ticket) => ['assigned', 'pricing', 'in_service', 'pending_payment'].includes(ticket.status)),
    pending: tickets.filter((ticket) => ['pending', 'pending_dispatch', 'assigned'].includes(ticket.status)),
    regionalQueue: tickets.filter((ticket) => ticket.status === 'pending_dispatch'),
    active: tickets.filter((ticket) => ['in_progress', 'in_service', 'pricing'].includes(ticket.status)),
    quotePending: tickets.filter((ticket) => ticket.status === 'pricing'),
    paymentFollowUp: tickets.filter((ticket) => ['pending_payment', 'payment_review'].includes(ticket.status)),
    reports: tickets.filter((ticket) => ['resolved', 'pending_review'].includes(ticket.status)),
    parts: tickets.filter((ticket) => /parts|spare|consumable/i.test(`${ticket.type || ''} ${ticket.description || ''}`)),
  };
}

function getNextAction(ticket, copy = WORKSPACE_COPY.en) {
  return copy.nextActions[ticket?.status] || copy.nextActions.fallback;
}

function getDeviceLabel(ticket, isCn = false) {
  const categories = isCn ? categoryConfigCn : categoryConfig;
  const types = isCn ? typeLabelsCn : typeLabels;
  const label = ticket?.category_l1 && ticket.category_l1 !== 'other'
    ? categories[ticket.category_l1]?.label
    : types[ticket?.type];
  return label || '';
}

function getIssueLabel(ticket, isCn = false) {
  if (!ticket?.category_l2 || ticket.category_l2 === 'other') return '';
  const categories = isCn ? categoryConfigCn : categoryConfig;
  const labels = isCn ? categoryL2LabelsCn : categoryL2Labels;
  return categories[ticket.category_l1]?.l2?.[ticket.category_l2] || labels[ticket.category_l2] || '';
}

function getMachineLine(ticket, isCn = false, copy = WORKSPACE_COPY.en) {
  const deviceDetails = [ticket?.device_brand || ticket?.brand, ticket?.device_model || ticket?.model].filter(Boolean);
  const serviceContext = [getDeviceLabel(ticket, isCn), getIssueLabel(ticket, isCn)].filter(Boolean);
  return [...serviceContext, ...deviceDetails].filter(Boolean).join(' / ') || copy.machinePending;
}

function tryParseAiSummary(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatAiIntakeSummary(ticket, copy = WORKSPACE_COPY.en) {
  const raw = ticket?.ai_summary || ticket?.summary || '';
  const summary = tryParseAiSummary(raw);
  if (!summary) {
    return {
      text: raw || ticket?.description || copy.intakeFallback,
      tags: [],
      notes: '',
    };
  }
  const tags = [
    ...(Array.isArray(summary.required_specialties) ? summary.required_specialties : []),
    ...(Array.isArray(summary.suggested_skills) ? summary.suggested_skills : []),
  ].filter(Boolean);
  return {
    text: summary.summary || ticket?.description || copy.issueFallback,
    tags,
    notes: summary.urgency_notes || '',
  };
}

const CHINESE_ENGINEER_DESCRIPTION_TERMS = [
  ['客户', 'Customer'],
  ['所在地区', 'Region'],
  ['休斯顿地区', 'Houston area'],
  ['设备类型', 'Equipment type'],
  ['设备品牌', 'Brand'],
  ['设备型号', 'Model'],
  ['设备', 'Machine'],
  ['品牌', 'Brand'],
  ['型号', 'Model'],
  ['故障', 'Fault'],
  ['激光切割机', 'laser cutting machine'],
  ['激光切割头', 'laser cutting head'],
  ['光纤激光器', 'fiber laser source'],
  ['不锈钢', 'stainless steel'],
  ['主要加工', 'mainly processes'],
  ['搭载', 'equipped with'],
  ['自动对焦无法校准', 'auto-focus cannot be calibrated'],
  ['校准启动时', 'when calibration starts'],
  ['轴头部完全不动', 'axis head does not move at all'],
  ['无碰撞或撞头历史', 'no collision or cutting-head crash history'],
  ['尚未完成', 'has not completed'],
  ['手动 JOG 测试', 'manual JOG test'],
  ['手动JOG测试', 'manual JOG test'],
  ['电容放大器', 'capacitance amplifier'],
  ['指示灯检查', 'indicator light check'],
  ['控制器报警确认', 'controller alarm confirmation'],
  ['生产已停产', 'production is stopped'],
  ['紧急程度为', 'urgency is'],
];

function replaceChineseDeviceLabels(text) {
  return CHINESE_ENGINEER_DESCRIPTION_TERMS.reduce(
    (value, [source, replacement]) => value.split(source).join(replacement),
    String(text || ''),
  )
    .replace(/Equipment type[：:]/g, 'Equipment type: ')
    .replace(/Brand[：:]/g, 'Brand: ')
    .replace(/Model[：:]/g, 'Model: ')
    .replace(/Region[：:]/g, 'Region: ')
    .replace(/；/g, '; ')
    .replace(/，/g, ', ')
    .replace(/。/g, '. ');
}

function formatEngineerDescription(description, isCn = false) {
  if (isCn) return redactContactInfo(description);
  return redactContactInfo(replaceChineseDeviceLabels(description));
}

function startOfLocalDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateKey(value) {
  const date = startOfLocalDay(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildCalendarPreviewDays(referenceDate = new Date(), length = CALENDAR_PREVIEW_DAYS) {
  const start = startOfLocalDay(referenceDate);
  return Array.from({ length }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: formatDateKey(date),
      date,
      day: date.getDate(),
      month: date.getMonth(),
      isToday: index === 0,
    };
  });
}

function getScheduledDateKeys(events, referenceDate = new Date(), length = CALENDAR_PREVIEW_DAYS) {
  const windowStart = startOfLocalDay(referenceDate);
  const windowEnd = addDays(windowStart, length - 1);
  const scheduled = new Set();

  events.forEach((event) => {
    const start = new Date(event.start_at);
    const end = new Date(event.end_at || event.start_at);
    if (Number.isNaN(start.getTime())) return;

    const eventStart = startOfLocalDay(start);
    const eventEnd = Number.isNaN(end.getTime()) ? eventStart : startOfLocalDay(end);
    const rangeStart = eventStart < windowStart ? windowStart : eventStart;
    const rangeEnd = eventEnd > windowEnd ? windowEnd : eventEnd;

    for (let day = rangeStart; day <= rangeEnd; day = addDays(day, 1)) {
      scheduled.add(formatDateKey(day));
    }
  });

  return scheduled;
}

export function EngineerWorkspace({ currentUser, onLogout, onOpenProfile }) {
  const isCn = isCnLocale();
  const copy = isCn ? WORKSPACE_COPY.cn : WORKSPACE_COPY.en;
  const statusLabels = isCn ? STATUS_LABELS_CN : STATUS_LABELS;
  const checklist = isCn ? CHECKLIST_CN : CHECKLIST;
  const weekdayLabels = isCn ? WEEKDAY_LABELS_CN : WEEKDAY_LABELS;
  const engineerId = localStorage.getItem('sagemro_engineer_id');
  const isRegionalLead =
    currentUser?.role === 'regional_lead' ||
    currentUser?.engineer_role === 'regional_lead' ||
    currentUser?.level === 'regional_lead';
  const [tickets, setTickets] = useState([]);
  const [team, setTeam] = useState([]);
  const [selectedEngineer, setSelectedEngineer] = useState({});
  const [assigningId, setAssigningId] = useState('');
  const [status, setStatus] = useState('available');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarPreviewEvents, setCalendarPreviewEvents] = useState([]);
  const [calendarPreviewLoading, setCalendarPreviewLoading] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!engineerId) return;
    setLoading(true);
    try {
      const data = await getEngineerTickets(engineerId);
      setTickets(data.work_orders || []);
    } catch (error) {
      setMessage(error.message || copy.loadTasksFailed);
    } finally {
      setLoading(false);
    }
  }, [engineerId, copy.loadTasksFailed]);

  const loadTeam = useCallback(async () => {
    if (!isRegionalLead) return;
    try {
      const data = await getEngineerTeam();
      setTeam(data.engineers || []);
    } catch (error) {
      setMessage(error.message || copy.loadTeamFailed);
    }
  }, [isRegionalLead, copy.loadTeamFailed]);

  const loadCalendarPreview = useCallback(async () => {
    setCalendarPreviewLoading(true);
    try {
      const from = startOfLocalDay(new Date());
      const to = addDays(from, CALENDAR_PREVIEW_DAYS);
      const data = await getEngineerCalendarEvents({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setCalendarPreviewEvents(data.events || []);
    } catch {
      setCalendarPreviewEvents([]);
    } finally {
      setCalendarPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    loadCalendarPreview();
  }, [loadCalendarPreview]);

  const updateStatus = async (nextStatus) => {
    setStatus(nextStatus);
    try {
      await updateEngineerStatus({ engineer_id: engineerId, status: nextStatus });
    } catch (error) {
      setMessage(error.message || copy.updateAvailabilityFailed);
    }
  };

  const assignToEngineer = async (ticket) => {
    const engineerIdToAssign = selectedEngineer[ticket.id];
    if (!engineerIdToAssign) {
      setMessage(copy.selectEngineerFirst);
      return;
    }
    setAssigningId(ticket.id);
    setMessage('');
    try {
      const data = await assignEngineerWorkOrder({
        work_order_id: ticket.id,
        engineer_id: engineerIdToAssign,
      });
      const assigned = data.work_order || {};
      setTickets((prev) => prev.map((item) => (
        item.id === ticket.id
          ? {
              ...item,
              status: assigned.status || 'assigned',
              engineer_id: assigned.engineer_id,
              engineer_name: assigned.engineer_name,
              conflict_status: 'clear',
              conflict_reason: '',
            }
          : item
      )));
      setMessage(copy.assigned(ticket.order_no || ticket.id));
    } catch (error) {
      setMessage(error.message || copy.assignFailed);
    } finally {
      setAssigningId('');
    }
  };

  const confirmAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:accept`);
    setMessage('');
    try {
      await acceptTicket({ work_order_id: ticket.id, engineer_id: engineerId });
      setMessage(copy.assignmentConfirmed(ticket.order_no || ticket.id));
      await loadTickets();
    } catch (error) {
      setMessage(error.message || copy.confirmFailed);
    } finally {
      setAssigningId('');
    }
  };

  const returnAssignment = async (ticket) => {
    const reason = window.prompt(
      copy.returnPrompt,
      '',
    )?.trim();
    if (!reason) {
      setMessage(copy.returnReasonRequired);
      return;
    }
    setAssigningId(`${ticket.id}:reject`);
    setMessage('');
    try {
      await rejectTicket({ work_order_id: ticket.id, engineer_id: engineerId, reason });
      setMessage(copy.returned(ticket.order_no || ticket.id));
      await loadTickets();
    } catch (error) {
      setMessage(error.message || copy.returnFailed);
    } finally {
      setAssigningId('');
    }
  };

  const grouped = groupTickets(tickets);
  const activeTicket = selectedTicket || tickets[0] || null;
  const activeAiSummary = formatAiIntakeSummary(activeTicket, copy);
  const calendarPreviewDays = buildCalendarPreviewDays();
  const scheduledDateKeys = getScheduledDateKeys(calendarPreviewEvents, calendarPreviewDays[0]?.date);
  const scheduledPreviewCount = calendarPreviewDays.filter((day) => scheduledDateKeys.has(day.key)).length;
  const personalMetrics = [
    { icon: AlertTriangle, label: copy.needsAction, value: grouped.needsAction.length },
    { icon: ClipboardCheck, label: copy.todayTasks, value: grouped.today.length },
    { icon: AlertTriangle, label: copy.pendingConfirmation, value: grouped.pending.length },
    { icon: Wrench, label: copy.inService, value: grouped.active.length },
    { icon: ReceiptText, label: copy.quotePending, value: grouped.quotePending.length },
    { icon: CalendarDays, label: copy.scheduledDates, value: scheduledPreviewCount },
    { icon: FileText, label: copy.reportsDue, value: grouped.reports.length },
    { icon: Package, label: copy.partsNeeds, value: grouped.parts.length },
  ];
  const regionalMetrics = isRegionalLead
    ? [
        { icon: ClipboardCheck, label: copy.regionalQueue, value: grouped.regionalQueue.length },
        { icon: CreditCard, label: copy.paymentFollowUp, value: grouped.paymentFollowUp.length },
      ]
    : [];
  const metrics = [...regionalMetrics, ...personalMetrics];

  return (
    <>
    <div className="h-[100dvh] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-primary)]">SAGEMRO</div>
            <h1 className="text-xl font-semibold">
              {isRegionalLead ? copy.regionalTitle : copy.engineerTitle}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">{copy.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
            <button
              onClick={onOpenProfile}
              className="min-h-10 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {currentUser?.name || copy.profileFallback}
            </button>
            <button
              onClick={onLogout}
              className="min-h-10 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              {copy.signOut}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
        {message && (
          <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            {message}
          </div>
        )}

        <section className="mb-6 grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">{copy.taskOverview}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">{copy.taskOverviewNote}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex">
                {[
                  { value: 'available', label: copy.statuses.available },
                  { value: 'paused', label: copy.statuses.paused },
                  { value: 'offline', label: copy.statuses.offline },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => updateStatus(item.value)}
                    className={`min-h-8 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      status === item.value
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                  <metric.icon size={18} className="mb-2 text-[var(--color-primary)]" />
                  <div className="text-2xl font-semibold">{metric.value}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsCalendarOpen(true)}
            className="group flex h-full flex-col gap-3 rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-surface)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{copy.calendarTitle}</h2>
                <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                  {copy.calendarNote}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
                {copy.openCalendar}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--color-text-secondary)]">
                <span>{copy.calendarRange}</span>
                <span>{calendarPreviewLoading ? copy.loadingShort : copy.scheduledCount(scheduledPreviewCount)}</span>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-[var(--color-text-muted)]">
                {weekdayLabels.map((label, index) => (
                  <div key={`${label}-${index}`}>{label}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {calendarPreviewDays.map((day) => {
                  const isScheduled = scheduledDateKeys.has(day.key);
                  return (
                    <div
                      key={day.key}
                      className={`flex aspect-square min-h-6 items-center justify-center rounded-md text-[10px] font-semibold ${
                        isScheduled
                          ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                          : day.isToday
                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {day.day}
                    </div>
                  );
                })}
              </div>
            </div>
          </button>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 font-semibold">{copy.serviceTasks}</h2>
            {loading ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{copy.loading}</div>
            ) : tickets.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{copy.emptyTasks}</div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div>
                        <div className="font-medium">{ticket.order_no || ticket.id}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          {ticket.customer_name || copy.customerFallback} / {ticket.customer_region || copy.regionFallback}
                        </div>
                      </div>
                      <span className="rounded-lg bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">
                        {statusLabels[ticket.status] || ticket.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {ticket.description ? formatEngineerDescription(ticket.description, isCn) : copy.descriptionFallback}
                    </p>
                    <div className="mt-3 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-3 py-2 text-xs text-[var(--color-text-primary)]">
                      <span className="font-semibold text-[var(--color-primary)]">{copy.nextStep}:</span> {getNextAction(ticket, copy)}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-3">
                      <div>{copy.customerIssue}: {ticket.type || '-'}</div>
                      <div>{copy.safetyRisk}: {ticket.urgency === 'critical' ? copy.highRisk : ticket.urgency === 'urgent' ? copy.priority : copy.standard}</div>
                      <div>{copy.currentEngineer}: {ticket.engineer_name || copy.pendingRegionalAssignment}</div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
                      >
                        {copy.viewTask}
                      </button>
                      {!isRegionalLead && ticket.status === 'assigned' && (
                        <>
                          <button
                            onClick={() => confirmAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:accept`}
                            className="min-h-10 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:accept` ? copy.confirming : copy.confirmAssignment}
                          </button>
                          <button
                            onClick={() => returnAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:reject`}
                            className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:reject` ? copy.returning : copy.returnToDispatch}
                          </button>
                        </>
                      )}
                    </div>
                    {ticket.conflict_status === 'blocked' && (
                      <div className="mt-3 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
                        {copy.conflictCheck}: {ticket.conflict_reason || copy.conflictFallback}
                      </div>
                    )}
                    {isRegionalLead && (
                      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="text-xs font-medium text-[var(--color-text-primary)]">{copy.regionalLeadAssignment}</div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <select
                            value={selectedEngineer[ticket.id] || ticket.engineer_id || ''}
                            onChange={(event) => setSelectedEngineer((prev) => ({ ...prev, [ticket.id]: event.target.value }))}
                            className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                          >
                            <option value="">{copy.selectTeamEngineer}</option>
                            {team.map((engineer) => (
                              <option key={engineer.id} value={engineer.id}>
                                {engineer.name}{engineer.service_region ? ` / ${engineer.service_region}` : ''}{engineer.status ? ` / ${engineer.status}` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => assignToEngineer(ticket)}
                            disabled={assigningId === ticket.id}
                            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === ticket.id ? copy.assigning : copy.assignEngineer}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          {copy.assignmentGuard}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 font-semibold">{copy.contextTitle}</h2>
              {activeTicket ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs uppercase text-[var(--color-text-muted)]">{copy.workOrder}</div>
                    <div className="font-medium text-[var(--color-text-primary)]">{activeTicket.order_no || activeTicket.id}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-[var(--color-text-muted)]">{copy.customerRegion}</div>
                    <div className="text-[var(--color-text-secondary)]">{activeTicket.customer_name || copy.customerFallback} / {activeTicket.customer_region || copy.regionFallback}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-[var(--color-text-muted)]">{copy.machineServiceType}</div>
                    <div className="text-[var(--color-text-secondary)]">{getMachineLine(activeTicket, isCn, copy)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-[var(--color-text-muted)]">{copy.nextStepLabel}</div>
                    <div className="text-[var(--color-text-secondary)]">{getNextAction(activeTicket, copy)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">{copy.noActiveTask}</p>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="mb-3">
                <h2 className="font-semibold">{copy.preparationTitle}</h2>
                {activeTicket && (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {copy.preparationFor(activeTicket.order_no || activeTicket.id)}
                  </p>
                )}
              </div>
              {activeTicket ? (
                <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                  <div>
                    <div className="mb-1 text-xs uppercase text-[var(--color-text-muted)]">{copy.aiIntakeSummary}</div>
                    <p>{formatEngineerDescription(activeAiSummary.text, isCn)}</p>
                    {activeAiSummary.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeAiSummary.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs text-[var(--color-primary)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {activeAiSummary.notes && (
                      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{activeAiSummary.notes}</p>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase text-[var(--color-text-muted)]">{copy.equipmentRecord}</div>
                    <p>{getMachineLine(activeTicket, isCn, copy)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {copy.selectTaskHint}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={18} className="text-[var(--color-primary)]" />
                <h2 className="font-semibold">{copy.checklistTitle}</h2>
              </div>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <label key={item} className="flex gap-2 text-sm text-[var(--color-text-secondary)]">
                    <input type="checkbox" className="mt-1" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
    <WorkOrderDetailModal
      isOpen={Boolean(selectedTicket)}
      onClose={() => setSelectedTicket(null)}
      workOrder={selectedTicket}
      userType="engineer"
      userId={engineerId}
      onRateSuccess={loadTickets}
      onConfirmed={loadTickets}
    />
    <Modal
      isOpen={isCalendarOpen}
      onClose={() => {
        setIsCalendarOpen(false);
        loadCalendarPreview();
      }}
      title={copy.modalCalendarTitle}
      size="2xl"
    >
      <EngineerAvailabilityCalendar />
    </Modal>
    </>
  );
}
