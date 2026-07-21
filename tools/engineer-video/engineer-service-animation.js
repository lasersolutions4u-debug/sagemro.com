export const DURATION_MS = 20000;
export const LOCALES = ['cn', 'en'];

const WIDTH = 1920;
const HEIGHT = 1080;
const SCENE_MS = DURATION_MS / 6;

export const COPY = {
  cn: {
    network: '工程师服务协作网络',
    scenes: [
      '客户需求进入系统',
      'AI 咨询接待 · 任务整理',
      '运营协调 · 匹配资源',
      '工程师确认 · 解决问题',
      '服务数据沉淀 · AI 持续学习',
      '知识技能 · 供应链 · 品牌获客 · 工程师培训',
    ],
    inputs: ['设备信息', '报警记录', '现场图片', '服务需求'],
    workOrder: ['设备与故障', '现场与风险', '历史记录', '材料需求'],
    roles: {
      ai: 'AI 系统',
      operations: '运营协调',
      engineer: '工程师确认',
      report: '服务记录',
      knowledge: '知识飞轮',
    },
    regions: ['华东', '华南', '华北'],
    serviceModes: ['远程服务', '现场执行'],
    capabilities: ['知识技能', '供应链', '品牌获客', '工程师培训'],
    finalTitle: 'AI 知识飞轮 + 工程师技能实践',
    finalSubtitle: '让技术服务持续进化',
  },
  en: {
    network: 'ENGINEER SERVICE NETWORK',
    scenes: [
      'Service requests enter the workflow',
      'AI intake · Structured work orders',
      'Operations coordination · Resource matching',
      'Engineer confirmation · Problem resolution',
      'Service data captured · Continuous AI learning',
      'Knowledge · Supply chain · Shared marketing · Engineer training',
    ],
    inputs: ['Machine data', 'Alarm history', 'Site images', 'Service request'],
    workOrder: ['Machine & fault', 'Site & risk', 'Service history', 'Material needs'],
    roles: {
      ai: 'AI SYSTEM',
      operations: 'OPERATIONS',
      engineer: 'ENGINEER',
      report: 'SERVICE RECORD',
      knowledge: 'KNOWLEDGE FLYWHEEL',
    },
    regions: ['EAST', 'SOUTH', 'NORTH'],
    serviceModes: ['Remote service', 'Field service'],
    capabilities: ['Knowledge', 'Supply chain', 'Shared marketing', 'Engineer training'],
    finalTitle: 'AI knowledge flywheel + engineer expertise',
    finalSubtitle: 'A service network that improves with every job',
  },
};

