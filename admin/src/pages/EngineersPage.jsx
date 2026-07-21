import { useEffect, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { getAdminEngineerDetail, getAdminUsers, updateAdminEngineer } from '../services/api';
import { runtimeConfig } from '../config/runtime';
import { formatListValue } from './workOrderDisplay';

const STATUS_MAP = {
  available: { color: 'var(--color-success)' },
  paused: { color: 'var(--color-warning)' },
  offline: { color: 'var(--color-text-muted)' },
};

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function listText(value) {
  return formatListValue(value) || '-';
}

function renderTags(value) {
  const list = Array.isArray(value)
    ? value
    : String(formatListValue(value) || '')
      .split(/[,;，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
  if (!list.length) return <span className="text-[var(--color-text-muted)]">-</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((item) => (
        <span key={item} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
          {item}
        </span>
      ))}
    </div>
  );
}

function formatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score > 0 ? score.toFixed(1) : '-';
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  const locale = runtimeConfig.locale === 'zh-CN' ? 'zh-CN' : 'en-US';
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function eventLabel(type, t = TEXT.en) {
  const map = t.eventTypes || {
    engineer_available: 'Available',
    engineer_unavailable: 'Unavailable',
    reserved_service: 'Reserved',
    service_visit: 'Service visit',
    travel: 'Travel',
  };
  return map[type] || type || t.calendarFallback || 'Calendar';
}

const TEXT = {
  en: {
    title: 'Engineers',
    subtitle: 'Search, inspect, and back up engineer profiles before assigning service orders.',
    searchPlaceholder: 'Search name, No., phone, company, region, team...',
    regionPlaceholder: 'Region',
    equipmentPlaceholder: 'Equipment specialty',
    servicePlaceholder: 'Process / service item',
    exportCurrent: 'Export current list',
    loading: 'Loading...',
    empty: 'No engineers found',
    total: (count) => `${count} engineer(s)`,
    headers: {
      no: 'No.',
      name: 'Engineer',
      region: 'Region / team',
      specialties: 'Equipment',
      services: 'Process / service',
      rating: 'Rating',
      orders: 'Orders',
      status: 'Status',
    },
    statuses: {
      available: 'Available',
      paused: 'Paused',
      offline: 'Offline',
    },
    regionalLead: 'Regional lead',
    engineer: 'Engineer',
    upstreamLead: (name) => `Lead: ${name}`,
    profileTitle: 'Engineer Profile',
    close: 'Close',
    contact: 'Contact',
    serviceScope: 'Service Scope',
    performance: 'Performance',
    workOrders: 'Related Service Orders',
    roleSettings: 'Regional Lead Settings',
    promoteLead: 'Set as Regional Lead',
    demoteLead: 'Set as Engineer',
    saveRole: 'Save settings',
    savingRole: 'Saving...',
    roleUpdated: 'Engineer role settings updated.',
    roleUpdateFailed: 'Failed to update engineer role settings',
    responsibleRegion: 'Responsible region',
    teamName: 'Team name',
    serviceRegion: 'Service region',
    currentLoad: 'Current load',
    activeOrders: 'Active service orders',
    availability: 'Availability / schedule',
    noAvailability: 'No future availability entries',
    noWorkOrders: 'No related service orders',
    customer: 'Customer',
    quote: 'Quote',
    openOrderHint: 'Use this service No. in Service Orders to open the full order detail.',
    loadFailed: 'Failed to load engineer profile',
    previous: 'Previous',
    next: 'Next',
  },
  'zh-CN': {
    title: '工程师',
    subtitle: '管理工程师档案、服务能力、服务区域和历史工单，派工前先在这里评估。',
    searchPlaceholder: '搜索姓名、No.、电话、公司、地区、团队...',
    regionPlaceholder: '地区',
    equipmentPlaceholder: '熟悉设备',
    servicePlaceholder: '熟悉工艺/服务项目',
    exportCurrent: '导出当前列表',
    loading: '加载中...',
    empty: '暂无工程师',
    total: (count) => `共 ${count} 位工程师`,
    headers: {
      no: 'No.',
      name: '工程师',
      region: '地区/团队',
      specialties: '熟悉设备',
      services: '熟悉工艺/服务',
      rating: '评分',
      orders: '工单',
      status: '状态',
    },
    statuses: {
      available: '可派工',
      paused: '暂停',
      offline: '离线',
    },
    regionalLead: '区域主管',
    engineer: '工程师',
    upstreamLead: (name) => `主管：${name}`,
    profileTitle: '工程师档案',
    close: '关闭',
    contact: '联系方式',
    serviceScope: '服务能力',
    performance: '服务表现',
    workOrders: '关联工单',
    roleSettings: '区域负责人设置',
    promoteLead: '设为区域负责人',
    demoteLead: '设为工程师',
    saveRole: '保存设置',
    savingRole: '保存中...',
    roleUpdated: '工程师角色设置已更新。',
    roleUpdateFailed: '工程师角色设置更新失败',
    responsibleRegion: '负责区域',
    teamName: '团队名称',
    serviceRegion: '服务区域',
    currentLoad: '当前负荷',
    activeOrders: '个进行中工单',
    availability: '可服务时间 / 排期',
    noAvailability: '暂无未来排期',
    noWorkOrders: '暂无关联工单',
    customer: '客户',
    quote: '报价',
    openOrderHint: '可使用工单号回到服务工单页面查看完整详情。',
    loadFailed: '工程师档案加载失败',
    previous: '上一页',
    next: '下一页',
    eventTypes: {
      engineer_available: '可服务',
      engineer_unavailable: '不可服务',
      reserved_service: '已预留',
      service_visit: '现场服务',
      travel: '差旅',
    },
    calendarFallback: '日历',
    workOrderHeaders: {
      no: '工单号',
      status: '状态',
      created: '创建时间',
    },
  },
};

export function EngineersPage({ initialEngineerId = '', onEngineerOpened }) {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterService, setFilterService] = useState('');
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [roleDraft, setRoleDraft] = useState({ engineer_role: 'engineer', responsible_region: '', team_name: '', service_region: '' });
  const [roleSaving, setRoleSaving] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [search, filterRegion, filterSpecialty, filterService]);

  useEffect(() => {
    const filters = {};
    if (search) filters.search = search;
    if (filterRegion) filters.region = filterRegion;
    if (filterSpecialty) filters.specialty = filterSpecialty;
    if (filterService) filters.service = filterService;

    setLoading(true);
    getAdminUsers('engineer', page, pageSize, filters)
      .then(setData)
      .catch((err) => setMessage(err.message || t.loadFailed))
      .finally(() => setLoading(false));
  }, [page, search, filterRegion, filterSpecialty, filterService, t.loadFailed]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  async function openProfile(engineer) {
    setSelectedEngineer(engineer);
    setProfile(null);
    setProfileLoading(true);
    setMessage('');
    try {
      const result = await getAdminEngineerDetail(engineer.id);
      setProfile(result);
      setRoleDraft({
        engineer_role: result.engineer?.engineer_role || 'engineer',
        responsible_region: result.engineer?.responsible_region || '',
        team_name: result.engineer?.team_name || '',
        service_region: result.engineer?.service_region || '',
      });
    } catch (err) {
      setMessage(err.message || t.loadFailed);
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    if (!initialEngineerId) return;
    openProfile({ id: initialEngineerId });
    onEngineerOpened?.();
  }, [initialEngineerId, onEngineerOpened]);

  async function saveRoleSettings() {
    if (!profile?.engineer?.id) return;
    setRoleSaving(true);
    setMessage('');
    try {
      const result = await updateAdminEngineer(profile.engineer.id, roleDraft);
      setProfile((current) => current ? { ...current, engineer: { ...current.engineer, ...result.engineer } } : current);
      setData((current) => ({
        ...current,
        list: current.list.map((engineer) => engineer.id === profile.engineer.id ? { ...engineer, ...result.engineer } : engineer),
      }));
      setMessage(t.roleUpdated);
    } catch (err) {
      setMessage(err.message || t.roleUpdateFailed);
    } finally {
      setRoleSaving(false);
    }
  }

  function exportCurrentList() {
    downloadCsv('sagemro-engineers-current.csv', [
      ['id', 'user_no', 'name', 'company', 'phone', 'status', 'role', 'regional_lead', 'service_region', 'responsible_region', 'team_name', 'specialties', 'services', 'rating_technical', 'rating_count', 'total_orders', 'created_at'],
      ...data.list.map((engineer) => [
        engineer.id,
        engineer.user_no,
        engineer.name,
        engineer.company,
        engineer.phone,
        engineer.status,
        engineer.engineer_role,
        engineer.regional_lead_name,
        engineer.service_region,
        engineer.responsible_region,
        engineer.team_name,
        listText(engineer.specialties),
        listText(engineer.services),
        engineer.rating_technical,
        engineer.rating_count,
        engineer.total_orders,
        engineer.created_at,
      ]),
    ]);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.subtitle}</p>
        </div>
        <button
          onClick={exportCurrentList}
          disabled={!data.list.length}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] disabled:opacity-40"
        >
          <Download size={15} />
          {t.exportCurrent}
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_160px_180px_180px]">
        <label className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchPlaceholder}
            className="min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <input
          value={filterRegion}
          onChange={(event) => setFilterRegion(event.target.value)}
          placeholder={t.regionPlaceholder}
          className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <input
          value={filterSpecialty}
          onChange={(event) => setFilterSpecialty(event.target.value)}
          placeholder={t.equipmentPlaceholder}
          className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <input
          value={filterService}
          onChange={(event) => setFilterService(event.target.value)}
          placeholder={t.servicePlaceholder}
          className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--color-text-muted)]">{t.loading}</div>
      ) : (
        <>
          <div className="mb-2 text-xs text-[var(--color-text-muted)]">{t.total(data.total)}</div>
          <div className="space-y-3 md:hidden">
            {data.list.length === 0 ? (
              <div className="rounded-xl bg-[var(--color-surface-elevated)] py-8 text-center text-sm text-[var(--color-text-muted)]">{t.empty}</div>
            ) : data.list.map((engineer) => {
              const statusInfo = STATUS_MAP[engineer.status] || { color: 'var(--color-text-muted)' };
              return (
                <article
                  key={engineer.id}
                  onClick={() => openProfile(engineer)}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold text-[var(--color-primary)]">{engineer.user_no || '-'}</div>
                      <div className="mt-1 font-medium">{engineer.name}</div>
                      <div className="truncate text-xs text-[var(--color-text-muted)]">{engineer.company || engineer.phone || '-'}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-surface-elevated)] px-2 py-1 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                      {t.statuses[engineer.status] || engineer.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-secondary)]">
                    <div>{t.headers.region}: {formatListValue(engineer.service_region || engineer.responsible_region) || '-'}</div>
                    <div>
                      {engineer.engineer_role === 'regional_lead'
                        ? t.regionalLead
                        : engineer.regional_lead_name
                          ? t.upstreamLead(engineer.regional_lead_name)
                          : engineer.team_name || '-'}
                    </div>
                    <div>{t.headers.specialties}: {listText(engineer.specialties)}</div>
                    <div>{t.headers.services}: {listText(engineer.services)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                    <span className="rounded-lg bg-[var(--color-surface-elevated)] px-2 py-1">{t.headers.rating}: {formatScore(engineer.rating_technical)}</span>
                    <span className="rounded-lg bg-[var(--color-surface-elevated)] px-2 py-1">{t.headers.orders}: {engineer.total_orders ?? '-'}</span>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.no}</th>
                  <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.name}</th>
                  <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.region}</th>
                  <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.specialties}</th>
                  <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.services}</th>
                  <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.rating}</th>
                  <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.orders}</th>
                  <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.status}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[var(--color-text-muted)]">{t.empty}</td>
                  </tr>
                ) : data.list.map((engineer) => {
                  const statusInfo = STATUS_MAP[engineer.status] || { color: 'var(--color-text-muted)' };
                  return (
                    <tr
                      key={engineer.id}
                      onClick={() => openProfile(engineer)}
                      className="cursor-pointer border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50"
                    >
                      <td className="px-2 py-3 font-mono text-[var(--color-primary)]">{engineer.user_no || '-'}</td>
                      <td className="px-2 py-3">
                        <div>{engineer.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{engineer.company || engineer.phone || '-'}</div>
                      </td>
                      <td className="px-2 py-3 text-[var(--color-text-secondary)]">
                        <div>{formatListValue(engineer.service_region || engineer.responsible_region) || '-'}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {engineer.engineer_role === 'regional_lead'
                            ? t.regionalLead
                            : engineer.regional_lead_name
                              ? t.upstreamLead(engineer.regional_lead_name)
                              : engineer.team_name || '-'}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-[var(--color-text-secondary)]">{listText(engineer.specialties)}</td>
                      <td className="px-2 py-3 text-[var(--color-text-secondary)]">{listText(engineer.services)}</td>
                      <td className="px-2 py-3">{formatScore(engineer.rating_technical)}</td>
                      <td className="px-2 py-3">{engineer.total_orders ?? '-'}</td>
                      <td className="px-2 py-3">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                          {t.statuses[engineer.status] || engineer.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg bg-[var(--color-surface-elevated)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-border)] disabled:opacity-30"
              >
                {t.previous}
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded-lg bg-[var(--color-surface-elevated)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-border)] disabled:opacity-30"
              >
                {t.next}
              </button>
            </div>
          )}
        </>
      )}

      {selectedEngineer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedEngineer(null)} />
          <div className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[var(--color-surface)] shadow-2xl">
            <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-5">
              <div className="min-w-0">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-primary)]">
                  {profile?.engineer?.user_no || selectedEngineer.user_no || '-'}
                </div>
                <h3 className="text-lg font-semibold">{profile?.engineer?.name || selectedEngineer.name}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{t.profileTitle}</p>
              </div>
              <button
                onClick={() => setSelectedEngineer(null)}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <X size={15} />
                {t.close}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">

            {profileLoading ? (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loading}</div>
            ) : profile ? (
              <div className="space-y-4">
                <section className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                    <div className="text-xs text-[var(--color-text-muted)]">{t.contact}</div>
                    <div className="mt-2 text-sm">{profile.engineer.phone || '-'}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{profile.engineer.company || '-'}</div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                    <div className="text-xs text-[var(--color-text-muted)]">{t.serviceScope}</div>
                    <div className="mt-2 text-sm">{formatListValue(profile.engineer.service_region || profile.engineer.responsible_region) || '-'}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      {profile.engineer.engineer_role === 'regional_lead'
                        ? t.regionalLead
                        : profile.engineer.regional_lead_name
                          ? t.upstreamLead(profile.engineer.regional_lead_name)
                          : profile.engineer.team_name || '-'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                    <div className="text-xs text-[var(--color-text-muted)]">{t.currentLoad}</div>
                    <div className="mt-2 text-sm">{profile.stats.active_work_orders} {t.activeOrders}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{t.performance}: {formatScore(profile.engineer.rating_technical)}</div>
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="font-medium">{t.roleSettings}</h4>
                    <div className="grid grid-cols-2 rounded-lg border border-[var(--color-border)] p-1 sm:flex">
                      {[
                        { value: 'engineer', label: t.engineer },
                        { value: 'regional_lead', label: t.regionalLead },
                      ].map((role) => (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => setRoleDraft((draft) => ({ ...draft, engineer_role: role.value }))}
                          className={`rounded-md px-3 py-2 text-xs font-medium ${
                            roleDraft.engineer_role === role.value
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                          }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs text-[var(--color-text-muted)]">
                      {t.responsibleRegion}
                      <input
                        value={roleDraft.responsible_region}
                        onChange={(event) => setRoleDraft((draft) => ({ ...draft, responsible_region: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                      />
                    </label>
                    <label className="text-xs text-[var(--color-text-muted)]">
                      {t.teamName}
                      <input
                        value={roleDraft.team_name}
                        onChange={(event) => setRoleDraft((draft) => ({ ...draft, team_name: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                      />
                    </label>
                    <label className="text-xs text-[var(--color-text-muted)]">
                      {t.serviceRegion}
                      <input
                        value={roleDraft.service_region}
                        onChange={(event) => setRoleDraft((draft) => ({ ...draft, service_region: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                      />
                    </label>
                  </div>
                  <button
                    onClick={saveRoleSettings}
                    disabled={roleSaving}
                    className="mt-3 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {roleSaving ? t.savingRole : t.saveRole}
                  </button>
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-3 font-medium">{t.serviceScope}</h4>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs text-[var(--color-text-muted)]">{t.headers.specialties}</div>
                      {renderTags(profile.engineer.specialties)}
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-[var(--color-text-muted)]">{t.headers.services}</div>
                      {renderTags(profile.engineer.services)}
                    </div>
                  </div>
                  {profile.engineer.bio && (
                    <div className="mt-3 rounded-lg bg-[var(--color-surface-elevated)] p-3 text-sm text-[var(--color-text-secondary)]">
                      {profile.engineer.bio}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-3 font-medium">{t.availability}</h4>
                  {!profile.calendar_events?.length ? (
                    <div className="py-4 text-sm text-[var(--color-text-muted)]">{t.noAvailability}</div>
                  ) : (
                    <div className="space-y-2">
                      {profile.calendar_events.map((event) => (
                        <div key={event.id} className="rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{event.title || eventLabel(event.event_type, t)}</span>
                            <span className="text-xs text-[var(--color-text-muted)]">{eventLabel(event.event_type, t)}</span>
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {formatDateTime(event.start_at)} - {formatDateTime(event.end_at)}
                          </div>
                          {(event.location || event.note) && (
                            <div className="mt-1 text-xs text-[var(--color-text-muted)]">{[event.location, event.note].filter(Boolean).join(' / ')}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-medium">{t.workOrders}</h4>
                    <span className="text-xs text-[var(--color-text-muted)]">{t.openOrderHint}</span>
                  </div>
                  {profile.work_orders.length === 0 ? (
                    <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">{t.noWorkOrders}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)]">
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">{t.workOrderHeaders?.no || 'No.'}</th>
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">{t.customer}</th>
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">{t.workOrderHeaders?.status || 'Status'}</th>
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">{t.quote}</th>
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">{t.workOrderHeaders?.created || 'Created'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.work_orders.map((order) => (
                            <tr key={order.id} className="border-b border-[var(--color-border)]/50">
                              <td className="px-2 py-2 font-mono text-[var(--color-primary)]">{order.order_no}</td>
                              <td className="px-2 py-2">
                                <div>{order.customer_name || '-'}</div>
                                <div className="text-xs text-[var(--color-text-muted)]">{order.customer_company || '-'}</div>
                              </td>
                              <td className="px-2 py-2 text-[var(--color-text-secondary)]">{order.status}</td>
                              <td className="px-2 py-2 text-[var(--color-text-secondary)]">
                                {order.pricing_status || '-'}{order.pricing_total_amount ? ` / ${order.pricing_total_amount}` : ''}
                              </td>
                              <td className="px-2 py-2 text-[var(--color-text-secondary)]">{order.created_at?.slice(0, 10) || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loadFailed}</div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
