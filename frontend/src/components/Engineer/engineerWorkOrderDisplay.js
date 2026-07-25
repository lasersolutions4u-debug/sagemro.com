import { redactContactInfo } from '../../utils/contactRedaction.js';
import { categoryConfig, categoryL2Labels, typeLabels } from '../../data/workOrderConfig.js';
import { hasChineseText } from './engineerWorkOrderContent.js';

const TYPE_LABELS_CN = {
  fault: '设备维修',
  maintenance: '维护保养',
  parameter: '参数调试',
  consult: '技术咨询',
  parts: '备件采购',
  aftersales: '服务支持',
  other: '其他',
};

const CATEGORY_LABELS_CN = {
  laser_cutting: '激光切割',
  bending: '折弯',
  punching: '冲压 / 压力机',
  welding: '焊接',
  surface_treatment: '表面处理',
  auxiliary: '辅助系统',
  cnc_automation: '数控与自动化',
  inspection: '检测与品控',
  other: '其他设备',
};

const CATEGORY_L2_LABELS_CN = {
  mechanical_fault: '机械故障',
  electrical_fault: '电气故障',
  optical_fault: '光路 / 光学故障',
  hydraulic_fault: '液压系统故障',
  arc_fault: '电弧 / 焊接质量问题',
  wire_feeder_fault: '送丝故障',
  tooling_fault: '模具 / 刀具故障',
  compressor_fault: '空压机故障',
  chiller_fault: '冷水机 / 冷却故障',
  gas_generation: '制氮 / 制氧设备故障',
  power_supply: '电源 / 稳压器故障',
  cnc_system: '数控系统故障',
  servo_drive: '伺服 / 驱动故障',
  robot_fault: '机器人故障',
  plc_fault: 'PLC / 自动化故障',
  sensor_fault: '传感器 / 检测故障',
  cooling_fault: '冷却系统故障',
  gas_fault: '气路 / 辅助气体故障',
  control_system: '控制系统故障',
  media_fault: '磨料 / 介质问题',
  dust_collection: '除尘 / 环保系统故障',
  calibration: '精度校准',
  software_fault: '软件 / 系统故障',
  general_fault: '常规故障',
  maintenance: '维护保养',
  parameter_debug: '参数调试',
  installation: '安装调试',
  consultation: '技术咨询',
  parts_replacement: '备件更换',
  other: '其他',
};

export const ACTION_PRIORITY = {
  assigned: 0,
  pending_dispatch: 1,
  pricing: 2,
  pending_payment: 3,
  payment_review: 4,
  in_service: 5,
  in_progress: 6,
  pending: 7,
  resolved: 8,
  pending_review: 9,
  completed: 10,
};

export function sortEngineerWorkOrders(tickets = []) {
  return [...tickets].sort((left, right) => {
    const priority = (ACTION_PRIORITY[left.status] ?? 99) - (ACTION_PRIORITY[right.status] ?? 99);
    if (priority !== 0) return priority;
    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  });
}
export function getEngineerWorkOrderTitle(ticket = {}, isCn = false, fallback = '') {
  const candidates = [ticket.issue_title, ticket.title, ticket.description]
    .map((value) => redactContactInfo(String(value || '')).match(/^[^。.!?\n]+[。.!?]?/)?.[0].trim())
    .filter(Boolean);
  const localized = candidates.find((value) => (isCn ? hasChineseText(value) : !hasChineseText(value)));
  return localized || fallback || (isCn ? '服务任务' : 'Service task');
}

export function getEngineerMachineLine(ticket = {}, isCn = false, fallback = '') {
  const category = ticket.category_l1 && ticket.category_l1 !== 'other'
    ? (isCn ? CATEGORY_LABELS_CN[ticket.category_l1] : categoryConfig[ticket.category_l1]?.label)
    : (isCn ? TYPE_LABELS_CN[ticket.type] : typeLabels[ticket.type]);
  const issue = ticket.category_l2 && ticket.category_l2 !== 'other'
    ? (isCn
        ? CATEGORY_L2_LABELS_CN[ticket.category_l2]
        : categoryConfig[ticket.category_l1]?.l2?.[ticket.category_l2] || categoryL2Labels[ticket.category_l2])
    : '';
  return [category, issue, ticket.device_brand || ticket.brand, ticket.device_model || ticket.model]
    .filter(Boolean)
    .join(' / ') || fallback;
}

export function getEngineerScheduleLabel(ticket = {}, locale = 'en-US') {
  const value = ticket.scheduled_at;
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
