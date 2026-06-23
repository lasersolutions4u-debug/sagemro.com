import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
import {
  createEngineerCalendarEvent,
  deleteEngineerCalendarEvent,
  getEngineerCalendarEvents,
} from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  cn: {
    title: '我的排单日历',
    subtitle: '请主动维护你的可服务时间、不可服务时间和已预留现场时间。Admin 与区域负责人派工时会把它作为重要参考。',
    type: '类型',
    titleLabel: '标题',
    start: '开始时间',
    end: '结束时间',
    region: '区域',
    notes: '备注',
    add: '发布排单信号',
    adding: '正在添加...',
    loading: '加载中...',
    empty: '暂无日历记录',
    delete: '删除',
    loadError: '日历加载失败',
    createError: '日历记录保存失败',
    deleteError: '日历记录删除失败',
    defaultTitle: {
      engineer_available: '可安排现场服务',
      engineer_unavailable: '暂不可安排',
      reserved_for_service: '已预留服务时间',
    },
    eventTypes: [
      ['engineer_available', '可服务'],
      ['engineer_unavailable', '不可服务'],
      ['reserved_for_service', '已预留'],
    ],
  },
  en: {
    title: 'My Scheduling Calendar',
    subtitle: 'Maintain your available, unavailable, and reserved field-service windows. Admin and regional leads use this as an important dispatch reference.',
    type: 'Type',
    titleLabel: 'Title',
    start: 'Start',
    end: 'End',
    region: 'Region',
    notes: 'Notes',
    add: 'Publish Scheduling Signal',
    adding: 'Adding...',
    loading: 'Loading...',
    empty: 'No calendar entries yet',
    delete: 'Delete',
    loadError: 'Failed to load calendar',
    createError: 'Failed to save calendar entry',
    deleteError: 'Failed to delete calendar entry',
    defaultTitle: {
      engineer_available: 'Available for field service',
      engineer_unavailable: 'Unavailable',
      reserved_for_service: 'Reserved for service',
    },
    eventTypes: [
      ['engineer_available', 'Available'],
      ['engineer_unavailable', 'Unavailable'],
      ['reserved_for_service', 'Reserved'],
    ],
  },
};

function getLocale() {
  return isCnLocale() ? 'cn' : 'en';
}

function defaultLocalDateTime(hoursFromNow) {
  const date = new Date(Date.now() + hoursFromNow * 3600000);
  date.setMinutes(0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function localDateTimeToIso(value) {
  return value ? new Date(value).toISOString() : '';
}

function formatDateTime(value, locale) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat(locale === 'cn' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function eventTone(eventType) {
  if (eventType === 'engineer_available') return 'border-green-200 bg-green-50 text-green-700';
  if (eventType === 'engineer_unavailable') return 'border-neutral-200 bg-neutral-50 text-neutral-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function eventAccent(eventType) {
  if (eventType === 'engineer_available') return 'bg-green-500';
  if (eventType === 'engineer_unavailable') return 'bg-neutral-400';
  return 'bg-[var(--color-primary)]';
}

export function EngineerAvailabilityCalendar() {
  const locale = getLocale();
  const copy = COPY[locale];
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [form, setForm] = useState({
    event_type: 'engineer_available',
    title: '',
    start_at: defaultLocalDateTime(24),
    end_at: defaultLocalDateTime(32),
    region: '',
    notes: '',
  });

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await getEngineerCalendarEvents();
      setEvents(data.events || []);
    } catch (error) {
      setMessage(error.message || copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addEvent = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      await createEngineerCalendarEvent({
        event_type: form.event_type,
        title: form.title.trim() || copy.defaultTitle[form.event_type],
        start_at: localDateTimeToIso(form.start_at),
        end_at: localDateTimeToIso(form.end_at),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        region: form.region,
        notes: form.notes,
      });
      setForm((prev) => ({ ...prev, title: '', notes: '' }));
      await loadEvents();
    } catch (error) {
      setMessage(error.message || copy.createError);
    } finally {
      setSubmitting(false);
    }
  };

  const removeEvent = async (eventId) => {
    setDeletingId(eventId);
    setMessage('');
    try {
      await deleteEngineerCalendarEvent(eventId);
      setEvents((prev) => prev.filter((item) => item.id !== eventId));
    } catch (error) {
      setMessage(error.message || copy.deleteError);
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="h-1 bg-gradient-to-r from-[var(--color-primary)] via-amber-300 to-transparent" />
      <div className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 p-2 text-[var(--color-primary)]">
          <CalendarDays size={20} />
        </div>
        <div>
          <h2 className="font-semibold">{copy.title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{copy.subtitle}</p>
        </div>
      </div>

      <form onSubmit={addEvent} className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 shadow-inner">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">
            {copy.type}
            <select
              value={form.event_type}
              onChange={(event) => updateField('event_type', event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)]"
            >
              {copy.eventTypes.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">
            {copy.titleLabel}
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder={copy.defaultTitle[form.event_type]}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">
            {copy.start}
            <input
              type="datetime-local"
              value={form.start_at}
              onChange={(event) => updateField('start_at', event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)]"
              required
            />
          </label>
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">
            {copy.end}
            <input
              type="datetime-local"
              value={form.end_at}
              onChange={(event) => updateField('end_at', event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)]"
              required
            />
          </label>
        </div>
        <input
          value={form.region}
          onChange={(event) => updateField('region', event.target.value)}
          placeholder={copy.region}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)]"
        />
        <textarea
          value={form.notes}
          onChange={(event) => updateField('notes', event.target.value)}
          placeholder={copy.notes}
          rows={2}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)]"
        />
        {message && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
            {message}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-[var(--color-primary)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {submitting ? copy.adding : copy.add}
        </button>
      </form>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">{copy.loading}</div>
        ) : events.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">{copy.empty}</div>
        ) : (
          events.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
              <div className="flex">
                <div className={`w-1.5 shrink-0 ${eventAccent(item.event_type)}`} />
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${eventTone(item.event_type)}`}>
                    {copy.eventTypes.find(([value]) => value === item.event_type)?.[1] || item.event_type}
                  </span>
                  <h3 className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">{item.title}</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {formatDateTime(item.start_at, locale)} - {formatDateTime(item.end_at, locale)}
                    {item.region ? ` · ${item.region}` : ''}
                  </p>
                  {item.notes && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{item.notes}</p>}
                </div>
                <button
                  onClick={() => removeEvent(item.id)}
                  disabled={deletingId === item.id}
                  className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] hover:text-[var(--color-error)] disabled:opacity-50"
                  title={copy.delete}
                >
                  <Trash2 size={15} />
                </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
