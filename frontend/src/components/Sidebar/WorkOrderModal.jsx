import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { TagInput } from '../common/TagInput';
import { RegionInput } from '../common/RegionInput';
import { toastError, toastWarning } from '../../utils/feedback';
import { WorkOrderType, UrgencyLevel } from '../../types';

// 设备类型选项
const deviceTypeOptions = [
  '激光切割机', '折弯机', '冲床', '焊接机', '激光焊接',
  '卷板机', '等离子切割', '水刀切割', '剪板机', '其他'
];

// 按设备类型分类的品牌预设
const brandPresets = {
  '激光切割机': ['大族', '通快', '百超', '迅镭', '邦德', '宏山', '奔腾', '华工', '亚威', '嘉泰'],
  '折弯机': ['通快', '百超', 'Amada', '亚威', '普玛宝', '萨瓦尼尼', '爱克', '华工', '金方圆', '扬力'],
  '冲床': ['通快', '村田', 'Amada', '金方圆', '扬力', '华工', '爱克', '普玛宝', '捷迈', '其他'],
  '焊接机': ['福尼斯', '林肯', '米勒', '松下', '伊萨', '麦格米特', '时代', '瑞凌', '佳士', '其他'],
  '激光焊接': ['大族', '通快', '百超', '华工', '逸激光', '其他'],
  '卷板机': ['华工', '扬力', '黄石', '其他'],
  '等离子切割': ['飞博', '华远', '瑞凌', '时代', '其他'],
  '水刀切割': ['华臻', '其他'],
  '剪板机': ['黄石', '上海冲', '扬力', '其他'],
  '其他': []
};

export function WorkOrderModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState({
    type: '',
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
      toastWarning('请填写必填项');
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit(form);
      // 显示成功提示
      setSubmitted(result);
    } catch (e) {
      toastError('提交失败：' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    // 关闭时重置表单和成功状态
    setForm({
      type: '',
      device_type: [],
      device_brand: [],
      region: [],
      device_model: '',
      description: '',
      contact: '',
      urgency: 'normal',
    });
    setSubmitted(null);
    onClose();
  };

  const typeOptions = [
    { value: WorkOrderType.FAULT, label: '设备故障' },
    { value: WorkOrderType.MAINTENANCE, label: '维护保养' },
    { value: WorkOrderType.PARAMETER, label: '参数调试' },
    { value: WorkOrderType.CONSULT, label: '技术咨询' },
    { value: WorkOrderType.PARTS, label: '配件采购' },
    { value: WorkOrderType.AFTERSALES, label: '售后服务' },
    { value: WorkOrderType.OTHER, label: '其他' },
  ];

  const urgencyOptions = [
    { value: UrgencyLevel.NORMAL, label: '普通' },
    { value: UrgencyLevel.URGENT, label: '紧急' },
    { value: UrgencyLevel.CRITICAL, label: '非常紧急' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={submitted ? '工单已提交' : '提交工单'} size="md">
      {/* 提交成功提示 */}
      {submitted && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">工单提交成功！</p>
            <p className="text-xs text-green-600 dark:text-green-500">
              工单号：{submitted.order_no || submitted.id}
            </p>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] text-center">
            工程师接单后，小智会通知您。
            您也可以在「我的工单」中随时查看进度。
          </p>
          <button
            onClick={handleClose}
            className="w-full py-2.5 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-xl font-medium transition-opacity"
          >
            知道了
          </button>
        </div>
      )}

      {!submitted && (
        <div className="space-y-4">
        {/* 问题类型 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            问题类型 <span className="text-red-500">*</span>
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="">请选择问题类型</option>
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 设备类型 */}
        <TagInput
          label="设备类型"
          options={deviceTypeOptions}
          value={form.device_type}
          onChange={(val) => setForm({ ...form, device_type: val })}
          placeholder="选择或输入设备类型..."
        />

        {/* 设备品牌 */}
        <TagInput
          label="设备品牌"
          options={brandOptions}
          value={form.device_brand}
          onChange={(val) => setForm({ ...form, device_brand: val })}
          placeholder={brandOptions.length > 0 ? "选择或添加品牌..." : "先选择设备类型"}
          disabled={brandOptions.length === 0}
        />

        {/* 所在地区 */}
        <RegionInput
          label="所在地区"
          value={form.region}
          onChange={(val) => setForm({ ...form, region: val })}
          placeholder="输入地区名称搜索..."
        />

        {/* 设备规格型号 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            设备规格型号
          </label>
          <input
            type="text"
            value={form.device_model}
            onChange={(e) => setForm({ ...form, device_model: e.target.value })}
            placeholder="如：C3015 3000W"
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* 问题描述 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            问题描述 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="请详细描述您遇到的问题..."
            rows={4}
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
        </div>

        {/* 联系方式 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            联系方式 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            placeholder="手机号码"
            className="w-full px-3 py-2 border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* 紧急程度 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            紧急程度
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

        {/* 提交按钮 */}
        <button
          data-testid="submit-work-order-button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-text-muted)] text-white rounded-xl font-medium transition-colors"
        >
          {submitting ? '提交中...' : '提交工单'}
        </button>
        </div>
      )}
    </Modal>
  );
}
