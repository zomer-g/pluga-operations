import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatDateTimeShort } from '@/lib/utils';

interface InlineEditCellProps {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'datetime-local' | 'select';
  options?: { value: string; label: string }[];
  isEditing: boolean;
  onStartEdit: () => void;
  placeholder?: string;
  className?: string;
}

export function InlineEditCell({
  value,
  onSave,
  type = 'text',
  options,
  isEditing,
  onStartEdit,
  placeholder,
  className,
}: InlineEditCellProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    onSave(draft);
  };

  const handleCancel = () => {
    setDraft(value);
    onSave(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!isEditing) {
    const displayValue =
      type === 'datetime-local' && value
        ? formatDateTimeShort(value)
        : type === 'select' && options
          ? options.find((o) => o.value === value)?.label ?? value
          : value;

    return (
      <div
        className={cn(
          'min-h-[44px] flex items-center px-2 cursor-pointer hover:bg-muted/50 rounded transition-colors',
          className
        )}
        onClick={onStartEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onStartEdit();
        }}
      >
        <span className={cn('text-sm truncate', !displayValue && 'text-muted-foreground')}>
          {displayValue || placeholder || '-'}
        </span>
      </div>
    );
  }

  if (type === 'select' && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onSave(e.target.value);
        }}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          'h-11 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
          className
        )}
      >
        <option value="">{placeholder || 'בחר...'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        'h-11 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
        className
      )}
    />
  );
}
