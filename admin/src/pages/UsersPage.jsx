import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Search, Filter } from 'lucide-react';
import { getAdminUsers, createAdminUser, deleteAdminUser } from '../services/api';
import { runtimeConfig } from '../config/runtime';
import { isTimeoutError, withTimeout } from '../utils/asyncTimeout';

const DELETE_TIMEOUT_MS = 12000;

const STATUS_MAP = {
  available: { color: 'var(--color-success)' },
  paused: { color: 'var(--color-warning)' },
  offline: { color: 'var(--color-text-muted)' },
};

const DEVICE_TYPES = [
  { value: '激光切割机', en: 'Laser cutting machine', zh: '激光切割机' },
  { value: '折弯机', en: 'Press brake', zh: '折弯机' },
  { value: '冲床', en: 'Punching machine', zh: '冲床' },
  { value: '焊接机', en: 'Welding machine', zh: '焊接机' },
  { value: '激光焊接', en: 'Laser welding', zh: '激光焊接' },
  { value: '卷板机', en: 'Plate rolling machine', zh: '卷板机' },
  { value: '等离子切割', en: 'Plasma cutting', zh: '等离子切割' },
  { value: '水刀切割', en: 'Waterjet cutting', zh: '水刀切割' },
  { value: '剪板机', en: 'Shearing machine', zh: '剪板机' },
  { value: '其他', en: 'Other', zh: '其他' },
];

const COMMON_SERVICES = [
  { value: '激光器维修', en: 'Laser source repair', zh: '激光器维修' },
  { value: '切割头维护', en: 'Cutting head maintenance', zh: '切割头维护' },
  { value: '导轨润滑', en: 'Guide rail lubrication', zh: '导轨润滑' },
  { value: '参数调试', en: 'Parameter tuning', zh: '参数调试' },
  { value: '液压维修', en: 'Hydraulic repair', zh: '液压维修' },
  { value: '电气排查', en: 'Electrical troubleshooting', zh: '电气排查' },
  { value: '设备保养', en: 'Equipment maintenance', zh: '设备保养' },
  { value: '系统升级', en: 'System upgrade', zh: '系统升级' },
  { value: '年度维保', en: 'Annual maintenance', zh: '年度维保' },
  { value: '应急抢修', en: 'Emergency repair', zh: '应急抢修' },
  { value: '培训指导', en: 'Training guidance', zh: '培训指导' },
  { value: '配件供应', en: 'Spare parts supply', zh: '配件供应' },
];

