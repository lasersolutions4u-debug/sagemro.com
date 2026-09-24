import { useState } from 'react';
import { X } from 'lucide-react';
import { submitConsultation } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';

// 主站（sagemro.com / sagemro.cn）的咨询线索表单。
// 工单体系已下线，落地页的转化路径就是这张表单：留下联系方式 + 需求，写入 leads。
// 不要把工单、报价、指派等流程再挂回来。
const COPY = {
  com: {
    title: 'Request a consultation',
    intro: 'Share the equipment and issue. A SAGEMRO engineer replies by email or phone. Do not include drawings, passwords, or other secrets.',
    name: 'Name',
    company: 'Company (optional)',
    email: 'Email',
    phone: 'Phone',
    message: 'Equipment, fault, or requirement',
    submit: 'Send request',
    sending: 'Sending…',
    close: 'Close',
    contactRequired: 'Provide an email or a phone number so we can reply.',
    nameRequired: 'Please provide your name.',
    success: 'Your request was sent. We will get back to you shortly.',
    failed: 'We could not send the request. Please try again.',
  },
  cn: {
    title: '提交咨询需求',
    intro: '请描述设备与问题，SAGEMRO 工程师会通过邮箱或电话回复。请勿填写图纸、密码等敏感信息。',
    name: '姓名',
    company: '公司名（选填）',
    email: '邮箱',
    phone: '电话',
    message: '设备、故障或需求描述',
    submit: '提交需求',
    sending: '提交中…',
    close: '关闭',
    contactRequired: '请至少填写邮箱或电话，方便我们回复。',
    nameRequired: '请填写姓名。',
    success: '需求已提交，我们会尽快与您联系。',
    failed: '暂时无法提交，请稍后重试。',
  },
};

const fieldClass = 'mt-1 w-full rounded-lg border border-[#d8c9b6] bg-white px-3 py-2.5 text-sm text-[#21160c] outline-none focus:border-[#d97706]';

export function ConsultationForm({ isOpen, isCn, onClose }) {
  const t = COPY[isCn ? 'cn' : 'com'];
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', message: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.name.trim()) { setError(t.nameRequired); return; }
    if (!form.email.trim() && !form.phone.trim()) { setError(t.contactRequired); return; }
    setPending(true);
    try {
      await submitConsultation({
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim(),
      });
      toastSuccess(t.success);
      setForm({ name: '', company: '', email: '', phone: '', message: '' });
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || t.failed);
      toastError(t.failed);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={t.title}>
      <form onSubmit={submit} className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e3d6c7] bg-[#fffdf8] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#21160c]">{t.title}</h2>
            <p className="mt-2 text-xs leading-6 text-[#756552]">{t.intro}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e3d6c7] text-[#756552]"><X size={16} /></button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[#5f5142]">{t.name}<input required value={form.name} onChange={update('name')} className={fieldClass} /></label>
          <label className="text-xs font-semibold text-[#5f5142]">{t.company}<input value={form.company} onChange={update('company')} className={fieldClass} /></label>
          <label className="text-xs font-semibold text-[#5f5142]">{t.email}<input type="email" value={form.email} onChange={update('email')} className={fieldClass} /></label>
          <label className="text-xs font-semibold text-[#5f5142]">{t.phone}<input type="tel" value={form.phone} onChange={update('phone')} className={fieldClass} /></label>
          <label className="text-xs font-semibold text-[#5f5142] sm:col-span-2">{t.message}<textarea rows={4} value={form.message} onChange={update('message')} className={fieldClass} /></label>
        </div>

        {error && <p role="alert" className="mt-3 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-10 whitespace-nowrap rounded-lg border border-[#d8c9b6] px-4 text-sm text-[#5f5142]">{t.close}</button>
          <button type="submit" disabled={pending} className="min-h-10 whitespace-nowrap rounded-lg bg-[#f59e0b] px-4 text-sm font-semibold text-[#21160c] disabled:opacity-50">{pending ? t.sending : t.submit}</button>
        </div>
      </form>
    </div>
  );
}
