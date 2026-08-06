const TECHNICAL_TEAM_ID = 'sagemro-technical-service-team';
const REVIEW_DATE = '2026-08-06';

const OSHA_LOCKOUT = {
  title: 'Lockout/Tagout: Control of Hazardous Energy Lockout-Tagout',
  publisher: 'Occupational Safety and Health Administration',
  url: 'https://www.osha.gov/sites/default/files/publications/OSHA3120.pdf',
  accessedAt: REVIEW_DATE,
};

const OSHA_LASER_SAFETY = {
  title: 'OSHA Technical Manual, Section III: Chapter 6 — Laser Hazards',
  publisher: 'Occupational Safety and Health Administration',
  url: 'https://www.osha.gov/otm/section-3-health-hazards/chapter-6',
  accessedAt: REVIEW_DATE,
};

const OSHA_PRESS_BRAKE_GUARDING = {
  title: 'Guidelines for Point of Operation Guarding of Power Press Brakes',
  publisher: 'Occupational Safety and Health Administration',
  url: 'https://www.osha.gov/enforcement/directives/cpl-02-01-025',
  accessedAt: REVIEW_DATE,
};

const PRECITEC_OPTICS = {
  title: 'Optics Manual',
  publisher: 'Precitec GmbH & Co. KG',
  url: 'https://shop.precitec.com/media/0f/3c/ef/1741683061/TD_Optik-HB_EN.pdf',
  accessedAt: REVIEW_DATE,
};

const BYSTRONIC_CUT_QUALITY = {
  title: '3 Essential Guidelines for Quality Laser Cutting',
  publisher: 'Bystronic',
  url: 'https://www.bystronic.com/zaf/en/news/3-essential-guidelines-quality-laser-cutting',
  accessedAt: REVIEW_DATE,
};

const BYSTRONIC_LASER_MAINTENANCE = {
  title: 'Maintenance Tips for Your Bystronic Fiber Laser Cutter',
  publisher: 'Bystronic',
  url: 'https://www.bystronic.com/zaf/en/news/maintenance-tips-your-bystronic-fiber-laser-cutter',
  accessedAt: REVIEW_DATE,
};

const TEYU_CHILLER_ALARM = {
  title: 'Troubleshoot the Ultrahigh Water Temp Alarm of TEYU Laser Chiller CWFL-2000',
  publisher: 'TEYU S&A Chiller',
  url: 'https://www.teyuchiller.com/ultrahigh-water-temp-alarm-of-laser-chiller-cwfl2000.html',
  accessedAt: REVIEW_DATE,
};

const WILA_ALIGNMENT = {
  title: 'Avoid Product Deviations',
  publisher: 'WILA B.V.',
  url: 'https://www.wilatooling.com/knowledge-innovation/knowledge-articles/avoid-product-deviations/',
  accessedAt: REVIEW_DATE,
};

const WILA_CROWNING = {
  title: 'New Standard Crowning',
  publisher: 'WILA B.V.',
  url: 'https://www.wilatooling.com/products/press-brake-tool-holders/new-standard-tool-holders/new-standard-crowning/',
  accessedAt: REVIEW_DATE,
};

const DELEM_CONTROL = {
  title: 'DA-66T Press Brake Control',
  publisher: 'Delem',
  url: 'https://delem.com/en/solutions/pressbrake-controls/da-60-series/da-66t',
  accessedAt: REVIEW_DATE,
};

const REXROTH_HYDRAULICS = {
  title: 'Failures — Causes and Advices',
  publisher: 'Bosch Rexroth',
  url: 'https://www.boschrexroth.com/en/pl/service-and-support/service/repairs/failures-causes-and-advices/',
  accessedAt: REVIEW_DATE,
};

const TRUMPF_TECHNICAL_SERVICE = {
  title: 'Technical Service for Machines & Systems',
  publisher: 'TRUMPF',
  url: 'https://www.trumpf.com/en_US/products/services/services-machines-amp-systems-and-lasers/technical-service/',
  accessedAt: REVIEW_DATE,
};

const TRUMPF_PRESS_BRAKE_TRAINING = {
  title: 'TRUMPF Training Catalog 2022–2023',
  publisher: 'TRUMPF',
  url: 'https://www.trumpf.com/filestorage/TRUMPF_US/Training_Schedule/Training/TRUMPF-training-catalog-2022-2023.pdf',
  accessedAt: REVIEW_DATE,
};