const TEXT = {
  en: {
    optionKey: 'en',
    statuses: {
      available: 'Available',
      paused: 'Paused',
      offline: 'Offline',
    },
    title: 'User Management',
    addUser: 'Add user',
    customer: 'Customer',
    engineer: 'Engineer',
    searchPlaceholder: 'Search name, company, or phone...',
    filter: 'Filter',
    dispatchStatus: 'Dispatch status',
    equipmentType: 'Equipment type',
    all: 'All',
    region: 'Region',
    serviceRegion: 'Service region',
    customerRegion: 'Customer region',
    clearFilters: 'Clear filters',
    loading: 'Loading...',
    total: (count) => `${count} record(s)`,
    headers: {
      no: 'No.',
      name: 'Name',
      company: 'Company',
      phone: 'Phone',
      region: 'Region',
      dispatchStatus: 'Dispatch status',
      roleTeam: 'Role / team',
      specialty: 'Specialty',
      rating: 'Rating',
      createdAt: 'Registered',
      action: 'Action',
    },
    emptyFiltered: 'No users match the filters',
    empty: 'No data',
    regionalLead: 'Regional lead',
    upstreamLead: (name) => `Lead: ${name}`,
    noLead: 'No lead assigned',
    ratingCount: (count) => `${count} review(s)`,
    deleteTitle: 'Delete user',
    addTitle: 'Add user',
    namePlaceholder: 'Name',
    phonePlaceholder: 'Phone number',
    passwordPlaceholder: 'Password',
    regionOptional: 'Region (optional)',
    engineerRole: 'Engineer account type *',
    leadOptional: 'Upper regional lead (can be assigned later)',
    responsibleRegion: 'Responsible region (optional)',
    teamName: 'Team name (optional)',
    specialtiesLabel: 'Equipment specialties *',
    servicesLabel: 'Service items *',
    bioPlaceholder: 'Bio (optional)',
    creating: 'Creating...',
    createUser: 'Create user',
    deleteFailed: 'Delete failed: ',
    deleteSlowNotice: 'Deletion is taking longer than expected. The list has been refreshed. Please check whether the user is still present before retrying.',
    deleteSuccessNotice: 'User deleted. The list has been refreshed.',
    confirmDelete: 'Confirm delete user',
    deleteWarning: 'After deletion, this user data such as conversations, service orders, and reviews will be removed. This action cannot be undone.',
    cancel: 'Cancel',
    deleting: 'Deleting...',
    confirmDeleteButton: 'Confirm delete',
    dismissNotice: 'Dismiss notice',
    previous: 'Previous',
    next: 'Next',
  },
  'zh-CN': {
    optionKey: 'zh',
    statuses: {
      available: '可派工',
      paused: '暂停',
      offline: '离线',
    },
    title: '用户管理',
    addUser: '添加用户',
    customer: '客户',
    engineer: '工程师',
    searchPlaceholder: '搜索姓名、公司名或手机号...',
    filter: '筛选',
    dispatchStatus: '派工状态',
    equipmentType: '设备类型',
    all: '全部',
    region: '地区',
    serviceRegion: '服务地区',
    customerRegion: '客户地区',
    clearFilters: '清除筛选',
    loading: '加载中...',
    total: (count) => `共 ${count} 条记录`,
    headers: {
      no: '编号',
      name: '姓名',
      company: '公司名',
      phone: '手机号',
      region: '地区',
      dispatchStatus: '派工状态',
      roleTeam: '角色/团队',
      specialty: '专长',
      rating: '评分',
      createdAt: '注册时间',
      action: '操作',
    },
    emptyFiltered: '没有符合条件的用户',
    empty: '暂无数据',
    regionalLead: '区域负责人',
    upstreamLead: (name) => `上级：${name}`,
    noLead: '未分配上级',
    ratingCount: (count) => `${count}次`,
    deleteTitle: '删除用户',
    addTitle: '添加用户',
    namePlaceholder: '姓名',
    phonePlaceholder: '手机号',
    passwordPlaceholder: '密码',
    regionOptional: '地区（选填）',
    engineerRole: '工程师账号类型 *',
    leadOptional: '上级区域负责人（可后续分配）',
    responsibleRegion: '负责区域（选填）',
    teamName: '团队名（选填）',
    specialtiesLabel: '擅长设备类型 *',
    servicesLabel: '维修项目 *',
    bioPlaceholder: '个人简介（选填）',
    creating: '创建中...',
    createUser: '创建用户',
    deleteFailed: '删除失败: ',
    deleteSlowNotice: '删除请求耗时较长，列表已刷新。请先确认该用户是否还在列表中，再决定是否重试。',
    deleteSuccessNotice: '用户已删除，列表已刷新。',
    confirmDelete: '确认删除用户',
    deleteWarning: '删除后该用户的所有数据（对话、工单、评价等）将被清除，此操作不可恢复。',
    cancel: '取消',
    deleting: '删除中...',
    confirmDeleteButton: '确认删除',
    dismissNotice: '关闭提示',
    previous: '上一页',
    next: '下一页',
  },
};

