import { useState } from 'react';
import { getPublicHomeContent } from '../../data/publicHomeContent';
import { PublicSiteShell } from './PublicSiteShell';
import { submitPartnerApplication } from '../../services/api';

// /partners/ —— 面向整机厂海外渠道商与服务伙伴的入口。
// 只在国际站发布：CN 不露出招商内容，避免与整机厂自有渠道体系及 euchio.com 定位冲突。
export function PartnersPage({ onOpenLegal }) {
  const content = getPublicHomeContent(false).partnerPage;
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', country: '', message: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const update = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await submitPartnerApplication(form);
      setStatus('sent');
    } catch (submitError) {
      setError(submitError.message || content.form.error);
      setStatus('error');
    }
  }

  const inputClass = 'mt-2 min-h-12 w-full rounded-lg border border-[#e3d6c7] bg-white px-4 text-sm text-[#2d2116] outline-none focus:border-[#d97706]';
  const labelClass = 'block text-sm font-semibold text-[#2d2116]';

  return (
    <PublicSiteShell isCn={false} onOpenLegal={onOpenLegal}>
      <section className="border-b border-[#e6dccf] bg-[#f7f3ed] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#92400e]">{content.eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.12] tracking-[-0.04em] text-[#21160c] md:text-5xl">{content.title}</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[#6b5a48] md:text-lg">{content.description}</p>
        </div>
      </section>

      <section className="bg-[#fffdf8] px-5 py-16 md:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-6 lg:grid-cols-3 lg:px-3">
          {content.sections.map((section) => (
            <article key={section.key} className="border-t-2 border-[#f59e0b] pt-5">
              <h2 className="text-lg font-semibold text-[#21160c]">{section.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-[#756552]">{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#e6dccf] bg-[#f4ede3] px-5 py-16 md:py-20">
        <div className="mx-auto max-w-[720px]">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#21160c]">{content.form.title}</h2>
          {status === 'sent' ? (
            <p className="mt-6 border-l-4 border-[#16a34a] bg-[#fffdf8] p-5 text-sm leading-7 text-[#2d2116]">{content.form.success}</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:grid-cols-2">
              <label className={labelClass}>
                {content.form.fields.name}
                <input className={inputClass} type="text" value={form.name} onChange={update('name')} required />
              </label>
              <label className={labelClass}>
                {content.form.fields.company}
                <input className={inputClass} type="text" value={form.company} onChange={update('company')} required />
              </label>
              <label className={labelClass}>
                {content.form.fields.email}
                <input className={inputClass} type="email" value={form.email} onChange={update('email')} />
              </label>
              <label className={labelClass}>
                {content.form.fields.phone}
                <input className={inputClass} type="text" value={form.phone} onChange={update('phone')} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                {content.form.fields.country}
                <input className={inputClass} type="text" value={form.country} onChange={update('country')} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                {content.form.fields.message}
                <textarea className={`${inputClass} min-h-32 py-3`} rows={4} value={form.message} onChange={update('message')} />
              </label>
              {status === 'error' && (
                <p className="sm:col-span-2 text-sm text-[#b91c1c]">{error}</p>
              )}
              <div className="sm:col-span-2">
                <button type="submit" disabled={status === 'sending'} className="flex min-h-12 items-center justify-center rounded-lg bg-[#f59e0b] px-6 text-sm font-semibold text-[#21160c] shadow-sm transition-colors hover:bg-[#fbbf24] disabled:opacity-60">
                  {content.form.submit}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </PublicSiteShell>
  );
}
