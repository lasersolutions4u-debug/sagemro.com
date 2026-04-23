import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Search, Filter } from 'lucide-react';
import { getAdminUsers, createAdminUser, deleteAdminUser } from '../services/api';

const DEVICE_TYPES = [
  '激光切割机', '折弯机', '冲床', '焊接机', '激光焊接',
  '卷板机', '等离子切割', '水刀切割', '剪板机', '其他'
];

const COMMON_SERVICES = [
  '激光器维修', '切割头维护', '导轨润滑', '参数调试',
  '液压维修', '电气排查', '设备保养', '系统升级',
  '年度维保', '应急抢修', '培训指导', '配件供应'
];

const STATUS_MAP = {
  available: { label: '可接单', color: 'var(--color-success)' },
  paused: { label: '暂停', color: 'var(--color-warning)' },
  offline: { label: '离线', color: 'var(--color-text-muted)' },
};

export function UsersPage() {
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
    specialties: [], services: [], serviceRegion: '', bio: '',
  });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    setAddForm({ name: '', phone: '', password: '', region: '', specialties: [], services: [], serviceRegion: '', bio: '' });
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
    try {
      await deleteAdminUser(deleteTarget.id, type);
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      alert('删除失败: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const hasActiveFilters = search || filterStatus || filterRegion || filterSpecialty;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">用户管理</h2>
        <button
          onClick={() => { resetAddForm(); setShowAdd(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          添加用户
        </button>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'customer', label: '客户' },
          { key: 'engineer', label: '工程师' },
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
            placeholder="搜索姓名、公司名或手机号..."
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
          筛选
        </button>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-3 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
          {/* 接单状态（仅工程师） */}
          {type === 'engineer' && (
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">接单状态</label>
              <div className="flex gap-1">
                {[{ value: '', label: '全部' }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))].map((opt) => (
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
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">设备类型</label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => { setFilterSpecialty(''); setPage(1); }}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    !filterSpecialty
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  全部
                </button>
                {DEVICE_TYPES.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setFilterSpecialty(d); setPage(1); }}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      filterSpecialty === d
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 地区 */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">地区</label>
            <input
              type="text"
              placeholder={type === 'engineer' ? '服务地区' : '客户地区'}
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
                清除筛选
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">加载中...</div>
      ) : (
        <>
          <div className="text-xs text-[var(--color-text-muted)] mb-2">共 {data.total} 条记录</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">编号</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">姓名</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">公司名</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">手机号</th>
                  {type === 'customer' ? (
                    <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">地区</th>
                  ) : (
                    <>
                      <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">接单状态</th>
                      <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">专长</th>
                      <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">评分</th>
                    </>
                  )}
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">注册时间</th>
                  <th className="text-right py-3 px-2 text-[var(--color-text-secondary)] font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-[var(--color-text-muted)]">
                      {hasActiveFilters ? '没有符合条件的用户' : '暂无数据'}
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
                              const s = STATUS_MAP[user.status] || { label: user.status, color: 'var(--color-text-muted)' };
                              return (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                  <span>{s.label}</span>
                                </span>
                              );
                            })()}
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
                              ? `${(user.rating_technical || 0).toFixed(1)} (${user.rating_count}次)`
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
                          title="删除用户"
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
                上一页
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors"
              >
                下一页
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
              <h2 className="text-base font-medium">添加用户</h2>
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
                    {t === 'customer' ? '客户' : '工程师'}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="姓名"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
              <input
                type="tel"
                placeholder="手机号"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
              <input
                type="password"
                placeholder="密码"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />

              {addType === 'customer' ? (
                <input
                  type="text"
                  placeholder="地区（选填）"
                  value={addForm.region}
                  onChange={(e) => setAddForm({ ...addForm, region: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              ) : (
                <>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">擅长设备类型 *</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DEVICE_TYPES.map((d) => (
                        <button
                          key={d}
                          onClick={() => setAddForm({ ...addForm, specialties: addForm.specialties.includes(d) ? addForm.specialties.filter(v => v !== d) : [...addForm.specialties, d] })}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            addForm.specialties.includes(d)
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">维修项目 *</label>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_SERVICES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setAddForm({ ...addForm, services: addForm.services.includes(s) ? addForm.services.filter(v => v !== s) : [...addForm.services, s] })}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            addForm.services.includes(s)
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="服务地区（选填）"
                    value={addForm.serviceRegion}
                    onChange={(e) => setAddForm({ ...addForm, serviceRegion: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                  <textarea
                    placeholder="个人简介（选填）"
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
                {addLoading ? '创建中...' : '创建用户'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-[calc(100vw-32px)] max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-error)]/15 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-[var(--color-error)]" />
            </div>
            <h3 className="text-base font-medium mb-2">确认删除用户</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">
              {deleteTarget.name}（{deleteTarget.user_no}）
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-6">
              删除后该用户的所有数据（对话、工单、评价等）将被清除，此操作不可恢复。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleteLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