const COLORS = {
  ink: '#111722',
  panel: '#192331',
  panelLight: '#223144',
  line: '#3e5065',
  text: '#f8fafc',
  muted: '#aab8c8',
  amber: '#f4b740',
  amberSoft: '#f9d98c',
  blue: '#4e8fbf',
  blueSoft: '#8fc1dd',
  green: '#65a985',
  red: '#d76f61',
  paper: '#f5f0e7',
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function ease(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function mix(from, to, amount) {
  return from + (to - from) * ease(amount);
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sceneOpacity(sceneIndex, timeMs) {
  const start = sceneIndex * SCENE_MS;
  const end = start + SCENE_MS;
  const fadeIn = ease((timeMs - start) / 420);
  const fadeOut = sceneIndex === 5 ? 1 : ease((end - timeMs) / 420);
  return clamp(fadeIn * fadeOut);
}

function sceneProgress(sceneIndex, timeMs) {
  return clamp((timeMs - sceneIndex * SCENE_MS) / SCENE_MS);
}

function settleProgress(sceneIndex, timeMs) {
  return ease((sceneProgress(sceneIndex, timeMs) - 0.05) / 0.62);
}

function text(x, y, value, options = {}) {
  const {
    size = 36,
    weight = 500,
    fill = COLORS.text,
    anchor = 'start',
    opacity = 1,
    family = 'Inter, PingFang SC, Microsoft YaHei, Arial, sans-serif',
  } = options;
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" opacity="${opacity}" font-family="${family}" letter-spacing="0">${esc(value)}</text>`;
}

function line(x1, y1, x2, y2, options = {}) {
  const { stroke = COLORS.line, width = 3, opacity = 1, dash = '' } = options;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;
}

function pill(x, y, width, label, options = {}) {
  const { fill = COLORS.panelLight, stroke = COLORS.line, textFill = COLORS.text, opacity = 1 } = options;
  return `
    <g opacity="${opacity}">
      <rect x="${x}" y="${y}" width="${width}" height="62" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2" />
      ${text(x + width / 2, y + 40, label, { size: 25, weight: 650, fill: textFill, anchor: 'middle' })}
    </g>`;
}

function checkMark(x, y, scale = 1, color = COLORS.green) {
  return `<path d="M ${x} ${y} l ${14 * scale} ${14 * scale} l ${28 * scale} ${-34 * scale}" fill="none" stroke="${color}" stroke-width="${8 * scale}" stroke-linecap="round" stroke-linejoin="round" />`;
}

function documentIcon(x, y, scale = 1, color = COLORS.amber) {
  return `
    <g transform="translate(${x} ${y}) scale(${scale})">
      <path d="M 0 0 h 78 l 34 34 v 128 h -112 z" fill="none" stroke="${color}" stroke-width="7" stroke-linejoin="round" />
      <path d="M 78 0 v 36 h 34" fill="none" stroke="${color}" stroke-width="7" stroke-linejoin="round" />
      <path d="M 24 72 h 64 M 24 102 h 64 M 24 132 h 44" stroke="${color}" stroke-width="7" stroke-linecap="round" />
    </g>`;
}

function wrenchIcon(x, y, scale = 1, color = COLORS.amber) {
  return `
    <g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 82 12 a 38 38 0 0 0 -42 48 l -56 56 a 18 18 0 1 0 26 26 l 56 -56 a 38 38 0 0 0 48 -42 l -28 28 l -28 -6 l -6 -28 z" />
      <circle cx="-1" cy="129" r="5" fill="${color}" stroke="none" />
    </g>`;
}

function machineIcon(x, y, scale = 1) {
  return `
    <g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${COLORS.blueSoft}" stroke-width="7" stroke-linejoin="round">
      <rect x="0" y="30" width="180" height="112" rx="8" />
      <path d="M 22 30 v -20 h 118 v 20 M 46 142 v 28 M 136 142 v 28" />
      <rect x="22" y="54" width="72" height="50" rx="4" />
      <path d="M 112 58 h 46 M 112 80 h 46 M 112 102 h 30" />
      <circle cx="154" cy="124" r="8" fill="${COLORS.red}" stroke="none" />
    </g>`;
}

function node(x, y, radius, options = {}) {
  const { fill = COLORS.panelLight, stroke = COLORS.line, strokeWidth = 3, opacity = 1 } = options;
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />`;
}

function baseLayer(copy, scene, timeMs) {
  const progress = clamp(timeMs / DURATION_MS);
  const dots = Array.from({ length: 22 }, (_, index) => {
    const x = 94 + index * 82;
    return `<circle cx="${x}" cy="994" r="${index / 21 <= progress ? 5 : 3}" fill="${index / 21 <= progress ? COLORS.amber : COLORS.line}" />`;
  }).join('');

  return `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.ink}" />
    <g opacity="0.16">
      ${Array.from({ length: 20 }, (_, index) => line(80 + index * 92, 80, 80 + index * 92, 930, { width: 1 })).join('')}
      ${Array.from({ length: 10 }, (_, index) => line(80, 110 + index * 90, 1840, 110 + index * 90, { width: 1 })).join('')}
    </g>
    <rect x="80" y="52" width="8" height="62" fill="${COLORS.amber}" />
    ${text(112, 87, 'SAGEMRO', { size: 36, weight: 750 })}
    ${text(112, 113, copy.network, { size: 18, weight: 600, fill: COLORS.muted })}
    ${text(1814, 92, `${String(scene + 1).padStart(2, '0')} / 06`, { size: 24, weight: 700, fill: COLORS.amberSoft, anchor: 'end' })}
    <rect x="80" y="966" width="1760" height="2" fill="${COLORS.line}" />
    <rect x="80" y="966" width="${1760 * progress}" height="4" fill="${COLORS.amber}" />
    ${dots}
  `;
}

function titleLayer(copy, scene, timeMs) {
  const opacity = sceneOpacity(scene, timeMs);
  const p = settleProgress(scene, timeMs);
  const y = mix(188, 176, p);
  const isFinalScene = scene === 5;
  const fontSize = copy === COPY.en
    ? (isFinalScene ? 50 : 58)
    : (isFinalScene ? 58 : 66);
  return `
    <g opacity="${opacity}">
      ${text(960, y, copy.scenes[scene], { size: fontSize, weight: 720, anchor: 'middle' })}
      <rect x="850" y="${y + 30}" width="220" height="5" fill="${COLORS.amber}" />
    </g>`;
}

function sceneOne(copy, timeMs) {
  const p = settleProgress(0, timeMs);
  const opacity = sceneOpacity(0, timeMs);
  const inputs = copy.inputs.map((label, index) => {
    const targetX = 770;
    const startX = index % 2 === 0 ? 122 : 450;
    const startY = 318 + index * 132;
    const x = mix(startX - 130, startX, p);
    const width = index % 2 === 0 ? 270 : 250;
    const packet = p > 0.45 ? clamp((p - 0.45 - index * 0.06) / 0.28) : 0;
    const packetX = mix(startX + width, targetX, packet);
    const packetY = mix(startY + 31, 544, packet);
    return `
      ${pill(x, startY, width, label, { stroke: index === 1 ? COLORS.red : COLORS.line, opacity: clamp((p - index * 0.08) / 0.35) })}
      ${line(startX + width, startY + 31, targetX, 544, { stroke: index === 1 ? COLORS.red : COLORS.blue, width: 3, opacity: 0.5 * p })}
      <circle cx="${packetX}" cy="${packetY}" r="10" fill="${index === 1 ? COLORS.red : COLORS.amber}" opacity="${packet}" />
    `;
  }).join('');

  const gatePulse = 0.85 + Math.sin(p * Math.PI * 4) * 0.08;
  return `
    <g opacity="${opacity}">
      ${machineIcon(1280, 414, 1.65)}
      <rect x="740" y="354" width="340" height="380" rx="12" fill="${COLORS.panel}" stroke="${COLORS.amber}" stroke-width="4" />
      <circle cx="910" cy="544" r="${92 * gatePulse}" fill="none" stroke="${COLORS.amber}" stroke-width="5" opacity="0.7" />
      <circle cx="910" cy="544" r="48" fill="${COLORS.amber}" opacity="0.16" />
      <path d="M 875 544 h 70 M 910 509 v 70" stroke="${COLORS.amber}" stroke-width="9" stroke-linecap="round" />
      ${text(910, 688, 'SAGEMRO', { size: 28, weight: 700, fill: COLORS.amberSoft, anchor: 'middle' })}
      ${inputs}
      <path d="M 1090 544 h 154" stroke="${COLORS.blueSoft}" stroke-width="5" stroke-dasharray="14 14" opacity="${p}" />
      <path d="M 1226 528 l 24 16 l -24 16" fill="none" stroke="${COLORS.blueSoft}" stroke-width="5" />
    </g>`;
}

function aiCore(x, y, p) {
  const spokes = Array.from({ length: 8 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 8 + p * 0.8;
    const x2 = x + Math.cos(angle) * 118;
    const y2 = y + Math.sin(angle) * 118;
    return `${line(x, y, x2, y2, { stroke: COLORS.blue, width: 4, opacity: 0.7 })}${node(x2, y2, 13, { fill: COLORS.blue, stroke: COLORS.blueSoft })}`;
  }).join('');
  return `
    <g>
      ${spokes}
      ${node(x, y, 86, { fill: COLORS.panelLight, stroke: COLORS.amber, strokeWidth: 5 })}
      ${text(x, y + 17, 'AI', { size: 54, weight: 800, fill: COLORS.amber, anchor: 'middle' })}
    </g>`;
}

function sceneTwo(copy, timeMs) {
  const p = settleProgress(1, timeMs);
  const opacity = sceneOpacity(1, timeMs);
  const panelX = mix(1300, 1030, p);
  const rows = copy.workOrder.map((label, index) => {
    const rowP = clamp((p - 0.18 - index * 0.08) / 0.35);
    const y = 396 + index * 102;
    return `
      <g opacity="${rowP}" transform="translate(${mix(70, 0, rowP)} 0)">
        <rect x="${panelX + 52}" y="${y}" width="480" height="70" rx="6" fill="${index === 1 ? '#372b2d' : COLORS.panelLight}" stroke="${index === 1 ? COLORS.red : COLORS.line}" stroke-width="2" />
        <circle cx="${panelX + 88}" cy="${y + 35}" r="10" fill="${index === 1 ? COLORS.red : COLORS.green}" />
        ${text(panelX + 116, y + 45, label, { size: 28, weight: 600 })}
        <rect x="${panelX + 380}" y="${y + 27}" width="120" height="12" fill="${index === 1 ? COLORS.red : COLORS.blue}" opacity="0.55" />
      </g>`;
  }).join('');

  const packets = copy.inputs.map((_, index) => {
    const packetP = clamp((p - index * 0.08) / 0.72);
    const startY = 340 + index * 112;
    return `<circle cx="${mix(300, 930, packetP)}" cy="${mix(startY, 500 + index * 24, packetP)}" r="12" fill="${index === 1 ? COLORS.red : COLORS.amber}" opacity="${clamp(packetP * 2) * (1 - clamp((packetP - 0.86) / 0.14))}" />`;
  }).join('');

  return `
    <g opacity="${opacity}">
      ${aiCore(650, 544, p)}
      ${text(650, 738, copy.roles.ai, { size: 28, weight: 700, fill: COLORS.blueSoft, anchor: 'middle' })}
      ${packets}
      <path d="M 786 544 h 198" stroke="${COLORS.amber}" stroke-width="5" stroke-dasharray="16 14" opacity="${p}" />
      <path d="M 964 528 l 24 16 l -24 16" fill="none" stroke="${COLORS.amber}" stroke-width="5" />
      <rect x="${panelX}" y="310" width="590" height="500" rx="10" fill="${COLORS.panel}" stroke="${COLORS.line}" stroke-width="3" />
      <rect x="${panelX}" y="310" width="590" height="68" rx="10" fill="${COLORS.paper}" />
      ${documentIcon(panelX + 24, 325, 0.26, COLORS.ink)}
      ${text(panelX + 90, 356, copy.scenes[1], { size: 27, weight: 750, fill: COLORS.ink })}
      ${rows}
      ${checkMark(panelX + 500, 750, 0.6, COLORS.green)}
    </g>`;
}

function sceneThree(copy, timeMs) {
  const p = settleProgress(2, timeMs);
  const opacity = sceneOpacity(2, timeMs);
  const centerX = 960;
  const centerY = 526;
  const regionPoints = [
    [410, 376],
    [410, 672],
    [1510, 526],
  ];
  const selected = 2;
  const routes = regionPoints.map(([x, y], index) => {
    const routeP = clamp((p - 0.18 - index * 0.08) / 0.48);
    const packetX = mix(centerX, x, routeP);
    const packetY = mix(centerY, y, routeP);
    return `
      ${line(centerX, centerY, x, y, { stroke: index === selected ? COLORS.amber : COLORS.line, width: index === selected ? 7 : 4, opacity: 0.8 })}
      <circle cx="${packetX}" cy="${packetY}" r="${index === selected ? 12 : 8}" fill="${index === selected ? COLORS.amber : COLORS.blue}" opacity="${clamp(p * 2)}" />
      ${node(x, y, index === selected ? 68 : 56, { fill: COLORS.panelLight, stroke: index === selected ? COLORS.amber : COLORS.blue, strokeWidth: index === selected ? 5 : 3 })}
      ${text(x, y + 9, copy.regions[index], { size: 26, weight: 700, anchor: 'middle' })}
      ${index === selected ? checkMark(x - 18, y + 96, 0.48) : ''}
    `;
  }).join('');
  const orbitAngle = p * Math.PI * 2;
  return `
    <g opacity="${opacity}">
      <path d="M 250 806 C 480 640, 590 870, 810 720 S 1240 650, 1690 790" fill="none" stroke="${COLORS.line}" stroke-width="3" stroke-dasharray="12 12" opacity="0.45" />
      ${routes}
      ${node(centerX, centerY, 116, { fill: COLORS.panel, stroke: COLORS.amber, strokeWidth: 5 })}
      ${text(centerX, centerY - 4, copy.roles.operations, { size: 31, weight: 750, fill: COLORS.amberSoft, anchor: 'middle' })}
      ${text(centerX, centerY + 40, 'SAGEMRO', { size: 24, weight: 700, fill: COLORS.muted, anchor: 'middle' })}
      <circle cx="${centerX + Math.cos(orbitAngle) * 148}" cy="${centerY + Math.sin(orbitAngle) * 148}" r="12" fill="${COLORS.amber}" />
      <circle cx="${centerX}" cy="${centerY}" r="148" fill="none" stroke="${COLORS.line}" stroke-width="2" />
      ${pill(758, 780, 404, copy.scenes[2], { fill: COLORS.panelLight, stroke: COLORS.amber, textFill: COLORS.amberSoft, opacity: clamp((p - 0.25) / 0.35) })}
    </g>`;
}

function engineerFigure(x, y, scale = 1) {
  return `
    <g transform="translate(${x} ${y}) scale(${scale})">
      <circle cx="0" cy="-74" r="44" fill="${COLORS.paper}" />
      <path d="M -52 -82 q 52 -54 104 0 v 15 h -104 z" fill="${COLORS.amber}" />
      <path d="M -78 18 q 78 -94 156 0 v 126 h -156 z" fill="${COLORS.panelLight}" stroke="${COLORS.blueSoft}" stroke-width="6" />
      <rect x="-20" y="30" width="40" height="72" fill="${COLORS.amber}" opacity="0.72" />
    </g>`;
}

function sceneFour(copy, timeMs) {
  const p = settleProgress(3, timeMs);
  const opacity = sceneOpacity(3, timeMs);
  const reviewRows = copy.workOrder.slice(0, 3).map((label, index) => {
    const rowP = clamp((p - 0.1 - index * 0.09) / 0.28);
    const y = 374 + index * 88;
    return `
      <g opacity="${rowP}">
        <rect x="340" y="${y}" width="550" height="58" rx="6" fill="${COLORS.panelLight}" stroke="${COLORS.line}" />
        ${text(372, y + 39, label, { size: 25, weight: 600 })}
        ${checkMark(812, y + 22, 0.43)}
      </g>`;
  }).join('');
  const branchP = clamp((p - 0.36) / 0.42);
  const activeBranch = p < 0.72 ? 0 : 1;
  return `
    <g opacity="${opacity}">
      <rect x="280" y="292" width="670" height="470" rx="10" fill="${COLORS.panel}" stroke="${COLORS.line}" stroke-width="3" />
      <rect x="280" y="292" width="670" height="62" rx="10" fill="${COLORS.paper}" />
      ${text(320, 334, copy.roles.engineer, { size: 28, weight: 750, fill: COLORS.ink })}
      ${reviewRows}
      <rect x="340" y="660" width="550" height="52" rx="6" fill="${COLORS.amber}" opacity="${clamp((p - 0.42) / 0.22)}" />
      ${text(615, 695, copy.scenes[3], { size: 25, weight: 750, fill: COLORS.ink, anchor: 'middle', opacity: clamp((p - 0.42) / 0.22) })}
      ${engineerFigure(1228, 494, 1.42)}
      ${wrenchIcon(1340, 604, 0.78, COLORS.amber)}
      ${line(1270, 636, 1090, 760, { stroke: COLORS.line, width: 4, opacity: branchP })}
      ${line(1270, 636, 1510, 760, { stroke: COLORS.line, width: 4, opacity: branchP })}
      ${pill(940, 760, 300, copy.serviceModes[0], { stroke: activeBranch === 0 ? COLORS.amber : COLORS.line, opacity: branchP })}
      ${pill(1360, 760, 300, copy.serviceModes[1], { stroke: activeBranch === 1 ? COLORS.amber : COLORS.line, opacity: branchP })}
      <circle cx="${activeBranch === 0 ? 1090 : 1510}" cy="730" r="13" fill="${COLORS.amber}" opacity="${branchP}" />
    </g>`;
}

function knowledgeCore(x, y, p, label) {
  const rings = [78, 112, 148].map((radius, index) => {
    const rotation = (index % 2 ? -1 : 1) * p * 90;
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${index === 1 ? COLORS.amber : COLORS.blue}" stroke-width="${index === 1 ? 5 : 3}" stroke-dasharray="${42 + index * 14} ${20 + index * 8}" transform="rotate(${rotation} ${x} ${y})" opacity="${0.55 + index * 0.12}" />`;
  }).join('');
  return `
    ${rings}
    ${node(x, y, 62, { fill: COLORS.panelLight, stroke: COLORS.amber, strokeWidth: 4 })}
    ${text(x, y - 2, 'AI', { size: 38, weight: 800, fill: COLORS.amber, anchor: 'middle' })}
    ${text(x, y + 31, label, { size: 20, weight: 700, fill: COLORS.muted, anchor: 'middle' })}
  `;
}

