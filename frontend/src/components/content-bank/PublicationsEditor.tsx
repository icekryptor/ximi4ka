import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  ContentPublication,
  publicationsApi,
} from '../../api/contentBank'
import { getNetworkDef, KNOWN_NETWORKS } from '../../lib/networks'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  unitId: string
  publications: ContentPublication[]
  onChange: (next: ContentPublication[]) => void
}

export function PublicationsEditor({ unitId, publications, onChange }: Props) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [newNetwork, setNewNetwork] = useState('')

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
          </div>
        )
      })}
    </div>
  )
}
