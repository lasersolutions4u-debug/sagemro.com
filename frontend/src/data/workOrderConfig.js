// Work order static configuration

export const statusConfig = {
  pending: { text: 'Pending', color: 'bg-blue-500' },
  assigned: { text: 'Assigned', color: 'bg-yellow-500' },
  in_progress: { text: 'In Progress', color: 'bg-orange-500' },
  pricing: { text: 'Awaiting Quote', color: 'bg-purple-500' },
  pending_payment: { text: 'Awaiting Payment', color: 'bg-pink-500' },
  payment_review: { text: 'Payment Review', color: 'bg-amber-500' },
  in_service: { text: 'In Service', color: 'bg-cyan-500' },
  resolved: { text: 'Resolved', color: 'bg-green-500' },
  pending_review: { text: 'Pending Review', color: 'bg-teal-500' },
  completed: { text: 'Completed', color: 'bg-gray-500' },
  rejected: { text: 'Rejected', color: 'bg-red-500' },
  cancelled: { text: 'Cancelled', color: 'bg-gray-400' },
};

export const statusConfigCn = {
  pending: { text: '待确认', color: 'bg-blue-500' },
  assigned: { text: '已派工', color: 'bg-yellow-500' },
  in_progress: { text: '处理中', color: 'bg-orange-500' },
  pricing: { text: '待报价', color: 'bg-purple-500' },
  pending_payment: { text: '待付款', color: 'bg-pink-500' },
  in_service: { text: '服务中', color: 'bg-cyan-500' },
  resolved: { text: '待客户确认', color: 'bg-green-500' },
  pending_review: { text: '待评价', color: 'bg-teal-500' },
  completed: { text: '已完成', color: 'bg-gray-500' },
  rejected: { text: '已拒绝', color: 'bg-red-500' },
  cancelled: { text: '已取消', color: 'bg-gray-400' },
};

export const urgencyConfig = {
  normal: { text: 'Normal', color: 'text-gray-500' },
  urgent: { text: 'Urgent', color: 'text-orange-500' },
  critical: { text: 'Critical', color: 'text-red-500' },
};

export const urgencyConfigCn = {
  normal: { text: '普通', color: 'text-gray-500' },
  urgent: { text: '紧急', color: 'text-orange-500' },
  critical: { text: '停机/高风险', color: 'text-red-500' },
};

export const typeLabels = {
  fault: 'Equipment Fault',
  maintenance: 'Maintenance',
  parameter: 'Parameter Tuning',
  consult: 'Technical Consultation',
  parts: 'Parts Procurement',
  aftersales: 'After-Sales Service',
  other: 'Other',
};

export const typeLabelsCn = {
  fault: '设备故障',
  maintenance: '维护保养',
  parameter: '参数调试',
  consult: '技术咨询',
  parts: '备件采购',
  aftersales: '售后服务',
  other: '其他需求',
};

