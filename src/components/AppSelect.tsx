import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
};

type AppSelectProps = {
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
};

type MenuPosition = { top: number; left: number; width: number };

/** A consistent dropdown that is not limited by the browser's native select UI. */
export function AppSelect({
  value,
  options,
  onChange,
  id,
  ariaLabel,
  disabled = false,
  placeholder = 'Tanlang',
  className = '',
  triggerClassName = '',
}: AppSelectProps) {
  const generatedId = useId();
  const selectId = id ?? `app-select-${generatedId}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const selectedOption = options.find((option) => option.value === value);

  const updateMenuPosition = useCallback(() => {
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const availableBelow = window.innerHeight - bounds.bottom - 12;
    const estimatedHeight = Math.min(312, Math.max(88, options.length * 48 + 12));
    const opensUpward = availableBelow < estimatedHeight && bounds.top > availableBelow;
    setMenuPosition({
      left: Math.max(12, Math.min(bounds.left, window.innerWidth - bounds.width - 12)),
      top: opensUpward ? Math.max(12, bounds.top - estimatedHeight - 8) : bounds.bottom + 8,
      width: Math.min(bounds.width, window.innerWidth - 24),
    });
  }, [options.length]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [close, open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    const firstEnabledIndex = options.findIndex((option) => !option.disabled);
    const focusIndex = selectedIndex >= 0 ? selectedIndex : firstEnabledIndex;
    if (focusIndex >= 0) requestAnimationFrame(() => optionRefs.current[focusIndex]?.focus());
  }, [open, options, value]);

  const choose = (option: AppSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const focusAdjacentOption = (currentIndex: number, direction: 1 | -1) => {
    if (!options.some((option) => !option.disabled)) return;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const candidate = (currentIndex + direction * offset + options.length) % options.length;
      if (!options[candidate].disabled) {
        optionRefs.current[candidate]?.focus();
        return;
      }
    }
  };

  return (
    <div className={`app-select ${className}`}>
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        className={`app-select-trigger ${open ? 'app-select-trigger-open' : ''} ${triggerClassName}`}
      >
        <span className={selectedOption ? 'truncate' : 'truncate text-slate-400'}>{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-600' : ''}`} />
      </button>

      {open && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-labelledby={selectId}
          className="app-select-menu"
          style={menuPosition}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                ref={(element) => { optionRefs.current[options.indexOf(option)] = element; }}
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onClick={() => choose(option)}
                onKeyDown={(event) => {
                  const index = options.indexOf(option);
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusAdjacentOption(index, 1);
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusAdjacentOption(index, -1);
                  } else if (event.key === 'Home') {
                    event.preventDefault();
                    const first = options.findIndex((entry) => !entry.disabled);
                    if (first >= 0) optionRefs.current[first]?.focus();
                  } else if (event.key === 'End') {
                    event.preventDefault();
                    const last = options.map((entry, entryIndex) => ({ entry, entryIndex })).reverse().find(({ entry }) => !entry.disabled)?.entryIndex;
                    if (last !== undefined) optionRefs.current[last]?.focus();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    close();
                    triggerRef.current?.focus();
                  }
                }}
                className={`app-select-option ${selected ? 'app-select-option-selected' : ''}`}
              >
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate">{option.label}</span>
                  {option.description && <span className="mt-0.5 block truncate text-xs font-medium text-slate-400">{option.description}</span>}
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
