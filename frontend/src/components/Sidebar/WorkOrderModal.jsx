import { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { TagInput } from '../common/TagInput';
import { RegionInput } from '../common/RegionInput';
import { toastError, toastWarning, toastSuccess } from '../../utils/feedback';
import { searchServiceLocations, uploadWorkOrderAttachment } from '../../services/api';
import { WorkOrderType, UrgencyLevel } from '../../types';
import { categoryConfig } from '../../data/workOrderConfig';
import { LocateFixed, Paperclip, Loader2, Search, X } from 'lucide-react';
import { isCnLocale } from '../../utils/locale';
import { formatGeolocationError, getBrowserLocation } from '../../utils/browserGeolocation';

// 设备类型选项
const DEVICE_TYPE_OPTIONS = {
  en: [
  'Laser Cutter', 'Press Brake', 'Punch Press', 'Welder', 'Laser Welder',
  'Plate Rolling Machine', 'Plasma Cutter', 'Waterjet Cutter', 'Shearing Machine', 'Other'
  ],
  cn: [
    '激光切割机', '折弯机', '数控冲床', '焊机', '激光焊接机',
    '卷板机', '等离子切割机', '水刀切割机', '剪板机', '其他'
  ],
};

const DEVICE_TYPE_PRESET_KEYS = {
  激光切割机: 'Laser Cutter',
  折弯机: 'Press Brake',
  数控冲床: 'Punch Press',
  焊机: 'Welder',
  激光焊接机: 'Laser Welder',
  卷板机: 'Plate Rolling Machine',
  等离子切割机: 'Plasma Cutter',
  水刀切割机: 'Waterjet Cutter',
  剪板机: 'Shearing Machine',
  其他: 'Other',
};

const WORK_ORDER_COPY = {
  en: {
    aiGuidanceTitle: 'Not sure how to describe the issue?',
    aiGuidanceDesc: 'Try the AI chat first — it helps organize the symptoms and context before you submit.',
    fillRequired: 'Please fill in all required fields',
    attachmentFailed: (name, message) => `Attachment ${name} upload failed: ${message}`,
    submittedWithAttachments: (count) => `Service request submitted, ${count} attachment(s) uploaded`,
    submitFailed: (message) => `Submission failed: ${message}`,
    titleSubmitted: 'Service Request Submitted',
    titleDefault: 'Request SAGEMRO Service Support',
    successTitle: 'Service request submitted successfully.',
    serviceNo: (value) => `Service No.: ${value}`,
    successDesc: 'Your request is now in the SAGEMRO queue. We\'ll review it and coordinate the right engineer. Track progress in "My Services" at any time.',
    gotIt: 'Got it',
    serviceType: 'Request Type',
    selectServiceType: 'Select request type',
    equipmentCategory: 'Equipment Category',
    specificIssue: 'Specific Issue',
    equipmentType: 'Equipment Type',
    equipmentTypePlaceholder: 'Select or enter equipment type...',
    equipmentBrand: 'Equipment Brand',
    brandPlaceholder: 'Select or add brand...',
    brandDisabledPlaceholder: 'Select equipment type first',
    region: 'Country / Region',
    regionPlaceholder: 'Search or enter country / region...',
    serviceMode: 'Service Mode',
    serviceModeOptions: {
      remote: 'Remote guidance',
      onsite: 'On-site service',
      hybrid: 'Hybrid: remote first, on-site if needed',
    },
    serviceAddress: 'Customer Site Address',
    serviceAddressPlaceholder: 'Enter the exact service site, gate, building, or workshop address',
    locateSite: 'Confirm site location',
    locatingSite: 'Getting location...',
    locationCaptured: 'Site location captured',
    locationRequired: 'On-site service requires the customer site address and location',
    locationFailed: 'Unable to get location. Please allow browser location access and try again.',
    searchLocation: 'Search address',
    searchingLocation: 'Searching...',
    mapSearchResults: 'Select a map result to confirm the service point',
    noLocationResults: 'No matching locations found',
    equipmentModel: 'Equipment Model / Part No.',
    modelPlaceholder: 'e.g. C3015 3000W, BM111, nozzle 1.5S, press brake tooling size',
    description: 'Request Details',
    descriptionPlaceholder: 'Describe the fault, service need, alarm code, part number, photos/nameplate availability, country, and production impact...',
    contact: 'Contact Method',
    contactPlaceholder: 'Email, WhatsApp, or phone',
    urgency: 'Urgency',
    attachments: 'Attachments (Optional)',
    uploadOptional: 'Upload images/videos (optional)',
    filesSelected: (count) => `${count} file(s) selected`,
    uploading: (current, total) => `Uploading attachments (${current}/${total})...`,
    submitting: 'Submitting...',
    submit: 'Submit Service Request',
    typeOptions: {
      fault: 'Equipment Repair',
      maintenance: 'Maintenance',
      parameter: 'Parameter Tuning',
      consult: 'Technical Consultation',
      parts: 'Spare Parts / Consumables',
      aftersales: 'Retrofit / Peripheral Equipment',
      other: 'Other Request',
    },
    urgencyOptions: {
      normal: 'Normal',
      urgent: 'Urgent',
      critical: 'Critical',
    },
  },
  cn: {
    aiGuidanceTitle: '不确定怎么描述问题？',
    aiGuidanceDesc: '先试试 AI 对话 — AI 帮你整理症状和背景信息，然后回来提交更完整的服务请求。',
    fillRequired: '请填写必填信息',
    attachmentFailed: (name, message) => `附件 ${name} 上传失败：${message}`,
    submittedWithAttachments: (count) => `服务请求已提交，已上传 ${count} 个附件`,
    submitFailed: (message) => `提交失败：${message}`,
    titleSubmitted: '服务请求已提交',
    titleDefault: '请求 SAGEMRO 服务支持',
    successTitle: '服务请求已提交成功。',
    serviceNo: (value) => `服务编号：${value}`,
    successDesc: '你的请求已进入 SAGEMRO 队列。我们会审核内容并协调合适的工程师跟进。随时可以在"我的服务"中查看进度。',
    gotIt: '知道了',
    serviceType: '服务类型',
    selectServiceType: '请选择服务类型',
    equipmentCategory: '设备类别',
    specificIssue: '具体问题',
    equipmentType: '设备类型',
    equipmentTypePlaceholder: '选择或输入设备类型...',
    equipmentBrand: '设备品牌',
    brandPlaceholder: '选择或补充品牌...',
    brandDisabledPlaceholder: '请先选择设备类型',
    region: '所在地区',
    regionPlaceholder: '搜索省市区...',
    serviceMode: '服务方式',
    serviceModeOptions: {
      remote: '远程指导',
      onsite: '上门服务',
      hybrid: '混合服务：先远程，必要时上门',
    },
    serviceAddress: '客户现场地址',
    serviceAddressPlaceholder: '请填写准确的服务地址、厂区入口、楼栋或车间信息',
    locateSite: '确认现场定位',
    locatingSite: '正在获取定位...',
    locationCaptured: '现场定位已获取',
    locationRequired: '现场服务需要提供客户现场地址和定位',
    locationFailed: '无法获取定位，请允许浏览器使用定位后重试。',
    locationHint: '请在设备现场使用手机获取当前位置，用于确认服务点位和工程师到场核验。',
    equipmentModel: '设备型号 / 规格',
    modelPlaceholder: '例如：C3015 3000W、BM111、喷嘴 1.5S',
    description: '故障 / 服务需求描述',
    descriptionPlaceholder: '请说明设备问题、服务需求、报警代码或对生产的影响...',
    contact: '联系方式',
    contactPlaceholder: '手机号 / 电话',
    urgency: '紧急程度',
    attachments: '附件（可选）',
    uploadOptional: '上传图片 / 视频（可选）',
    filesSelected: (count) => `已选择 ${count} 个文件`,
    uploading: (current, total) => `正在上传附件（${current}/${total}）...`,
    submitting: '提交中...',
    submit: '提交服务请求',
    typeOptions: {
      fault: '设备维修',
      maintenance: '维护保养',
      parameter: '参数调试',
      consult: '技术咨询',
      parts: '备件采购',
      aftersales: '服务支持',
      other: '其他',
    },
    urgencyOptions: {
      normal: '普通',
      urgent: '紧急',
      critical: '非常紧急',
    },
  },
};

const CN_CATEGORY_LABELS = {
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

const CN_CATEGORY_L2_LABELS = {
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

// 按设备类型分类的品牌预设
const brandPresets = {
  'Laser Cutter': ['Han\'s Laser', 'TRUMPF', 'Bystronic', 'Xunlei', 'Bond', 'Hongshan', 'Bodor', 'HGTECH', 'Yawei', 'Jiatai'],
  'Press Brake': ['TRUMPF', 'Bystronic', 'Amada', 'Yawei', 'Prima Power', 'Salvagnini', 'Eagle', 'HGTECH', 'Jinfangyuan', 'Yangli'],
  'Punch Press': ['TRUMPF', 'Murata', 'Amada', 'Jinfangyuan', 'Yangli', 'HGTECH', 'Eagle', 'Prima Power', 'JFY', 'Other'],
  'Welder': ['Fronius', 'Lincoln', 'Miller', 'Panasonic', 'ESAB', 'Megmeet', 'TIME', 'Riland', 'JASIC', 'Other'],
  'Laser Welder': ['Han\'s Laser', 'TRUMPF', 'Bystronic', 'HGTECH', 'Yi Laser', 'Other'],
  'Plate Rolling Machine': ['HGTECH', 'Yangli', 'Huangshi', 'Other'],
  'Plasma Cutter': ['Hypertherm', 'Huayuan', 'Riland', 'TIME', 'Other'],
  'Waterjet Cutter': ['Huazhen', 'Other'],
  'Shearing Machine': ['Huangshi', 'Shanghai Punching', 'Yangli', 'Other'],
  'Other': []
};

export function WorkOrderModal({ isOpen, onClose, onSubmit }) {
  const isCn = isCnLocale();
  const allowAddressSearch = !isCn;
  const copy = isCn ? WORK_ORDER_COPY.cn : WORK_ORDER_COPY.en;
  const deviceTypeOptions = isCn ? DEVICE_TYPE_OPTIONS.cn : DEVICE_TYPE_OPTIONS.en;
  const [form, setForm] = useState({
    type: '',
    category_l1: 'other',
    category_l2: 'other',
    device_type: [],
    device_brand: [],
    region: [],
    service_mode: 'remote',
    service_address: '',
    service_latitude: null,
    service_longitude: null,
    service_accuracy_m: null,
    service_coordinate_system: 'wgs84',
    service_location_source: 'customer_browser',
    device_model: '',
    description: '',
    contact: '',
    urgency: 'normal',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // 提交成功后显示的工单信息
  const [brandOptions, setBrandOptions] = useState([]);
  const [files, setFiles] = useState([]); // 待上传附件
  const [uploadPhase, setUploadPhase] = useState(null); // { current, total } | null
  const [locating, setLocating] = useState(false);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationResults, setLocationResults] = useState([]);
  const fileInputRef = useRef(null);

  // 监听设备类型变化，更新品牌预设选项
  useEffect(() => {
    if (form.device_type.length > 0) {
      // 取第一个选中的设备类型获取预设品牌
      const firstType = form.device_type[0];
      const presets = brandPresets[DEVICE_TYPE_PRESET_KEYS[firstType] || firstType] || [];
      setBrandOptions(presets);
    } else {
      setBrandOptions([]);
    }
  }, [form.device_type]);

  const handleSubmit = async () => {
    if (!form.type || !form.description || !form.contact) {
      toastWarning(copy.fillRequired);
      return;
    }

    if (form.service_mode === 'onsite'
      && (!form.service_address.trim() || form.service_latitude === null || form.service_longitude === null)) {
      toastWarning(copy.locationRequired);
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit(form);
      if (result?.id && files.length > 0) {
        // 阶段二：上传附件
        let uploaded = 0;
        for (const file of files) {
          setUploadPhase({ current: uploaded + 1, total: files.length });
          try {
            await uploadWorkOrderAttachment(result.id, file);
            uploaded++;
          } catch (e) {
            toastError(copy.attachmentFailed(file.name, e.message));
          }
        }
        setUploadPhase(null);
        if (uploaded > 0) {
          toastSuccess(copy.submittedWithAttachments(uploaded));
        }
      }
      setFiles([]);
      setSubmitted(result);
    } catch (e) {
      toastError(copy.submitFailed(e.message));
    } finally {
      setSubmitting(false);
      setUploadPhase(null);
    }
  };

  const captureSiteLocation = async () => {
    setLocating(true);
    try {
      const { coords } = await getBrowserLocation();
      setForm((current) => ({
        ...current,
        service_latitude: coords.latitude,
        service_longitude: coords.longitude,
        service_accuracy_m: coords.accuracy,
        service_coordinate_system: 'wgs84',
        service_location_source: 'customer_browser',
      }));
    } catch (error) {
      toastError(formatGeolocationError(error, isCn));
    } finally {
      setLocating(false);
    }
  };

  const searchSiteAddress = async () => {
    const query = form.service_address.trim();
    if (query.length < 2) {
      toastWarning(copy.locationRequired);
      return;
    }
    setLocationSearching(true);
    try {
      const result = await searchServiceLocations(query);
      setLocationResults(result.results || []);
    } catch (e) {
      setLocationResults([]);
      toastError(e.message || copy.locationFailed);
    } finally {
      setLocationSearching(false);
    }
  };

  const selectSiteLocation = (result) => {
    setForm((current) => ({
      ...current,
      service_address: result.address || result.label,
      service_latitude: result.latitude,
      service_longitude: result.longitude,
      service_accuracy_m: null,
      service_coordinate_system: result.coordinate_system,
      service_location_source: result.source,
    }));
    setLocationResults([]);
  };

  const handleClose = () => {
    // 关闭时重置表单和成功状态
    setForm({
      type: '',
      category_l1: 'other',
      category_l2: 'other',
      device_type: [],
      device_brand: [],
      region: [],
      service_mode: 'remote',
      service_address: '',
      service_latitude: null,
      service_longitude: null,
      service_accuracy_m: null,
      service_coordinate_system: 'wgs84',
      service_location_source: 'customer_browser',
      device_model: '',
      description: '',
      contact: '',
      urgency: 'normal',
    });
    setFiles([]);
    setLocationResults([]);
    setUploadPhase(null);
    setSubmitted(null);
    onClose();
  };

  const typeOptions = [
    { value: WorkOrderType.FAULT, label: copy.typeOptions.fault },
    { value: WorkOrderType.MAINTENANCE, label: copy.typeOptions.maintenance },
    { value: WorkOrderType.PARAMETER, label: copy.typeOptions.parameter },
    { value: WorkOrderType.CONSULT, label: copy.typeOptions.consult },
    { value: WorkOrderType.PARTS, label: copy.typeOptions.parts },
    { value: WorkOrderType.AFTERSALES, label: copy.typeOptions.aftersales },
    { value: WorkOrderType.OTHER, label: copy.typeOptions.other },
  ];

  const urgencyOptions = [
    { value: UrgencyLevel.NORMAL, label: copy.urgencyOptions.normal },
    { value: UrgencyLevel.URGENT, label: copy.urgencyOptions.urgent },
    { value: UrgencyLevel.CRITICAL, label: copy.urgencyOptions.critical },
  ];

  const categoryLabel = (key, cfg) => (isCn ? (CN_CATEGORY_LABELS[key] || cfg.label) : cfg.label);
  const categoryL2Label = (key, label) => (isCn ? (CN_CATEGORY_L2_LABELS[key] || label) : label);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={submitted ? copy.titleSubmitted : copy.titleDefault} size="md">
      {/* 提交成功提示 */}
      {submitted && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">{copy.successTitle}</p>
            <p className="text-xs text-green-600 dark:text-green-500">
              {copy.serviceNo(submitted.order_no || submitted.id)}
            </p>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] text-center">
            {copy.successDesc}
          </p>
          <button
            onClick={handleClose}
            className="w-full py-2.5 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-xl font-medium transition-opacity"
          >
            {copy.gotIt}
          </button>
        </div>
      )}

      {!submitted && (
        <div className="space-y-4">
        {/* AI 前置引导 */}
        <div className="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-3.5 text-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-base">💡</span>
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">{copy.aiGuidanceTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">{copy.aiGuidanceDesc}</p>
            </div>
          </div>
        </div>

        {/* 问题类型 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {copy.serviceType} <span className="text-red-500">*</span>
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="">{copy.selectServiceType}</option>
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 设备大类 + 问题类型（级联） */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {copy.equipmentCategory}
          </label>
          <select
            value={form.category_l1}
            onChange={(e) => setForm({ ...form, category_l1: e.target.value, category_l2: 'other' })}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {Object.entries(categoryConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{categoryLabel(key, cfg)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {copy.specificIssue}
          </label>
          <select
            value={form.category_l2}
            onChange={(e) => setForm({ ...form, category_l2: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {Object.entries(categoryConfig[form.category_l1]?.l2 || {}).map(([key, label]) => (
              <option key={key} value={key}>{categoryL2Label(key, label)}</option>
            ))}
          </select>
        </div>

        {/* 设备类型 */}
        <TagInput
          label={copy.equipmentType}
          options={deviceTypeOptions}
          value={form.device_type}
          onChange={(val) => setForm({ ...form, device_type: val })}
          placeholder={copy.equipmentTypePlaceholder}
        />

        {/* 设备品牌 */}
        <TagInput
          label={copy.equipmentBrand}
          options={brandOptions}
          value={form.device_brand}
          onChange={(val) => setForm({ ...form, device_brand: val })}
          placeholder={brandOptions.length > 0 ? copy.brandPlaceholder : copy.brandDisabledPlaceholder}
          disabled={brandOptions.length === 0}
        />

        {/* 所在地区 */}
        <RegionInput
          label={copy.region}
          value={form.region}
          onChange={(val) => setForm({ ...form, region: val })}
          placeholder={copy.regionPlaceholder}
        />

        {/* 设备规格型号 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {copy.serviceMode}
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(copy.serviceModeOptions).map(([value, label]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center rounded-xl border px-3 py-2 text-sm transition-colors ${
                  form.service_mode === value
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'
                }`}
              >
                <input
                  type="radio"
                  name="service_mode"
                  value={value}
                  checked={form.service_mode === value}
                  onChange={(e) => setForm({ ...form, service_mode: e.target.value })}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 space-y-3">
          <label className="block text-sm font-medium text-[var(--color-text-primary)]">
            {copy.serviceAddress} {form.service_mode === 'onsite' && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={form.service_address}
            onChange={(e) => {
              setForm({
                ...form,
                service_address: e.target.value,
                service_latitude: null,
                service_longitude: null,
                service_accuracy_m: null,
                service_coordinate_system: 'wgs84',
                service_location_source: 'customer_browser',
              });
              setLocationResults([]);
            }}
            placeholder={copy.serviceAddressPlaceholder}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          {isCn && (
            <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">{copy.locationHint}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {allowAddressSearch && (
              <button
                type="button"
                onClick={searchSiteAddress}
                disabled={locationSearching}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
              >
                {locationSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {locationSearching ? copy.searchingLocation : copy.searchLocation}
              </button>
            )}
            <button
              type="button"
              onClick={captureSiteLocation}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
            >
              {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
              {locating ? copy.locatingSite : copy.locateSite}
            </button>
          </div>
          {allowAddressSearch && locationResults.length > 0 && (
            <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-2">
              <p className="text-xs text-[var(--color-text-muted)]">{copy.mapSearchResults}</p>
              {locationResults.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  onClick={() => selectSiteLocation(result)}
                  className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-primary)]/10"
                >
                  {result.label}
                </button>
              ))}
            </div>
          )}
          {form.service_latitude !== null && form.service_longitude !== null && (
            <p className="text-xs text-green-600">{copy.locationCaptured} · ±{Math.round(form.service_accuracy_m || 0)} m</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {copy.equipmentModel}
          </label>
          <input
            type="text"
            value={form.device_model}
            onChange={(e) => setForm({ ...form, device_model: e.target.value })}
            placeholder={copy.modelPlaceholder}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* 问题描述 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {copy.description} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={copy.descriptionPlaceholder}
            rows={4}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
        </div>

        {/* 联系方式 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {copy.contact} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            placeholder={copy.contactPlaceholder}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* 紧急程度 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {copy.urgency}
          </label>
          <div className="flex gap-3">
            {urgencyOptions.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-colors ${
                  form.urgency === opt.value
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] dark:border-[var(--color-border-strong)] text-[var(--color-text-secondary)]'
                }`}
              >
                <input
                  type="radio"
                  name="urgency"
                  value={opt.value}
                  checked={form.urgency === opt.value}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                  className="sr-only"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 附件上传（可选） */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {copy.attachments}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
            onChange={(e) => {
              if (e.target.files.length > 0) {
                setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
                e.target.value = '';
              }
            }}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 border border-dashed border-[var(--color-border)] rounded-xl cursor-pointer hover:border-[var(--color-text-muted)] transition-colors"
          >
            <Paperclip className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-xs text-[var(--color-text-muted)]">
              {files.length > 0 ? copy.filesSelected(files.length) : copy.uploadOptional}
            </span>
          </div>
          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <Paperclip className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-[var(--color-text-muted)] flex-shrink-0">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="p-0.5 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 提交按钮 */}
        <button
          data-testid="submit-work-order-button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-text-muted)] text-white rounded-xl font-medium transition-colors"
        >
          {submitting
            ? uploadPhase
              ? copy.uploading(uploadPhase.current, uploadPhase.total)
              : copy.submitting
            : copy.submit}
        </button>
        </div>
      )}
    </Modal>
  );
}