const EN_STOP_CONDITIONS = [
  'Stop if a check would reveal exposed energized parts; isolate hazardous energy under the site procedure and escalate.',
  'Stop if any guard or interlock is defeated, missing, or unreliable; do not bypass it.',
  'Stop for uncontrolled hydraulic or mechanical movement, and keep clear of the motion area.',
  'Stop for smoke, fire, or overheating and follow the site emergency procedure.',
  'Escalate any OEM-only calibration or protected service adjustment to the machine maker or qualified service team.',
];

const ZH_STOP_CONDITIONS = [
  '如果检查会接触裸露带电部件，请停止；按现场程序隔离危险能量并升级处理。',
  '如果防护装置或联锁被旁路、缺失或不可靠，请停止；不得绕过安全功能。',
  '如出现失控的液压或机械运动，请停止并远离运动区域。',
  '如出现烟雾、起火或过热，请停止并执行现场应急程序。',
  '任何仅限 OEM 执行的校准或受保护服务调整，都应升级给设备制造商或合格服务团队。',
];

function guide(value) {
  const published = value.status === 'published';
  return {
    ...value,
    authorId: TECHNICAL_TEAM_ID,
    reviewedBy: TECHNICAL_TEAM_ID,
    publishedAt: published ? REVIEW_DATE : null,
    reviewedAt: published ? REVIEW_DATE : null,
    internalEvidenceNotes: [],
  };
}

const EN_SAFETY = 'Use only external, non-invasive observations allowed by the machine manual and site energy-control procedure. Do not open electrical or pressurized enclosures for this guide.';
const ZH_SAFETY = '仅执行设备手册和现场能量控制程序允许的外部、非侵入式观察。本指南不要求打开电气柜或带压部件。';

