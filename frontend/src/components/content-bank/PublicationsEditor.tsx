import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  ContentPublication,
  publicationsApi,
} from '../../api/contentBank'
import { publishChannelsApi } from '../../api/publishChannels'
import { metricSnapshotsApi } from '../../api/metricSnapshots'
import type { ContentMetricSnapshot, PublishChannel } from '../../api/types'
import { getNetworkDef, KNOWN_NETWORKS } from '../../lib/networks'
import { useToast } from '../../contexts/ToastContext'
import { MetricsModal } from './MetricsModal'

interface Props {
  unitId: string
  publications: ContentPublication[]
  onChange: (next: ContentPublication[]) => void
}

export function PublicationsEditor({ unitId, publications, onChange }: Props) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [newNetwork, setNewNetwork] = useState('')
  const [channels, setChannels] = useState<PublishChannel[]>([])
  const [metricsModalFor, setMetricsModalFor] = useState<string | null>(null)
  const [latestByPub, setLatestByPub] = useState<Record<string, ContentMetricSnapshot | null>>({})

  useEffect(() => {
    publishChannelsApi.getAll().then(setChannels).catch(() => {})
  }, [])

  // Load latest snapshot per publication on mount + when publications list changes.
  // Single batched round-trip — server returns DISTINCT ON per publication_id.
  useEffect(() => {
    let cancelled = false
    if (publications.length === 0) return
    metricSnapshotsApi
      .latestForPublications(publications.map((p) => p.id))
      .then((map) => {
        if (cancelled) return
        const result: Record<string, ContentMetricSnapshot | null> = {}
        for (const pub of publications) result[pub.id] = map[pub.id] ?? null
        setLatestByPub(result)
      })
      .catch(() => {
        if (!cancelled) setLatestByPub({})
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publications.map((p) => p.id).join(',')])

  const channelForRow = (p: ContentPublication): PublishChannel | null => {
    if (p.channel_id) return channels.find((c) => c.id === p.channel_id) ?? null
    return channels.find((c) => c.slug === p.network) ?? null
  }

  const addPublication = async (network: string) => {
    if (!network) return
    if (publications.find((p) => p.network === network)) {
      toast.error('Эта соцсеть уже добавлена')
      return
    }
    try {
      const created = await publicationsApi.create({
        content_unit_id: unitId,
        network,
      })
      onChange([...publications, created])
      setAdding(false)
      setNewNetwork('')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка добавления')
    }
  }

  const updateField = async (
    pub: ContentPublication,
    patch: Partial<ContentPublication>,
  ) => {
    // Optimistic update
    const next = publications.map((p) => (p.id === pub.id ? { ...p, ...patch } : p))
    onChange(next)
    try {
      await publicationsApi.update(pub.id, patch)
    } catch {
      toast.error('Ошибка сохранения')
      onChange(publications) // rollback
    }
  }

  const remove = async (pub: ContentPublication) => {
    if (!confirm(`Удалить публикацию в ${getNetworkDef(pub.network).label}?`)) return
    try {
      await publicationsApi.delete(pub.id)
      onChange(publications.filter((p) => p.id !== pub.id))
    } catch {
      toast.error('Ошибка удаления')
    }
  }

  const availableNetworks = KNOWN_NETWORKS.filter(
    (n) => !publications.find((p) => p.network === n.value),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-brand-text">Публикации</h4>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs px-2 py-1 rounded-lg border border-brand-border text-primary-600 hover:border-primary-400"
          >
            + Добавить публикацию
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-subtle p-3 rounded-xl space-y-2">
          <p className="text-xs text-brand-text-secondary">Выбери соцсеть или введи свою:</p>
          <div className="flex gap-1 flex-wrap">
            {availableNetworks.map((n) => (
              <button
                key={n.value}
                type="button"
                onClick={() => addPublication(n.value)}
                className="px-2.5 py-1 text-xs rounded-full border border-brand-border bg-card hover:border-primary-300"
              >
                {n.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newNetwork}
              onChange={(e) => setNewNetwork(e.target.value)}
              placeholder="свой тег (threads, zen…)"
              className="text-xs px-3 py-1.5 rounded-xl border border-brand-border bg-card flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addPublication(newNetwork.trim().toLowerCase())}
            />
            <button
              type="button"
              onClick={() => addPublication(newNetwork.trim().toLowerCase())}
              disabled={!newNetwork.trim()}
              className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-xl disabled:opacity-40"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setNewNetwork('')
              }}
              className="text-xs px-3 py-1.5 text-brand-text-secondary"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {publications.map((p) => {
        const def = getNetworkDef(p.network)
        const Icon = def.icon
        return (
          <div
            key={p.id}
            className="bg-card border border-brand-border rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: def.color }}
              >
                {Icon ? <Icon className="inline w-3 h-3 mr-1" /> : null}
                {def.label}
              </span>
              <button
                type="button"
                onClick={() => remove(p)}
                className="p-1 text-brand-text-secondary hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-brand-text-secondary">Запланировано</label>
                <input
                  type="datetime-local"
                  value={p.scheduled_at ? p.scheduled_at.slice(0, 16) : ''}
                  onChange={(e) =>
                    updateField(p, {
                      scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className="text-xs w-full px-2 py-1.5 rounded-lg border border-brand-border bg-subtle"
                />
              </div>
              <div>
                <label className="text-[10px] text-brand-text-secondary">Опубликовано</label>
                <input
                  type="datetime-local"
                  value={p.published_at ? p.published_at.slice(0, 16) : ''}
                  onChange={(e) =>
                    updateField(p, {
                      published_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className="text-xs w-full px-2 py-1.5 rounded-lg border border-brand-border bg-subtle"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-brand-text-secondary">Ссылка на пост</label>
              <input
                type="url"
                value={p.published_url || ''}
                onChange={(e) => updateField(p, { published_url: e.target.value || null })}
                placeholder="https://..."
                className="text-xs w-full px-2 py-1.5 rounded-lg border border-brand-border bg-subtle"
              />
            </div>
            {(() => {
              const ch = channelForRow(p)
              const canAuto = ch?.integration_status === 'api_connected'
              return (
                <label
                  className="inline-flex items-center gap-2 text-sm"
                  title={canAuto ? '' : 'Канал не настроен для авто-публикации (нужен api_connected)'}
                >
                  <input
                    type="checkbox"
                    disabled={!canAuto}
                    checked={!!p.auto_publish}
                    onChange={(e) => updateField(p, { auto_publish: e.target.checked })}
                    aria-label="Авто-публикация"
                  />
                  <span className={canAuto ? 'text-brand-text' : 'text-brand-text-secondary'}>
                    Авто-публикация
                  </span>
                </label>
              )
            })()}
            {(() => {
              const latest = latestByPub[p.id]
              const formatN = (n: number | null | undefined) =>
                n == null ? '—' : new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(n)
              return (
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMetricsModalFor(p.id)}
                    className="btn btn-secondary text-xs"
                    aria-label="Открыть метрики публикации"
                  >
                    📊 Метрики
                  </button>
                  {latest ? (
                    <span className="text-brand-text-secondary">
                      👁 {formatN(latest.views)} · ❤️ {formatN(latest.likes)} · 💬 {formatN(latest.comments)}
                      {' · '}
                      <span title={new Date(latest.captured_at).toLocaleString('ru-RU')}>
                        {new Date(latest.captured_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </span>
                  ) : (
                    <span className="text-brand-text-secondary">метрики не введены</span>
                  )}
                </div>
              )
            })()}
            {p.publisher_log && (() => {
              const log = p.publisher_log as { success?: boolean; gave_up?: boolean; attempts?: number; last_error?: string | null } | null
              if (!log) return null
              if (log.gave_up) {
                return (
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded bg-red-100 text-red-700"
                    title={log.last_error ?? ''}
                  >
                    ❌ Авто-публикация остановлена
                  </span>
                )
              }
              if ((log.attempts ?? 0) > 0 && !log.success) {
                return (
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700"
                    title={log.last_error ?? ''}
                  >
                    ⚠ Попыток: {log.attempts}
                  </span>
                )
              }
              return null
            })()}
          </div>
        )
      })}

      {metricsModalFor && (
        <MetricsModal
          publicationId={metricsModalFor}
          onClose={() => setMetricsModalFor(null)}
          onSnapshotSaved={(snap) => {
            setLatestByPub((prev) => ({ ...prev, [snap.publication_id]: snap }))
          }}
        />
      )}
    </div>
  )
}