export function UsersPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const optionLabel = (option) => option[t.optionKey] || option.zh;
  const [type, setType] = useState('customer');
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  // 筛选
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // 添加用户弹窗
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState('customer');
  const [addForm, setAddForm] = useState({
    name: '', phone: '', password: '', region: '',
    engineerRole: 'engineer', regionalLeadId: '', responsibleRegion: '', teamName: '',
    specialties: [], services: [], serviceRegion: '', bio: '',
  });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState('');

  useEffect(() => {
    setPage(1);
  }, [type]);

  const buildFilters = () => {
    const f = {};
    if (search) f.search = search;
    if (type === 'engineer') {
      if (filterStatus) f.status = filterStatus;
      if (filterRegion) f.region = filterRegion;
      if (filterSpecialty) f.specialty = filterSpecialty;
    } else {
      if (filterRegion) f.region = filterRegion;
    }
    return f;
  };

  const loadUsers = () => {
    setLoading(true);
    getAdminUsers(type, page, pageSize, buildFilters())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, [type, page, search, filterStatus, filterRegion, filterSpecialty]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const resetAddForm = () => {
    setAddForm({
      name: '', phone: '', password: '', region: '',
      engineerRole: 'engineer', regionalLeadId: '', responsibleRegion: '', teamName: '',
      specialties: [], services: [], serviceRegion: '', bio: '',
    });
    setAddError('');
    setAddType('customer');
  };

  const handleAdd = async () => {
    setAddError('');
    setAddLoading(true);
    try {
      const payload = { userType: addType, name: addForm.name, phone: addForm.phone, password: addForm.password };
      if (addType === 'customer') {
        payload.region = addForm.region;
      } else {
        payload.specialties = addForm.specialties;
        payload.services = addForm.services;
        payload.serviceRegion = addForm.serviceRegion;
        payload.bio = addForm.bio;
        payload.engineerRole = addForm.engineerRole;
        payload.regionalLeadId = addForm.engineerRole === 'engineer' ? addForm.regionalLeadId : '';
        payload.responsibleRegion = addForm.responsibleRegion;
        payload.teamName = addForm.teamName;
      }
      await createAdminUser(payload);
      setShowAdd(false);
      resetAddForm();
      if (addType === type) {
        loadUsers();
      } else {
        setType(addType);
      }
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteNotice('');
    try {
      await withTimeout(
        deleteAdminUser(deleteTarget.id, type),
        DELETE_TIMEOUT_MS,
        t.deleteSlowNotice,
      );
      setDeleteTarget(null);
      setDeleteNotice(t.deleteSuccessNotice);
      loadUsers();
    } catch (err) {
      if (isTimeoutError(err)) {
        setDeleteTarget(null);
        setDeleteNotice(t.deleteSlowNotice);
        loadUsers();
      } else {
        alert(t.deleteFailed + err.message);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const hasActiveFilters = search || filterStatus || filterRegion || filterSpecialty;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">{t.title}</h2>
        <button
          onClick={() => { resetAddForm(); setShowAdd(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          {t.addUser}
        </button>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'customer', label: t.customer },
          { key: 'engineer', label: t.engineer },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setType(tab.key); setSearch(''); setFilterStatus(''); setFilterRegion(''); setFilterSpecialty(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              type === tab.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 搜索和筛选栏 */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
            hasActiveFilters
              ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10'
              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          <Filter size={16} />
          {t.filter}
        </button>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-3 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
          {/* 派工状态（仅内部工程师） */}
          {type === 'engineer' && (
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t.dispatchStatus}</label>
              <div className="flex gap-1">
                {[{ value: '', label: t.all }, ...Object.keys(STATUS_MAP).map((k) => ({ value: k, label: t.statuses[k] }))].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilterStatus(opt.value); setPage(1); }}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      filterStatus === opt.value
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 设备类型（仅工程师） */}
          {type === 'engineer' && (
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t.equipmentType}</label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => { setFilterSpecialty(''); setPage(1); }}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    !filterSpecialty
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {t.all}
                </button>
                {DEVICE_TYPES.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => { setFilterSpecialty(d.value); setPage(1); }}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      filterSpecialty === d.value
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {optionLabel(d)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 地区 */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t.region}</label>
            <input
              type="text"
              placeholder={type === 'engineer' ? t.serviceRegion : t.customerRegion}
              value={filterRegion}
              onChange={(e) => { setFilterRegion(e.target.value); setPage(1); }}
              className="px-3 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-xs w-40 focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={() => { setSearch(''); setFilterStatus(''); setFilterRegion(''); setFilterSpecialty(''); setPage(1); }}
                className="px-2.5 py-1 rounded text-xs text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
              >
                {t.clearFilters}
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">{t.loading}</div>
      ) : (
        <>
          {deleteNotice && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              <span>{deleteNotice}</span>
              <button
                onClick={() => setDeleteNotice('')}
                className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                aria-label={t.dismissNotice}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="text-xs text-[var(--color-text-muted)] mb-2">{t.total(data.total)}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.no}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.name}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.company}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.phone}</th>
                  {type === 'customer' ? (
                    <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.region}</th>
                  ) : (
                    <>
                      <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.dispatchStatus}</th>
                      <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.roleTeam}</th>
                      <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.specialty}</th>
                      <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.rating}</th>
                    </>
                  )}
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.createdAt}</th>
                  <th className="text-right py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.action}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-[var(--color-text-muted)]">
                      {hasActiveFilters ? t.emptyFiltered : t.empty}
                    </td>
                  </tr>
                ) : (
                  data.list.map((user) => (
                    <tr key={user.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50">
                      <td className="py-3 px-2 font-mono text-[var(--color-text-secondary)]">{user.user_no}</td>
                      <td className="py-3 px-2">{user.name}</td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)]">{user.company || '-'}</td>
                      <td className="py-3 px-2 font-mono">{user.phone}</td>
                      {type === 'customer' ? (
                        <td className="py-3 px-2 text-[var(--color-text-secondary)]">{user.region || '-'}</td>
                      ) : (
                        <>
                          <td className="py-3 px-2">
                            {(() => {
                              const s = STATUS_MAP[user.status] || { color: 'var(--color-text-muted)' };
                              return (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                  <span>{t.statuses[user.status] || user.status}</span>
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-2">
                            <div>{user.engineer_role === 'regional_lead' ? t.regionalLead : t.engineer}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              {user.engineer_role === 'regional_lead'
                                ? (user.responsible_region || user.service_region || '-')
                                : (user.regional_lead_name ? t.upstreamLead(user.regional_lead_name) : t.noLead)}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex flex-wrap gap-1">
                              {(user.specialties || []).map((s, i) => (
                                <span key={i} className="px-2 py-0.5 text-xs rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            {user.rating_count > 0
                              ? `${(user.rating_technical || 0).toFixed(1)} (${t.ratingCount(user.rating_count)})`
                              : '-'}
                          </td>
                        </>
                      )}
                      <td className="py-3 px-2 text-[var(--color-text-secondary)]">
                        {user.created_at?.slice(0, 10)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
                          title={t.deleteTitle}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors"
              >
                {t.previous}
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors"
              >
                {t.next}
              </button>
            </div>
          )}
        </>
      )}

      {/* 添加用户弹窗 */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAdd(false)} />
          <div className="relative w-[calc(100vw-32px)] max-w-md max-h-[85vh] overflow-auto bg-[var(--color-surface)] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="text-base font-medium">{t.addTitle}</h2>
              <button onClick={() => setShowAdd(false)} className="p-2 rounded-lg hover:bg-[var(--color-surface-elevated)]">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {addError && (
                <div className="px-3 py-2 rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm">{addError}</div>
              )}

              <div className="flex gap-2">
                {['customer', 'engineer'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setAddType(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      addType === t
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {t === 'customer' ? (TEXT[runtimeConfig.locale] || TEXT.en).customer : (TEXT[runtimeConfig.locale] || TEXT.en).engineer}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder={t.namePlaceholder}
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
              <input
                type="tel"
                placeholder={t.phonePlaceholder}
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
              <input
                type="password"
                placeholder={t.passwordPlaceholder}
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />

              {addType === 'customer' ? (
                <input
                  type="text"
                  placeholder={t.regionOptional}
                  value={addForm.region}
                  onChange={(e) => setAddForm({ ...addForm, region: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              ) : (
                <>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">{t.engineerRole}</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'engineer', label: t.engineer },
                        { value: 'regional_lead', label: t.regionalLead },
                      ].map((role) => (
                        <button
                          key={role.value}
                          onClick={() => setAddForm({ ...addForm, engineerRole: role.value, regionalLeadId: role.value === 'regional_lead' ? '' : addForm.regionalLeadId })}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            addForm.engineerRole === role.value
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                          }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {addForm.engineerRole === 'engineer' && (
                    <select
                      value={addForm.regionalLeadId}
                      onChange={(e) => setAddForm({ ...addForm, regionalLeadId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    >
                      <option value="">{t.leadOptional}</option>
                      {(data.list || [])
                        .filter((user) => user.engineer_role === 'regional_lead')
                        .map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {lead.name}{lead.responsible_region || lead.service_region ? ` · ${lead.responsible_region || lead.service_region}` : ''}
                          </option>
                        ))}
                    </select>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder={t.responsibleRegion}
                      value={addForm.responsibleRegion}
                      onChange={(e) => setAddForm({ ...addForm, responsibleRegion: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <input
                      type="text"
                      placeholder={t.teamName}
                      value={addForm.teamName}
                      onChange={(e) => setAddForm({ ...addForm, teamName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">{t.specialtiesLabel}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DEVICE_TYPES.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => setAddForm({ ...addForm, specialties: addForm.specialties.includes(d.value) ? addForm.specialties.filter(v => v !== d.value) : [...addForm.specialties, d.value] })}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            addForm.specialties.includes(d.value)
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                          }`}
                        >
                          {optionLabel(d)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">{t.servicesLabel}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_SERVICES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setAddForm({ ...addForm, services: addForm.services.includes(s.value) ? addForm.services.filter(v => v !== s.value) : [...addForm.services, s.value] })}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            addForm.services.includes(s.value)
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                          }`}
                        >
                          {optionLabel(s)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder={t.serviceRegion}
                    value={addForm.serviceRegion}
                    onChange={(e) => setAddForm({ ...addForm, serviceRegion: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                  <textarea
                    placeholder={t.bioPlaceholder}
                    value={addForm.bio}
                    onChange={(e) => setAddForm({ ...addForm, bio: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none"
                  />
                </>
              )}

              <button
                onClick={handleAdd}
                disabled={addLoading || !addForm.name || !addForm.phone || !addForm.password}
                className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {addLoading ? t.creating : t.createUser}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => { if (!deleteLoading) setDeleteTarget(null); }} />
          <div className="relative w-[calc(100vw-32px)] max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-error)]/15 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-[var(--color-error)]" />
            </div>
            <h3 className="text-base font-medium mb-2">{t.confirmDelete}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">
              {deleteTarget.name}（{deleteTarget.user_no}）
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-6">
              {t.deleteWarning}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleteLoading ? t.deleting : t.confirmDeleteButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