function sceneFive(copy, timeMs) {
  const p = settleProgress(4, timeMs);
  const opacity = sceneOpacity(4, timeMs);
  const reportX = 330;
  const coreX = 1315;
  const coreY = 532;
  const packetP = clamp((p - 0.18) / 0.62);
  const packetLabels = [copy.roles.report, copy.workOrder[3], copy.inputs[2]];
  const packets = packetLabels.map((label, index) => {
    const localP = clamp((packetP - index * 0.1) / 0.7);
    const startX = 900;
    const startY = 402 + index * 118;
    const x = mix(startX, coreX - 160, localP);
    const y = mix(startY, coreY + (index - 1) * 22, localP);
    return `
      ${pill(640, startY - 31, 260, label, { fill: COLORS.panelLight, stroke: COLORS.line, opacity: clamp((p - index * 0.08) / 0.3) })}
      ${line(startX, startY, coreX - 160, coreY + (index - 1) * 22, { stroke: index === 0 ? COLORS.green : COLORS.blue, width: 4, opacity: 0.58 })}
      <circle cx="${x}" cy="${y}" r="11" fill="${index === 0 ? COLORS.green : COLORS.amber}" opacity="${clamp(localP * 2)}" />
    `;
  }).join('');
  return `
    <g opacity="${opacity}">
      <rect x="${reportX}" y="306" width="250" height="470" rx="10" fill="${COLORS.paper}" />
      ${documentIcon(reportX + 66, 360, 1.05, COLORS.ink)}
      ${text(reportX + 125, 600, copy.roles.report, { size: 27, weight: 750, fill: COLORS.ink, anchor: 'middle' })}
      <rect x="${reportX + 52}" y="640" width="146" height="12" fill="${COLORS.blue}" opacity="0.52" />
      <rect x="${reportX + 52}" y="674" width="112" height="12" fill="${COLORS.green}" opacity="0.65" />
      <rect x="${reportX + 52}" y="708" width="166" height="12" fill="${COLORS.amber}" opacity="0.72" />
      ${packets}
      ${knowledgeCore(coreX, coreY, p, copy.roles.knowledge)}
      ${text(coreX, 792, copy.scenes[4], { size: 31, weight: 700, fill: COLORS.amberSoft, anchor: 'middle', opacity: clamp((p - 0.45) / 0.3) })}
      <path d="M 1480 532 C 1630 532, 1650 710, 1450 784 C 1180 884, 936 834, 820 756" fill="none" stroke="${COLORS.green}" stroke-width="5" stroke-dasharray="18 14" opacity="${clamp((p - 0.5) / 0.3)}" />
    </g>`;
}

