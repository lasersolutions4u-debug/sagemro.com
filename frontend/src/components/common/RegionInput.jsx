import { useState, useRef, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { searchDivisions } from '../../data/administrativeDivisions.js';

export function RegionInput({ label, value = [], onChange, placeholder = '输入地区名称搜索...' }) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.length >= 1) {
      setSuggestions(searchDivisions(val));
      setShowDropdown(true);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const addRegion = (item) => {
    const fullName = item.fullName;
    if (!value.includes(fullName)) {
      onChange([...value, fullName]);
    }
    setInputValue('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  const removeRegion = (region) => {
    onChange(value.filter(r => r !== region));
  };

  return (
    <div ref={dropdownRef} className="relative">
      {label && (
        <label className="block text-xs font-medium mb-2">{label}</label>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((region) => (
            <span
              key={region}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[var(--color-primary)] text-white"
            >
              <MapPin size={12} />
              {region}
              <button
                type="button"
                onClick={() => removeRegion(region)}
                className="hover:opacity-70"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.length >= 1 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full px-3 py-1.5 text-sm border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-lg bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] placeholder:text-xs"
        />
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((item, idx) => (
            <button
              key={`${item.level}-${item.name}-${idx}`}
              type="button"
              onClick={() => addRegion(item)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-primary)]/10 dark:hover:bg-[var(--color-primary)]/20 flex items-center gap-2"
            >
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                item.level === 'province' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                item.level === 'city' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {item.level === 'province' ? '省' : item.level === 'city' ? '市' : '区'}
              </span>
              <span className="flex-1">{item.name}</span>
              {item.level === 'district' && (
                <span className="text-xs text-[var(--color-text-secondary)]">{item.parent}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {showDropdown && suggestions.length === 0 && inputValue.length >= 1 && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] border border-[var(--color-border)] dark:border-[var(--color-border-strong)] rounded-lg shadow-lg p-3 text-sm text-[var(--color-text-secondary)]">
          未找到匹配的地区，请尝试其他关键词
        </div>
      )}
    </div>
  );
}
