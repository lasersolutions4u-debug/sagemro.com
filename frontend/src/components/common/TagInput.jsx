import { useState } from 'react';
import { X } from 'lucide-react';

export function TagInput({ label, options = [], value = [], onChange, placeholder = '输入并按回车添加...' }) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (tag) => {
    onChange(value.filter(t => t !== tag));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue) {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  const togglePreset = (option) => {
    if (value.includes(option)) {
      removeTag(option);
    } else {
      addTag(option);
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium mb-2">{label}</label>
      )}

      {/* 已选标签 */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[var(--color-primary)] text-white"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:opacity-70"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 自填输入框 */}
      <div className="mb-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-1.5 text-sm border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-lg bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] placeholder:text-xs"
        />
      </div>

      {/* 预设选项 */}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => togglePreset(option)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                value.includes(option)
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-hover)] dark:bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] border border-transparent hover:text-[var(--color-primary)]'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
