const REVIEWED_AT = '2026-09-01';

const brands = [
  ['hans-laser', 'Han\'s Laser', '大族激光', 'machine', 'fiber-laser cutting platforms, installed controls, laser source, cutting head, motion system, and auxiliary equipment', '光纤激光切割平台，以及已装控制系统、激光器、切割头、运动系统和辅助设备'],
  ['hsg-laser', 'HSG Laser', '宏山激光', 'machine', 'sheet and tube laser cutters, automation interfaces, nesting controls, drives, and cutting-process stability', '板材与管材激光切割机、自动化接口、排版控制、驱动系统和切割工艺稳定性'],
  ['bodor-laser', 'Bodor Laser', '邦德激光', 'machine', 'sheet and tube cutting equipment, operator-reported alarms, motion accuracy, optics, and peripheral coordination', '板材与管材切割设备、操作端报警、运动精度、光学系统和外围设备协同'],
  ['hymson-laser', 'Hymson Laser', '海目星', 'machine', 'industrial laser cutting cells, controls and drives, laser delivery, automation, and site utilities', '工业激光切割单元、控制与驱动、激光传输、自动化系统和现场公用条件'],
  ['trumpf', 'TRUMPF', '通快', 'machine', 'laser cutting and metal-forming equipment, control history, machine options, safety circuits, and service records', '激光切割与金属成形设备、控制系统历史、设备选配、安全回路和服务记录'],
  ['bystronic', 'Bystronic', '百超', 'machine', 'laser cutting and press-brake systems, controls, automation links, cutting or bending quality, and installed options', '激光切割与折弯系统、控制系统、自动化联接、切割或折弯质量和已装选配'],
  ['amada', 'AMADA', '天田', 'machine', 'laser cutting, punching, shearing, and bending equipment with its controls, tooling context, and maintenance history', '激光切割、冲压、剪切与折弯设备，以及控制系统、模具条件和维护历史'],
  ['yawei', 'Yawei', '亚威', 'machine', 'laser cutters, press brakes, shears, controls, drives, hydraulic or pneumatic systems, and installed tooling', '激光切割机、折弯机、剪板机、控制与驱动、液压或气动系统及已装模具'],
  ['raycus', 'Raycus', '锐科激光', 'laser-source', 'fiber laser source alarms, output instability, optical delivery, cooling, communication, and operating records', '光纤激光器报警、输出不稳定、光路传输、冷却、通信和运行记录'],
  ['ipg-photonics', 'IPG Photonics', 'IPG Photonics', 'laser-source', 'fiber laser source status, emission and interlock faults, delivery fiber condition, cooling, and source-to-machine communication', '光纤激光器状态、出光与互锁故障、传输光纤状态、冷却和激光器与整机通信'],
  ['max-photonics', 'MAX Photonics', '创鑫激光', 'laser-source', 'fiber laser source alarms, power behavior, interlocks, cooling loop, optical delivery, and integration with the host machine', '光纤激光器报警、功率表现、互锁、冷却回路、光路传输以及与整机的集成'],
  ['friendess-bochu', 'Friendess / BOCHU', '柏楚 / BOCHU', 'control-system', 'CypCut or related laser controls, controller and drive communication, I/O, parameter backups, nesting workflow, and machine integration', 'CypCut 等激光控制系统、控制器与驱动通信、I/O、参数备份、排版流程和整机集成'],
  ['beckhoff', 'Beckhoff', '倍福', 'control-system', 'industrial PC and PLC control, EtherCAT devices, I/O, motion axes, safety-related interfaces, and machine-specific application logic', '工业电脑与 PLC 控制、EtherCAT 设备、I/O、运动轴、安全相关接口和设备专用应用逻辑'],
  ['raytools', 'RayTools', '瑞士瑞镭 / RayTools', 'cutting-head', 'laser cutting heads, focus and height-control behavior, protective optics, nozzle alignment, cooling, and contamination evidence', '激光切割头、焦点与调高表现、保护镜片、喷嘴同轴、冷却和污染痕迹'],
];

