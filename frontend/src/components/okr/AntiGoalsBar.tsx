interface Props {
  antiGoals: string[]
}

export function AntiGoalsBar({ antiGoals }: Props) {
  if (antiGoals.length === 0) {
    return (
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-card/80 backdrop-blur border-b border-brand-border text-xs text-brand-text-secondary">
        Anti-goals для квартала не заданы
      </div>
    )
  }
  return (
    <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-amber-50/95 backdrop-blur border-b border-amber-200 dark:bg-amber-950/60 dark:border-amber-900">
      <div className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5">
        Anti-goals
      </div>
      <ul className="space-y-0.5">
        {antiGoals.map((g, i) => (
          <li key={i} className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <span aria-hidden>🚫</span>
            <span>{g}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
