import {
  Activity,
  BadgeDollarSign,
  Cog,
  Gauge,
  HeartPulse,
  ScanSearch,
} from 'lucide-react';

export const aiServiceTools = [
  {
    id: 'diagnosis',
    icon: ScanSearch,
    title: 'Fault Diagnosis AI',
    shortTitle: 'Fault Diagnosis',
    description: 'Turn alarms, photos, and symptoms into a structured service request.',
    cta: 'Diagnose Fault',
    leadType: 'Repair Service',
    fields: [
      { name: 'equipment', label: 'Equipment type', placeholder: 'e.g. Fiber laser cutter' },
      { name: 'brandModel', label: 'Brand / model', placeholder: 'e.g. 3015 6kW, CypCut, Raycus' },
      { name: 'alarmCode', label: 'Alarm code', placeholder: 'e.g. Z-axis following error' },
      { name: 'symptom', label: 'Fault symptoms', type: 'textarea', placeholder: 'Describe what happened, when it started, and whether the machine is stopped.' },
      { name: 'material', label: 'Material / thickness / gas', placeholder: 'e.g. 6mm carbon steel, oxygen' },
      { name: 'region', label: 'Location', placeholder: 'City / country' },
      { name: 'urgency', label: 'Urgency', placeholder: 'Normal / urgent / stopped production' },
    ],
    promptIntro: 'Please act as SAGEMRO AI Equipment Diagnostic Assistant and create a safe preliminary diagnosis.',
    outputGuide: 'Return likely causes, risk level, stop-work advice, information needed, possible parts, and whether SAGEMRO service follow-up is recommended.',
  },
  {
    id: 'cutting-parameters',
    icon: Gauge,
    title: 'Cutting Parameters AI',
    shortTitle: 'Cutting Parameters',
    description: 'Get safe reference ranges for material, thickness, power, gas, and quality issues.',
    cta: 'Generate Parameters',
    leadType: 'Process Tuning',
    fields: [
      { name: 'material', label: 'Material', placeholder: 'e.g. stainless steel, carbon steel, aluminum' },
      { name: 'thickness', label: 'Thickness', placeholder: 'e.g. 3mm' },
      { name: 'laserPower', label: 'Laser power', placeholder: 'e.g. 3000W' },
      { name: 'gas', label: 'Assist gas', placeholder: 'e.g. nitrogen / oxygen / air' },
      { name: 'nozzle', label: 'Nozzle / focus', placeholder: 'e.g. 1.5 single nozzle, focus unknown' },
      { name: 'qualityIssue', label: 'Current issue', type: 'textarea', placeholder: 'Burr, dross, not cutting through, burn marks, rough edge...' },
    ],
    promptIntro: 'Please act as SAGEMRO Cutting Process AI and provide conservative reference cutting parameters.',
    outputGuide: 'Return parameter ranges, focus/gas/speed advice, likely causes of quality issues, and when to request SAGEMRO process tuning.',
  },
  {
    id: 'parts-identification',
    icon: Cog,
    title: 'Parts Identification AI',
    shortTitle: 'Parts Identification',
    description: 'Identify consumables or spare parts and collect what is needed for manual confirmation.',
    cta: 'Identify Part',
    leadType: 'Spare Parts',
    fields: [
      { name: 'partPhoto', label: 'Photo / marking description', type: 'textarea', placeholder: 'Describe the photo, marking, code, or nameplate text.' },
      { name: 'machineInfo', label: 'Machine / cutting head', placeholder: 'e.g. BM111, BLT, Precitec, Raytools' },
      { name: 'partUse', label: 'Where it is used', placeholder: 'e.g. protective lens, ceramic ring, sensor cable' },
      { name: 'quantity', label: 'Quantity needed', placeholder: 'e.g. 20 pcs' },
      { name: 'shippingRegion', label: 'Shipping region', placeholder: 'Country / city' },
    ],
    promptIntro: 'Please act as SAGEMRO Spare Parts Identification AI and help identify the likely part category.',
    outputGuide: 'Return likely part category, possible model, compatibility risks, missing confirmation info, and next step for SAGEMRO parts confirmation.',
  },
  {
    id: 'repair-estimate',
    icon: BadgeDollarSign,
    title: 'Service Cost Reference AI',
    shortTitle: 'Cost Reference',
    description: 'Organize likely cost drivers and service complexity before formal review.',
    cta: 'Review Cost Drivers',
    leadType: 'Service Cost Context',
    fields: [
      { name: 'faultType', label: 'Fault type', placeholder: 'e.g. laser power drop, cutting head crash, chiller alarm' },
      { name: 'machineAge', label: 'Machine age', placeholder: 'e.g. 4 years' },
      { name: 'downtime', label: 'Production status', placeholder: 'Running / unstable / stopped' },
      { name: 'history', label: 'Repair history', type: 'textarea', placeholder: 'Previous repairs, replaced parts, repeated faults.' },
      { name: 'location', label: 'Location', placeholder: 'City / country' },
    ],
    promptIntro: 'Please act as SAGEMRO Service Cost Reference AI and provide a planning-level cost driver review.',
    outputGuide: 'Return low/medium/high cost level, key cost drivers, likely parts or labor, information needed for qualified confirmation, and safety notes.',
  },
  {
    id: 'machine-selection',
    icon: Activity,
    title: 'Retrofit & Peripherals AI',
    shortTitle: 'Retrofit Review',
    description: 'Collect upgrade, automation, laser peripheral, and post-processing needs for SAGEMRO review.',
    cta: 'Review Upgrade',
    leadType: 'Retrofit / Peripherals',
    fields: [
      { name: 'materials', label: 'Current process / materials', placeholder: 'e.g. laser cutting carbon steel, bending stainless steel' },
      { name: 'thicknessRange', label: 'Current range or bottleneck', placeholder: 'e.g. 1-20mm, slow loading, unstable nitrogen supply' },
      { name: 'sheetSize', label: 'Machine / line size', placeholder: 'e.g. 1500x3000mm laser, 110T press brake' },
      { name: 'capacity', label: 'Production goal', placeholder: 'Daily/monthly output target or labor-saving goal' },
      { name: 'budget', label: 'Budget range', placeholder: 'Optional' },
      { name: 'automation', label: 'Needed equipment or upgrade', placeholder: 'Chiller, dust collector, gas mixer, deburring, lifter, seventh axis, gantry, tooling' },
      { name: 'country', label: 'Project country', placeholder: 'Country / region' },
    ],
    promptIntro: 'Please act as SAGEMRO Retrofit and Peripheral Equipment AI and create a preliminary upgrade requirement summary.',
    outputGuide: 'Return likely upgrade category, compatibility questions, required machine/site information, possible auxiliary equipment, whether maintenance/retrofit/accessory procurement is the better next step, and note that SAGEMRO can follow up for formal confirmation.',
  },
  {
    id: 'health-report',
    icon: HeartPulse,
    title: 'Maintenance Risk Review AI',
    shortTitle: 'Maintenance Risk',
    description: 'Organize maintenance risk signals from usage, faults, and repair history.',
    cta: 'Review Risk Signals',
    leadType: 'Maintenance Plan',
    fields: [
      { name: 'machine', label: 'Machine profile', placeholder: 'Brand, model, power, year' },
      { name: 'usage', label: 'Usage intensity', placeholder: 'e.g. 10 hours/day, 6 days/week' },
      { name: 'faultFrequency', label: 'Recent fault frequency', placeholder: 'e.g. 3 stops in the last month' },
      { name: 'maintenance', label: 'Maintenance history', type: 'textarea', placeholder: 'Cleaning, lens replacement, chiller service, previous repairs.' },
      { name: 'qualityIssues', label: 'Quality issues', placeholder: 'Burr, unstable power, poor accuracy, repeated alarms' },
    ],
    promptIntro: 'Please act as SAGEMRO Maintenance Risk Review AI and create a practical maintenance and lifecycle assessment.',
    outputGuide: 'Return observed risk signals, maintenance priorities, suggested spare parts to confirm, planning notes, and possible retrofit or peripheral equipment signals.',
  },
];

export function buildAiToolPrompt(tool, values) {
  const details = tool.fields
    .map((field) => `${field.label}: ${values[field.name] || 'Not provided'}`)
    .join('\n');

  return `${tool.promptIntro}

Business context:
- SAGEMRO provides independent service coordination for laser and metal forming equipment, separate from machine-maker after-sales desks and open technician marketplaces.
- AI advice is preliminary and must avoid unsafe repair instructions, absolute diagnosis, or binding price commitments.
- When on-site confirmation is needed, help the user prepare a clear service request for qualified review.

User input:
${details}

Required output:
${tool.outputGuide}

Also create a short structured summary suitable for service request preparation or admin review.`;
}
