import { useEffect, useRef, useState } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  label: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Optional shorter label for the closed-state button when nothing selected. */
  placeholder?: string
}

/**
 * Compact multi-select dropdown: pill-shaped trigger that opens a checkbox
 * list popover. Used in the content-bank filter bar to replace the wide
 * FilterChipBar for content_type and network.
 *
 * Trigger displays:
 *   {label} ▾                    — nothing selected
 *   {label}: N ▾                 — 1+ selected (count badge)
 */
export function MultiSelectDropdown({ label, options, selected, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (value: string) => {
    const set = new Set(selected)
    if (set.has(value)) set.delete(value)
    else set.add(value)
    onChange(Array.from(set))
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const hasSelection = selected.length > 0

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ' +
          (hasSelection
            ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300'
            : 'bg-card border-brand-border text-brand-text hover:bg-subtle')
        }
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span>{label}</span>
        {hasSelection ? (
          <>
            <span className="font-semibold">{selected.length}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={clear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onChange([])
                }
              }}
              className="text-xs hover:text-red-600"
              title="Сбросить"
              aria-label={`Сбросить фильтр ${label}`}
            >
              ✕
            </span>
          </>
        ) : (
          placeholder && <span className="text-brand-text-secondary text-xs">{placeholder}</span>
        )}
        <span className={'transition-transform text-xs ' + (open ? 'rotate-180' : '')}>▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 w-64 max-h-80 overflow-y-auto bg-card border border-brand-border rounded-xl shadow-lg z-20 py-1"
          role="listbox"
        >
          {options.map((opt) => {
            const isChecked = selected.includes(opt.value)
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-subtle cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(opt.value)}
                  className="rounded"
                />
                <span className="flex-1 truncate">{opt.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