const DIAGNOSTIC_GUIDES = {
  en: [
    guide({
      slug: 'laser-cutting-machine-not-firing',
      status: 'draft',
      category: 'laser-cutting',
      title: 'Laser cutting machine not firing',
      description: 'A structured intake for a machine that completes a start request without producing an expected cutting beam.',
      directAnswer: '“Not firing” is an operating observation, not yet a diagnosis. Record the machine state and visible safety indications before a model-specific service review.',
      safety: EN_SAFETY,
      symptoms: ['The cutting cycle requests laser output but no cut starts', 'The machine remains stopped after a start request or displays a general warning'],
      causes: ['The operating sequence is not in a ready state', 'A safety enclosure or interlock state is unresolved', 'The laser source or beam-delivery system needs model-specific diagnosis'],
      checks: ['Record the displayed operating state and recent changes without resetting alarms', 'Observe external guard and interlock indicators without bypassing them', 'Collect the machine model, source model, event history, and photos of visible indicators'],
      actions: ['Restore only normal operator prerequisites described in the machine manual', 'Keep the machine stopped and request service review if the safe state cannot be confirmed', 'Escalate the evidence to the machine maker or qualified laser service team'],
      stopConditions: EN_STOP_CONDITIONS,
      relatedServiceSlug: 'laser-cutting-machine-repair',
      relatedToolSlug: 'laser-cutting-speed-reference',
      diagnosisPrompt: 'Describe what the machine does after the start request, the visible machine state, and any recent setup or maintenance change.',
      references: [TRUMPF_TECHNICAL_SERVICE, OSHA_LASER_SAFETY, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'fiber-laser-burr-and-dross',
      status: 'draft',
      category: 'laser-cutting',
      title: 'Fiber laser burr and dross troubleshooting',
      description: 'A diagnostic-order review of visible burr or attached dross on fiber-laser-cut edges.',
      directAnswer: 'Burr or dross is a cut-edge observation, not yet a diagnosis. First compare material and program context, then inspect accessible nozzle and optics condition before requesting parameter review.',
      safety: EN_SAFETY,
      symptoms: ['Attached material remains on the lower cut edge', 'Cut-edge quality changes between otherwise comparable parts'],
      causes: ['The selected job does not match the material or sheet condition', 'The nozzle condition or centering is degraded', 'Optical contamination or focus state is affecting the process'],
      checks: ['Compare the material identity, sheet condition, and selected approved job', 'With the machine safely stopped, visually inspect the accessible nozzle for debris or damage', 'Review accessible contamination indicators and whether the change follows an optics event'],
      actions: ['Use the machine maker’s approved job for the verified material', 'Clean or replace the nozzle only as directed by the machine manual', 'Stop production and request trained optics or focus review if contamination or focus state is uncertain'],
      stopConditions: EN_STOP_CONDITIONS,
      relatedServiceSlug: 'laser-cutting-machine-repair',
      relatedToolSlug: 'laser-cutting-speed-reference',
      diagnosisPrompt: 'Share material, visible edge condition, nozzle observations, the approved job used, and when the result changed.',
      references: [PRECITEC_OPTICS, BYSTRONIC_CUT_QUALITY, OSHA_LASER_SAFETY, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'laser-chiller-alarm-troubleshooting',
      status: 'draft',
      category: 'laser-cutting',
      title: 'Laser chiller alarm troubleshooting',
      description: 'A safe external review of laser-chiller alarms before model-specific refrigeration or electrical service.',
      directAnswer: 'A chiller alarm is an observation reported by the controller, not yet a diagnosis. Record the message, coolant condition, ventilation, and external leakage before escalation.',
      safety: EN_SAFETY,
      symptoms: ['The chiller reports an alarm or stops cooling', 'Displayed coolant condition or temperature behavior changes unexpectedly'],
      causes: ['The installation airflow or external filter condition is restricting heat rejection', 'Coolant level, flow, or an external connection is abnormal', 'A fan, sensor, compressor, or refrigeration circuit needs trained diagnosis'],
      checks: ['Record the complete displayed message and ambient conditions', 'Inspect accessible vents, filters, coolant level, hoses, and visible leaks with the equipment safely stopped', 'Observe only external fan behavior and collect the model and recent maintenance history'],
      actions: ['Restore clear ventilation and perform only manual-approved external cleaning', 'Correct only accessible coolant or hose issues allowed by the chiller manual', 'Escalate persistent alarms or suspected internal faults without opening the enclosure'],
      stopConditions: EN_STOP_CONDITIONS,
      relatedServiceSlug: 'laser-cutting-machine-repair',
      relatedToolSlug: 'laser-chiller-dust-collector-sizing-checklist',
      diagnosisPrompt: 'Provide the complete alarm message, chiller model, coolant and ventilation observations, leaks, and recent maintenance.',
      references: [TEYU_CHILLER_ALARM, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'laser-protective-lens-burning',
      status: 'published',
      category: 'laser-cutting',
      title: 'Why a laser protective lens keeps burning',
      description: 'A contamination-path review for repeated protective-window discoloration, marks, or damage.',
      directAnswer: 'Repeated protective-lens damage is an observation, not yet a diagnosis. Contamination evidence and its side of origin must be reviewed before replacing parts or changing the process.',
      safety: EN_SAFETY,
      symptoms: ['A protective window shows new marks, haze, or discoloration', 'Cut quality declines again after a protective-window change'],
      causes: ['Process-side spatter or fumes are contaminating the protective window', 'Handling residue, particles, or unsuitable cleaning is lowering the damage threshold', 'A seal, gas-quality, pressure, distance, or focus issue requires trained review'],
      checks: ['Safely remove the cartridge only if the machine manual permits and record the contamination side', 'Inspect for visible residue, fingerprints, scratches, and cartridge or seal damage without touching optical surfaces', 'Record gas supply condition, recent nozzle events, and contamination-monitor indications'],
      actions: ['Replace a window that cannot be safely cleaned according to the optics manual', 'Correct handling and cleanliness controls specified by the component maker', 'Escalate suspected sealing, gas, focus, or optical-path faults before fitting another window'],
      stopConditions: EN_STOP_CONDITIONS,
      relatedServiceSlug: 'laser-cutting-machine-repair',
      relatedToolSlug: 'laser-cutting-cost-calculator',
      diagnosisPrompt: 'Share photos of both accessible sides, cartridge and seal condition, gas observations, and the events before damage appeared.',
      references: [PRECITEC_OPTICS, OSHA_LASER_SAFETY, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'press-brake-angle-inaccuracy',
      status: 'draft',
      category: 'press-brake',
      title: 'Press brake angle inaccuracy troubleshooting',
      description: 'A diagnostic-order review when a measured bend angle differs from the intended result.',
      directAnswer: 'An inaccurate bend angle is a measured observation, not yet a diagnosis. Confirm the part, program, tooling, and alignment evidence before any correction or calibration.',
      safety: EN_SAFETY,
      symptoms: ['A measured bend angle differs from the drawing intent', 'A repeated bend does not reproduce the approved sample'],
      causes: ['Material, thickness, orientation, or program selection differs from the approved setup', 'Tool seating, identity, condition, or alignment is incorrect', 'Machine compensation or sensor calibration needs OEM review'],
      checks: ['Verify the drawing, material identity, orientation, and selected program against the approved setup', 'With hazardous energy controlled, inspect tool identity, seating, cleanliness, damage, and alignment', 'Compare the controller correction state and measurement method with the machine documentation'],
      actions: ['Restore the approved material and program combination', 'Correct only tool seating or cleanliness tasks permitted by the tooling manual', 'Escalate compensation, sensor, or axis calibration to the machine maker or qualified service team'],
      stopConditions: EN_STOP_CONDITIONS,
      relatedServiceSlug: 'press-brake-repair',
      relatedToolSlug: 'press-brake-v-die-bend-allowance-helper',
      diagnosisPrompt: 'Provide the drawing intent, measured result, material, program, tooling identity, setup photos, and correction history.',
      references: [WILA_ALIGNMENT, DELEM_CONTROL, OSHA_PRESS_BRAKE_GUARDING, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'press-brake-angle-variation',
      status: 'draft',
      category: 'press-brake',
      title: 'Uneven bend angle across the part',
      description: 'A structured review when the bend angle varies along the length of a formed part.',
      directAnswer: 'Angle variation across a part is an observed pattern, not yet a diagnosis. Map the variation, then check tooling alignment and deflection-compensation context in that order.',
      safety: EN_SAFETY,
      symptoms: ['The bend angle changes from one end of the part to the other', 'The center result differs from the results near the ends'],
      causes: ['The material or part support condition varies along the bend', 'Punch and die alignment or seating varies along the machine', 'Deflection compensation does not match the machine and bend context'],
      checks: ['Record angle measurements by position and inspect material and support consistency', 'With hazardous energy controlled, inspect tool seating, cleanliness, damage, and visible alignment', 'Record the crowning or compensation state without changing protected settings'],
      actions: ['Correct verified material orientation or support inconsistencies', 'Follow the tooling maker’s alignment instructions or request tooling service', 'Escalate crowning or local compensation adjustment to trained personnel using the OEM procedure'],
      stopConditions: EN_STOP_CONDITIONS,
      relatedServiceSlug: 'press-brake-repair',
      relatedToolSlug: 'press-brake-v-die-bend-allowance-helper',
      diagnosisPrompt: 'Share angle measurements by position, material and support details, tooling setup photos, and the compensation state.',
      references: [WILA_CROWNING, WILA_ALIGNMENT, DELEM_CONTROL, OSHA_PRESS_BRAKE_GUARDING, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'press-brake-low-hydraulic-pressure',
      status: 'draft',
      category: 'press-brake',
      title: 'Press brake low hydraulic pressure checks',
      description: 'A safe evidence-collection sequence for a press brake reporting or behaving like hydraulic force is unavailable.',
      directAnswer: 'A low-pressure display or weak motion is an observation, not yet a diagnosis. External fluid, temperature, leakage, and event evidence should be collected before hydraulic service.',
      safety: EN_SAFETY,
      symptoms: ['The controller reports reduced hydraulic pressure or force', 'Ram motion is incomplete, weak, or interrupted'],
      causes: ['Fluid level, temperature, or externally visible leakage is outside the documented operating condition', 'A filter, suction path, pump, valve, or internal leakage may be affecting the circuit', 'The pressure feedback or control system needs model-specific diagnosis'],
      checks: ['Record the displayed condition, operating phase, fluid temperature indication, and recent changes', 'With the machine safely stopped, inspect accessible level indicators and external hoses or fittings for visible leakage', 'Collect the machine hydraulic diagram, maintenance history, and controller event history for service'],
      actions: ['Restore only fluid or external conditions explicitly permitted by the machine manual', 'Keep the machine stopped if leakage, abnormal noise, heat, or motion is present', 'Escalate filter, pump, valve, sensor, and pressure-setting work to qualified hydraulic service'],
      stopConditions: EN_STOP_CONDITIONS,
      relatedServiceSlug: 'press-brake-repair',
      relatedToolSlug: 'press-brake-tonnage-calculator',
      diagnosisPrompt: 'Provide the displayed condition, operating phase, external leak observations, fluid indications, noise, heat, and recent maintenance.',
      references: [REXROTH_HYDRAULICS, OSHA_PRESS_BRAKE_GUARDING, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'laser-cutting-machine-maintenance-checklist',
      status: 'published',
      category: 'laser-cutting',
      title: 'Laser cutting machine maintenance checklist',
      description: 'A condition-based external checklist to organize laser-cutter maintenance observations and escalation.',
      directAnswer: 'A checklist records observable condition; it is not a diagnosis and does not replace the machine-specific maintenance schedule. Use it to collect evidence before approved maintenance or service.',
      safety: EN_SAFETY,
      symptoms: ['Optics, nozzle, cooling, work area, or safety-system condition needs review', 'Cut quality or machine behavior has changed since the prior inspection'],
      causes: ['Debris, nozzle wear, or optical contamination is visible', 'Cooling level, ventilation, filtration, or leakage condition has changed', 'A safety function, motion component, or service interval needs machine-specific attention'],
      checks: ['Inspect accessible optics indicators, nozzle condition, and the work area with the machine safely stopped', 'Inspect accessible coolant level, vents, filters, and external leaks', 'Verify safety-system status and review the OEM maintenance record without defeating safeguards'],
      actions: ['Perform only cleaning or consumable replacement described in the machine manual', 'Record changed cooling or filtration condition and escalate internal work', 'Remove the machine from service if a safety function is unreliable and arrange qualified review'],
      stopConditions: EN_STOP_CONDITIONS,
      relatedServiceSlug: 'preventive-maintenance',
      relatedToolSlug: 'laser-chiller-dust-collector-sizing-checklist',
      diagnosisPrompt: 'Share the machine model, maintenance record, optics and nozzle condition, cooling observations, safety status, and recent changes.',
      references: [BYSTRONIC_LASER_MAINTENANCE, PRECITEC_OPTICS, OSHA_LASER_SAFETY, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'press-brake-maintenance-checklist',
      status: 'draft',
      category: 'press-brake',
      title: 'Press brake maintenance checklist',
      description: 'A draft external inspection framework for press-brake maintenance intake pending broader manufacturer evidence.',
      directAnswer: 'A maintenance checklist records observations; it is not a diagnosis and cannot replace the press brake maker’s model-specific schedule.',
      safety: EN_SAFETY,
      symptoms: ['Tooling, alignment, hydraulics, motion, or safety-system condition needs review', 'Forming behavior has changed since the prior inspection'],
      causes: ['Tool seating, cleanliness, damage, or alignment condition has changed', 'An external hydraulic leak or motion concern is visible', 'A guard, interlock, control, or OEM service item needs qualified review'],
      checks: ['With hazardous energy controlled, inspect accessible tooling condition and seating', 'Inspect only external hydraulic and motion areas for leakage, damage, or unusual condition', 'Review safety status and model-specific maintenance records without bypassing safeguards'],
      actions: ['Perform only tooling care described by the tooling and machine manuals', 'Keep the machine stopped and escalate any hydraulic or motion concern', 'Remove the machine from service if a safety function is unreliable and arrange OEM review'],
      stopConditions: EN_STOP_CONDITIONS,
      relatedServiceSlug: 'preventive-maintenance',
      relatedToolSlug: 'press-brake-tonnage-calculator',
      diagnosisPrompt: 'Share the model, maintenance record, tooling and alignment observations, external hydraulic condition, and safety status.',
      references: [WILA_ALIGNMENT, TRUMPF_PRESS_BRAKE_TRAINING, OSHA_PRESS_BRAKE_GUARDING, OSHA_LOCKOUT],
    }),
  ],
  'zh-CN': [
    guide({
      slug: 'laser-cutting-machine-not-firing', status: 'draft', category: 'laser-cutting', title: '激光切割机不出光',
      description: '用于整理设备收到启动请求但未产生预期切割光束时的信息。',
      directAnswer: '“不出光”是运行现象，不是已经完成的诊断。应先记录设备状态和可见安全指示，再进行针对具体机型的服务评估。',
      safety: ZH_SAFETY,
      symptoms: ['切割循环请求激光输出，但未开始切割', '启动请求后设备保持停止或显示一般警告'],
      causes: ['设备运行顺序尚未处于就绪状态', '安全外罩或联锁状态未满足', '激光器或光路需要针对具体机型进行诊断'],
      checks: ['记录显示的运行状态和近期变更，不清除报警', '仅观察外部防护和联锁指示，不旁路安全功能', '收集设备型号、激光器型号、事件记录和可见指示照片'],
      actions: ['仅恢复设备手册说明的正常操作前提', '无法确认安全状态时保持停机并提交服务评估', '将资料升级给设备制造商或合格激光服务团队'],
      stopConditions: ZH_STOP_CONDITIONS, relatedServiceSlug: 'laser-cutting-machine-repair', relatedToolSlug: 'laser-cutting-speed-reference',
      diagnosisPrompt: '请说明启动请求后设备的表现、可见设备状态，以及近期设置或维护变更。',
      references: [TRUMPF_TECHNICAL_SERVICE, OSHA_LASER_SAFETY, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'fiber-laser-burr-and-dross', status: 'draft', category: 'laser-cutting', title: '激光切割毛刺与挂渣排查',
      description: '按诊断顺序检查光纤激光切边上可见的毛刺或附着挂渣。',
      directAnswer: '毛刺或挂渣是切边观察现象，不是已经完成的诊断。先核对材料和程序，再检查可接近的喷嘴与光学状态，最后提交参数评估。',
      safety: ZH_SAFETY,
      symptoms: ['切口下缘残留附着物', '其他条件可比时，切边质量发生变化'],
      causes: ['所选作业与材料或板材状态不匹配', '喷嘴状态或对中情况异常', '光学污染或焦点状态影响加工'],
      checks: ['对照材料标识、板材状态和已批准作业', '设备安全停机后，目视检查可接近喷嘴是否有异物或损伤', '查看可接近的污染指示，并确认变化是否发生在光学事件之后'],
      actions: ['使用设备制造商针对已确认材料提供的作业', '仅按设备手册清洁或更换喷嘴', '污染或焦点状态不明确时停止生产并申请受训人员评估'],
      stopConditions: ZH_STOP_CONDITIONS, relatedServiceSlug: 'laser-cutting-machine-repair', relatedToolSlug: 'laser-cutting-speed-reference',
      diagnosisPrompt: '请提供材料、切边现象、喷嘴观察结果、所用已批准作业，以及结果开始变化的时间。',
      references: [PRECITEC_OPTICS, BYSTRONIC_CUT_QUALITY, OSHA_LASER_SAFETY, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'laser-chiller-alarm-troubleshooting', status: 'draft', category: 'laser-cutting', title: '激光冷水机报警排查',
      description: '在针对具体机型的制冷或电气服务前，对冷水机报警进行安全的外部检查。',
      directAnswer: '冷水机报警是控制器报告的现象，不是已经完成的诊断。升级前应记录完整信息、冷却液状态、通风和外部泄漏。',
      safety: ZH_SAFETY,
      symptoms: ['冷水机报告报警或停止制冷', '显示的冷却液状态或温度表现异常变化'],
      causes: ['安装通风或外部过滤状态限制散热', '冷却液液位、流量或外部连接异常', '风扇、传感器、压缩机或制冷回路需要受训人员诊断'],
      checks: ['记录完整显示信息和环境条件', '设备安全停机后检查可接近的通风口、滤网、液位、软管和可见泄漏', '只观察外部风扇表现，并收集型号和近期维护记录'],
      actions: ['恢复通畅通风，仅执行手册允许的外部清洁', '仅处理冷水机手册允许的可接近冷却液或软管问题', '持续报警或疑似内部故障时不要开盖，直接升级处理'],
      stopConditions: ZH_STOP_CONDITIONS, relatedServiceSlug: 'laser-cutting-machine-repair', relatedToolSlug: 'laser-chiller-dust-collector-sizing-checklist',
      diagnosisPrompt: '请提供完整报警信息、冷水机型号、冷却液与通风观察、泄漏和近期维护情况。',
      references: [TEYU_CHILLER_ALARM, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'laser-protective-lens-burning', status: 'published', category: 'laser-cutting', title: '激光保护镜片频繁烧坏的原因',
      description: '针对保护镜反复变色、出现斑点或损伤，按污染路径进行检查。',
      directAnswer: '保护镜反复损伤是观察现象，不是已经完成的诊断。更换零件或改变工艺前，应确认污染证据及其来源侧。',
      safety: ZH_SAFETY,
      symptoms: ['保护镜出现新的斑点、雾状污染或变色', '更换保护镜后切割质量再次下降'],
      causes: ['加工侧飞溅或烟尘污染保护镜', '操作残留、颗粒或不合适清洁降低损伤阈值', '密封、气体质量、压力、距离或焦点问题需要受训人员评估'],
      checks: ['仅在设备手册允许时安全取出镜盒，并记录污染所在侧', '不接触光学表面，检查可见残留、指印、划痕及镜盒或密封损伤', '记录供气状态、近期喷嘴事件和污染监测指示'],
      actions: ['无法按光学手册安全清洁的保护镜应更换', '纠正部件制造商规定的操作与洁净控制', '怀疑密封、气体、焦点或光路故障时，安装新保护镜前先升级处理'],
      stopConditions: ZH_STOP_CONDITIONS, relatedServiceSlug: 'laser-cutting-machine-repair', relatedToolSlug: 'laser-cutting-cost-calculator',
      diagnosisPrompt: '请提供可接近两侧的照片、镜盒和密封状态、供气观察，以及损伤前发生的事件。',
      references: [PRECITEC_OPTICS, OSHA_LASER_SAFETY, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'press-brake-angle-inaccuracy', status: 'draft', category: 'press-brake', title: '折弯角度不准怎么排查',
      description: '当实测折弯角度与目标结果不符时，按诊断顺序核对。',
      directAnswer: '折弯角度不准是测量到的现象，不是已经完成的诊断。任何修正或校准前，先确认工件、程序、模具和对中证据。',
      safety: ZH_SAFETY,
      symptoms: ['实测折弯角度与图纸目标不同', '重复折弯无法复现已批准样件'],
      causes: ['材料、厚度、方向或程序选择与批准设置不同', '模具就位、标识、状态或对中不正确', '设备补偿或传感器校准需要 OEM 评估'],
      checks: ['对照批准设置核对图纸、材料标识、方向和所选程序', '控制危险能量后，检查模具标识、就位、洁净、损伤和对中', '对照设备资料核对控制器修正状态和测量方法'],
      actions: ['恢复已批准的材料与程序组合', '仅执行模具手册允许的就位或清洁工作', '将补偿、传感器或轴校准升级给设备制造商或合格服务团队'],
      stopConditions: ZH_STOP_CONDITIONS, relatedServiceSlug: 'press-brake-repair', relatedToolSlug: 'press-brake-v-die-bend-allowance-helper',
      diagnosisPrompt: '请提供图纸目标、实测结果、材料、程序、模具标识、设置照片和修正记录。',
      references: [WILA_ALIGNMENT, DELEM_CONTROL, OSHA_PRESS_BRAKE_GUARDING, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'press-brake-angle-variation', status: 'draft', category: 'press-brake', title: '折弯角度左右不一致怎么排查',
      description: '当成形件沿折弯长度方向的角度不一致时进行结构化检查。',
      directAnswer: '工件不同位置角度不一致是观察到的分布，不是已经完成的诊断。先记录分布，再依次检查模具对中和挠度补偿背景。',
      safety: ZH_SAFETY,
      symptoms: ['折弯角度从工件一端到另一端发生变化', '工件中部结果与两端结果不同'],
      causes: ['材料或工件支撑条件沿折弯线不一致', '上下模沿设备长度的对中或就位不一致', '挠度补偿与设备及折弯工况不匹配'],
      checks: ['按位置记录角度测量，并检查材料和支撑一致性', '控制危险能量后，检查模具就位、洁净、损伤和可见对中状态', '记录挠度补偿状态，不改变受保护设置'],
      actions: ['纠正确认过的材料方向或支撑不一致', '按模具制造商说明处理对中，或申请模具服务', '由受训人员按 OEM 程序处理挠度或局部补偿调整'],
      stopConditions: ZH_STOP_CONDITIONS, relatedServiceSlug: 'press-brake-repair', relatedToolSlug: 'press-brake-v-die-bend-allowance-helper',
      diagnosisPrompt: '请提供各位置角度测量、材料与支撑信息、模具设置照片和补偿状态。',
      references: [WILA_CROWNING, WILA_ALIGNMENT, DELEM_CONTROL, OSHA_PRESS_BRAKE_GUARDING, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'press-brake-low-hydraulic-pressure', status: 'draft', category: 'press-brake', title: '折弯机液压压力不足检查',
      description: '当折弯机报告液压力不足或表现出推力不足时，安全收集诊断证据。',
      directAnswer: '低压显示或运动无力是观察现象，不是已经完成的诊断。液压维修前应先收集外部液位、温度、泄漏和事件证据。',
      safety: ZH_SAFETY,
      symptoms: ['控制器报告液压压力或推力下降', '滑块运动不完整、无力或中断'],
      causes: ['液位、温度或外部可见泄漏偏离资料规定的运行状态', '过滤、吸油路径、泵、阀或内部泄漏可能影响回路', '压力反馈或控制系统需要针对具体机型诊断'],
      checks: ['记录显示状态、运行阶段、油温指示和近期变更', '设备安全停机后，检查可接近液位指示以及外部软管或接头是否有可见泄漏', '为服务团队收集设备液压图、维护记录和控制器事件记录'],
      actions: ['仅恢复设备手册明确允许处理的油液或外部条件', '存在泄漏、异常噪声、发热或运动时保持停机', '将过滤、泵、阀、传感器和压力设置工作升级给合格液压服务人员'],
      stopConditions: ZH_STOP_CONDITIONS, relatedServiceSlug: 'press-brake-repair', relatedToolSlug: 'press-brake-tonnage-calculator',
      diagnosisPrompt: '请提供显示状态、运行阶段、外部泄漏观察、油液指示、噪声、发热和近期维护。',
      references: [REXROTH_HYDRAULICS, OSHA_PRESS_BRAKE_GUARDING, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'laser-cutting-machine-maintenance-checklist', status: 'published', category: 'laser-cutting', title: '激光切割机维护保养检查表',
      description: '按可观察状态整理激光切割机维护信息和升级条件。',
      directAnswer: '检查表记录可观察状态，不是诊断，也不能替代具体机型的维护计划。它用于在批准的维护或服务前收集证据。',
      safety: ZH_SAFETY,
      symptoms: ['需要检查光学、喷嘴、冷却、工作区或安全系统状态', '自上次检查后，切割质量或设备表现发生变化'],
      causes: ['可见碎屑、喷嘴磨损或光学污染', '冷却液位、通风、过滤或泄漏状态改变', '安全功能、运动部件或服务项目需要针对设备处理'],
      checks: ['设备安全停机后，检查可接近光学指示、喷嘴状态和工作区', '检查可接近冷却液位、通风口、滤网和外部泄漏', '不旁路安全功能，确认安全系统状态并查看 OEM 维护记录'],
      actions: ['仅执行设备手册规定的清洁或耗材更换', '记录冷却或过滤状态变化，并升级内部工作', '安全功能不可靠时停止使用设备并安排合格评估'],
      stopConditions: ZH_STOP_CONDITIONS, relatedServiceSlug: 'preventive-maintenance', relatedToolSlug: 'laser-chiller-dust-collector-sizing-checklist',
      diagnosisPrompt: '请提供设备型号、维护记录、光学和喷嘴状态、冷却观察、安全状态和近期变更。',
      references: [BYSTRONIC_LASER_MAINTENANCE, PRECITEC_OPTICS, OSHA_LASER_SAFETY, OSHA_LOCKOUT],
    }),
    guide({
      slug: 'press-brake-maintenance-checklist', status: 'draft', category: 'press-brake', title: '折弯机维护保养检查表',
      description: '折弯机维护信息的外部检查草稿，等待更多制造商证据后发布。',
      directAnswer: '维护检查表记录观察结果，不是诊断，也不能替代折弯机制造商针对具体机型的计划。',
      safety: ZH_SAFETY,
      symptoms: ['需要检查模具、对中、液压、运动或安全系统状态', '自上次检查后，成形表现发生变化'],
      causes: ['模具就位、洁净、损伤或对中状态改变', '可见外部液压泄漏或运动异常', '防护、联锁、控制或 OEM 服务项目需要合格评估'],
      checks: ['控制危险能量后，检查可接近模具状态和就位', '仅从外部检查液压和运动区域是否有泄漏、损伤或异常', '不旁路安全功能，查看安全状态和具体机型维护记录'],
      actions: ['仅执行模具和设备手册规定的模具保养', '发现液压或运动问题时保持停机并升级处理', '安全功能不可靠时停止使用设备并安排 OEM 评估'],
      stopConditions: ZH_STOP_CONDITIONS, relatedServiceSlug: 'preventive-maintenance', relatedToolSlug: 'press-brake-tonnage-calculator',
      diagnosisPrompt: '请提供型号、维护记录、模具与对中观察、外部液压状态和安全状态。',
      references: [WILA_ALIGNMENT, TRUMPF_PRESS_BRAKE_TRAINING, OSHA_PRESS_BRAKE_GUARDING, OSHA_LOCKOUT],
    }),
  ],
};

function cloneGuide(value) {
  return {
    ...value,
    symptoms: [...value.symptoms],
    causes: [...value.causes],
    checks: [...value.checks],
    actions: [...value.actions],
    stopConditions: [...value.stopConditions],
    references: value.references.map((reference) => ({ ...reference })),
    internalEvidenceNotes: [...value.internalEvidenceNotes],
  };
}

export function getDiagnosticGuides(locale, { publishedOnly = true } = {}) {
  const guides = DIAGNOSTIC_GUIDES[locale] ?? DIAGNOSTIC_GUIDES.en;
  return guides
    .filter((value) => !publishedOnly || value.status === 'published')
    .map(cloneGuide);
}

export function getDiagnosticGuide(slug, locale) {
  const guideValue = (DIAGNOSTIC_GUIDES[locale] ?? DIAGNOSTIC_GUIDES.en)
    .find((value) => value.slug === slug && value.status === 'published');
  return guideValue ? cloneGuide(guideValue) : null;
}
