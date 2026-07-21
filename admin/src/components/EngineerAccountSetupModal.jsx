import { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';

const TEXT = {
  en: {
    title: 'Engineer account setup',
    subtitle: 'Confirm the account details. The engineer will set a password from the activation email.',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    specialties: 'Equipment specialties',
    specialtiesHint: 'Separate multiple equipment types with commas',
    services: 'Service items',
    servicesHint: 'Separate multiple items with commas',
    regions: 'Service regions',
    experience: 'Experience summary',
    accountType: 'Account type',
    engineer: 'Engineer',
    regionalLead: 'Regional lead',
    lead: 'Regional lead assignment',
    noLead: 'Assign later',
    responsibleRegion: 'Responsible region',
    team: 'Team name',
    certification: 'Certification',
    cooperation: 'Cooperation',
    workload: 'Workload',
    certificationOptions: { pending: 'Pending', verified: 'Verified' },
    cooperationOptions: { confirmed: 'Confirmed', trial: 'Trial' },
    workloadOptions: { available: 'Available', normal: 'Normal', busy: 'Busy' },
    required: 'Add at least one service capability.',
    cancel: 'Cancel',
    submit: 'Confirm and send activation email',
    submitting: 'Opening account...',
  },
  'zh-CN': {
    title: '工程师账号设置',
    subtitle: '确认账号资料后发送激活邮件，工程师将自行设置登录密码。',
    name: '姓名',
    email: '邮箱',
    phone: '手机号',
    specialties: '熟悉设备',
    specialtiesHint: '多种设备请用逗号分隔',
    services: '服务项目',
    servicesHint: '多项内容请用逗号分隔',
    regions: '服务区域',
    experience: '经验说明',
    accountType: '账号类型',
    engineer: '工程师',
    regionalLead: '区域负责人',
    lead: '所属区域负责人',
    noLead: '稍后分配',
    responsibleRegion: '负责区域',
    team: '团队名称',
    certification: '认证状态',
    cooperation: '合作状态',
    workload: '工作负荷',
    certificationOptions: { pending: '待认证', verified: '已认证' },
    cooperationOptions: { confirmed: '已确认合作', trial: '试合作' },
    workloadOptions: { available: '可接单', normal: '正常', busy: '繁忙' },
    required: '至少填写一项服务能力。',
    cancel: '取消',
    submit: '确认开通并发送激活邮件',
    submitting: '正在开通...',
  },
};

function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // Fall through to delimiter parsing for Admin-edited text.
    }
  }
  return String(value || '').split(/[,;，、\n]/).map((item) => item.trim()).filter(Boolean);
}

function initialForm(application) {
  return {
    name: application.name || '',
    email: application.email || '',
    phone: application.phone || '',
    specialties: toList(application.equipment_types).join(', '),
    services: toList(application.skill_tags).join(', '),
    service_regions: toList(application.service_regions).join(', '),
    bio: application.experience_summary || '',
    engineer_role: 'engineer',
    regional_lead_id: '',
    responsible_region: application.base_region || application.city || '',
    team_name: '',
    certification_status: 'pending',
    cooperation_status: 'confirmed',
    workload_status: 'available',
  };
}

export function EngineerAccountSetupModal({
  application,
  locale,
  regionalLeads,
  submitting,
  error,
  onClose,
  onSubmit,
}) {
  const t = TEXT[locale] || TEXT.en;
  const [form, setForm] = useState(() => initialForm(application));
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setForm(initialForm(application));
    setValidationError('');
  }, [application]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = () => {
    const services = toList(form.services);
    if (!services.length) {
      setValidationError(t.required);
      return;
    }
    setValidationError('');
    onSubmit({
      ...form,
      specialties: toList(form.specialties),
      services,
      service_regions: toList(form.service_regions),
      regional_lead_id: form.engineer_role === 'engineer' ? form.regional_lead_id : '',
    });
  };

  const inputClass = 'min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]';

  return (
    <section className="mt-3 border-t border-[var(--color-primary)]/20 pt-4" aria-label={t.title}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text)]">{t.title}</h4>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{t.subtitle}</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]" aria-label={t.cancel}>
          <X size={17} />
        </button>
      </div>

      {(error || validationError) && (
        <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error || validationError}</div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-[var(--color-text-secondary)]">{t.name}<input className={`${inputClass} mt-1`} value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
        <label className="text-xs text-[var(--color-text-secondary)]">{t.email}<input type="email" className={`${inputClass} mt-1`} value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
        <label className="text-xs text-[var(--color-text-secondary)]">{t.phone}<input type="tel" className={`${inputClass} mt-1`} value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
        <label className="text-xs text-[var(--color-text-secondary)]">{t.responsibleRegion}<input className={`${inputClass} mt-1`} value={form.responsible_region} onChange={(event) => update('responsible_region', event.target.value)} /></label>
        <label className="text-xs text-[var(--color-text-secondary)] md:col-span-2">{t.specialties}<input className={`${inputClass} mt-1`} value={form.specialties} onChange={(event) => update('specialties', event.target.value)} placeholder={t.specialtiesHint} /></label>
        <label className="text-xs text-[var(--color-text-secondary)] md:col-span-2">{t.services}<input className={`${inputClass} mt-1`} value={form.services} onChange={(event) => update('services', event.target.value)} placeholder={t.servicesHint} /></label>
        <label className="text-xs text-[var(--color-text-secondary)] md:col-span-2">{t.regions}<input className={`${inputClass} mt-1`} value={form.service_regions} onChange={(event) => update('service_regions', event.target.value)} /></label>
        <label className="text-xs text-[var(--color-text-secondary)] md:col-span-2">{t.experience}<textarea rows={3} className={`${inputClass} mt-1 resize-y`} value={form.bio} onChange={(event) => update('bio', event.target.value)} /></label>

        <div className="text-xs text-[var(--color-text-secondary)]">
          <span>{t.accountType}</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {[
              ['engineer', t.engineer],
              ['regional_lead', t.regionalLead],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => update('engineer_role', value)} className={`min-h-10 whitespace-nowrap rounded-lg border px-3 text-sm ${form.engineer_role === value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="text-xs text-[var(--color-text-secondary)]">{t.lead}
          <select className={`${inputClass} mt-1`} value={form.regional_lead_id} onChange={(event) => update('regional_lead_id', event.target.value)} disabled={form.engineer_role === 'regional_lead'}>
            <option value="">{t.noLead}</option>
            {regionalLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-[var(--color-text-secondary)]">{t.team}<input className={`${inputClass} mt-1`} value={form.team_name} onChange={(event) => update('team_name', event.target.value)} /></label>
        <label className="text-xs text-[var(--color-text-secondary)]">{t.certification}<select className={`${inputClass} mt-1`} value={form.certification_status} onChange={(event) => update('certification_status', event.target.value)}>{Object.entries(t.certificationOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs text-[var(--color-text-secondary)]">{t.cooperation}<select className={`${inputClass} mt-1`} value={form.cooperation_status} onChange={(event) => update('cooperation_status', event.target.value)}>{Object.entries(t.cooperationOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs text-[var(--color-text-secondary)]">{t.workload}<select className={`${inputClass} mt-1`} value={form.workload_status} onChange={(event) => update('workload_status', event.target.value)}>{Object.entries(t.workloadOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} disabled={submitting} className="min-h-10 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-secondary)] disabled:opacity-50">{t.cancel}</button>
        <button type="button" onClick={submit} disabled={submitting} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50">
          <Send size={15} />
          {submitting ? t.submitting : t.submit}
        </button>
      </div>
    </section>
  );
}
