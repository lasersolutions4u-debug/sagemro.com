import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Edit2, Trash2, ExternalLink, Star, Check, X } from 'lucide-react';
import { getDevice, updateDevice } from '../../services/api';
import { toastError } from '../../utils/feedback';

export function DeviceDetailPanel({ deviceId, onBack, onDelete }) {
  const [device, setDevice] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDevice();
  }, [deviceId]);

  async function loadDevice() {
    try {
      setLoading(true);
      const data = await getDevice(deviceId);
      setDevice(data.device);
      setWorkOrders(data.work_orders || []);
      setNotes(data.device?.notes || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setForm({
      name: device.name || '',
      type: device.type || '',
      brand: device.brand || '',
      model: device.model || '',
      power: device.power || '',
      status: device.status || '正常',
    });
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setForm({});
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateDevice(deviceId, form);
      setDevice(updated.device);
      setEditing(false);
      setForm({});
    } catch (err) {
      toastError('保存失败');
    } finally {
      setSaving(false);
    }
  }

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSaveNotes() {
    setSaving(true);
    try {
      const updated = await updateDevice(deviceId, { notes });
      setDevice(updated.device);
      setEditingNotes(false);
    } catch (err) {
      toastError('保存失败');
    } finally {
      setSaving(false);
    }
  }

  const statusColors = {
    '正常': 'text-green-500',
    '使用中': 'text-yellow-500',
    '维保中': 'text-orange-500'
  };

  const statusDots = {
    '正常': 'bg-green-500',
    '使用中': 'bg-yellow-500',
    '维保中': 'bg-orange-500'
  };

  const urgencyColors = {
    '普通': 'text-gray-400',
    '紧急': 'text-orange-500',
    '非常紧急': 'text-red-500'
  };

  const typeText = {
    '设备故障': '🔧',
    '维护保养': '🛠️',
    '参数调试': '⚙️',
    '其他': '📋'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center py-8 text-[var(--color-text-muted)]">
        设备不存在
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 返回按钮 */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <ArrowLeft size={14} />
        返回设备列表
      </button>

      {/* 设备信息卡 */}
      <div className="bg-[var(--color-surface-elevated)] rounded-xl p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center flex-shrink-0">
              <Package size={24} className="text-[var(--color-primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={form.name}
                  onChange={e => updateForm('name', e.target.value)}
                  className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-2 py-1 text-[15px] font-medium text-[var(--color-text-primary)]"
                  placeholder="设备名称"
                />
              ) : (
                <h3 className="text-[15px] font-medium text-[var(--color-text-primary)] truncate">{device.name}</h3>
              )}
              <div className="flex items-center gap-2 mt-1">
                {editing ? (
                  <select
                    value={form.status}
                    onChange={e => updateForm('status', e.target.value)}
                    className="bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded px-1.5 py-0.5 text-[12px] text-[var(--color-text-primary)]"
                  >
                    <option value="正常">正常</option>
                    <option value="使用中">使用中</option>
                    <option value="维保中">维保中</option>
                  </select>
                ) : (
                  <>
                    <span className={`w-2 h-2 rounded-full ${statusDots[device.status] || 'bg-gray-500'}`} />
                    <span className="text-[12px] text-[var(--color-text-secondary)]">{device.status}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving} className="p-1.5 hover:bg-green-500/10 rounded-lg transition-colors text-green-500" title="保存">
                  <Check size={16} />
                </button>
                <button onClick={cancelEditing} disabled={saving} className="p-1.5 hover:bg-[var(--color-hover)] rounded-lg transition-colors text-[var(--color-text-muted)]" title="取消">
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <button onClick={startEditing} className="p-2 hover:bg-[var(--color-hover)] rounded-lg transition-colors text-[var(--color-text-muted)]" title="编辑设备">
                  <Edit2 size={16} />
                </button>
                <button onClick={onDelete} className="p-2 hover:bg-[var(--color-hover)] rounded-lg transition-colors text-red-400" title="删除设备">
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* 设备属性 */}
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <span className="text-[var(--color-text-muted)]">类型</span>
            {editing ? (
              <input
                value={form.type}
                onChange={e => updateForm('type', e.target.value)}
                className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-2 py-1.5 mt-0.5 text-[var(--color-text-primary)]"
                placeholder="设备类型"
              />
            ) : (
              <p className="text-[var(--color-text-primary)] mt-0.5">{device.type}</p>
            )}
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">品牌</span>
            {editing ? (
              <input
                value={form.brand}
                onChange={e => updateForm('brand', e.target.value)}
                className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-2 py-1.5 mt-0.5 text-[var(--color-text-primary)]"
                placeholder="品牌"
              />
            ) : (
              <p className="text-[var(--color-text-primary)] mt-0.5">{device.brand || '-'}</p>
            )}
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">型号</span>
            {editing ? (
              <input
                value={form.model}
                onChange={e => updateForm('model', e.target.value)}
                className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-2 py-1.5 mt-0.5 text-[var(--color-text-primary)]"
                placeholder="型号"
              />
            ) : (
              <p className="text-[var(--color-text-primary)] mt-0.5">{device.model || '-'}</p>
            )}
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">功率</span>
            {editing ? (
              <input
                value={form.power}
                onChange={e => updateForm('power', e.target.value)}
                className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-2 py-1.5 mt-0.5 text-[var(--color-text-primary)]"
                placeholder="功率"
              />
            ) : (
              <p className="text-[var(--color-text-primary)] mt-0.5">{device.power || '-'}</p>
            )}
          </div>
        </div>

        {/* 备注 */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[var(--color-text-muted)]">备注</span>
            {!editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="flex items-center gap-1 text-[12px] text-[var(--color-primary)] opacity-70 hover:opacity-100"
              >
                <Edit2 size={12} />
                {notes ? '编辑' : '添加备注'}
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="添加备注信息..."
                className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNotes}
                  disabled={saving}
                  className="px-3 py-1 bg-[var(--color-primary)] text-white rounded-lg text-[12px] disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => {
                    setEditingNotes(false);
                    setNotes(device.notes || '');
                  }}
                  className="px-3 py-1 bg-[var(--color-hover)] text-[var(--color-text-secondary)] rounded-lg text-[12px]"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {notes || '暂无备注'}
            </p>
          )}
        </div>

        {/* 添加时间 */}
        <div className="mt-3 text-[12px] text-[var(--color-text-muted)]">
          添加时间：{device.created_at}
        </div>
      </div>

      {/* 维修保养记录 */}
      <div>
        <h4 className="text-[14px] font-medium text-[var(--color-text-primary)] mb-3">
          维修保养记录（{workOrders.length}条）
        </h4>

        {workOrders.length === 0 && (
          <div className="bg-[var(--color-surface-elevated)] rounded-xl p-6 text-center">
            <p className="text-[13px] text-[var(--color-text-muted)]">暂无维修记录</p>
          </div>
        )}

        <div className="space-y-3">
          {workOrders.map((wo) => {
            const totalCost = wo.cost_summary
              ? (wo.cost_summary.labor + wo.cost_summary.parts + wo.cost_summary.travel)
              : null;

            return (
              <div key={wo.id || wo.order_no} className="bg-[var(--color-surface-elevated)] rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                      {typeText[wo.type] || '📋'} {wo.order_no}
                    </span>
                    <span className={`text-[11px] ${urgencyColors[wo.urgency] || 'text-gray-400'}`}>
                      {wo.urgency}
                    </span>
                  </div>
                  <span className={`text-[12px] ${
                    wo.status === '已完成' ? 'text-green-500' :
                    wo.status === '处理中' ? 'text-yellow-500' :
                    'text-[var(--color-text-muted)]'
                  }`}>
                    {wo.status}
                  </span>
                </div>

                <p className="text-[13px] text-[var(--color-text-secondary)] mb-2">
                  {wo.description}
                </p>

                <div className="flex items-center gap-4 text-[12px] text-[var(--color-text-muted)]">
                  {wo.engineer_name && (
                    <span>SAGEMRO 工程师：{wo.engineer_name}</span>
                  )}
                  {wo.rating && (
                    <span className="flex items-center gap-1">
                      <Star size={12} className="text-yellow-500 fill-yellow-500" />
                      {wo.rating}
                    </span>
                  )}
                  {totalCost !== null && totalCost > 0 && (
                    <span className="text-green-500">¥{totalCost}</span>
                  )}
                  <span>{wo.created_at}</span>
                </div>

                {wo.completed_at && (
                  <div className="mt-2 pt-2 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)]">
                    完成时间：{wo.completed_at}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}