import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, GraduationCap, Loader2, Sparkles } from 'lucide-react'
import { StylePattern, stylePatternsApi } from '../../api/stylePatterns'
import { BlueprintContentType } from '../../api/contentEngine'
import { errorMessage } from '../marketing/utils'

// ─── Секция «Обучение стиля» ─────────────────────────────────────────────────
// Read-only свод накопленных Writer'ом правил стиля по формату. Правила пишет
// агент через MCP (learn_from_edit → save_style_patterns); здесь только показ.

const DEFAULT_FORMAT = 'short_post'

// Цвет-тон по префиксу кода правила (А — аудио/ритм, С — структура/лексика,
// Э — узкие уточнения). Мягкая визуальная группировка.
const codeTone = (code: string): string => {
  const first = code.trim().charAt(0).toUpperCase()
  if (first === 'А' || first === 'A') return 'bg-sky-100 text-sky-700'
  if (first === 'С' || first === 'C') return 'bg-violet-100 text-violet-700'
  if (first === 'Э' || first === 'E') return 'bg-amber-100 text-amber-700'
  return 'bg-muted text-brand-text-secondary'
}

interface StyleLearningSectionProps {
  contentTypes: BlueprintContentType[]
}

export const StyleLearningSection = ({ contentTypes }: StyleLearningSectionProps) => {
  const [format, setFormat] = useState<string>(DEFAULT_FORMAT)
  const [patterns, setPatterns] = useState<StylePattern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Список форматов из blueprint contentTypes (+ гарантируем short_post).
  const formats = useMemo(() => {
    const list = contentTypes.map((c) => ({ value: c.type, label: c.displayName || c.type }))
    if (!list.some((f) => f.value === DEFAULT_FORMAT)) {
      list.unshift({ value: DEFAULT_FORMAT, label: 'Короткий пост' })
    }
    return list
  }, [contentTypes])

  const load = async (fmt: string) => {
    setLoading(true)
    setError(null)
    try {
      const r = await stylePatternsApi.list(fmt)
      setPatterns(r.patterns)
    } catch (e) {
      setError(errorMessage(e, 'Не удалось загрузить правила стиля'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(format)
  }, [format])

  // Сигнал сходимости: сколько правил добавлено за последние 7 дней. Мало
  // свежих → стиль почти пойман (ориентир для 0 новых за 2-3 итерации).
  const recentCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return patterns.filter((p) => new Date(p.created_at).getTime() >= weekAgo).length
  }, [patterns])

  const lastAt = useMemo(() => {
    if (patterns.length === 0) return null
    const max = patterns.reduce((acc, p) => {
      const t = new Date(p.created_at).getTime()
      return t > acc ? t : acc
    }, 0)
    return max ? new Date(max) : null
  }, [patterns])

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div>
            <h2 className="text-lg font-semibold text-brand-text">Обучение стиля</h2>
            <p className="mt-0.5 text-sm text-brand-text-secondary">
              Свод правил, которые Writer накопил из правок копирайтера. Применяются при генерации
              автоматически.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-brand-text-secondary">Формат</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded-lg border border-brand-border bg-card px-2.5 py-1.5 text-sm text-brand-text focus:border-primary-300 focus:outline-none"
          >
            {formats.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Счётчик + сигнал сходимости */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary-100 px-2.5 py-1 font-semibold text-primary-700">
          Правил: {patterns.length}
        </span>
        {patterns.length > 0 && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-brand-text-secondary">
            За 7 дней: +{recentCount}
          </span>
        )}
        {lastAt && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-brand-text-secondary">
            Последнее: {lastAt.toLocaleDateString('ru-RU')}
          </span>
        )}
        {patterns.length > 0 && recentCount === 0 && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" /> +0 новых за 7 дней — стиль почти пойман
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-brand-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка правил…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-brand-text-secondary">{error}</p>
          <button type="button" onClick={() => void load(format)} className="btn btn-secondary">
            Повторить
          </button>
        </div>
      ) : patterns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-brand-text-secondary">
            Правил пока нет — появятся после первых правок через агента (learn_from_edit →
            save_style_patterns).
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-xs text-brand-text-secondary">
                <th className="px-2 py-2 font-medium">Код</th>
                <th className="px-2 py-2 font-medium">Правило</th>
                <th className="px-2 py-2 font-medium">Было → стало</th>
                <th className="px-2 py-2 font-medium">Обоснование</th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((p) => (
                <tr key={p.id} className="border-b border-brand-border/60 align-top">
                  <td className="px-2 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${codeTone(
                        p.code,
                      )}`}
                    >
                      {p.code}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 font-medium text-brand-text">{p.title}</td>
                  <td className="px-2 py-2.5 text-brand-text-secondary">
                    {p.before || p.after ? (
                      <span className="flex flex-col gap-1">
                        {p.before && <span className="text-rose-600/90 line-through">{p.before}</span>}
                        {p.after && (
                          <span className="flex items-start gap-1 text-emerald-700">
                            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {p.after}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-brand-text-secondary/50">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-brand-text-secondary">{p.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
