import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, LocateFixed, Paperclip, Search, X } from 'lucide-react';
import { TagInput } from '../common/TagInput';
import { RegionInput } from '../common/RegionInput';
import { categoryConfig } from '../../data/workOrderConfig';
import { assistServiceRequestDraft, searchServiceLocations } from '../../services/api';
import { formatGeolocationError, getBrowserLocation } from '../../utils/browserGeolocation';
import { toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';
import {
  clearServiceRequestDraft,
  createEmptyServiceRequestDraft,
  loadServiceRequestDraft,
  mergeServiceRequestEntryPresets,
  normalizeServiceRequestDraft,
  saveServiceRequestDraft,
  toWorkOrderPayload,
  validateServiceRequestStep,
} from './serviceRequestDraft';

const MAX_FILES = 12;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm',
]);

const DEVICE_OPTIONS = {
  cn: ['激光切割机', '折弯机', '数控冲床', '焊机', '激光焊接机', '卷板机', '等离子切割机', '水刀切割机', '剪板机', '自动化产线', '辅助设备', '其他'],
  en: ['Laser cutter', 'Press brake', 'Punch press', 'Welder', 'Laser welder', 'Plate rolling machine', 'Plasma cutter', 'Waterjet cutter', 'Shearing machine', 'Automation line', 'Auxiliary equipment', 'Other'],
};

const BRAND_OPTIONS = [
  "Han's Laser", 'HSG Laser', 'Bodor Laser', 'Hymson', 'TRUMPF', 'Bystronic', 'AMADA', 'Yawei',
  'HGTECH', 'Prima Power', 'Salvagnini', 'Murata', 'Raycus', 'IPG Photonics', 'MAX Photonics',
  'Friendess / BOCHU', 'Beckhoff', 'RayTools', 'Fronius', 'Lincoln Electric', 'Hypertherm',
];

const CN_CATEGORY_LABELS = {
  laser_cutting: '激光切割', bending: '折弯', punching: '冲压 / 压力机', welding: '焊接',
  surface_treatment: '表面处理', auxiliary: '辅助系统', cnc_automation: '数控与自动化',
  inspection: '检测与品控', other: '其他设备',
};

