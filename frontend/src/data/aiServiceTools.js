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
    title: 'Repair Estimate AI',
    shortTitle: 'Repair Estimate',
    description: 'Estimate cost level and service complexity without making a binding quote.',
    cta: 'Estimate Repair',
    leadType: 'Repair Quote',
    fields: [
      { name: 'faultType', label: 'Fault type', placeholder: 'e.g. laser power drop, cutting head crash, chiller alarm' },
      { name: 'machineAge', label: 'Machine age', placeholder: 'e.g. 4 years' },
      { name: 'downtime', label: 'Production status', placeholder: 'Running / unstable / stopped' },
      { name: 'history', label: 'Repair history', type: 'textarea', placeholder: 'Previous repairs, replaced parts, repeated faults.' },
      { name: 'location', label: 'Location', placeholder: 'City / country' },
    ],
    promptIntro: 'Please act as SAGEMRO Repair Estimate AI and provide a non-binding cost-level assessment.',
    outputGuide: 'Return low/medium/high cost level, key cost drivers, likely parts or labor, information needed for a formal SAGEMRO quote, and safety notes.',
  },
  {
    id: 'machine-selection',
    icon: Activity,
    title: 'Machine Selection AI',
    shortTitle: 'Machine Selection',
    description: 'Recommend laser power, bed size, automation, and route qualified new-machine leads to Euchio.',
    cta: 'Select Machine',
    leadType: 'New Machine',
    fields: [
      { name: 'materials', label: 'Materials', placeholder: 'e.g. carbon steel, stainless steel, aluminum' },
      { name: 'thicknessRange', label: 'Thickness range', placeholder: 'e.g. 1-20mm' },
      { name: 'sheetSize', label: 'Sheet size', placeholder: 'e.g. 1500x3000mm' },
      { name: 'capacity', label: 'Production capacity', placeholder: 'Daily/monthly output target' },
      { name: 'budget', label: 'Budget range', placeholder: 'Optional' },
      { name: 'automation', label: 'Automation needs', placeholder: 'Manual / exchange table / loading system' },
      { name: 'country', label: 'Installation country', placeholder: 'Country / region' },
    ],
    promptIntro: 'Please act as SAGEMRO Machine Selection AI and create a preliminary laser cutting machine configuration.',
    outputGuide: 'Return recommended power range, table size, automation, auxiliary equipment, whether repair/upgrade/new purchase is better, and note that Euchio can follow up for a formal project quote.',
  },
  {
    id: 'health-report',
    icon: HeartPulse,
    title: 'Equipment Health Report AI',
    shortTitle: 'Health Report',
    description: 'Create a health score and maintenance plan from usage, faults, and repair history.',
    cta: 'Create Report',
    leadType: 'Maintenance Plan',
    fields: [
      { name: 'machine', label: 'Machine profile', placeholder: 'Brand, model, power, year' },
      { name: 'usage', label: 'Usage intensity', placeholder: 'e.g. 10 hours/day, 6 days/week' },
      { name: 'faultFrequency', label: 'Recent fault frequency', placeholder: 'e.g. 3 stops in the last month' },
      { name: 'maintenance', label: 'Maintenance history', type: 'textarea', placeholder: 'Cleaning, lens replacement, chiller service, previous repairs.' },
      { name: 'qualityIssues', label: 'Quality issues', placeholder: 'Burr, unstable power, poor accuracy, repeated alarms' },
    ],
    promptIntro: 'Please act as SAGEMRO Equipment Health Report AI and create a practical maintenance and lifecycle assessment.',
    outputGuide: 'Return health score, risk components, recommended maintenance, suggested spare parts kit, maintenance-plan opportunity, and possible upgrade/new-machine signal.',
  },
];

export function buildAiToolPrompt(tool, values) {
  const details = tool.fields
    .map((field) => `${field.label}: ${values[field.name] || 'Not provided'}`)
    .join('\n');

  return `${tool.promptIntro}

Business context:
- SAGEMRO is an independent third-party service brand for laser cutting and sheet metal equipment, not a machine manufacturer after-sales desk or a loose matchmaking platform.
- AI advice is preliminary and must avoid unsafe repair instructions, absolute diagnosis, or binding price commitments.
- If on-site confirmation is needed, guide the user to request SAGEMRO service coordination.

User input:
${details}

Required output:
${tool.outputGuide}

Also create a short structured summary suitable for a service request or sales lead.`;
}