function capabilityIcon(type, x, y) {
  if (type === 0) {
    return `${documentIcon(x - 35, y - 46, 0.62, COLORS.blueSoft)}${checkMark(x - 12, y + 44, 0.42, COLORS.green)}`;
  }
  if (type === 1) {
    return `<g transform="translate(${x - 54} ${y - 44})" fill="none" stroke="${COLORS.amber}" stroke-width="7"><path d="M 0 28 l 54 -28 l 54 28 l -54 28 z M 0 28 v 70 l 54 30 l 54 -30 v -70 M 54 56 v 72" /></g>`;
  }
  if (type === 2) {
    return `<g transform="translate(${x - 58} ${y - 52})" fill="none" stroke="${COLORS.red}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M 10 46 h 32 l 54 -34 v 100 l -54 -34 h -32 z M 42 78 l 14 52 h -26 l -12 -52" /><path d="M 112 36 q 32 26 0 52" /></g>`;
  }
  return `<g transform="translate(${x - 58} ${y - 48})" fill="none" stroke="${COLORS.green}" stroke-width="7" stroke-linecap="round"><path d="M 0 18 q 58 -36 116 0 v 96 q -58 -34 -116 0 z M 58 0 v 102" /><path d="M 22 40 h 24 M 70 40 h 24 M 22 68 h 24 M 70 68 h 24" /></g>`;
}