const COPY = {
  cn: {
    title: '提交设备服务请求',
    intro: '按步骤提供设备与现场信息，便于我们准确评估并协调后续服务。',
    step: (value) => `第${value}步，共4步`,
    stepNames: ['服务类型', '设备与问题', '服务安排', '联系与确认'],
    required: '必填', optional: '选填', next: '下一步', back: '上一步', cancel: '返回工作台',
    submit: '提交服务请求', submitting: '正在提交…',
    manualMode: '手动填写', aiMode: 'AI 协助填写',
    aiDisclosure: 'AI 只帮整理信息，不替代工程师诊断或报价。所有内容仍由您核对、修改并确认提交。',
    aiPlaceholder: '用一句话描述设备、品牌型号、报警、故障现象和生产影响…',
    aiOrganize: '整理到表单', aiOrganizing: '正在整理…',
    aiMissing: '还需要补充', aiInferred: 'AI 已填写，请核对',
    aiStale: '表单已被修改，本次 AI 结果未应用。需要时可再次整理。',
    aiError: '暂时无法使用 AI 整理，请稍后重试或继续手动填写。',
    assistFields: {
      service_request_kind: '服务类型', service_kind: '服务类型', device_types: '设备类型', device_brands: '设备品牌',
      device_model: '设备型号', region: '设备地区', alarm_code: '报警代码', description: '问题描述',
      production_impact: '生产影响', service_mode: '服务方式', urgency: '紧急程度',
      'contact.name': '联系人', 'contact.email': '邮箱', 'contact.phone': '电话',
      'contact.whatsapp': 'WhatsApp', 'contact.preference': '首选联系渠道',
    },
    authRequired: '提交前请先登录。登录后请返回此页再次确认提交，当前内容不会丢失。',
    authConfirmed: '登录成功。请再次确认以上信息，然后提交服务请求。',
    serviceTitle: '您需要解决什么问题？',
    serviceHelp: '选择最接近的一项；提交后仍可根据实际情况调整服务范围。',
    services: [
      ['repair', '维修诊断', '故障排查、报警分析、不开机、运动异常、光路或切割质量问题'],
      ['retrofit', '系统升级改造', '旧系统替换、总线或硬件升级、控制与工艺能力改造'],
      ['relocation', '拆机移位安装', '拆机、搬迁、复装、调试与现场恢复支持'],
      ['maintenance', '检测保养', '设备巡检、电路与耗材检查、预防性维护'],
      ['used_equipment', '二手设备评估 / 处置支持', '设备状态评估、配置核对与处置建议，具体能力按项目确认'],
      ['parts', '耗材配件 / 更换调试', '配件与耗材识别、替换、安装和调试支持'],
    ],
    equipmentTitle: '设备和问题信息', equipmentType: '设备类型', equipmentBrand: '设备品牌',
    equipmentModel: '设备型号 / 规格', alarmCode: '报警代码', category: '设备类别', issueCategory: '问题类别',
    description: '问题或服务需求描述', descriptionHint: '请描述现象、发生时间、已做检查，以及设备目前是否还能运行。',
    impact: '对生产的影响', impactHint: '例如：整线停产、间歇故障、质量不稳定或暂不影响生产。',
    typePlaceholder: '选择或输入设备类型…', brandPlaceholder: '选择或输入品牌…',
    modelPlaceholder: '例如：C3015 3000W、TruLaser 3030、BM111', alarmPlaceholder: '例如：E204（没有可留空）',
    arrangementTitle: '服务方式和所在地区', serviceMode: '希望的服务方式',
    serviceModeOptions: { remote: '远程指导', onsite: '上门服务', hybrid: '先远程评估，必要时上门' },
    modeNotes: { remote: '适合先排查报警、参数、软件和操作问题。', onsite: '需要提供准确现场地址和设备旁定位。', hybrid: '先确认问题范围，再根据地区与资源协调现场支持。' },
    region: '设备所在地区', regionPlaceholder: '搜索省、市或区县…', internationalRegionPlaceholder: '输入国家、州 / 省或城市，按 Enter 添加…',
    urgency: '紧急程度', urgencies: { normal: '一般', urgent: '紧急', critical: '生产中断' },
    address: '设备现场地址', addressPlaceholder: '填写厂区、楼栋、车间或入口信息',
    searchAddress: '搜索地址', searching: '搜索中…', captureLocation: '确认现场定位', locating: '定位中…',
    selectLocation: '选择搜索结果确认服务点位', locationCaptured: '现场定位已获取',
    contactTitle: '联系人、附件和提交确认', name: '联系人姓名', email: '邮箱', phone: '电话 / 手机', whatsapp: 'WhatsApp',
    contactHelp: '邮箱、电话或 WhatsApp 至少填写一项；这些信息仅用于本次服务沟通。',
    preference: '首选联系渠道', preferences: { platform: '站内消息', email: '邮箱', phone: '电话', whatsapp: 'WhatsApp' },
    attachments: '设备资料和现场文件', upload: '选择图片或视频', uploadHint: '最多 12 个；JPG、PNG、GIF、WebP、MP4 或 WebM；单个不超过 50MB。',
    summary: '提交前核对', confirm: '我确认以上信息准确，并同意 SAGEMRO 根据这些信息进行服务评估。',
    pricing: '根据地区、设备和项目单独评估，报价明细确认后再启动。',
    fallback: '暂时无法提交？请发送邮件至 support@sagemro.com。',
    success: '服务请求已提交', successDesc: '请求已进入工作队列，可在“我的服务”中查看后续进展。',
    serviceNo: '服务编号', close: '完成',
    errors: {
      service_kind: '请选择服务类型。', device_types: '请至少填写一种设备类型。', description: '请描述问题或服务需求。',
      region: '请填写设备所在地区。', service_location: '上门服务需要现场地址和有效定位。',
      'contact.name': '请填写联系人姓名。', 'contact.channel': '请至少填写邮箱、电话或 WhatsApp 中的一项。',
      'contact.email': '请填写有效邮箱。', 'contact.phone': '请填写有效电话号码。',
      'contact.whatsapp': '请填写有效 WhatsApp 号码。', 'contact.preference': '请选择首选联系渠道。',
    },
    fileTypeError: '仅支持 JPG、PNG、GIF、WebP、MP4 或 WebM 文件。', fileSizeError: '单个附件不能超过 50MB。',
    fileCountError: '最多可添加 12 个附件。', confirmError: '提交前请确认信息准确。', submitError: '提交失败，请保留当前内容后重试。',
  },
  en: {
    title: 'Request equipment service',
    intro: 'Provide the equipment and site details step by step so we can assess the request and coordinate the next action.',
    step: (value) => `Step ${value} / 4`,
    stepNames: ['Service', 'Equipment & issue', 'Service setup', 'Contact & review'],
    required: 'Required', optional: 'Optional', next: 'Continue', back: 'Back', cancel: 'Back to workspace',
    submit: 'Send service request', submitting: 'Sending…',
    manualMode: 'Fill manually', aiMode: 'AI-assisted',
    aiDisclosure: "AI organizes your information only; it does not replace an engineer's diagnosis or quotation. You still review, edit and confirm everything before submission.",
    aiPlaceholder: 'Describe the equipment, brand/model, alarm, symptoms and production impact…',
    aiOrganize: 'Organize into form', aiOrganizing: 'Organizing…',
    aiMissing: 'Still needed', aiInferred: 'AI-filled — please review',
    aiStale: 'The form changed, so this AI result was not applied. Run it again if needed.',
    aiError: 'AI organization is temporarily unavailable. Try again or continue manually.',
    assistFields: {
      service_request_kind: 'Service type', service_kind: 'Service type', device_types: 'Equipment type', device_brands: 'Equipment brand',
      device_model: 'Model', region: 'Location', alarm_code: 'Alarm code', description: 'Issue description',
      production_impact: 'Production impact', service_mode: 'Service method', urgency: 'Urgency',
      'contact.name': 'Contact name', 'contact.email': 'Email', 'contact.phone': 'Phone',
      'contact.whatsapp': 'WhatsApp', 'contact.preference': 'Preferred contact channel',
    },
    authRequired: 'Sign in before submitting. Return here to review and submit again; your entries will be kept.',
    authConfirmed: 'You are signed in. Review the information and submit the service request again.',
    serviceTitle: 'What do you need help with?',
    serviceHelp: 'Choose the closest option. The scope can still be refined after review.',
    services: [
      ['repair', 'Repair & diagnostics', 'Fault isolation, alarm review, startup, motion, optics or cut-quality issues'],
      ['retrofit', 'System retrofit', 'Legacy controls, bus or hardware upgrades, process and capability improvements'],
      ['relocation', 'Relocation & installation', 'Dismantling, transport coordination, reinstallation and recommissioning'],
      ['maintenance', 'Inspection & maintenance', 'Condition checks, electrical and consumable inspection, preventive maintenance'],
      ['used_equipment', 'Used equipment evaluation / disposition support', 'Condition and configuration review with project-specific disposition support'],
      ['parts', 'Parts, consumables & commissioning', 'Part identification, replacement, installation and commissioning support'],
    ],
    equipmentTitle: 'Equipment and issue details', equipmentType: 'Equipment type', equipmentBrand: 'Equipment brand',
    equipmentModel: 'Model / specification', alarmCode: 'Alarm code', category: 'Equipment category', issueCategory: 'Issue category',
    description: 'Problem or service request', descriptionHint: 'Describe the symptoms, when they started, checks already completed, and whether the machine can still run.',
    impact: 'Production impact', impactHint: 'For example: line stopped, intermittent issue, unstable quality, or no immediate production impact.',
    typePlaceholder: 'Select or enter the equipment type…', brandPlaceholder: 'Select or enter the brand…',
    modelPlaceholder: 'e.g. C3015 3000W, TruLaser 3030, BM111', alarmPlaceholder: 'e.g. E204 (leave blank if none)',
    arrangementTitle: 'Service method and equipment location', serviceMode: 'Preferred service method',
    serviceModeOptions: { remote: 'Remote guidance', onsite: 'On-site service', hybrid: 'Remote assessment first, on-site if needed' },
    modeNotes: { remote: 'Useful for initial alarm, parameter, software and operation checks.', onsite: 'Requires the precise site address and a location captured beside the equipment.', hybrid: 'Define the scope remotely, then coordinate on-site support by country and available resources.' },
    region: 'Equipment location', regionPlaceholder: 'Search province, city or district…', internationalRegionPlaceholder: 'Enter country, state / province or city, then press Enter…',
    urgency: 'Urgency', urgencies: { normal: 'Standard', urgent: 'Urgent', critical: 'Production stopped' },
    address: 'Equipment site address', addressPlaceholder: 'Plant, building, workshop or gate details',
    searchAddress: 'Search address', searching: 'Searching…', captureLocation: 'Capture site location', locating: 'Locating…',
    selectLocation: 'Select a result to confirm the service point', locationCaptured: 'Site location captured',
    contactTitle: 'Contact, files and confirmation', name: 'Contact name', email: 'Email', phone: 'Phone / mobile', whatsapp: 'WhatsApp',
    contactHelp: 'Provide at least one of email, phone or WhatsApp. We use it only to coordinate this service request.',
    preference: 'Preferred contact channel', preferences: { platform: 'Platform message', email: 'Email', phone: 'Phone', whatsapp: 'WhatsApp' },
    attachments: 'Equipment and site files', upload: 'Choose images or videos', uploadHint: 'Up to 12 files; JPG, PNG, GIF, WebP, MP4 or WebM; 50MB maximum per file.',
    summary: 'Review before sending', confirm: 'I confirm this information is accurate and agree that SAGEMRO may use it to assess this service request.',
    pricing: 'Scope and pricing are assessed for the region, equipment and project. Work starts after you confirm the itemized quotation.',
    fallback: 'Unable to submit? Email support@sagemro.com.',
    success: 'Service request sent', successDesc: 'Your request is in the work queue. Track the next steps in My Services.',
    serviceNo: 'Service No.', close: 'Done',
    errors: {
      service_kind: 'Choose a service type.', device_types: 'Add at least one equipment type.', description: 'Describe the problem or service need.',
      region: 'Add the equipment location.', service_location: 'On-site service requires a site address and valid location.',
      'contact.name': 'Enter the contact name.', 'contact.channel': 'Provide an email, phone number or WhatsApp number.',
      'contact.email': 'Enter a valid email address.', 'contact.phone': 'Enter a valid phone number.',
      'contact.whatsapp': 'Enter a valid WhatsApp number.', 'contact.preference': 'Choose the preferred contact channel.',
    },
    fileTypeError: 'Use JPG, PNG, GIF, WebP, MP4 or WebM files.', fileSizeError: 'Each attachment must be 50MB or smaller.',
    fileCountError: 'You can add up to 12 attachments.', confirmError: 'Confirm the information before sending.', submitError: 'The request could not be sent. Your entries are still here; please try again.',
  },
};

