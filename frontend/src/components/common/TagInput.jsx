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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#f59e0b] text-white"
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
          className="w-full px-3 py-1.5 text-sm border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-lg bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b] placeholder:text-xs"
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
                  ? 'bg-[#f59e0b] text-white'
                  : 'bg-[#f4f3f4] dark:bg-[#2a2a3c] text-[#6b6375] hover:border-[#f59e0b] border border-transparent hover:text-[#f59e0b]'
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
