import { useEffect, useMemo, useState } from 'react'
import { Target, RefreshCw, FileText } from 'lucide-react'
import { brandDocsApi } from '../api/brandDocs'
import { okrStatusApi, OkrStatusDoc } from '../api/okrStatus'
import { parseOkr, ParsedOkr, KrStatus } from '../lib/okr-parser'
import { useToast } from '../contexts/ToastContext'
import { AntiGoalsBar } from '../components/okr/AntiGoalsBar'
import { QuarterSelector } from '../components/okr/QuarterSelector'
import { KrRow } from '../components/okr/KrRow'

const OKR_SLUG = 'okr_2026_2027'

function summary(quarters: ParsedOkr['quarters'], qid: string, statuses: OkrStatusDoc['statuses']) {
  const q = quarters.find((x) => x.id === qid)
  if (!q) return { on_track: 0, at_risk: 0, off_track: 0, done: 0, unknown: 0, total: 0 }
  const all = q.objectives.flatMap((o) => o.krs)
  const counts = { on_track: 0, at_risk: 0, off_track: 0, done: 0, unknown: 0 }
  for (const kr of all) {
    const s = statuses[kr.id]?.status ?? 'unknown'
    counts[s] = (counts[s] ?? 0) + 1
  }
  return { ...counts, total: all.length }
}

export default function OkrPage() {
  const toast = useToast()
  const [okr, setOkr] = useState<ParsedOkr | null>(null)
  const [statusDoc, setStatusDoc] = useState<OkrStatusDoc | null>(null)
  const [selectedQid, setSelectedQid] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busyKrId, setBusyKrId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [doc, statusD] = await Promise.all([
        brandDocsApi.get(OKR_SLUG),
        okrStatusApi.load(),
      ])
      if (!doc || !doc.content) {
        setError(`Документ ${OKR_SLUG} не найден в brand_docs.`)
        return
      }
      const parsed = parseOkr(doc.content)
      if (parsed.quarters.length === 0) {
        setError('Не удалось распарсить OKR. Проверь структуру § 5 «Квартальные OKR».')
        return
      }
      setOkr(parsed)
      setStatusDoc(statusD)
      setSelectedQid(parsed.currentQuarterId ?? parsed.quarters[0].id)
    } catch (e: any) {
      setError(e?.message ?? 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const currentQuarter = useMemo(
    () => okr?.quarters.find((q) => q.id === selectedQid) ?? null,
    [okr, selectedQid],
  )

  const counts = useMemo(
    () => (okr && statusDoc) ? summary(okr.quarters, selectedQid, statusDoc.statuses) : null,
    [okr, statusDoc, selectedQid],
  )

  const handleKrChange = async (krId: string, status: KrStatus, comment?: string) => {
    if (!statusDoc) return
    setBusyKrId(krId)
    const previous = statusDoc
    try {
      // Optimistic update
      const optimisticStatuses = { ...previous.statuses }
      if (status === 'unknown') {
        delete optimisticStatuses[krId]
      } else {
        optimisticStatuses[krId] = {
          status,
          ...(comment !== undefined ? { comment } : {}),
          updated_at: new Date().toISOString(),
        }
      }
      setStatusDoc({ ...previous, statuses: optimisticStatuses })

      // Persist
      const next = status === 'unknown'
        ? await okrStatusApi.clearKrStatus(krId)
        : await okrStatusApi.setKrStatus(krId, status, comment)
      setStatusDoc(next)
      toast.success('Сохранено')
    } catch {
      setStatusDoc(previous)
      toast.error('Не удалось сохранить статус')
    } finally {
      setBusyKrId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
        <div className="h-16 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-brand-text mb-2 flex items-center gap-2">
          <Target className="h-6 w-6 text-primary-600" /> OKR
        </h1>
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      </div>
    )
  }

  if (!okr || !currentQuarter) return null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <header className="mb-4 flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand-text flex items-center gap-2">
            <Target className="h-6 w-6 text-primary-600" /> OKR Химички
          </h1>
          {currentQuarter.focus && (
            <p className="text-sm text-brand-text-secondary mt-1">
              <span className="font-medium">Фокус:</span> {currentQuarter.focus}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <QuarterSelector
            quarters={okr.quarters}
            value={selectedQid}
            onChange={setSelectedQid}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 rounded-lg border border-brand-border hover:bg-subtle"
            title="Обновить"
          >
            <RefreshCw size={16} />
          </button>
          <a
            href="/marketing/strategy"
            className="p-2 rounded-lg border border-brand-border hover:bg-subtle flex items-center gap-1 text-xs"
            title="Открыть OKR-документ в маркетинг-стратегии"
          >
            <FileText size={14} /> MD
          </a>
        </div>
      </header>

      <AntiGoalsBar antiGoals={currentQuarter.antiGoals} />

      <div className="mt-4 space-y-4">
        {currentQuarter.objectives.map((obj) => (
          <section key={obj.id} className="rounded-2xl border border-brand-border bg-card p-4">
            <h2 className="text-base font-semibold text-brand-text mb-2">
              {obj.id.split('-').slice(-1)[0]}. {obj.title}
            </h2>
            <div className="divide-y divide-brand-border">
              {obj.krs.map((kr) => (
                <KrRow
                  key={kr.id}
                  kr={kr}
                  status={statusDoc?.statuses[kr.id]?.status ?? 'unknown'}
                  comment={statusDoc?.statuses[kr.id]?.comment}
                  onChange={handleKrChange}
                  busy={busyKrId === kr.id}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {counts && (
        <div className="mt-6 rounded-2xl border border-brand-border bg-card p-3 flex items-center justify-around text-sm">
          <span>🟢 {counts.on_track}</span>
          <span>🟡 {counts.at_risk}</span>
          <span>🔴 {counts.off_track}</span>
          <span>✅ {counts.done}</span>
          <span>⚪ {counts.unknown}</span>
          <span className="text-brand-text-secondary ml-2">из {counts.total}</span>
        </div>
      )}
    </div>
  )
}
