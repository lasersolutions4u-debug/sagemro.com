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

export const urgencyConfig = {
  normal: { text: 'Normal', color: 'text-gray-500' },
  urgent: { text: 'Urgent', color: 'text-orange-500' },
  critical: { text: 'Critical', color: 'text-red-500' },
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
