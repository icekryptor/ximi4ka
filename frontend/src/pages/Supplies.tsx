import { useEffect, useState } from 'react'
import { suppliesApi } from '../api/supplies'
import { Supply } from '../api/types'
import { formatCurrency } from '../utils/format'
import { Plus, Edit2, Trash2, Package, Truck } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import SupplyModal from '../components/SupplyModal'
import { useToast } from '../App'

const Supplies = () => {
  const { showToast } = useToast()
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await suppliesApi.getAll()
      setSupplies(data)
    } catch (error) {
      console.error('Ошибка загрузки поставок:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить поставку? Связанные транзакции тоже будут удалены.')) return

    try {
      await suppliesApi.delete(id)
      setSupplies(supplies.filter((s) => s.id !== id))
    } catch (error) {
      console.error('Ошибка удаления поставки:', error)
      showToast('Не удалось удалить поставку', 'error')
    }
  }

  const handleEdit = (supply: Supply) => {
    setEditingSupply(supply)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingSupply(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingSupply(null)
    loadData()
  }

  const getItemsTotal = (supply: Supply) =>
    supply.items?.reduce((sum, it) => sum + Number(it.total_cost || 0), 0) || 0

  const getGrandTotal = (supply: Supply) =>
    getItemsTotal(supply) + Number(supply.delivery_cost || 0)

  if (loading) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <div className="skeleton h-8 w-1/4"></div>
          <div className="skeleton h-64"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-text">Поставки</h1>
          <p className="text-brand-text-secondary mt-1">
            Учёт закупок компонентов с автоматическим созданием транзакций
          </p>
        </div>
        <button onClick={handleAdd} className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Новая поставка</span>
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-brand-text-secondary">Всего поставок</p>
          <p className="text-2xl font-bold text-brand-text mt-1">{supplies.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-brand-text-secondary">Материалы (сумма)</p>
          <p className="text-2xl font-bold text-brand-text mt-1">
            {formatCurrency(supplies.reduce((sum, s) => sum + getItemsTotal(s), 0))}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-brand-text-secondary">Доставка (сумма)</p>
          <p className="text-2xl font-bold text-brand-text mt-1">
            {formatCurrency(supplies.reduce((sum, s) => sum + Number(s.delivery_cost || 0), 0))}
          </p>
        </div>
      </div>

      {/* Supplies table */}
      <div className="card">
        {supplies.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">Поставок пока нет</p>
            <button onClick={handleAdd} className="btn btn-primary mt-4">
              Добавить первую поставку
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-minimal">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Поставщик</th>
                  <th>Компоненты</th>
                  <th className="text-right">Материалы</th>
                  <th className="text-right">Доставка</th>
                  <th className="text-right">Итого</th>
                  <th className="text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {supplies.map((supply) => {
                  const materialsCost = getItemsTotal(supply)
                  const total = getGrandTotal(supply)
                  return (
                    <tr key={supply.id}>
                      <td className="whitespace-nowrap">
                        {supply.supply_date
                          ? format(new Date(supply.supply_date), 'd MMM yyyy', { locale: ru })
                          : '—'}
                      </td>
                      <td>
                        <div>
                          {supply.supplier?.name || <span className="text-gray-400">—</span>}
                        </div>
                        {supply.carrier && (
                          <div className="text-xs text-brand-text-secondary flex items-center mt-0.5">
                            <Truck className="h-3 w-3 mr-1" />
                            {supply.carrier.name}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="space-y-0.5">
                          {supply.items?.map((item, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{item.component?.name || 'Компонент'}</span>
                              <span className="text-brand-text-secondary ml-1">
                                × {Number(item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(materialsCost)}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {Number(supply.delivery_cost) > 0
                          ? formatCurrency(Number(supply.delivery_cost))
                          : '—'}
                      </td>
                      <td className="text-right font-semibold text-brand-text whitespace-nowrap">
                        {formatCurrency(total)}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end space-x-1">
                          <button
                            onClick={() => handleEdit(supply)}
                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(supply.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <SupplyModal supply={editingSupply} onClose={handleModalClose} />
      )}
    </div>
  )
}

export default Supplies
