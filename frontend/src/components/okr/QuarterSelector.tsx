import type { ParsedQuarter } from '../../lib/okr-parser'

interface Props {
  quarters: ParsedQuarter[]
  value: string
  onChange: (id: string) => void
}

export function QuarterSelector({ quarters, value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input text-sm py-1.5 shrink-0"
      title="Выбрать квартал"
    >
      {quarters.map((q) => (
        <option key={q.id} value={q.id}>
          {q.label}
        </option>
      ))}
    </select>
  )
}
