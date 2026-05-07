import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { KNOWN_NETWORKS, getNetworkDef } from '../../lib/networks'

interface Props {
  selected: string[]
  onChange: (next: string[]) => void
  allowCustom?: boolean
  size?: 'sm' | 'md'
}

export function NetworkChips({ selected, onChange, allowCustom = true, size = 'md' }: Props) {
  const [adding, setAdding] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v))
    else onChange([...selected, v])
  }

  const addCustom = () => {
    const v = customValue.trim().toLowerCase()
    if (v && !selected.includes(v)) onChange([...selected, v])
    setCustomValue('')
    setAdding(false)
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'

  // Show: known networks as chips, plus any custom values from `selected` not in KNOWN
  const customSelected = selected.filter((s) => !KNOWN_NETWORKS.find((k) => k.value === s))

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {KNOWN_NETWORKS.map((n) => {
        const active = selected.includes(n.value)
        const Icon = n.icon
        return (
          <button
            key={n.value}
            type="button"
            onClick={() => toggle(n.value)}
            className={`${px} rounded-full border transition-colors flex items-center gap-1 ${
              active
                ? 'border-primary-400 text-white'
                : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
            }`}
            style={active ? { backgroundColor: n.color } : undefined}
          >
            {Icon ? <Icon width={12} height={12} /> : null}
            {n.label}
          </button>
        )
      })}
      {customSelected.map((v) => {
        const def = getNetworkDef(v)
        return (
          <span
            key={v}
            className={`${px} rounded-full border bg-subtle border-brand-border text-brand-text-secondary flex items-center gap-1`}
          >
            {def.label}
            <button type="button" onClick={() => toggle(v)} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        )
      })}
      {allowCustom && (
        adding ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              onBlur={addCustom}
              placeholder="свой тег"
              className={`${px} rounded-full border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 max-w-[100px]`}
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`${px} rounded-full border border-dashed border-brand-border text-brand-text-secondary hover:border-primary-400 flex items-center gap-1`}
          >
            <Plus size={10} /> свой тег
          </button>
        )
      )}
    </div>
  )
}