function FieldError({ children }) {
  if (!children) return null;
  return <p data-field-error tabIndex={-1} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{children}</p>;
}

function fieldClass(hasError) {
  return `min-h-11 w-full rounded-xl border bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:ring-2 focus:ring-[var(--color-primary)] ${hasError ? 'border-red-500' : 'border-[var(--color-border)] dark:border-[var(--color-border-strong)]'}`;
}

export function ServiceRequestFlow({
  onSubmit,
  onCancel,
  onSuccess,
  initialDraft,
  market,
  mode = 'manual',
  conversationId,
  compact = false,
  isAuthenticated = false,
  onRequireAuth,
}) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const resolvedMarket = market || (isCn ? 'cn' : 'com');
  const storage = typeof window === 'undefined' ? null : window.localStorage;
  const [draft, setDraft] = useState(() => mergeServiceRequestEntryPresets(
    storage ? loadServiceRequestDraft(storage, resolvedMarket) : createEmptyServiceRequestDraft({ mode }),
    { mode, presets: initialDraft },
  ));
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [fileError, setFileError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [authConfirmationRequired, setAuthConfirmationRequired] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationResults, setLocationResults] = useState([]);
  const [assistMessage, setAssistMessage] = useState('');
  const [assistPending, setAssistPending] = useState(false);
  const [assistStatus, setAssistStatus] = useState('');
  const [assistMissingFields, setAssistMissingFields] = useState([]);
  const [inferredFields, setInferredFields] = useState([]);
  const fileInputRef = useRef(null);
  const submitLockRef = useRef(false);
  const assistLockRef = useRef(false);
  const assistRequestRef = useRef(0);
  const draftRevisionRef = useRef(0);
  const currentStep = draft.step;

  useEffect(() => {
    if (storage && !submitted) saveServiceRequestDraft(storage, resolvedMarket, draft);
  }, [draft, resolvedMarket, storage, submitted]);

  useEffect(() => {
    draftRevisionRef.current += 1;
  }, [draft]);

  const clearInferredField = (field) => {
    setInferredFields((current) => current.filter((value) => value !== field && !value.startsWith(`${field}.`)));
  };

  const setField = (field, value) => {
    clearInferredField(field);
    setDraft((current) => normalizeServiceRequestDraft({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const setContact = (field, value) => {
    clearInferredField(`contact.${field}`);
    setDraft((current) => normalizeServiceRequestDraft({
      ...current,
      contact: { ...current.contact, [field]: value },
    }));
    setErrors((current) => ({
      ...current,
      [`contact.${field}`]: undefined,
      'contact.channel': undefined,
    }));
  };

  const setLocation = (updates) => {
    clearInferredField('service_location');
    setDraft((current) => normalizeServiceRequestDraft({
      ...current,
      service_location: { ...current.service_location, ...updates },
    }));
    setErrors((current) => ({ ...current, service_location: undefined }));
  };

  const focusFirstError = () => {
    window.requestAnimationFrame(() => {
      const element = document.querySelector('[data-field-error]');
      element?.focus();
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleNext = () => {
    const validation = validateServiceRequestStep(draft, currentStep);
    if (!validation.valid) {
      setErrors(validation.errors);
      focusFirstError();
      return;
    }
    setErrors({});
    setDraft((current) => ({ ...current, step: Math.min(4, current.step + 1) }));
  };

  const handleBack = () => {
    setErrors({});
    setDraft((current) => ({ ...current, step: Math.max(1, current.step - 1) }));
  };

  const captureSiteLocation = async () => {
    setLocating(true);
    try {
      const { coords } = await getBrowserLocation();
      setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: coords.accuracy,
        coordinate_system: 'wgs84',
        source: 'customer_browser',
      });
    } catch (error) {
      toastError(formatGeolocationError(error, isCn));
    } finally {
      setLocating(false);
    }
  };

  const searchSiteAddress = async () => {
    const query = draft.service_location.address.trim();
    if (query.length < 2) {
      setErrors((current) => ({ ...current, service_location: copy.errors.service_location }));
      return;
    }
    setLocationSearching(true);
    try {
      const result = await searchServiceLocations(query);
      setLocationResults(result.results || []);
    } catch (error) {
      setLocationResults([]);
      toastError(error.message || copy.errors.service_location);
    } finally {
      setLocationSearching(false);
    }
  };

  const selectSiteLocation = (result) => {
    setLocation({
      address: result.address || result.label,
      latitude: result.latitude,
      longitude: result.longitude,
      accuracy_m: null,
      coordinate_system: result.coordinate_system,
      source: result.source,
    });
    setLocationResults([]);
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (files.length + incoming.length > MAX_FILES) {
      setFileError(copy.fileCountError);
      return;
    }
    const unsupported = incoming.find((file) => !ACCEPTED_FILE_TYPES.has(file.type));
    if (unsupported) {
      setFileError(copy.fileTypeError);
      return;
    }
    const oversized = incoming.find((file) => file.size <= 0 || file.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileError(copy.fileSizeError);
      return;
    }
    setFileError('');
    setFiles((current) => [...current, ...incoming]);
  };

  const setEntryMode = (nextMode) => {
    setAssistStatus('');
    setDraft((current) => normalizeServiceRequestDraft({ ...current, mode: nextMode }));
  };

  const handleAssist = async () => {
    const message = assistMessage.trim();
    if (!message || assistLockRef.current) return;
    assistLockRef.current = true;
    const requestId = assistRequestRef.current + 1;
    assistRequestRef.current = requestId;
    const startingRevision = draftRevisionRef.current;
    setAssistPending(true);
    setAssistStatus('');
    try {
      const result = await assistServiceRequestDraft({ message, draft });
      if (requestId !== assistRequestRef.current || startingRevision !== draftRevisionRef.current) {
        setAssistStatus(copy.aiStale);
        return;
      }
      const patch = result?.patch && typeof result.patch === 'object' ? result.patch : {};
      const contactPatch = patch.contact && typeof patch.contact === 'object' ? patch.contact : {};
      const appliedFields = [
        ...Object.keys(patch).filter((field) => field !== 'contact'),
        ...Object.keys(contactPatch).map((field) => `contact.${field}`),
      ];
      setDraft((current) => normalizeServiceRequestDraft({
        ...current,
        ...patch,
        mode: 'ai',
        step: current.step,
        contact: { ...current.contact, ...patch.contact },
      }));
      setInferredFields(appliedFields);
      setAssistMissingFields(Array.isArray(result?.missing_fields) ? result.missing_fields : []);
      setAssistStatus('applied');
    } catch {
      setAssistStatus(copy.aiError);
    } finally {
      assistLockRef.current = false;
      setAssistPending(false);
    }
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      const validation = validateServiceRequestStep(draft, 4);
      if (!validation.valid) {
        setErrors(validation.errors);
        focusFirstError();
        return;
      }
      if (!confirmed) {
        setErrors((current) => ({ ...current, confirmation: copy.confirmError }));
        focusFirstError();
        return;
      }
      if (!isAuthenticated) {
        if (storage) saveServiceRequestDraft(storage, resolvedMarket, { ...draft, step: 4 });
        setAuthConfirmationRequired(true);
        setErrors({ submit: copy.authRequired });
        onRequireAuth?.();
        return;
      }
      if (authConfirmationRequired) setAuthConfirmationRequired(false);
      setSubmitting(true);
      setErrors({});
      const payload = toWorkOrderPayload(draft, conversationId);
      const result = await onSubmit(payload, files);
      if (storage) clearServiceRequestDraft(storage, resolvedMarket);
      setFiles([]);
      setSubmitted(result || { success: true });
      onSuccess?.(result);
    } catch (error) {
      toastError(error.message || copy.submitError);
      setErrors({ submit: error.message || copy.submitError });
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950/30" role="status" aria-live="polite">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold text-[var(--color-text-primary)]">{copy.success}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{copy.successDesc}</p>
        {(submitted.order_no || submitted.id) && (
          <p className="mt-3 font-mono text-sm text-[var(--color-text-primary)]">{copy.serviceNo}: {submitted.order_no || submitted.id}</p>
        )}
        {onCancel && <button type="button" onClick={onCancel} className="mt-5 min-h-11 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 font-medium text-white hover:opacity-90">{copy.close}</button>}
      </section>
    );
  }

  const errorText = (key) => errors[key] && (copy.errors[key] || errors[key]);
  const categoryOptions = Object.entries(categoryConfig);
  const issueOptions = Object.entries(categoryConfig[draft.category_l1]?.l2 || {});

  return (
    <section className={`mx-auto w-full ${compact ? '' : 'max-w-3xl'} text-[var(--color-text-primary)]`}>
      <header className="border-b border-[var(--color-border)] pb-5">
        <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          <span>{copy.step(currentStep)}</span>
          <span>{copy.stepNames[currentStep - 1]}</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2" aria-label={copy.step(currentStep)}>
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className={`h-1.5 rounded-full ${step <= currentStep ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />
          ))}
        </div>
        {!compact && <><h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">{copy.intro}</p></>}
      </header>

      <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-surface)] p-1" role="group" aria-label={copy.aiMode}>
          {[['manual', copy.manualMode], ['ai', copy.aiMode]].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setEntryMode(value)} className={`min-h-11 rounded-lg px-3 text-sm font-medium ${draft.mode === value ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]'}`}>{label}</button>
          ))}
        </div>
        {draft.mode === 'ai' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs leading-5 text-[var(--color-text-secondary)]">{copy.aiDisclosure}</p>
            <textarea value={assistMessage} onChange={(event) => setAssistMessage(event.target.value)} maxLength={4000} rows={3} placeholder={copy.aiPlaceholder} className={fieldClass(false)} />
            <button type="button" onClick={handleAssist} disabled={assistPending || !assistMessage.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {assistPending && <Loader2 size={16} className="animate-spin" />}{assistPending ? copy.aiOrganizing : copy.aiOrganize}
            </button>
            {assistStatus && assistStatus !== 'applied' && <p role="status" className="text-xs font-medium text-[var(--color-text-secondary)]">{assistStatus}</p>}
            {inferredFields.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                <p className="font-semibold">{copy.aiInferred}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{inferredFields.map((field) => <span key={field} className="rounded-full bg-white/80 px-2 py-1 dark:bg-black/20">{copy.assistFields[field] || field}</span>)}</div>
              </div>
            )}
            {assistMissingFields.length > 0 && (
              <div className="text-xs text-[var(--color-text-secondary)]"><span className="font-semibold">{copy.aiMissing}: </span>{assistMissingFields.map((field) => copy.assistFields[field]).filter(Boolean).join('、')}</div>
            )}
          </div>
        )}
      </div>

      <div className="py-5 sm:py-6">
        {currentStep === 1 && (
          <div data-step="1">
            <h2 className="text-xl font-semibold">{copy.serviceTitle}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{copy.serviceHelp}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {copy.services.map(([value, label, description], index) => (
                <label key={value} className={`group flex min-h-28 cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${draft.service_kind === value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8' : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/60'}`}>
                  <input type="radio" name="service_kind" value={value} checked={draft.service_kind === value} onChange={(event) => setField('service_kind', event.target.value)} className="sr-only" />
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${draft.service_kind === value ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-hover)] text-[var(--color-text-secondary)]'}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">{description}</span></span>
                </label>
              ))}
            </div>
            <FieldError>{errorText('service_kind')}</FieldError>
          </div>
        )}

        {currentStep === 2 && (
          <div data-step="2" className="space-y-5">
            <h2 className="text-xl font-semibold">{copy.equipmentTitle}</h2>
            <div className="[&_button]:min-h-11 [&_input]:min-h-11">
              <TagInput label={`${copy.equipmentType} · ${copy.required}`} options={DEVICE_OPTIONS[isCn ? 'cn' : 'en']} value={draft.device_types} onChange={(value) => setField('device_types', value)} placeholder={copy.typePlaceholder} />
              <FieldError>{errorText('device_types')}</FieldError>
            </div>
            <div className="[&_button]:min-h-11 [&_input]:min-h-11">
              <TagInput label={`${copy.equipmentBrand} · ${copy.optional}`} options={BRAND_OPTIONS} value={draft.device_brands} onChange={(value) => setField('device_brands', value)} placeholder={copy.brandPlaceholder} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium">{copy.category} · {copy.optional}<select value={draft.category_l1} onChange={(event) => setDraft((current) => normalizeServiceRequestDraft({ ...current, category_l1: event.target.value, category_l2: 'other' }))} className={`mt-2 ${fieldClass(false)}`}>{categoryOptions.map(([value, config]) => <option key={value} value={value}>{isCn ? (CN_CATEGORY_LABELS[value] || config.label) : config.label}</option>)}</select></label>
              <label className="text-xs font-medium">{copy.issueCategory} · {copy.optional}<select value={draft.category_l2} onChange={(event) => setField('category_l2', event.target.value)} className={`mt-2 ${fieldClass(false)}`}>{issueOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-xs font-medium">{copy.equipmentModel} · {copy.optional}<input value={draft.device_model} onChange={(event) => setField('device_model', event.target.value)} placeholder={copy.modelPlaceholder} className={`mt-2 ${fieldClass(false)}`} /></label>
              <label className="text-xs font-medium">{copy.alarmCode} · {copy.optional}<input value={draft.alarm_code} onChange={(event) => setField('alarm_code', event.target.value)} placeholder={copy.alarmPlaceholder} className={`mt-2 ${fieldClass(false)}`} /></label>
            </div>
            <label className="block text-xs font-medium">{copy.description} · {copy.required}<textarea value={draft.description} onChange={(event) => setField('description', event.target.value)} rows={5} placeholder={copy.descriptionHint} className={`mt-2 resize-y ${fieldClass(Boolean(errors.description))}`} /><FieldError>{errorText('description')}</FieldError></label>
            <label className="block text-xs font-medium">{copy.impact} · {copy.optional}<textarea value={draft.production_impact} onChange={(event) => setField('production_impact', event.target.value)} rows={3} placeholder={copy.impactHint} className={`mt-2 resize-y ${fieldClass(false)}`} /></label>
          </div>
        )}

        {currentStep === 3 && (
          <div data-step="3" className="space-y-5">
            <h2 className="text-xl font-semibold">{copy.arrangementTitle}</h2>
            <fieldset><legend className="text-xs font-medium">{copy.serviceMode} · {copy.required}</legend><div className="mt-2 grid gap-3 sm:grid-cols-3">{Object.entries(copy.serviceModeOptions).map(([value, label]) => <label key={value} className={`cursor-pointer rounded-xl border p-3 ${draft.service_mode === value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8' : 'border-[var(--color-border)]'}`}><input type="radio" name="service_mode" value={value} checked={draft.service_mode === value} onChange={(event) => setField('service_mode', event.target.value)} className="sr-only" /><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">{copy.modeNotes[value]}</span></label>)}</div></fieldset>
            <div className="[&_button]:min-h-11 [&_input]:min-h-11">{isCn ? <RegionInput label={`${copy.region} · ${copy.required}`} value={draft.region} onChange={(value) => setField('region', value)} placeholder={copy.regionPlaceholder} /> : <TagInput label={`${copy.region} · ${copy.required}`} options={[]} value={draft.region} onChange={(value) => setField('region', value)} placeholder={copy.internationalRegionPlaceholder} />}<FieldError>{errorText('region')}</FieldError></div>
            <fieldset><legend className="text-xs font-medium">{copy.urgency} · {copy.required}</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(copy.urgencies).map(([value, label]) => <label key={value} className={`flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm ${draft.urgency === value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8 font-medium' : 'border-[var(--color-border)]'}`}><input type="radio" name="urgency" value={value} checked={draft.urgency === value} onChange={(event) => setField('urgency', event.target.value)} className="sr-only" />{label}</label>)}</div></fieldset>
            {draft.service_mode === 'onsite' && <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4"><label className="block text-xs font-medium">{copy.address} · {copy.required}<input value={draft.service_location.address} onChange={(event) => { setLocation({ address: event.target.value, latitude: null, longitude: null, accuracy_m: null, coordinate_system: 'wgs84', source: 'customer_browser' }); setLocationResults([]); }} placeholder={copy.addressPlaceholder} className={`mt-2 ${fieldClass(Boolean(errors.service_location))}`} /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={searchSiteAddress} disabled={locationSearching} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm disabled:opacity-50">{locationSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}{locationSearching ? copy.searching : copy.searchAddress}</button><button type="button" onClick={captureSiteLocation} disabled={locating} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm disabled:opacity-50">{locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}{locating ? copy.locating : copy.captureLocation}</button></div>{locationResults.length > 0 && <div className="mt-3 space-y-1 rounded-xl border border-[var(--color-border)] p-2"><p className="px-2 py-1 text-xs text-[var(--color-text-muted)]">{copy.selectLocation}</p>{locationResults.map((result) => <button type="button" key={result.id} onClick={() => selectSiteLocation(result)} className="block min-h-11 w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--color-primary)]/10">{result.label}</button>)}</div>}{draft.service_location.latitude !== null && draft.service_location.longitude !== null && <p className="mt-3 text-xs font-medium text-green-600">{copy.locationCaptured}{draft.service_location.accuracy_m !== null ? ` · ±${Math.round(draft.service_location.accuracy_m)} m` : ''}</p>}<FieldError>{errorText('service_location')}</FieldError></div>}
          </div>
        )}

        {currentStep === 4 && (
          <div data-step="4" className="space-y-5">
            <h2 className="text-xl font-semibold">{copy.contactTitle}</h2>
            <div><label className="block text-xs font-medium">{copy.name} · {copy.required}<input value={draft.contact.name} onChange={(event) => setContact('name', event.target.value)} className={`mt-2 ${fieldClass(Boolean(errors['contact.name']))}`} /></label><FieldError>{errorText('contact.name')}</FieldError></div>
            <p className="text-xs leading-5 text-[var(--color-text-secondary)]">{copy.contactHelp}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="block text-xs font-medium">{copy.email} · {copy.optional}<input type="email" autoComplete="email" value={draft.contact.email} onChange={(event) => setContact('email', event.target.value)} className={`mt-2 ${fieldClass(Boolean(errors['contact.email']))}`} /></label><FieldError>{errorText('contact.email')}</FieldError></div>
              <div><label className="block text-xs font-medium">{copy.phone} · {copy.optional}<input type="tel" autoComplete="tel" value={draft.contact.phone} onChange={(event) => setContact('phone', event.target.value)} className={`mt-2 ${fieldClass(Boolean(errors['contact.phone']))}`} /></label><FieldError>{errorText('contact.phone')}</FieldError></div>
              <div><label className="block text-xs font-medium">{copy.whatsapp} · {copy.optional}<input type="tel" value={draft.contact.whatsapp} onChange={(event) => setContact('whatsapp', event.target.value)} className={`mt-2 ${fieldClass(Boolean(errors['contact.whatsapp']))}`} /></label><FieldError>{errorText('contact.whatsapp')}</FieldError></div>
            </div>
            <FieldError>{errorText('contact.channel')}</FieldError>
            <label className="block text-xs font-medium">{copy.preference} · {copy.required}<select value={draft.contact.preference} onChange={(event) => setContact('preference', event.target.value)} className={`mt-2 ${fieldClass(Boolean(errors['contact.preference']))}`}>{Object.entries(copy.preferences).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div><p className="text-xs font-medium">{copy.attachments} · {copy.optional}</p><input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] px-4 text-sm hover:border-[var(--color-primary)]"><Paperclip size={16} />{copy.upload}</button><p className="mt-1.5 text-xs leading-5 text-[var(--color-text-muted)]">{copy.uploadHint}</p><FieldError>{fileError}</FieldError>{files.length > 0 && <ul className="mt-3 space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-surface-elevated)] px-3 text-xs"><Paperclip size={14} className="shrink-0" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="shrink-0 text-[var(--color-text-muted)]">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`${copy.back}: ${file.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--color-hover)]"><X size={15} /></button></li>)}</ul>}</div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4"><h3 className="text-sm font-semibold">{copy.summary}</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--color-text-muted)]">{copy.serviceTitle}</dt><dd className="mt-1 font-medium">{copy.services.find(([value]) => value === draft.service_kind)?.[1]}</dd></div><div><dt className="text-xs text-[var(--color-text-muted)]">{copy.equipmentType}</dt><dd className="mt-1 font-medium">{draft.device_types.join(', ')}</dd></div><div><dt className="text-xs text-[var(--color-text-muted)]">{copy.region}</dt><dd className="mt-1 font-medium">{draft.region.join(', ')}</dd></div><div><dt className="text-xs text-[var(--color-text-muted)]">{copy.serviceMode}</dt><dd className="mt-1 font-medium">{copy.serviceModeOptions[draft.service_mode]}</dd></div></dl><p className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs leading-5 text-[var(--color-text-secondary)]">{copy.pricing}</p></div>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-6 ${errors.confirmation ? 'border-red-500' : 'border-[var(--color-border)]'}`}><input type="checkbox" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); setErrors((current) => ({ ...current, confirmation: undefined })); }} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]" /><span>{copy.confirm}</span></label><FieldError>{errors.confirmation}</FieldError>
            <p className="text-center text-xs text-[var(--color-text-muted)]">{copy.fallback}</p>
            {authConfirmationRequired && isAuthenticated && <p role="status" className="rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">{copy.authConfirmed}</p>}
            <FieldError>{errors.submit}</FieldError>
          </div>
        )}
      </div>

      <footer className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">{currentStep > 1 ? <button type="button" onClick={handleBack} disabled={submitting} className="min-h-11 rounded-xl border border-[var(--color-border)] px-5 text-sm font-medium disabled:opacity-50">{copy.back}</button> : onCancel ? <button type="button" onClick={onCancel} disabled={submitting} className="min-h-11 rounded-xl border border-[var(--color-border)] px-5 text-sm font-medium disabled:opacity-50">{copy.cancel}</button> : null}</div>
        {currentStep < 4 ? <button type="button" onClick={handleNext} className="min-h-11 rounded-xl bg-[var(--color-primary)] px-6 text-sm font-semibold text-white hover:opacity-90">{copy.next}</button> : <button type="button" onClick={handleSubmit} disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{submitting && <Loader2 size={16} className="animate-spin" />}{submitting ? copy.submitting : copy.submit}</button>}
      </footer>
    </section>
  );
}