// ============ Two-level category system ============
// category_l1: equipment type  category_l2: issue type
export const categoryConfig = {
  laser_cutting: {
    label: 'Laser Cutting', color: 'bg-blue-500',
    l2: {
      mechanical_fault: 'Mechanical Fault',
      electrical_fault: 'Electrical Fault',
      optical_fault: 'Optical / Beam Path Fault',
      control_system: 'Control System Fault',
      cooling_fault: 'Cooling System Fault',
      gas_fault: 'Gas / Assist Gas Fault',
      maintenance: 'Maintenance',
      parameter_debug: 'Parameter Tuning',
      installation: 'Installation & Commissioning',
      consultation: 'Technical Consultation',
      parts_replacement: 'Parts Replacement',
      other: 'Other',
    },
  },
  bending: {
    label: 'Bending', color: 'bg-green-500',
    l2: {
      mechanical_fault: 'Mechanical Fault',
      electrical_fault: 'Electrical Fault',
      hydraulic_fault: 'Hydraulic System Fault',
      control_system: 'CNC System Fault',
      maintenance: 'Maintenance',
      parameter_debug: 'Parameter Tuning',
      installation: 'Installation & Commissioning',
      consultation: 'Technical Consultation',
      parts_replacement: 'Parts Replacement',
      other: 'Other',
    },
  },
  punching: {
    label: 'Punching / Press', color: 'bg-purple-500',
    l2: {
      mechanical_fault: 'Mechanical Fault',
      electrical_fault: 'Electrical Fault',
      hydraulic_fault: 'Hydraulic / Pneumatic Fault',
      control_system: 'CNC System Fault',
      tooling_fault: 'Tooling / Die Fault',
      maintenance: 'Maintenance',
      parameter_debug: 'Parameter Tuning',
      installation: 'Installation & Commissioning',
      consultation: 'Technical Consultation',
      parts_replacement: 'Parts Replacement',
      other: 'Other',
    },
  },
  welding: {
    label: 'Welding', color: 'bg-orange-500',
    l2: {
      mechanical_fault: 'Mechanical Fault',
      electrical_fault: 'Electrical Fault',
      arc_fault: 'Arc / Weld Quality Fault',
      wire_feeder_fault: 'Wire Feeder Fault',
      gas_fault: 'Shielding Gas Fault',
      cooling_fault: 'Cooling System Fault',
      control_system: 'Control System Fault',
      maintenance: 'Maintenance',
      parameter_debug: 'Parameter Tuning',
      installation: 'Installation & Commissioning',
      consultation: 'Technical Consultation',
      parts_replacement: 'Parts Replacement',
      other: 'Other',
    },
  },
  surface_treatment: {
    label: 'Surface Treatment', color: 'bg-teal-500',
    l2: {
      mechanical_fault: 'Mechanical Fault',
      electrical_fault: 'Electrical Fault',
      media_fault: 'Abrasive / Media Fault',
      dust_collection: 'Dust Collection / Environmental Fault',
      maintenance: 'Maintenance',
      parameter_debug: 'Parameter Tuning',
      installation: 'Installation & Commissioning',
      consultation: 'Technical Consultation',
      parts_replacement: 'Parts Replacement',
      other: 'Other',
    },
  },
  auxiliary: {
    label: 'Auxiliary Systems', color: 'bg-cyan-500',
    l2: {
      compressor_fault: 'Air Compressor Fault',
      chiller_fault: 'Chiller / Cooling Fault',
      gas_generation: 'Nitrogen / Oxygen Generator Fault',
      power_supply: 'Power Supply / Stabilizer Fault',
      dust_collection: 'Dust Collection System Fault',
      maintenance: 'Maintenance',
      parameter_debug: 'Parameter Tuning',
      installation: 'Installation & Commissioning',
      consultation: 'Technical Consultation',
      parts_replacement: 'Parts Replacement',
      other: 'Other',
    },
  },
  cnc_automation: {
    label: 'CNC & Automation', color: 'bg-pink-500',
    l2: {
      cnc_system: 'CNC System Fault',
      servo_drive: 'Servo / Drive Fault',
      robot_fault: 'Robot Fault',
      plc_fault: 'PLC / Automation Fault',
      sensor_fault: 'Sensor / Detection Fault',
      maintenance: 'Maintenance',
      parameter_debug: 'Parameter Tuning',
      installation: 'Installation & Commissioning',
      consultation: 'Technical Consultation',
      parts_replacement: 'Parts Replacement',
      other: 'Other',
    },
  },
  inspection: {
    label: 'Inspection & QC', color: 'bg-yellow-500',
    l2: {
      mechanical_fault: 'Mechanical Fault',
      electrical_fault: 'Electrical Fault',
      calibration: 'Precision Calibration',
      sensor_fault: 'Sensor / Probe Fault',
      software_fault: 'Software / System Fault',
      maintenance: 'Maintenance',
      parameter_debug: 'Parameter Tuning',
      installation: 'Installation & Commissioning',
      consultation: 'Technical Consultation',
      parts_replacement: 'Parts Replacement',
      other: 'Other',
    },
  },
  other: {
    label: 'Other Equipment', color: 'bg-gray-500',
    l2: {
      general_fault: 'General Fault',
      maintenance: 'Maintenance',
      installation: 'Installation & Commissioning',
      consultation: 'Technical Consultation',
      parts_replacement: 'Parts Replacement',
      other: 'Other',
    },
  },
};

