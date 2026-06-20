import { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { TagInput } from '../common/TagInput';
import { RegionInput } from '../common/RegionInput';
import { toastError, toastWarning, toastSuccess } from '../../utils/feedback';
import { uploadWorkOrderAttachment } from '../../services/api';
import { WorkOrderType, UrgencyLevel } from '../../types';
import { categoryConfig, categoryConfigCn } from '../../data/workOrderConfig';
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

export function WorkOrderModal({ isOpen, onClose, onSubmit }) {
  const isCn = isCnLocale();
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
      toastWarning(isCn ? '请填写服务类型、问题描述和联系方式' : 'Please fill in all required fields');
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
            toastError(isCn ? `附件 ${file.name} 上传失败：${e.message}` : `Attachment ${file.name} upload failed: ${e.message}`);
          }
        }
        setUploadPhase(null);
        if (uploaded > 0) {
          toastSuccess(isCn ? `服务申请已提交，已上传 ${uploaded} 个附件` : `Service request submitted, ${uploaded} attachment(s) uploaded`);
        }
      }
      setFiles([]);
      setSubmitted(result);
    } catch (e) {
      toastError((isCn ? '提交失败：' : 'Submission failed: ') + e.message);
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
    { value: WorkOrderType.FAULT, label: isCn ? '设备维修' : 'Equipment Repair' },
    { value: WorkOrderType.MAINTENANCE, label: isCn ? '维护保养' : 'Maintenance' },
    { value: WorkOrderType.PARAMETER, label: isCn ? '参数调试' : 'Parameter Tuning' },
    { value: WorkOrderType.CONSULT, label: isCn ? '技术咨询' : 'Technical Consultation' },
    { value: WorkOrderType.PARTS, label: isCn ? '备件采购' : 'Parts Purchase' },
    { value: WorkOrderType.AFTERSALES, label: isCn ? '售后服务' : 'After-sales Service' },
    { value: WorkOrderType.OTHER, label: isCn ? '其他需求' : 'Other' },
  ];

  const urgencyOptions = [
    { value: UrgencyLevel.NORMAL, label: isCn ? '普通' : 'Normal' },
    { value: UrgencyLevel.URGENT, label: isCn ? '紧急' : 'Urgent' },
    { value: UrgencyLevel.CRITICAL, label: isCn ? '停机/高风险' : 'Critical' },
  ];
  const localizedCategoryConfig = isCn ? categoryConfigCn : categoryConfig;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={submitted ? (isCn ? '服务申请已提交' : 'Service Request Submitted') : (isCn ? '提交 SAGEMRO 官方服务申请' : 'Request SAGEMRO Official Service')}
      size="md"
    >
      {/* 提交成功提示 */}
      {submitted && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
              {isCn ? '服务申请提交成功！' : 'Service request submitted successfully!'}
            </p>
            <p className="text-xs text-green-600 dark:text-green-500">
              {isCn ? '服务编号：' : 'Service No.: '}{submitted.order_no || submitted.id}
            </p>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] text-center">
            {isCn
              ? 'SAGEMRO 将审核你的服务需求，确认诊断、报价和现场安全要求后，再安排合适的官方服务人员。你可以在“我的服务”里随时查看进度。'
              : 'SAGEMRO will review the request, confirm details, and arrange the right official engineer or service representative. You can track progress in "My Services" at any time.'}
          </p>
          <button
            onClick={handleClose}
            className="w-full py-2.5 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-xl font-medium transition-opacity"
          >
            {isCn ? '知道了' : 'Got it'}
          </button>
        </div>
      )}

      {!submitted && (
        <div className="space-y-4">
        {/* 服务类型 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {isCn ? '服务类型' : 'Service Type'} <span className="text-red-500">*</span>
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="">{isCn ? '请选择服务类型' : 'Select service type'}</option>
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 设备大类 + 服务类型（级联） */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {isCn ? '设备类别' : 'Equipment Category'}
          </label>
          <select
            value={form.category_l1}
            onChange={(e) => setForm({ ...form, category_l1: e.target.value, category_l2: 'other' })}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {Object.entries(localizedCategoryConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {isCn ? '具体问题' : 'Specific Issue'}
          </label>
          <select
            value={form.category_l2}
            onChange={(e) => setForm({ ...form, category_l2: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {Object.entries(localizedCategoryConfig[form.category_l1]?.l2 || {}).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* 设备类型 */}
        <TagInput
          label={isCn ? '设备类型' : 'Equipment Type'}
          options={deviceTypeOptions}
          value={form.device_type}
          onChange={(val) => setForm({ ...form, device_type: val })}
          placeholder={isCn ? '选择或输入设备类型...' : 'Select or enter equipment type...'}
        />

        {/* 设备品牌 */}
        <TagInput
          label={isCn ? '设备品牌' : 'Equipment Brand'}
          options={brandOptions}
          value={form.device_brand}
          onChange={(val) => setForm({ ...form, device_brand: val })}
          placeholder={brandOptions.length > 0
            ? (isCn ? '选择或补充品牌...' : 'Select or add brand...')
            : (isCn ? '请先选择设备类型' : 'Select equipment type first')}
          disabled={brandOptions.length === 0}
        />

        {/* 所在地区 */}
        <RegionInput
          label={isCn ? '所在地区' : 'Region'}
          value={form.region}
          onChange={(val) => setForm({ ...form, region: val })}
          placeholder={isCn ? '搜索或选择地区...' : 'Search by region name...'}
        />

        {/* 设备规格型号 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {isCn ? '设备型号 / 规格' : 'Equipment Model / Spec'}
          </label>
          <input
            type="text"
            value={form.device_model}
            onChange={(e) => setForm({ ...form, device_model: e.target.value })}
            placeholder="e.g. C3015 3000W"
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* 问题描述 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {isCn ? '问题描述' : 'Fault / Service Description'} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={isCn ? '请描述设备问题、报警代码、服务需求或对生产的影响...' : 'Describe the equipment issue, service need, alarm code, or production impact...'}
            rows={4}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
        </div>

        {/* 联系方式 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {isCn ? '联系方式' : 'Contact Info'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            placeholder={isCn ? '手机号或其他联系方式' : 'Phone number'}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* 紧急程度 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {isCn ? '紧急程度' : 'Urgency'}
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
            {isCn ? '附件（可选）' : 'Attachments (Optional)'}
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
              {files.length > 0
                ? (isCn ? `已选择 ${files.length} 个文件` : `${files.length} file(s) selected`)
                : (isCn ? '补充图片或视频（可选）' : 'Upload images/videos (optional)')}
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
              ? (isCn ? `正在上传附件（${uploadPhase.current}/${uploadPhase.total}）...` : `Uploading attachments (${uploadPhase.current}/${uploadPhase.total})...`)
              : (isCn ? '正在提交...' : 'Submitting...')
            : (isCn ? '提交服务申请' : 'Submit Service Request')}
        </button>
        </div>
      )}
    </Modal>
  );
}
