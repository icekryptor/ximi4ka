import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { contentEngineApi, DashboardData, StageKey } from '../api/contentEngine'
import { MetricsRow } from '../components/content-engine/MetricsRow'
import { PipelineRow } from '../components/content-engine/PipelineRow'
import { StageDrawer } from '../components/content-engine/StageDrawer'
import { TodayQueue } from '../components/content-engine/TodayQueue'
import { Bottlenecks } from '../components/content-engine/Bottlenecks'
import { RubricDistribution } from '../components/content-engine/RubricDistribution'
import { RecentPublished } from '../components/content-engine/RecentPublished'

export default function ContentEngine() {
  const toast = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [openStage, setOpenStage] = useState<StageKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const r = await contentEngineApi.stats()
      setData(r)
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Не удалось загрузить дашборд'
      setError(msg)
      // Show toast only on initial load failure; silent retry on poll failures
      if (!data) toast.error(msg)
    } finally {
      setFetching(false)
      setLoading(false)
    }
  }, [data, toast])

  // Initial load
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 30s polling, paused when tab hidden
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) refresh()
    }
    const timer = setInterval(tick, 30000)
    const onVisibility = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-brand-text-secondary">{error ?? 'Нет данных'}</p>
        <button onClick={refresh} className="btn btn-primary">Повторить</button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-text">📊 Контент-движок · Химичка</h1>
          <p className="text-sm text-brand-text-secondary mt-1">Операционный пульт</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-brand-text-secondary">
          <span
            className={
              'inline-block w-2 h-2 rounded-full ' +
              (fetching ? 'bg-primary-500 animate-pulse' : 'bg-green-500')
            }
            aria-label={fetching ? 'Обновляется' : 'Актуально'}
          />
          <span>Обновлено: {new Date(data.generated_at).toLocaleTimeString('ru-RU')}</span>
          <button
            onClick={refresh}
            disabled={fetching}
            className="ml-2 flex items-center gap-1 px-2 py-1 rounded-lg border border-brand-border hover:bg-subtle disabled:opacity-50"
          >
            <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} /> Обновить
          </button>
        </div>
      </div>

      {error && data && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          ⚠️ {error} (показаны последние известные данные)
        </div>
      )}

      <MetricsRow stats={data.stats} />
      <Bottlenecks counts={data.stats.counts} />
      <TodayQueue queue={data.today_queue} />
      <PipelineRow
        counts={data.stats.counts}
        openStage={openStage}
        onStageClick={(s: StageKey) => setOpenStage(openStage === s ? null : s)}
      />
      {openStage && (
        <StageDrawer
          stage={openStage}
          units={data.buckets[openStage] ?? []}
          onClose={() => setOpenStage(null)}
        />
      )}
      <RubricDistribution units={data.buckets} rubrics={data.rubrics} />
      <RecentPublished items={data.recent_published} />

      <div className="text-center text-xs text-brand-text-secondary pt-6 border-t border-brand-border">
        Snapshot: {new Date(data.generated_at).toLocaleString('ru-RU')} · content-engine-stats
      </div>
    </div>
  )
}