export const categoryConfigCn = {
  laser_cutting: {
    label: '激光切割', color: 'bg-blue-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      optical_fault: '光路 / 光学故障',
      control_system: '控制系统故障',
      cooling_fault: '冷却系统故障',
      gas_fault: '气路 / 辅助气体故障',
      maintenance: '维护保养',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
  bending: {
    label: '折弯设备', color: 'bg-green-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      hydraulic_fault: '液压系统故障',
      control_system: '数控系统故障',
      maintenance: '维护保养',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
  punching: {
    label: '冲压 / 压力设备', color: 'bg-purple-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      hydraulic_fault: '液压 / 气动故障',
      control_system: '数控系统故障',
      tooling_fault: '模具 / 刀具故障',
      maintenance: '维护保养',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
  welding: {
    label: '焊接设备', color: 'bg-orange-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      arc_fault: '焊接质量 / 电弧异常',
      wire_feeder_fault: '送丝机构故障',
      gas_fault: '保护气体故障',
      cooling_fault: '冷却系统故障',
      control_system: '控制系统故障',
      maintenance: '维护保养',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
  surface_treatment: {
    label: '表面处理', color: 'bg-teal-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      media_fault: '磨料 / 介质异常',
      dust_collection: '除尘 / 环保故障',
      maintenance: '维护保养',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
  auxiliary: {
    label: '辅助系统', color: 'bg-cyan-500',
    l2: {
      compressor_fault: '空压机故障',
      chiller_fault: '冷水机 / 冷却故障',
      gas_generation: '制氮 / 制氧系统故障',
      power_supply: '电源 / 稳压系统故障',
      dust_collection: '除尘系统故障',
      maintenance: '维护保养',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
  cnc_automation: {
    label: '数控与自动化', color: 'bg-pink-500',
    l2: {
      cnc_system: '数控系统故障',
      servo_drive: '伺服 / 驱动故障',
      robot_fault: '机器人故障',
      plc_fault: 'PLC / 自动化故障',
      sensor_fault: '传感器 / 检测故障',
      maintenance: '维护保养',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
  inspection: {
    label: '检测与质检', color: 'bg-yellow-500',
    l2: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      calibration: '精度校准',
      sensor_fault: '传感器 / 探头故障',
      software_fault: '软件 / 系统故障',
      maintenance: '维护保养',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
  other: {
    label: '其他设备', color: 'bg-gray-500',
    l2: {
      general_fault: '一般故障',
      maintenance: '维护保养',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
};

// Flat map: category_l2 → English label (shared across all L1 categories)
export const categoryL2Labels = {
  mechanical_fault: 'Mechanical Fault',
  electrical_fault: 'Electrical Fault',
  optical_fault: 'Optical / Beam Path Fault',
  hydraulic_fault: 'Hydraulic System Fault',
  arc_fault: 'Arc / Weld Quality',
  wire_feeder_fault: 'Wire Feeder Fault',
  tooling_fault: 'Tooling / Die Fault',
  compressor_fault: 'Air Compressor Fault',
  chiller_fault: 'Chiller / Cooling Fault',
  gas_generation: 'Nitrogen / Oxygen Generator Fault',
  power_supply: 'Power Supply / Stabilizer Fault',
  cnc_system: 'CNC System Fault',
  servo_drive: 'Servo / Drive Fault',
  robot_fault: 'Robot Fault',
  plc_fault: 'PLC / Automation Fault',
  sensor_fault: 'Sensor / Detection Fault',
  cooling_fault: 'Cooling System Fault',
  gas_fault: 'Gas / Gas Line Fault',
  control_system: 'Control System Fault',
  media_fault: 'Abrasive / Media Fault',
  dust_collection: 'Dust Collection / Environmental Fault',
  calibration: 'Precision Calibration',
  software_fault: 'Software / System Fault',
  general_fault: 'General Fault',
  maintenance: 'Maintenance',
  parameter_debug: 'Parameter Tuning',
  installation: 'Installation & Commissioning',
  consultation: 'Technical Consultation',
  parts_replacement: 'Parts Replacement',
  other: 'Other',
};

export const categoryL2LabelsCn = {
  mechanical_fault: '机械故障',
  electrical_fault: '电气故障',
  optical_fault: '光路 / 光学故障',
  hydraulic_fault: '液压系统故障',
  arc_fault: '焊接质量 / 电弧异常',
  wire_feeder_fault: '送丝机构故障',
  tooling_fault: '模具 / 刀具故障',
  compressor_fault: '空压机故障',
  chiller_fault: '冷水机 / 冷却故障',
  gas_generation: '制氮 / 制氧系统故障',
  power_supply: '电源 / 稳压系统故障',
  cnc_system: '数控系统故障',
  servo_drive: '伺服 / 驱动故障',
  robot_fault: '机器人故障',
  plc_fault: 'PLC / 自动化故障',
  sensor_fault: '传感器 / 检测故障',
  cooling_fault: '冷却系统故障',
  gas_fault: '气路 / 辅助气体故障',
  control_system: '控制系统故障',
  media_fault: '磨料 / 介质异常',
  dust_collection: '除尘 / 环保故障',
  calibration: '精度校准',
  software_fault: '软件 / 系统故障',
  general_fault: '一般故障',
  maintenance: '维护保养',
  parameter_debug: '参数调试',
  installation: '安装调试',
  consultation: '技术咨询',
  parts_replacement: '备件更换',
  other: '其他',
};

export const slaHours = { critical: 4, urgent: 24, normal: 72 };

export function formatSlaRemaining(slaStatus) {
  if (!slaStatus || slaStatus.remaining_seconds == null) return null;
  const seconds = slaStatus.remaining_seconds;
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const prefix = slaStatus.status === 'breached' ? 'Overdue ' : 'Remaining ';
  if (h > 0) return prefix + h + 'h' + (m > 0 ? m + 'm' : '');
  if (m > 0) return prefix + m + 'm';
  return slaStatus.status === 'breached' ? 'Just overdue' : 'Less than 1 min';
}

export function formatSlaRemainingCn(slaStatus) {
  if (!slaStatus || slaStatus.remaining_seconds == null) return null;
  const seconds = slaStatus.remaining_seconds;
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const prefix = slaStatus.status === 'breached' ? '已超时 ' : '剩余 ';
  if (h > 0) return prefix + h + '小时' + (m > 0 ? m + '分钟' : '');
  if (m > 0) return prefix + m + '分钟';
  return slaStatus.status === 'breached' ? '刚刚超时' : '不足 1 分钟';
}
