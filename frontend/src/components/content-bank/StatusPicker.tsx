import { ContentStatus, STATUS_LABELS } from '../../api/contentBank'

const FLOW_ORDER: ContentStatus[] = ['idea', 'script', 'filming', 'editing', 'ready', 'published']
const REJECTED: ContentStatus = 'rejected'

interface Props {
  value: ContentStatus
  onChange: (s: ContentStatus) => void
}

export function StatusPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        {FLOW_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              value === s
                ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-400 text-primary-700'
                : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange(REJECTED)}
        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
          value === REJECTED
            ? 'bg-red-100 border-red-400 text-red-700'
            : 'bg-card border-brand-border text-brand-text-secondary hover:border-red-300'
        }`}
      >
        {STATUS_LABELS[REJECTED]}
      </button>
    </div>
  )
}
