import { DashboardStats } from '../../api/contentEngine'

interface Props {
  stats: DashboardStats
}

const METRICS: Array<{ key: keyof Pick<DashboardStats, 'total_units' | 'total_publications' | 'published_total' | 'scheduled_total'>; label: string; emoji: string }> = [
  { key: 'total_units', label: 'SKU всего', emoji: '📦' },
  { key: 'total_publications', label: 'В плане публикаций', emoji: '🗓' },
  { key: 'published_total', label: 'Опубликовано', emoji: '🚀' },
  { key: 'scheduled_total', label: 'Запланировано', emoji: '⏳' },
]

export function MetricsRow({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {METRICS.map((m) => (
        <div key={m.key} className="rounded-2xl border border-brand-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-brand-text-secondary">
            {m.emoji} {m.label}
          </div>
          <div className="text-2xl font-bold text-brand-text mt-1">{stats[m.key]}</div>
        </div>
      ))}
    </div>
  )
}
