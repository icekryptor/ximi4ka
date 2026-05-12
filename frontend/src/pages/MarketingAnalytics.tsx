import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { BarChart3 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { marketingAnalyticsApi } from '../api/marketingAnalytics'
import { publishChannelsApi } from '../api/publishChannels'
import { icpSegmentsApi } from '../api/icpSegments'
import { strategicThemesApi } from '../api/strategicThemes'
import { rubricsApi, CONTENT_TYPE_LABELS } from '../api/contentBank'
import type { ContentRubric } from '../api/contentBank'
import type {
  AnalyticsGroupBy,
  AnalyticsResponse,
  AnalyticsFilters,
  PublishChannel,
  IcpSegment,
  StrategicTheme,
} from '../api/types'

const GROUP_BY_LABELS: Record<AnalyticsGroupBy, string> = {
  content_type: 'Тип контента',
  channel_id: 'Канал',
  rubric_id: 'Рубрика',
  target_segment_id: 'ICP-сегмент',
  theme_id: 'Тема',
}

function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return String(e.response.data.error)
  return fallback
}

export default function MarketingAnalytics() {
  const toast = useToast()
  const [filters, setFilters] = useState<AnalyticsFilters>({ group_by: 'content_type' })
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const [channels, setChannels] = useState<PublishChannel[]>([])
  const [segments, setSegments] = useState<IcpSegment[]>([])
  const [themes, setThemes] = useState<StrategicTheme[]>([])
  const [rubrics, setRubrics] = useState<ContentRubric[]>([])

  // Load dictionaries once
  useEffect(() => {
    Promise.all([
      publishChannelsApi.getAll(),
      icpSegmentsApi.getAll(),
      strategicThemesApi.getAll(),
      rubricsApi.getAll(),
    ])
      .then(([ch, sg, th, ru]) => {
        setChannels(ch)
        setSegments(sg)
        setThemes(th)
        setRubrics(ru)
      })
      .catch((e) => toast.error(errorMessage(e, 'Ошибка загрузки справочников')))
  }, [])

  // Fetch analytics on filter change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    marketingAnalyticsApi
      .fetch(filters)
      .then((r) => {
        if (!cancelled) {
          setData(r)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoading(false)
          toast.error(errorMessage(e, 'Ошибка загрузки аналитики'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [JSON.stringify(filters)])

  // Resolver: group_key → human label
  const labelForGroup = useMemo(() => {
    return (key: string | null): string => {
      if (!key) return '— не задано —'
      switch (filters.group_by) {
        case 'content_type':
          return CONTENT_TYPE_LABELS[key as keyof typeof CONTENT_TYPE_LABELS] ?? key
        case 'channel_id':
          return channels.find((c) => c.id === key)?.display_name ?? key.slice(0, 8)
        case 'rubric_id':
          return rubrics.find((r) => r.id === key)?.title ?? key.slice(0, 8)
        case 'target_segment_id':
          return segments.find((s) => s.id === key)?.name ?? key.slice(0, 8)
        case 'theme_id':
          return themes.find((t) => t.id === key)?.name ?? key.slice(0, 8)
        default:
          return key
      }
    }
  }, [filters.group_by, channels, rubrics, segments, themes])

  const totalPublications = data?.rows.reduce((s, r) => s + r.publications, 0) ?? 0
  const totalViews = data?.rows.reduce((s, r) => s + r.views, 0) ?? 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-brand-text">Маркетинг-аналитика</h1>
        </div>
        <p className="text-sm text-brand-text-secondary">
          Per-publication метрики, агрегированные по выбранному измерению. Снимки обновляются вручную из «Метрики» в карточке публикации.
        </p>
      </header>

      {/* Filter bar */}
      <div className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs text-brand-text-secondary">Группировка</span>
          <select
            className="input mt-1"
            value={filters.group_by ?? 'content_type'}
            onChange={(e) => setFilters({ ...filters, group_by: e.target.value as AnalyticsGroupBy })}
            aria-label="Группировка"
          >
            {(Object.entries(GROUP_BY_LABELS) as Array<[AnalyticsGroupBy, string]>).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Тип контента (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.content_type ?? ''}
            onChange={(e) => setFilters({ ...filters, content_type: e.target.value || undefined })}
            aria-label="Фильтр: тип контента"
          >
            <option value="">— все —</option>
            {(Object.entries(CONTENT_TYPE_LABELS) as Array<[string, string]>).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Канал (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.channel_id ?? ''}
            onChange={(e) => setFilters({ ...filters, channel_id: e.target.value || undefined })}
            aria-label="Фильтр: канал"
          >
            <option value="">— все —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>{c.display_name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Рубрика (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.rubric_id ?? ''}
            onChange={(e) => setFilters({ ...filters, rubric_id: e.target.value || undefined })}
            aria-label="Фильтр: рубрика"
          >
            <option value="">— все —</option>
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">ICP-сегмент (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.target_segment_id ?? ''}
            onChange={(e) => setFilters({ ...filters, target_segment_id: e.target.value || undefined })}
            aria-label="Фильтр: ICP-сегмент"
          >
            <option value="">— все —</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Тема (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.theme_id ?? ''}
            onChange={(e) => setFilters({ ...filters, theme_id: e.target.value || undefined })}
            aria-label="Фильтр: тема"
          >
            <option value="">— все —</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Период с</span>
          <input
            type="date"
            className="input mt-1"
            value={filters.period_start?.slice(0, 10) ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                period_start: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
            aria-label="Период с"
          />
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Период по</span>
          <input
            type="date"
            className="input mt-1"
            value={filters.period_end?.slice(0, 10) ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                period_end: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
            aria-label="Период по"
          />
        </label>

        <button
          type="button"
          onClick={() => setFilters({ group_by: filters.group_by ?? 'content_type' })}
          className="btn btn-secondary self-end text-sm"
        >
          Сбросить фильтры
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card p-3">
          <div className="text-xs text-brand-text-secondary">Публикаций</div>
          <div className="text-2xl font-bold text-brand-text tabular-nums">{totalPublications}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-brand-text-secondary">Просмотров (сумма)</div>
          <div className="text-2xl font-bold text-brand-text tabular-nums">
            {new Intl.NumberFormat('ru-RU').format(totalViews)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-brand-text-secondary">Группировка</div>
          <div className="text-lg font-semibold text-brand-text">
            {GROUP_BY_LABELS[filters.group_by ?? 'content_type']}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-brand-text-secondary">Срезов</div>
          <div className="text-2xl font-bold text-brand-text tabular-nums">{data?.rows.length ?? 0}</div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading && <p className="p-4 text-sm text-brand-text-secondary">Загрузка…</p>}
        {!loading && (data?.rows.length ?? 0) === 0 && (
          <p className="p-4 text-sm text-brand-text-secondary">
            Нет данных для выбранных фильтров. Введи снимки метрик в «Метрики» на публикациях.
          </p>
        )}
        {!loading && (data?.rows.length ?? 0) > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-brand-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">{GROUP_BY_LABELS[filters.group_by ?? 'content_type']}</th>
                <th className="px-3 py-2 text-right">Публикаций</th>
                <th className="px-3 py-2 text-right">👁</th>
                <th className="px-3 py-2 text-right">❤️</th>
                <th className="px-3 py-2 text-right">💬</th>
                <th className="px-3 py-2 text-right">↗</th>
                <th className="px-3 py-2 text-right">💾</th>
                <th className="px-3 py-2 text-right">→ Профиль</th>
                <th className="px-3 py-2 text-right">→ Маркет</th>
              </tr>
            </thead>
            <tbody>
              {data!.rows.map((r) => (
                <tr key={r.group_key ?? '__null__'} className="border-t">
                  <td className="px-3 py-2">{labelForGroup(r.group_key)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.publications}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.views}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.likes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.comments}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.shares}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.saves}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.profile_clicks}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.marketplace_clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