const categoryContent = {
  machine: {
    supportEn: ['Review complete alarms, symptoms, and available machine records', 'Coordinate remote checks, repair scope, retrofit feasibility, maintenance, or relocation planning', 'Match replacement parts against the machine model, installed component, and interface'],
    supportZh: ['核对完整报警、故障现象和可用设备记录', '协调远程检查、维修范围、改造可行性、维护或移位计划', '根据整机型号、已装部件和接口核对备件'],
    needsEn: ['Machine stops, repeated alarms, or unstable operation', 'Cutting, bending, positioning, or motion quality changes', 'Controls, drives, optics, auxiliaries, or obsolete components require assessment'],
    needsZh: ['设备停机、重复报警或运行不稳定', '切割、折弯、定位或运动质量发生变化', '控制、驱动、光学、辅机或停产部件需要评估'],
    inputsEn: ['Complete machine model and serial number', 'Controller, laser source, cutting head, drive, and option details', 'Full alarm text and operating timeline', 'Clear photos, videos, service history, and site location'],
    inputsZh: ['完整整机型号和序列号', '控制器、激光器、切割头、驱动和选配信息', '完整报警文本和故障时间线', '清晰照片、视频、维修历史和现场位置'],
  },
  'laser-source': {
    supportEn: ['Review source alarms, interlocks, cooling, and communication evidence', 'Separate likely source-side issues from cutting-head, optics, gas, control, or machine causes', 'Coordinate inspection, compatible replacement, return repair, or integration checks'],
    supportZh: ['核对激光器报警、互锁、冷却和通信证据', '区分激光器侧问题与切割头、光学、气体、控制或整机原因', '协调检测、兼容替换、返修或集成检查'],
    needsEn: ['No emission, intermittent emission, or unstable output', 'Temperature, humidity, interlock, communication, or power alarms', 'Source replacement, delivery-fiber review, or host-machine integration'],
    needsZh: ['不出光、间歇出光或输出不稳定', '温度、湿度、互锁、通信或电源报警', '激光器替换、传输光纤检查或整机集成'],
    inputsEn: ['Source model, serial number, and rated power', 'Complete alarm code and indicator state', 'Chiller temperatures, flow, environment, and recent maintenance', 'Host-machine model, communication interface, photos, and videos'],
    inputsZh: ['激光器型号、序列号和额定功率', '完整报警代码和指示灯状态', '冷水机温度、流量、环境和近期维护记录', '整机型号、通信接口、照片和视频'],
  },
  'control-system': {
    supportEn: ['Review controller, industrial PC, PLC, bus, I/O, and drive evidence', 'Assess parameter backup, software or hardware replacement, and interface risks', 'Coordinate fault isolation and retrofit scope with machine-specific logic kept in view'],
    supportZh: ['核对控制器、工业电脑、PLC、总线、I/O 和驱动证据', '评估参数备份、软硬件替换和接口风险', '结合设备专用逻辑协调故障隔离与改造范围'],
    needsEn: ['Boot, communication, bus, I/O, axis, or application alarms', 'Lost parameters, failed industrial PC, controller, drive, or interface hardware', 'Legacy controls require replacement or integration with other equipment'],
    needsZh: ['启动、通信、总线、I/O、轴或应用程序报警', '参数丢失，工业电脑、控制器、驱动或接口硬件故障', '旧控制系统需要替换或与其他设备集成'],
    inputsEn: ['Controller and industrial PC model with software version', 'Complete alarm, topology, and affected-axis information', 'Available parameter, PLC, configuration, and application backups', 'Machine model, wiring diagrams, interface list, photos, and videos'],
    inputsZh: ['控制器和工业电脑型号及软件版本', '完整报警、拓扑和受影响轴信息', '可用参数、PLC、配置和应用程序备份', '整机型号、电气图、接口清单、照片和视频'],
  },
  'cutting-head': {
    supportEn: ['Review focus, height control, optics, nozzle, cooling, and contamination evidence', 'Separate cutting-head symptoms from source, gas, material, parameter, or motion causes', 'Coordinate inspection, compatible parts matching, replacement, and commissioning checks'],
    supportZh: ['核对焦点、调高、光学、喷嘴、冷却和污染证据', '区分切割头症状与激光器、气体、材料、参数或运动原因', '协调检查、兼容备件匹配、更换和调试确认'],
    needsEn: ['Protective lens burns repeatedly or cutting quality changes', 'Capacitive height, focus, collision, temperature, or communication alarms', 'Nozzle, ceramic, optics, sensor cable, or complete head requires matching'],
    needsZh: ['保护镜片反复烧损或切割质量变化', '电容调高、焦点、碰撞、温度或通信报警', '喷嘴、陶瓷体、光学件、传感线或完整切割头需要匹配'],
    inputsEn: ['Complete cutting-head model and nameplate', 'Laser power, material, thickness, gas, nozzle, and parameter context', 'Alarm history and protective-lens condition', 'Close photos, videos, collision history, and host-machine details'],
    inputsZh: ['完整切割头型号和铭牌', '激光功率、材料、厚度、气体、喷嘴和参数条件', '报警历史和保护镜片状态', '近照、视频、碰撞历史和整机信息'],
  },
};

