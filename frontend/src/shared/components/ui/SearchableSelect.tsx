import { useId, useMemo, useState } from 'react';

export interface SearchableOption {
  value: string | number;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  label,
  placeholder = 'Filter options...',
  options,
  value,
  onChange,
  disabled = false,
}: {
  label?: string;
  placeholder?: string;
  options: SearchableOption[];
  value: string | number | '';
  onChange: (nextValue: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q)) ||
        String(o.value) === String(value)
    );
  }, [options, query, value]);

  return (
    <div className="apid-field">
      {label && <label htmlFor={listId}>{label}</label>}
      <input
        type="text"
        className="apid-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />
      <select
        id={listId}
        className="apid-input"
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select...</option>
        {filtered.map((opt) => (
          <option key={opt.value} value={String(opt.value)} disabled={opt.disabled}>
            {opt.label}
            {opt.hint ? ` (${opt.hint})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

