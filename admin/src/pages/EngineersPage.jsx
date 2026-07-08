import { useEffect, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { getAdminEngineerDetail, getAdminUsers } from '../services/api';
import { runtimeConfig } from '../config/runtime';

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
  return Array.isArray(value) && value.length ? value.join(', ') : '-';
}

function formatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score > 0 ? score.toFixed(1) : '-';
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
    noWorkOrders: 'No related service orders',
    customer: 'Customer',
    quote: 'Quote',
    openOrderHint: 'Use this service No. in Service Orders to open the full order detail.',
    loadFailed: 'Failed to load engineer profile',
    previous: 'Previous',
    next: 'Next',
  },
  'zh-CN': {
    title: 'Engineers',
    subtitle: '独立管理工程师档案、服务能力、地区和历史工单，派工前先在这里判断。',
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
    noWorkOrders: '暂无关联工单',
    customer: '客户',
    quote: '报价',
    openOrderHint: '可用工单 No. 回到 Service Orders 中打开完整工单详情。',
    loadFailed: '工程师档案加载失败',
    previous: '上一页',
    next: '下一页',
  },
};

export function EngineersPage() {
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
    } catch (err) {
      setMessage(err.message || t.loadFailed);
    } finally {
      setProfileLoading(false);
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.subtitle}</p>
        </div>
        <button
          onClick={exportCurrentList}
          disabled={!data.list.length}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] disabled:opacity-40"
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

      <div className="mb-4 grid gap-2 lg:grid-cols-[minmax(240px,1fr)_160px_180px_180px]">
        <label className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <input
          value={filterRegion}
          onChange={(event) => setFilterRegion(event.target.value)}
          placeholder={t.regionPlaceholder}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <input
          value={filterSpecialty}
          onChange={(event) => setFilterSpecialty(event.target.value)}
          placeholder={t.equipmentPlaceholder}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <input
          value={filterService}
          onChange={(event) => setFilterService(event.target.value)}
          placeholder={t.servicePlaceholder}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--color-text-muted)]">{t.loading}</div>
      ) : (
        <>
          <div className="mb-2 text-xs text-[var(--color-text-muted)]">{t.total(data.total)}</div>
          <div className="overflow-x-auto">
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
                        <div>{engineer.service_region || engineer.responsible_region || '-'}</div>
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
          <div className="relative h-full w-full max-w-3xl overflow-y-auto bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-primary)]">
                  {profile?.engineer?.user_no || selectedEngineer.user_no || '-'}
                </div>
                <h3 className="text-lg font-semibold">{profile?.engineer?.name || selectedEngineer.name}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{t.profileTitle}</p>
              </div>
              <button
                onClick={() => setSelectedEngineer(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
              >
                <X size={15} />
                {t.close}
              </button>
            </div>

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
                    <div className="mt-2 text-sm">{profile.engineer.service_region || profile.engineer.responsible_region || '-'}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{profile.engineer.team_name || profile.engineer.regional_lead_name || '-'}</div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                    <div className="text-xs text-[var(--color-text-muted)]">{t.performance}</div>
                    <div className="mt-2 text-sm">{formatScore(profile.engineer.rating_technical)}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{profile.stats.total_work_orders} orders</div>
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-3 font-medium">{t.serviceScope}</h4>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs text-[var(--color-text-muted)]">{t.headers.specialties}</div>
                      <div className="text-[var(--color-text-secondary)]">{listText(profile.engineer.specialties)}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-[var(--color-text-muted)]">{t.headers.services}</div>
                      <div className="text-[var(--color-text-secondary)]">{listText(profile.engineer.services)}</div>
                    </div>
                  </div>
                  {profile.engineer.bio && (
                    <div className="mt-3 rounded-lg bg-[var(--color-surface-elevated)] p-3 text-sm text-[var(--color-text-secondary)]">
                      {profile.engineer.bio}
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
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">No.</th>
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">{t.customer}</th>
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">Status</th>
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">{t.quote}</th>
                            <th className="px-2 py-2 text-left text-[var(--color-text-secondary)]">Created</th>
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
      )}
    </div>
  );
}