function buildPage([slug, enName, zhName, category, enFocus, zhFocus], locale) {
  const zh = locale === 'zh-CN';
  const content = categoryContent[category];
  const brandName = zh ? zhName : enName;
  const summary = zh
    ? `针对采用 ${zhName} 相关设备或部件的服务请求，我们先围绕${zhFocus}整理铭牌、报警、运行条件和已做检查，再判断远程排查、现场服务、维修协调、系统改造、备件匹配或维护计划中哪一种更合适。具体可执行范围按型号、地区和项目资料单独确认。`
    : `For service requests involving ${enName} equipment or components, SAGEMRO first organizes evidence around ${enFocus}. The available records are then used to determine whether remote review, field service, repair coordination, retrofit, parts matching, or maintenance planning is the appropriate next step. Feasibility is confirmed for the exact model, region, and project.`;

  return {
    slug,
    brandName,
    category,
    title: zh ? `${zhName} 设备与部件服务支持` : `${enName} Equipment and Component Service Support`,
    seoTitle: zh ? `${zhName} 设备维修、诊断、改造与备件支持` : `${enName} Equipment Repair, Diagnostics, Retrofit, and Parts Support`,
    description: zh ? `面向 ${zhName} 相关设备或部件的独立故障资料整理、维修协调、改造评估、维护与备件匹配服务。` : `Independent fault review, repair coordination, retrofit assessment, maintenance, and parts matching for ${enName} equipment or components.`,
    summary,
    supportScope: zh ? content.supportZh : content.supportEn,
    commonNeeds: zh ? content.needsZh : content.needsEn,
    customerInputs: zh ? content.inputsZh : content.inputsEn,
    serviceBoundary: zh ? '远程判断不能替代现场检测，也不构成最终维修结论。现场服务、配件、价格、交期和质保以单独确认的方案或报价为准。' : 'Remote review does not replace on-site inspection or constitute a final repair conclusion. Field work, parts, price, lead time, and warranty are defined in the confirmed proposal or quotation.',
    independenceNotice: zh ? `SAGEMRO 是独立的多品牌工业设备服务协调方，并非 ${zhName} 官方服务机构，也未获得该品牌授权。品牌名称仅用于识别客户现有设备。` : `SAGEMRO is an independent multi-brand industrial equipment service coordinator. It is not affiliated with or authorized by ${enName}; the trademark is used only to identify customer-installed equipment.`,
    relatedServiceSlugs: category === 'machine'
      ? ['laser-cutting-machine-repair', 'equipment-system-retrofit', 'preventive-maintenance']
      : ['remote-diagnostics', 'spare-parts-consumables', 'equipment-system-retrofit'],
    reviewedAt: REVIEWED_AT,
  };
}

function normalizeLocale(locale) {
  return locale === 'zh-CN' ? 'zh-CN' : 'en';
}

export function getBrandServicePages(locale = 'en') {
  const normalized = normalizeLocale(locale);
  return structuredClone(brands.map((brand) => buildPage(brand, normalized)));
}

export function getBrandServicePage(slug, locale = 'en') {
  return getBrandServicePages(locale).find((page) => page.slug === slug) || null;
}

export function getBrandServiceRequestHref(slug, locale = 'en') {
  const host = normalizeLocale(locale) === 'zh-CN' ? 'https://ai.sagemro.cn' : 'https://ai.sagemro.com';
  return `${host}/service-request?mode=manual&brand=${encodeURIComponent(slug)}`;
}

export function getBrandServicePageRoute(pathname) {
  if (pathname === '/brands' || pathname === '/brands/') return { type: 'hub', slug: '' };
  const match = String(pathname || '').match(/^\/brands\/([a-z0-9-]+)\/?$/);
  if (match) return { type: 'detail', slug: match[1] };
  if (String(pathname || '').startsWith('/brands/')) return { type: 'not-found', slug: '' };
  return null;
}
