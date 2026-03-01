import { useEffect, useState } from 'react'
import { marketplaceApi } from '../api/marketplace'
import {
  MarketplaceSale,
  MarketplaceAnalytics,
  MarketplaceType,
  SkuMapping,
} from '../api/types'
import {
  ShoppingBag,
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  BarChart3,
  Package,
  X,
} from 'lucide-react'

type Tab = 'wildberries' | 'website' | 'skus'

const currentYear = new Date().getFullYear()

const Marketplace = () => {
  const [tab, setTab] = useState<Tab>('wildberries')
  const [loading, setLoading] = useState(false)

  // Analytics
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`)
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [analytics, setAnalytics] = useState<MarketplaceAnalytics | null>(null)

  // Sales list for management
  const [sales, setSales] = useState<MarketplaceSale[]>([])

  // SKU mappings
  const [skuMappings, setSkuMappings] = useState<SkuMapping[]>([])

  // Sale modal
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<MarketplaceSale | null>(null)

  // SKU modal
  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false)
  const [editingSku, setEditingSku] = useState<SkuMapping | null>(null)

  useEffect(() => {
    loadData()
  }, [tab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (tab === 'skus') {
        const data = await marketplaceApi.getSkuMappings()
        setSkuMappings(data)
      } else {
        const mp = tab === 'wildberries' ? 'wildberries' : 'website'
        const [analyticsData, salesData] = await Promise.all([
          marketplaceApi.getAnalytics(mp, { startDate, endDate }),
          marketplaceApi.getSales({ marketplace: mp, startDate, endDate }),
        ])
        setAnalytics(analyticsData)
        setSales(salesData)
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount)

  const handleDeleteSale = async (id: string) => {
    if (!window.confirm('Удалить запись?')) return
    try {
      await marketplaceApi.deleteSale(id)
      loadData()
    } catch (error) {
      alert('Ошибка удаления')
    }
  }

  const handleDeleteSku = async (id: string) => {
    if (!window.confirm('Удалить артикул?')) return
    try {
      await marketplaceApi.deleteSkuMapping(id)
      setSkuMappings(skuMappings.filter((s) => s.id !== id))
    } catch (error) {
      alert('Ошибка удаления')
    }
  }

  const renderAnalytics = () => {
    if (!analytics) return null
    const t = analytics.totals

    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Начало</label>
              <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Конец</label>
              <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <button onClick={loadData} className="btn btn-primary">Обновить</button>
            <button
              onClick={() => { setEditingSale(null); setIsSaleModalOpen(true) }}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Добавить</span>
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-sm text-brand-text-secondary">Заказы</p>
            <p className="text-2xl font-bold text-brand-text">{t.orders}</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-brand-text-secondary">Выкупы</p>
            <p className="text-2xl font-bold text-brand-text">{t.buyouts}</p>
            <p className="text-xs text-brand-text-secondary">{t.buyoutRate}% выкупность</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-brand-text-secondary">Выручка</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(t.revenue)}</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-brand-text-secondary">К выплате</p>
            <p className="text-2xl font-bold text-primary-600">{formatCurrency(t.payout)}</p>
          </div>
        </div>

        {/* Costs breakdown */}
        <div className="card">
          <h3 className="text-lg font-bold text-brand-text mb-3">Структура расходов</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tab === 'wildberries' ? (
              <>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-amber-600">Комиссия</p>
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(t.commission)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-red-600">Логистика</p>
                  <p className="text-lg font-bold text-red-700">{formatCurrency(t.logistics)}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-orange-600">Хранение</p>
                  <p className="text-lg font-bold text-orange-700">{formatCurrency(t.storage)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-600">Прочее</p>
                  <p className="text-lg font-bold text-gray-700">{formatCurrency(t.other)}</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-red-600">Логистика</p>
                  <p className="text-lg font-bold text-red-700">{formatCurrency(t.logistics)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-amber-600">Эквайринг</p>
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(t.acquiring)}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* By SKU table */}
        {analytics.bySku.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-bold text-brand-text mb-3">По артикулам</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-surface">
                  <tr>
                    <th className="py-2 px-3 text-left font-medium">Артикул</th>
                    <th className="py-2 px-3 text-left font-medium">Товар</th>
                    <th className="py-2 px-3 text-right font-medium">Заказы</th>
                    <th className="py-2 px-3 text-right font-medium">Выкупы</th>
                    <th className="py-2 px-3 text-right font-medium">Выручка</th>
                    <th className="py-2 px-3 text-right font-medium">К выплате</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.bySku.map((row) => (
                    <tr key={row.sku} className="border-t border-gray-100">
                      <td className="py-2 px-3 font-medium">{row.sku}</td>
                      <td className="py-2 px-3 text-brand-text-secondary">{row.product_name}</td>
                      <td className="py-2 px-3 text-right">{row.orders}</td>
                      <td className="py-2 px-3 text-right">{row.buyouts}</td>
                      <td className="py-2 px-3 text-right font-medium text-green-600">{formatCurrency(row.revenue)}</td>
                      <td className="py-2 px-3 text-right font-medium text-primary-600">{formatCurrency(row.payout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sales table */}
        <div className="card">
          <h3 className="text-lg font-bold text-brand-text mb-3">Записи ({sales.length})</h3>
          <div className="overflow-x-auto">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-surface sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-medium">Дата</th>
                    <th className="py-2 px-3 text-left text-xs font-medium">Артикул</th>
                    <th className="py-2 px-3 text-right text-xs font-medium">Заказы</th>
                    <th className="py-2 px-3 text-right text-xs font-medium">Выкупы</th>
                    <th className="py-2 px-3 text-right text-xs font-medium">Выручка</th>
                    <th className="py-2 px-3 text-right text-xs font-medium">К выплате</th>
                    <th className="py-2 px-3 text-center text-xs font-medium w-20">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 whitespace-nowrap">{sale.date}</td>
                      <td className="py-2 px-3 font-medium">{sale.sku}</td>
                      <td className="py-2 px-3 text-right">{sale.orders_count}</td>
                      <td className="py-2 px-3 text-right">{sale.buyouts_count}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency(sale.revenue)}</td>
                      <td className="py-2 px-3 text-right text-primary-600">{formatCurrency(sale.payout)}</td>
                      <td className="py-2 px-3">
                        <div className="flex justify-center space-x-1">
                          <button
                            onClick={() => { setEditingSale(sale); setIsSaleModalOpen(true) }}
                            className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderSkus = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-brand-text">Артикулы маркетплейсов</h3>
          <button
            onClick={() => { setEditingSku(null); setIsSkuModalOpen(true) }}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Добавить</span>
          </button>
        </div>
      </div>

      <div className="card">
        {skuMappings.length === 0 ? (
          <p className="text-center text-brand-text-secondary py-8">Нет артикулов</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand-surface">
              <tr>
                <th className="py-2 px-3 text-left font-medium">Артикул МП</th>
                <th className="py-2 px-3 text-left font-medium">Название товара</th>
                <th className="py-2 px-3 text-left font-medium">Набор</th>
                <th className="py-2 px-3 text-center font-medium w-20">Действия</th>
              </tr>
            </thead>
            <tbody>
              {skuMappings.map((sku) => (
                <tr key={sku.id} className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium">{sku.marketplace_sku}</td>
                  <td className="py-2 px-3">{sku.product_name}</td>
                  <td className="py-2 px-3 text-brand-text-secondary">{sku.kit?.name || '—'}</td>
                  <td className="py-2 px-3">
                    <div className="flex justify-center space-x-1">
                      <button
                        onClick={() => { setEditingSku(sku); setIsSkuModalOpen(true) }}
                        className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSku(sku.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Маркетплейсы</h1>
        <p className="text-gray-600 mt-1">Аналитика продаж на площадках</p>
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex space-x-2">
          {([
            { key: 'wildberries' as Tab, label: 'Wildberries', icon: ShoppingBag },
            { key: 'website' as Tab, label: 'Сайт', icon: TrendingUp },
            { key: 'skus' as Tab, label: 'Артикулы', icon: Package },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                tab === t.key
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-brand-text-secondary">Загрузка...</p>
        </div>
      ) : (
        <>
          {(tab === 'wildberries' || tab === 'website') && renderAnalytics()}
          {tab === 'skus' && renderSkus()}
        </>
      )}

      {/* Sale Modal */}
      {isSaleModalOpen && (
        <SaleModal
          sale={editingSale}
          marketplace={tab === 'website' ? MarketplaceType.WEBSITE : MarketplaceType.WILDBERRIES}
          onClose={() => { setIsSaleModalOpen(false); setEditingSale(null); loadData() }}
        />
      )}

      {/* SKU Modal */}
      {isSkuModalOpen && (
        <SkuModal
          sku={editingSku}
          onClose={() => { setIsSkuModalOpen(false); setEditingSku(null); loadData() }}
        />
      )}
    </div>
  )
}

// ===== Sale Modal Component =====
const SaleModal = ({
  sale,
  marketplace,
  onClose,
}: {
  sale: MarketplaceSale | null;
  marketplace: MarketplaceType;
  onClose: () => void;
}) => {
  const isWB = marketplace === MarketplaceType.WILDBERRIES
  const [formData, setFormData] = useState({
    marketplace,
    date: sale?.date || new Date().toISOString().split('T')[0],
    sku: sale?.sku || '',
    product_name: sale?.product_name || '',
    orders_count: sale?.orders_count || 0,
    buyouts_count: sale?.buyouts_count || 0,
    revenue: sale?.revenue || 0,
    commission: sale?.commission || 0,
    commission_rate: sale?.commission_rate || 28.5,
    logistics_cost: sale?.logistics_cost || 0,
    storage_cost: sale?.storage_cost || 0,
    other_costs: sale?.other_costs || 0,
    acquiring_cost: sale?.acquiring_cost || 0,
    notes: sale?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const payout = isWB
    ? formData.revenue - formData.commission - formData.logistics_cost - formData.storage_cost - formData.other_costs
    : formData.revenue - formData.logistics_cost - formData.acquiring_cost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.sku || !formData.date) {
      alert('Укажите артикул и дату')
      return
    }
    setSaving(true)
    try {
      const payload = { ...formData, payout }
      if (sale) {
        await marketplaceApi.updateSale(sale.id, payload)
      } else {
        await marketplaceApi.createSale(payload)
      }
      onClose()
    } catch (error) {
      console.error('Ошибка:', error)
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const setNum = (field: string, value: string) => {
    setFormData({ ...formData, [field]: Number(value) || 0 })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-bold text-brand-text">
            {sale ? 'Редактировать' : 'Новая запись'} — {isWB ? 'Wildberries' : 'Сайт'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-brand-surface rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Дата *</label>
              <input type="date" className="input" value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Артикул *</label>
              <input type="text" className="input" placeholder="7V25" value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Название товара</label>
            <input type="text" className="input" value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Заказы</label>
              <input type="number" className="input" value={formData.orders_count}
                onChange={(e) => setNum('orders_count', e.target.value)} />
            </div>
            <div>
              <label className="label">Выкупы</label>
              <input type="number" className="input" value={formData.buyouts_count}
                onChange={(e) => setNum('buyouts_count', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Выручка (₽)</label>
            <input type="number" step="0.01" className="input" value={formData.revenue}
              onChange={(e) => setNum('revenue', e.target.value)} />
          </div>

          {isWB ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Комиссия (₽)</label>
                  <input type="number" step="0.01" className="input" value={formData.commission}
                    onChange={(e) => setNum('commission', e.target.value)} />
                </div>
                <div>
                  <label className="label">Ставка комиссии (%)</label>
                  <input type="number" step="0.1" className="input" value={formData.commission_rate}
                    onChange={(e) => setNum('commission_rate', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Логистика (₽)</label>
                  <input type="number" step="0.01" className="input" value={formData.logistics_cost}
                    onChange={(e) => setNum('logistics_cost', e.target.value)} />
                </div>
                <div>
                  <label className="label">Хранение (₽)</label>
                  <input type="number" step="0.01" className="input" value={formData.storage_cost}
                    onChange={(e) => setNum('storage_cost', e.target.value)} />
                </div>
                <div>
                  <label className="label">Прочее (₽)</label>
                  <input type="number" step="0.01" className="input" value={formData.other_costs}
                    onChange={(e) => setNum('other_costs', e.target.value)} />
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Логистика (₽)</label>
                <input type="number" step="0.01" className="input" value={formData.logistics_cost}
                  onChange={(e) => setNum('logistics_cost', e.target.value)} />
              </div>
              <div>
                <label className="label">Эквайринг (₽)</label>
                <input type="number" step="0.01" className="input" value={formData.acquiring_cost}
                  onChange={(e) => setNum('acquiring_cost', e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="label">Заметки</label>
            <textarea className="input" rows={2} value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>

          {/* Payout preview */}
          <div className={`rounded-lg p-3 text-center ${payout >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-sm text-brand-text-secondary">К выплате</p>
            <p className={`text-xl font-bold ${payout >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(payout)}
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-brand-border">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : sale ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== SKU Modal Component =====
const SkuModal = ({
  sku,
  onClose,
}: {
  sku: SkuMapping | null;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState({
    marketplace_sku: sku?.marketplace_sku || '',
    product_name: sku?.product_name || '',
    kit_id: sku?.kit_id || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.marketplace_sku || !formData.product_name) {
      alert('Укажите артикул и название')
      return
    }
    setSaving(true)
    try {
      const payload = { ...formData, kit_id: formData.kit_id || undefined }
      if (sku) {
        await marketplaceApi.updateSkuMapping(sku.id, payload)
      } else {
        await marketplaceApi.createSkuMapping(payload)
      }
      onClose()
    } catch (error) {
      console.error('Ошибка:', error)
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-bold text-brand-text">
            {sku ? 'Редактировать артикул' : 'Новый артикул'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-brand-surface rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Артикул МП *</label>
            <input type="text" className="input" placeholder="7V25" value={formData.marketplace_sku}
              onChange={(e) => setFormData({ ...formData, marketplace_sku: e.target.value })} />
          </div>
          <div>
            <label className="label">Название товара *</label>
            <input type="text" className="input" placeholder="Химичка 3.0" value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })} />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-brand-border">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : sku ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Marketplace
