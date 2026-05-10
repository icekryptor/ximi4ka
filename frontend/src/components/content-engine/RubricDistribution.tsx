import { DashboardUnit, DashboardRubric, StageKey } from '../../api/contentEngine'

interface Props {
  units: Record<StageKey, DashboardUnit[]>
  rubrics: DashboardRubric[]
}

// Active stages (excludes published & rejected — those are end-of-life)
const ACTIVE_STAGES: StageKey[] = [
  'ideas', 'triage_needs_work', 'excellent',
  'planning', 'scripting', 'voiceover_prep', 'production',
]

export function RubricDistribution({ units, rubrics }: Props) {
  // Count active units per rubric title (rubric is a string in DashboardUnit)
  const counts = new Map<string, number>()
  for (const stage of ACTIVE_STAGES) {
    for (const u of units[stage] ?? []) {
      const key = u.rubric ?? 'Без рубрики'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  if (sorted.length === 0) return null

  const max = sorted[0][1]
  const emojiByTitle = new Map(rubrics.map(r => [r.title, r.emoji]))

  return (
    <div className="rounded-2xl border border-brand-border bg-card p-4">
      <h2 className="text-sm font-semibold text-brand-text mb-3">
        Распределение по рубрикам · top 8
      </h2>
      <ul className="space-y-2">
        {sorted.map(([title, n]) => {
          const emoji = emojiByTitle.get(title) ?? '·'
          const pct = max > 0 ? (n / max) * 100 : 0
          return (
            <li key={title} className="flex items-center gap-3">
              <span className="text-sm w-6 text-center shrink-0">{emoji}</span>
              <span className="text-sm text-brand-text flex-1 truncate min-w-0">{title}</span>
              <div className="flex-1 max-w-[180px] h-2 rounded-full bg-subtle overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-mono text-brand-text-secondary w-8 text-right shrink-0">
                {n}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
