import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, ClipboardList, ChevronRight, Package, Calendar, Hash } from 'lucide-react'
import {
  ordersApi,
  ProductionOrder,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  OrderStats,
} from '../api/orders'
import { kitsApi, Kit } from '../api/kits'
import { channelsApi, SalesChannel } from '../api/channels'
import { useToast } from '../App'

const rub = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(v)

const STATUS_FLOW: OrderStatus[] = [
  OrderStatus.CREATED,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.QC,
  OrderStatus.PACKING,
  OrderStatus.READY,
  OrderStatus.SHIPPED,
  OrderStatus.AT_MARKETPLACE,
]

const ProductionOrders = () => {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [stats, setStats] = useState<OrderStats[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [channels, setChannels] = useState<SalesChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<Partial<ProductionOrder>>({})

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [o, s, k, c] = await Promise.all([
        ordersApi.getAll(),
        ordersApi.stats(),
        kitsApi.getAll(),
        channelsApi.getAll(),
      ])
      setOrders(o); setStats(s); setKits(k); setChannels(c)
    } catch (e) { console.error('Ошибка загрузки заказов:', e) }
    finally { setLoading(false) }
  }

  const advanceStatus = async (order: ProductionOrder) => {
    const idx = STATUS_FLOW.indexOf(order.status)
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return
    const next = STATUS_FLOW[idx + 1]
    try {
      await ordersApi.updateStatus(order.id, next)
      loadData()
    } catch { showToast('Не удалось обновить статус', 'error') }
  }

  const handleCreate = async () => {
    try {
      await ordersApi.create(form)
      setIsFormOpen(false); setForm({}); loadData()
    } catch { showToast('Не удалось создать заказ', 'error') }
  }

  const filtered = useMemo(() =>
    orders.filter(o => {
      if (statusFilter && o.status !== statusFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return o.order_number?.toLowerCase().includes(q) ||
        o.kit?.name?.toLowerCase().includes(q) ||
        o.channel?.name?.toLowerCase().includes(q)
    }),
  [orders, search, statusFilter])

  if (loading) return (
    <div className="p-8"><div className="space-y-4"><div className="skeleton h-8 w-1/4" /><div className="skeleton h-64" /></div></div>
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Заказы на производство</h1>
          <p className="text-gray-600 mt-1">FBO-логистика и статусы</p>
        </div>
        <button onClick={() => { setForm({ quantity: 1 }); setIsFormOpen(true) }} className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" /><span>Новый заказ</span>
        </button>
      </div>

      {/* Stats badges */}
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!statusFilter ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Все ({orders.length})
          </button>
          {stats.map(s => (
            <button
              key={s.status}
              onClick={() => setStatusFilter(s.status === statusFilter ? '' : s.status)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                s.status === statusFilter
                  ? ORDER_STATUS_COLORS[s.status].replace('bg-', 'bg-').replace('100', '200')
                  : ORDER_STATUS_COLORS[s.status]
              }`}
            >
              {ORDER_STATUS_LABELS[s.status]} ({s.count})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Поиск по номеру, набору, каналу…" className="input pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Order list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Заказы не найдены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order, index) => {
            const canAdvance = STATUS_FLOW.indexOf(order.status) >= 0 && STATUS_FLOW.indexOf(order.status) < STATUS_FLOW.length - 1 && order.status !== OrderStatus.CANCELLED
            return (
              <div key={order.id} className="card-hover stagger-item" style={{ animationDelay: `${index * 60}ms` }}>
                <div className="flex items-center gap-4">
                  {/* Order number & Kit */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="h-4 w-4 text-gray-400" />
                      <span className="font-mono text-sm font-semibold text-gray-900">{order.order_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{order.kit?.name || '—'}</span>
                      <span>× {order.quantity} шт.</span>
                      {order.channel && <span className="text-gray-400">→ {order.channel.name}</span>}
                    </div>
                  </div>

                  {/* Dates & Cost */}
                  <div className="text-right text-sm shrink-0">
                    {order.target_date && (
                      <div className="flex items-center gap-1 text-gray-500 justify-end">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(order.target_date).toLocaleDateString('ru-RU')}</span>
                      </div>
                    )}
                    <div className="text-gray-700 font-medium">{rub(order.planned_cost)}</div>
                  </div>

                  {/* QC indicators */}
                  {(order.qc_passed > 0 || order.qc_failed > 0) && (
                    <div className="flex gap-2 text-xs shrink-0">
                      <span className="px-2 py-1 bg-green-50 text-green-700 rounded">✓ {order.qc_passed}</span>
                      {order.qc_failed > 0 && <span className="px-2 py-1 bg-red-50 text-red-700 rounded">✗ {order.qc_failed}</span>}
                    </div>
                  )}

                  {/* Advance button */}
                  {canAdvance && (
                    <button
                      onClick={() => advanceStatus(order)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors shrink-0"
                      title={`Перевести → ${ORDER_STATUS_LABELS[STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1]]}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span className="hidden sm:inline">{ORDER_STATUS_LABELS[STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1]]}</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create form modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsFormOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-modal animate-scale-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Новый заказ на производство</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Набор (SKU)</label>
                <select className="input" value={form.kit_id || ''} onChange={e => setForm(f => ({ ...f, kit_id: e.target.value }))}>
                  <option value="">Выберите набор</option>
                  {kits.filter(k => k.is_active).map(k => <option key={k.id} value={k.id}>{k.name} {k.sku ? `(${k.sku})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
                <input type="number" min="1" className="input" value={form.quantity ?? 1} onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Целевой канал</label>
                <select className="input" value={form.channel_id || ''} onChange={e => setForm(f => ({ ...f, channel_id: e.target.value || undefined }))}>
                  <option value="">—</option>
                  {channels.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Целевая дата</label>
                <input type="date" className="input" value={form.target_date || ''} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
                <textarea className="input" rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="btn" onClick={() => setIsFormOpen(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.kit_id}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductionOrders
