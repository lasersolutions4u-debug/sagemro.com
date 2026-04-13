import { useState } from 'react';
import { Modal } from '../common/Modal';
import { TagInput } from '../common/TagInput';
import { WorkOrderType, UrgencyLevel } from '../../types';

// 设备类型选项
const deviceTypeOptions = [
  '激光切割机', '折弯机', '冲床', '焊接机', '激光焊接',
  '卷板机', '等离子切割', '水刀切割', '剪板机', '其他'
];

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

  const handleSubmit = async () => {
    if (!form.type || !form.description || !form.contact) {
      alert('请填写必填项');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(form);
      // 重置表单
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
      onClose();
    } catch (e) {
      alert('提交失败：' + e.message);
    } finally {
      setSubmitting(false);
    }
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
    <Modal isOpen={isOpen} onClose={onClose} title="提交工单" size="lg">
      <div className="space-y-4">
        {/* 问题类型 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            问题类型 <span className="text-red-500">*</span>
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
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
          value={form.device_brand}
          onChange={(val) => setForm({ ...form, device_brand: val })}
          placeholder="输入设备品牌，回车添加..."
        />

        {/* 所在地区 */}
        <TagInput
          label="所在地区"
          value={form.region}
          onChange={(val) => setForm({ ...form, region: val })}
          placeholder="输入所在地区，回车添加..."
        />

        {/* 设备型号 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            设备型号
          </label>
          <input
            type="text"
            value={form.device_model}
            onChange={(e) => setForm({ ...form, device_model: e.target.value })}
            placeholder="如：3000W光纤激光切割机"
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
          />
        </div>

        {/* 问题描述 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            问题描述 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="请详细描述您遇到的问题..."
            rows={4}
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b] resize-none"
          />
        </div>

        {/* 联系方式 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            联系方式 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            placeholder="手机号码"
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
          />
        </div>

        {/* 紧急程度 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">
            紧急程度
          </label>
          <div className="flex gap-3">
            {urgencyOptions.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-colors ${
                  form.urgency === opt.value
                    ? 'border-[#f59e0b] bg-[#f59e0b]/10 text-[#f59e0b]'
                    : 'border-[#e5e4e7] dark:border-[#3a3a4c] text-[#6b6375]'
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

        {/* 费用提示 */}
        <div className="bg-[#fffbeb] dark:bg-[#2a2a1a] border border-[#fde68a] dark:border-[#92400e] rounded-xl p-3">
          <p className="text-xs text-[#92400e] dark:text-[#fde68a]">
            费用由工程师在接单前私下与您讨论确认。
          </p>
        </div>

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
        >
          {submitting ? '提交中...' : '提交工单'}
        </button>
      </div>
    </Modal>
  );
}
