// 工单详情相关的静态配置

export const statusConfig = {
  pending: { text: '待处理', color: 'bg-blue-500' },
  assigned: { text: '已分配', color: 'bg-yellow-500' },
  in_progress: { text: '处理中', color: 'bg-orange-500' },
  pricing: { text: '等待报价确认', color: 'bg-purple-500' },
  pending_payment: { text: '待付款', color: 'bg-pink-500' },
  in_service: { text: '服务中', color: 'bg-cyan-500' },
  resolved: { text: '已解决', color: 'bg-green-500' },
  pending_review: { text: '待评价', color: 'bg-teal-500' },
  completed: { text: '已完成', color: 'bg-gray-500' },
  rejected: { text: '已拒绝', color: 'bg-red-500' },
  cancelled: { text: '已取消', color: 'bg-gray-400' },
};

export const urgencyConfig = {
  normal: { text: '普通', color: 'text-gray-500' },
  urgent: { text: '紧急', color: 'text-orange-500' },
  critical: { text: '非常紧急', color: 'text-red-500' },
};

export const typeLabels = {
  fault: '设备故障',
  maintenance: '维护保养',
  parameter: '参数调试',
  consult: '技术咨询',
  parts: '配件采购',
  aftersales: '售后服务',
  other: '其他',
};

// ============ 二级分类体系 ============
// category_l1: 设备大类  category_l2: 问题类型
export const categoryConfig = {
  laser_cutting: {
    label: '激光切割', color: 'bg-blue-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      optical_fault: '光路/光学故障',
      control_system: '控制系统故障',
      cooling_fault: '冷却系统故障',
      gas_fault: '气路/辅助气体故障',
      maintenance: '保养维护',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '配件更换',
      other: '其他',
    },
  },
  bending: {
    label: '折弯', color: 'bg-green-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      hydraulic_fault: '液压系统故障',
      control_system: '数控系统故障',
      maintenance: '保养维护',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '配件更换',
      other: '其他',
    },
  },
  punching: {
    label: '冲压/冲床', color: 'bg-purple-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      hydraulic_fault: '液压/气动故障',
      control_system: '数控系统故障',
      tooling_fault: '模具/刀具故障',
      maintenance: '保养维护',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '配件更换',
      other: '其他',
    },
  },
  welding: {
    label: '焊接', color: 'bg-orange-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      arc_fault: '电弧/焊接质量故障',
      wire_feeder_fault: '送丝系统故障',
      gas_fault: '保护气体故障',
      cooling_fault: '冷却系统故障',
      control_system: '控制系统故障',
      maintenance: '保养维护',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '配件更换',
      other: '其他',
    },
  },
  surface_treatment: {
    label: '表面处理', color: 'bg-teal-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      media_fault: '磨料/介质故障',
      dust_collection: '除尘/环保故障',
      maintenance: '保养维护',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '配件更换',
      other: '其他',
    },
  },
  auxiliary: {
    label: '辅助系统', color: 'bg-cyan-500',
    l2: {
      compressor_fault: '空压机故障',
      chiller_fault: '冷水机/冷却故障',
      gas_generation: '制氮/制氧故障',
      power_supply: '电源/稳压器故障',
      dust_collection: '除尘系统故障',
      maintenance: '保养维护',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '配件更换',
      other: '其他',
    },
  },
  cnc_automation: {
    label: '数控与自动化', color: 'bg-pink-500',
    l2: {
      cnc_system: '数控系统故障',
      servo_drive: '伺服/驱动故障',
      robot_fault: '机器人故障',
      plc_fault: 'PLC/自动化故障',
      sensor_fault: '传感器/检测故障',
      maintenance: '保养维护',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '配件更换',
      other: '其他',
    },
  },
  inspection: {
    label: '检测品控', color: 'bg-yellow-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      calibration: '精度校准',
      sensor_fault: '传感器/探头故障',
      software_fault: '软件/系统故障',
      maintenance: '保养维护',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '配件更换',
      other: '其他',
    },
  },
  other: {
    label: '其他设备', color: 'bg-gray-500',
    l2: {
      general_fault: '通用故障',
      maintenance: '保养维护',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '配件更换',
      other: '其他',
    },
  },
};

// 压平：category_l2 → 中文标签（所有大类共用同一套 l2 key）
export const categoryL2Labels = {
  mechanical_fault: '机械故障',
  electrical_fault: '电气故障',
  optical_fault: '光路/光学故障',
  hydraulic_fault: '液压系统故障',
  arc_fault: '电弧/焊接质量',
  wire_feeder_fault: '送丝系统故障',
  tooling_fault: '模具/刀具故障',
  compressor_fault: '空压机故障',
  chiller_fault: '冷水机/冷却故障',
  gas_generation: '制氮/制氧故障',
  power_supply: '电源/稳压器故障',
  cnc_system: '数控系统故障',
  servo_drive: '伺服/驱动故障',
  robot_fault: '机器人故障',
  plc_fault: 'PLC/自动化故障',
  sensor_fault: '传感器/检测故障',
  cooling_fault: '冷却系统故障',
  gas_fault: '气路/气体故障',
  control_system: '控制系统故障',
  media_fault: '磨料/介质故障',
  dust_collection: '除尘/环保故障',
  calibration: '精度校准',
  software_fault: '软件/系统故障',
  general_fault: '通用故障',
  maintenance: '保养维护',
  parameter_debug: '参数调试',
  installation: '安装调试',
  consultation: '技术咨询',
  parts_replacement: '配件更换',
  other: '其他',
};

export const slaHours = { critical: 4, urgent: 24, normal: 72 };

export function formatSlaRemaining(slaStatus) {
  if (!slaStatus || slaStatus.remaining_seconds == null) return null;
  const seconds = slaStatus.remaining_seconds;
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const prefix = slaStatus.status === 'breached' ? '超时 ' : '剩余 ';
  if (h > 0) return prefix + h + 'h' + (m > 0 ? m + 'm' : '');
  if (m > 0) return prefix + m + 'm';
  return slaStatus.status === 'breached' ? '刚刚超时' : '不足1分钟';
}
