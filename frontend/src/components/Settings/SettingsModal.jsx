import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';

export function SettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState({
    nickname: '',
    company: '',
    device_model: '',
    theme: 'system',
  });

  // 从 localStorage 加载设置
  useEffect(() => {
    const stored = localStorage.getItem('sagemro_settings');
    if (stored) {
      setSettings(JSON.parse(stored));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('sagemro_settings', JSON.stringify(settings));
    onClose();
  };

  const themeOptions = [
    { value: 'light', label: '浅色模式' },
    { value: 'dark', label: '深色模式' },
    { value: 'system', label: '跟随系统' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="设置" size="lg">
      <div className="space-y-4">
        {/* 用户名 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            用户名
          </label>
          <input
            type="text"
            value={settings.nickname}
            onChange={(e) => setSettings({ ...settings, nickname: e.target.value })}
            placeholder="张工"
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
          />
        </div>

        {/* 公司名称 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            公司名称
          </label>
          <input
            type="text"
            value={settings.company}
            onChange={(e) => setSettings({ ...settings, company: e.target.value })}
            placeholder="XX金属制品有限公司"
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
          />
        </div>

        {/* 常用设备型号 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            常用设备型号
          </label>
          <input
            type="text"
            value={settings.device_model}
            onChange={(e) => setSettings({ ...settings, device_model: e.target.value })}
            placeholder="3000W光纤激光切割机"
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
          />
        </div>

        {/* 外观模式 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">
            外观模式
          </label>
          <div className="flex gap-3">
            {themeOptions.map((opt) => (
              <label
                key={opt.value}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-colors ${
                  settings.theme === opt.value
                    ? 'border-[#f59e0b] bg-[#f59e0b]/10 text-[#f59e0b]'
                    : 'border-[#e5e4e7] dark:border-[#3a3a4c] text-[#6b6375]'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={opt.value}
                  checked={settings.theme === opt.value}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                  className="sr-only"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] text-white rounded-xl font-medium transition-colors"
        >
          保存设置
        </button>
      </div>
    </Modal>
  );
}
