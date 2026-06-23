import { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { TagInput } from '../common/TagInput';
import { RegionInput } from '../common/RegionInput';
import { toastError, toastWarning, toastSuccess } from '../../utils/feedback';
import { uploadWorkOrderAttachment } from '../../services/api';
import { WorkOrderType, UrgencyLevel } from '../../types';
import { categoryConfig } from '../../data/workOrderConfig';
import { Paperclip, Loader2, X } from 'lucide-react';
import { isCnLocale } from '../../utils/locale';

// 设备类型选项
const deviceTypeOptions = [
  'Laser Cutter', 'Press Brake', 'Punch Press', 'Welder', 'Laser Welder',
  'Plate Rolling Machine', 'Plasma Cutter', 'Waterjet Cutter', 'Shearing Machine', 'Other'
];

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

const COPY = {
  cn: {
    titleSubmit: '提交 SAGEMRO 官方服务请求',
    titleSubmitted: '服务请求已提交',
    requiredWarning: '请填写所有必填项',
    attachmentFailed: '附件上传失败',
    submittedWithAttachments: (count) => `服务请求已提交，已上传 ${count} 个附件`,
    submitFailed: '提交失败',
    successTitle: '服务请求提交成功！',
    serviceNo: '服务编号',
    successDesc: 'SAGEMRO 会审核请求、确认细节，并安排合适的官方工程师或服务代表。你可以随时在“我的服务”中查看进度。',
    gotIt: '知道了',
    serviceType: '服务类型',
    serviceTypePlaceholder: '选择服务类型',
    equipmentCategory: '设备类别',
    specificIssue: '具体问题',
    equipmentType: '设备类型',
    equipmentTypePlaceholder: '选择或输入设备类型...',
    equipmentBrand: '设备品牌',
    brandPlaceholder: '选择或添加品牌...',
    brandDisabledPlaceholder: '请先选择设备类型',
    region: '所在地区',
    regionPlaceholder: '按地区名称搜索...',
    equipmentModel: '设备型号 / 规格',
    equipmentModelPlaceholder: '例如：C3015 3000W',
    description: '故障 / 服务描述',
    descriptionPlaceholder: '请描述设备问题、服务需求、报警代码或对生产的影响...',
    contact: '联系方式',
    contactPlaceholder: '手机号',
    urgency: '紧急程度',
    attachments: '附件（可选）',
    filesSelected: (count) => `已选择 ${count} 个文件`,
    uploadOptional: '上传图片 / 视频（可选）',
    uploadingAttachments: (current, total) => `正在上传附件（${current}/${total}）...`,
    submitting: '正在提交...',
    submit: '提交服务请求',
    typeOptions: {
      [WorkOrderType.FAULT]: '设备维修',
      [WorkOrderType.MAINTENANCE]: '维护保养',
      [WorkOrderType.PARAMETER]: '参数调试',
      [WorkOrderType.CONSULT]: '技术咨询',
      [WorkOrderType.PARTS]: '备件采购',
      [WorkOrderType.AFTERSALES]: '售后服务',
      [WorkOrderType.OTHER]: '其他',
    },
    urgencyOptions: {
      [UrgencyLevel.NORMAL]: '普通',
      [UrgencyLevel.URGENT]: '紧急',
      [UrgencyLevel.CRITICAL]: '非常紧急',
    },
    deviceTypes: {
      'Laser Cutter': '激光切割机',
      'Press Brake': '折弯机',
      'Punch Press': '冲床',
      'Welder': '焊机',
      'Laser Welder': '激光焊机',
      'Plate Rolling Machine': '卷板机',
      'Plasma Cutter': '等离子切割机',
      'Waterjet Cutter': '水刀切割机',
      'Shearing Machine': '剪板机',
      'Other': '其他',
    },
    categoryLabels: {
      laser_cutting: '激光切割',
      bending: '折弯',
      punching: '冲压 / 冲床',
      welding: '焊接',
      surface_treatment: '表面处理',
      auxiliary: '辅助系统',
      cnc_automation: '数控与自动化',
      inspection: '检测与质检',
      other: '其他设备',
    },
    categoryL2Labels: {
      mechanical_fault: '机械故障',
      electrical_fault: '电气故障',
      optical_fault: '光路 / 光束故障',
      hydraulic_fault: '液压系统故障',
      arc_fault: '电弧 / 焊接质量问题',
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
      media_fault: '磨料 / 介质故障',
      dust_collection: '除尘 / 环保系统故障',
      calibration: '精度校准',
      software_fault: '软件 / 系统故障',
      general_fault: '一般故障',
      maintenance: '维护保养',
      parameter_debug: '参数调试',
      installation: '安装调试',
      consultation: '技术咨询',
      parts_replacement: '备件更换',
      other: '其他',
    },
  },
  en: {
    titleSubmit: 'Request SAGEMRO Official Service',
    titleSubmitted: 'Service Request Submitted',
    requiredWarning: 'Please fill in all required fields',
    attachmentFailed: 'Attachment upload failed',
    submittedWithAttachments: (count) => `Service request submitted, ${count} attachment(s) uploaded`,
    submitFailed: 'Submission failed',
    successTitle: 'Service request submitted successfully!',
    serviceNo: 'Service No.',
    successDesc: 'SAGEMRO will review the request, confirm details, and arrange the right official engineer or service representative. You can track progress in "My Services" at any time.',
    gotIt: 'Got it',
    serviceType: 'Service Type',
    serviceTypePlaceholder: 'Select service type',
    equipmentCategory: 'Equipment Category',
    specificIssue: 'Specific Issue',
    equipmentType: 'Equipment Type',
    equipmentTypePlaceholder: 'Select or enter equipment type...',
    equipmentBrand: 'Equipment Brand',
    brandPlaceholder: 'Select or add brand...',
    brandDisabledPlaceholder: 'Select equipment type first',
    region: 'Region',
    regionPlaceholder: 'Search by region name...',
    equipmentModel: 'Equipment Model / Spec',
    equipmentModelPlaceholder: 'e.g. C3015 3000W',
    description: 'Fault / Service Description',
    descriptionPlaceholder: 'Describe the equipment issue, service need, alarm code, or production impact...',
    contact: 'Contact Info',
    contactPlaceholder: 'Phone number',
    urgency: 'Urgency',
    attachments: 'Attachments (Optional)',
    filesSelected: (count) => `${count} file(s) selected`,
    uploadOptional: 'Upload images/videos (optional)',
    uploadingAttachments: (current, total) => `Uploading attachments (${current}/${total})...`,
    submitting: 'Submitting...',
    submit: 'Submit Service Request',
    typeOptions: {
      [WorkOrderType.FAULT]: 'Equipment Repair',
      [WorkOrderType.MAINTENANCE]: 'Maintenance',
      [WorkOrderType.PARAMETER]: 'Parameter Tuning',
      [WorkOrderType.CONSULT]: 'Technical Consultation',
      [WorkOrderType.PARTS]: 'Parts Purchase',
      [WorkOrderType.AFTERSALES]: 'After-sales Service',
      [WorkOrderType.OTHER]: 'Other',
    },
    urgencyOptions: {
      [UrgencyLevel.NORMAL]: 'Normal',
      [UrgencyLevel.URGENT]: 'Urgent',
      [UrgencyLevel.CRITICAL]: 'Critical',
    },
    deviceTypes: {},
    categoryLabels: {},
    categoryL2Labels: {},
  },
};

export function WorkOrderModal({ isOpen, onClose, onSubmit }) {
  const copy = isCnLocale() ? COPY.cn : COPY.en;
  const [form, setForm] = useState({
    type: '',
    category_l1: 'other',
    category_l2: 'other',
    device_type: [],
    device_brand: [],
    region: [],
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
  const fileInputRef = useRef(null);

  // 监听设备类型变化，更新品牌预设选项
  useEffect(() => {
    if (form.device_type.length > 0) {
      // 取第一个选中的设备类型获取预设品牌
      const firstType = form.device_type[0];
      const presets = brandPresets[firstType] || [];
      setBrandOptions(presets);
    } else {
      setBrandOptions([]);
    }
  }, [form.device_type]);

  const handleSubmit = async () => {
    if (!form.type || !form.description || !form.contact) {
      toastWarning(copy.requiredWarning);
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
            toastError(`${file.name} ${copy.attachmentFailed}: ${e.message}`);
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
      toastError(`${copy.submitFailed}: ${e.message}`);
    } finally {
      setSubmitting(false);
      setUploadPhase(null);
    }
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
      device_model: '',
      description: '',
      contact: '',
      urgency: 'normal',
    });
    setFiles([]);
    setUploadPhase(null);
    setSubmitted(null);
    onClose();
  };

  const typeOptions = [
    { value: WorkOrderType.FAULT, label: copy.typeOptions[WorkOrderType.FAULT] },
    { value: WorkOrderType.MAINTENANCE, label: copy.typeOptions[WorkOrderType.MAINTENANCE] },
    { value: WorkOrderType.PARAMETER, label: copy.typeOptions[WorkOrderType.PARAMETER] },
    { value: WorkOrderType.CONSULT, label: copy.typeOptions[WorkOrderType.CONSULT] },
    { value: WorkOrderType.PARTS, label: copy.typeOptions[WorkOrderType.PARTS] },
    { value: WorkOrderType.AFTERSALES, label: copy.typeOptions[WorkOrderType.AFTERSALES] },
    { value: WorkOrderType.OTHER, label: copy.typeOptions[WorkOrderType.OTHER] },
  ];

  const urgencyOptions = [
    { value: UrgencyLevel.NORMAL, label: copy.urgencyOptions[UrgencyLevel.NORMAL] },
    { value: UrgencyLevel.URGENT, label: copy.urgencyOptions[UrgencyLevel.URGENT] },
    { value: UrgencyLevel.CRITICAL, label: copy.urgencyOptions[UrgencyLevel.CRITICAL] },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={submitted ? copy.titleSubmitted : copy.titleSubmit} size="md">
      {/* 提交成功提示 */}
      {submitted && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">{copy.successTitle}</p>
            <p className="text-xs text-green-600 dark:text-green-500">
              {copy.serviceNo}: {submitted.order_no || submitted.id}
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
            <option value="">{copy.serviceTypePlaceholder}</option>
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
              <option key={key} value={key}>{copy.categoryLabels[key] || cfg.label}</option>
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
              <option key={key} value={key}>{copy.categoryL2Labels[key] || label}</option>
            ))}
          </select>
        </div>

        {/* 设备类型 */}
        <TagInput
          label={copy.equipmentType}
          options={deviceTypeOptions}
          optionLabels={copy.deviceTypes}
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
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {copy.equipmentModel}
          </label>
          <input
            type="text"
            value={form.device_model}
            onChange={(e) => setForm({ ...form, device_model: e.target.value })}
            placeholder={copy.equipmentModelPlaceholder}
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
              ? copy.uploadingAttachments(uploadPhase.current, uploadPhase.total)
              : copy.submitting
            : copy.submit}
        </button>
        </div>
      )}
    </Modal>
  );
}
