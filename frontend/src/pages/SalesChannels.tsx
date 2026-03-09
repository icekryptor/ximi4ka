import { useEffect, useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, Search, Store, Percent, TruckIcon, Warehouse } from 'lucide-react'
import {
  channelsApi,
  SalesChannel,
  MarketplaceType,
  MARKETPLACE_LABELS,
} from '../api/channels'
import { useToast } from '../App'

const pct = (v: number) => `${Number(v).toFixed(1)}%`
const rub = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(v)

const SalesChannels = () => {
  const { showToast } = useToast()
  const [channels, setChannels] = useState<SalesChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<SalesChannel | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<Partial<SalesChannel>>({})

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try { setLoading(true); setChannels(await channelsApi.getAll()) }
    catch (e) { console.error('Ошибка загрузки каналов:', e) }
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    try {
      if (editing) await channelsApi.update(editing.id, form)
      else await channelsApi.create(form)
      setIsFormOpen(false); setEditing(null); setForm({}); loadData()
    } catch { showToast('Не удалось сохранить канал', 'error') }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить канал продаж?')) return
    try { await channelsApi.delete(id); setChannels(prev => prev.filter(c => c.id !== id)) }
    catch { showToast('Не удалось удалить канал', 'error') }
  }

  const openEdit = (ch: SalesChannel) => { setEditing(ch); setForm(ch); setIsFormOpen(true) }
  const openAdd = () => { setEditing(null); setForm({ marketplace_type: MarketplaceType.OZON, is_active: true, commission_pct: 0, logistics_cost: 0, storage_cost: 0, ad_spend_pct: 0, return_rate_pct: 0 }); setIsFormOpen(true) }

  const filtered = useMemo(() =>
    channels.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())),
  [channels, search])

  if (loading) return (
    <div className="p-8"><div className="space-y-4"><div className="skeleton h-8 w-1/4" /><div className="skeleton h-64" /></div></div>
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Каналы продаж</h1>
          <p className="text-gray-600 mt-1">Маркетплейсы и параметры комиссий</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" /><span>Добавить</span>
        </button>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Поиск по названию…" className="input pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">Каналы не найдены</p>
          <button onClick={openAdd} className="btn btn-primary">Добавить канал</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((ch, index) => (
            <div key={ch.id} className="card-hover stagger-item relative group" style={{ animationDelay: `${index * 60}ms` }}>
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(ch)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(ch.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Store className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{ch.name}</h3>
                  <span className="text-xs text-gray-500">{MARKETPLACE_LABELS[ch.marketplace_type]}</span>
                </div>
                {!ch.is_active && <span className="ml-auto px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Неактивен</span>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Percent className="h-4 w-4 text-orange-400 shrink-0" />
                  <span>Комиссия: <b>{pct(ch.commission_pct)}</b></span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <TruckIcon className="h-4 w-4 text-blue-400 shrink-0" />
                  <span>Логистика: <b>{rub(ch.logistics_cost)}</b></span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Warehouse className="h-4 w-4 text-green-400 shrink-0" />
                  <span>Хранение: <b>{rub(ch.storage_cost)}</b></span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Percent className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>Реклама: <b>{pct(ch.ad_spend_pct)}</b></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline form modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsFormOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-modal animate-scale-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? 'Редактировать канал' : 'Новый канал'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input className="input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип маркетплейса</label>
                <select className="input" value={form.marketplace_type || ''} onChange={e => setForm(f => ({ ...f, marketplace_type: e.target.value as MarketplaceType }))}>
                  {Object.entries(MARKETPLACE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Комиссия %</label>
                  <input type="number" step="0.1" className="input" value={form.commission_pct ?? ''} onChange={e => setForm(f => ({ ...f, commission_pct: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Логистика ₽</label>
                  <input type="number" step="0.01" className="input" value={form.logistics_cost ?? ''} onChange={e => setForm(f => ({ ...f, logistics_cost: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Хранение ₽</label>
                  <input type="number" step="0.01" className="input" value={form.storage_cost ?? ''} onChange={e => setForm(f => ({ ...f, storage_cost: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Реклама %</label>
                  <input type="number" step="0.1" className="input" value={form.ad_spend_pct ?? ''} onChange={e => setForm(f => ({ ...f, ad_spend_pct: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Возврат %</label>
                  <input type="number" step="0.1" className="input" value={form.return_rate_pct ?? ''} onChange={e => setForm(f => ({ ...f, return_rate_pct: +e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <label className="text-sm text-gray-700">Активен</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="btn" onClick={() => setIsFormOpen(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={handleSave}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesChannels
