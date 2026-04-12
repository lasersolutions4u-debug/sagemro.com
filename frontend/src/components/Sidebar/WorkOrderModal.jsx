import { useState } from 'react';
import { Modal } from '../common/Modal';
import { WorkOrderType, UrgencyLevel } from '../../types';

export function WorkOrderModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState({
    type: '',
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
    { value: WorkOrderType.MALFUNCTION, label: '设备故障' },
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
    <Modal isOpen={isOpen} onClose={onClose} title="提交工单">
      <div className="space-y-4">
        {/* 问题类型 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            问题类型 <span className="text-red-500">*</span>
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#1677ff]"
          >
            <option value="">请选择问题类型</option>
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 设备型号 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            设备型号
          </label>
          <input
            type="text"
            value={form.device_model}
            onChange={(e) => setForm({ ...form, device_model: e.target.value })}
            placeholder="例如：3000W光纤激光切割机"
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#1677ff]"
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
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#1677ff] resize-none"
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
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#1677ff]"
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
                    ? 'border-[#1677ff] bg-[#1677ff]/10 text-[#1677ff]'
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

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-[#1677ff] hover:bg-[#4096ff] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
        >
          {submitting ? '提交中...' : '提交工单'}
        </button>
      </div>
    </Modal>
  );
}
