import { useState, useEffect, useCallback } from 'react'
import { Plus, Settings } from 'lucide-react'
import { unitsApi, ContentUnit, STATUS_LABELS, CONTENT_TYPE_LABELS } from '../api/contentBank'
import { useToast } from '../contexts/ToastContext'

export default function ContentBank() {
  const toast = useToast()
  const [items, setItems] = useState<ContentUnit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await unitsApi.list({ limit: 200 })
      setItems(r.data)
      setTotal(r.pagination.total)
    } catch {
      toast.error('Ошибка загрузки контент-банка')
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-brand-text">Контент-банк</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary flex items-center gap-2">
            <Settings size={16} />
            <span className="hidden sm:inline">Рубрики</span>
          </button>
          <button className="btn btn-primary flex items-center gap-2">
            <Plus size={16} />
            <span>Добавить</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-brand-text-secondary">Нет единиц контента</div>
      ) : (
        <div className="bg-card rounded-2xl border border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Рубрика
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Статус
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Тип
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">
                    Название / Hook
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">Сети</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-b border-brand-border hover:bg-subtle">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {u.rubric ? (
                        <span>
                          {u.rubric.emoji} {u.rubric.title}
                        </span>
                      ) : (
                        <span className="text-brand-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {STATUS_LABELS[u.status]}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {CONTENT_TYPE_LABELS[u.content_type]}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-brand-text max-w-[400px] truncate">
                        {u.title}
                      </div>
                      {u.hook && u.hook !== u.title && (
                        <div className="text-xs text-brand-text-secondary max-w-[400px] truncate">
                          {u.hook}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.publications.map((p) => (
                          <span
                            key={p.id}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-subtle text-brand-text-secondary"
                          >
                            {p.network}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-brand-border text-xs text-brand-text-secondary">
            Показано {items.length} из {total}
          </div>
        </div>
      )}
    </div>
  )
}