function sceneSix(copy, timeMs) {
  const p = settleProgress(5, timeMs);
  const opacity = sceneOpacity(5, timeMs);
  const centerX = 960;
  const centerY = 548;
  const positions = [
    [430, 398],
    [1490, 398],
    [430, 676],
    [1490, 676],
  ];
  const capabilities = copy.capabilities.map((label, index) => {
    const localP = clamp((p - index * 0.06) / 0.58);
    const [targetX, targetY] = positions[index];
    const x = mix(centerX, targetX, localP);
    const y = mix(centerY, targetY, localP);
    const width = copy === COPY.en ? 360 : 300;
    return `
      ${line(centerX, centerY, targetX, targetY, { stroke: index === 1 ? COLORS.amber : index === 2 ? COLORS.red : index === 3 ? COLORS.green : COLORS.blue, width: 5, opacity: 0.6 * localP })}
      <g opacity="${localP}">
        <rect x="${x - width / 2}" y="${y - 92}" width="${width}" height="184" rx="8" fill="${COLORS.panel}" stroke="${index === 1 ? COLORS.amber : index === 2 ? COLORS.red : index === 3 ? COLORS.green : COLORS.blue}" stroke-width="4" />
        ${capabilityIcon(index, x, y - 12)}
        ${text(x, y + 70, label, { size: copy === COPY.en ? 31 : 36, weight: 750, anchor: 'middle' })}
      </g>`;
  }).join('');
  const ringP = clamp((p - 0.18) / 0.5);
  const lockupP = clamp((p - 0.54) / 0.28);
  return `
    <g opacity="${opacity}">
      ${capabilities}
      ${knowledgeCore(centerX, centerY, p * 2.4, copy.roles.knowledge)}
      <circle cx="${centerX}" cy="${centerY}" r="214" fill="none" stroke="${COLORS.amber}" stroke-width="7" stroke-dasharray="80 34" transform="rotate(${p * 110} ${centerX} ${centerY})" opacity="${ringP}" />
      <circle cx="${centerX}" cy="${centerY}" r="246" fill="none" stroke="${COLORS.blue}" stroke-width="3" stroke-dasharray="24 26" transform="rotate(${-p * 90} ${centerX} ${centerY})" opacity="${0.62 * ringP}" />
      <g opacity="${lockupP}">
        <rect x="478" y="826" width="964" height="88" rx="8" fill="${COLORS.paper}" />
        <image href="/frontend/public/sagemro-logo.png" x="500" y="833" width="72" height="72" preserveAspectRatio="xMidYMid meet" />
        ${text(1000, 882, copy.finalTitle, { size: copy === COPY.en ? 36 : 43, weight: 800, fill: COLORS.ink, anchor: 'middle' })}
        ${text(960, 946, copy.finalSubtitle, { size: copy === COPY.en ? 30 : 34, weight: 700, fill: COLORS.amberSoft, anchor: 'middle' })}
      </g>
    </g>`;
}

export function renderSvg(locale = 'cn', rawTimeMs = 0) {
  const normalizedLocale = LOCALES.includes(locale) ? locale : 'cn';
  const copy = COPY[normalizedLocale];
  const timeMs = clamp(Number(rawTimeMs) || 0, 0, DURATION_MS - 1);
  const scene = Math.min(5, Math.floor(timeMs / SCENE_MS));
  const sceneLayers = [
    sceneOne(copy, timeMs),
    sceneTwo(copy, timeMs),
    sceneThree(copy, timeMs),
    sceneFour(copy, timeMs),
    sceneFive(copy, timeMs),
    sceneSix(copy, timeMs),
  ].join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(copy.scenes[scene])}">
      ${baseLayer(copy, scene, timeMs)}
      ${sceneLayers}
      ${titleLayer(copy, scene, timeMs)}
    </svg>`;
}

export function renderFrame(stage, locale = 'cn', timeMs = 0) {
  if (!stage) return;
  stage.innerHTML = renderSvg(locale, timeMs);
}

if (typeof window !== 'undefined') {
  window.EngineerServiceAnimation = {
    DURATION_MS,
    LOCALES,
    COPY,
    renderSvg,
    renderFrame,
  };
}
