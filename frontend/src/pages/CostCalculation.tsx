import { useEffect, useState } from 'react'
import { Plus, Calculator, RefreshCw } from 'lucide-react'
import { componentsApi, Component } from '../api/components'

const CostCalculation = () => {
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await componentsApi.getAll({ active: true })
      setComponents(data)
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    }).format(price)
  }

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'reagent': return 'Реактивы'
      case 'equipment': return 'Комплектующие'
      case 'print': return 'Печатная продукция'
      case 'labor': return 'Работа'
      default: return category
    }
  }

  const reagents = components.filter(c => c.category === 'reagent' && c.is_active)
  const equipment = components.filter(c => c.category === 'equipment' && c.is_active)
  const printProducts = components.filter(c => c.category === 'print' && c.is_active)
  const labor = components.filter(c => c.category === 'labor' && c.is_active)

  const reagentsTotal = reagents.reduce((sum, c) => sum + Number(c.price_per_kit), 0)
  const equipmentTotal = equipment.reduce((sum, c) => sum + Number(c.price_per_kit), 0)
  const printTotal = printProducts.reduce((sum, c) => sum + Number(c.price_per_kit), 0)
  const laborTotal = labor.reduce((sum, c) => sum + Number(c.price_per_kit), 0)

  const grandTotal = reagentsTotal + equipmentTotal + printTotal + laborTotal

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const ComponentTable = ({ items, title }: { items: Component[], title: string }) => (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      <table className="table-minimal">
        <thead>
          <tr>
            <th>Название</th>
            <th className="text-right">Цена за 1 набор</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td className="text-right font-medium">{formatPrice(item.price_per_kit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Расчет себестоимости</h1>
          <p className="text-sm text-gray-500 mt-1">Химичка · Размер партии: 5000 шт</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={loadData} className="btn btn-secondary flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>Обновить</span>
          </button>
          <button className="btn btn-primary flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Добавить компонент</span>
          </button>
        </div>
      </div>

      {/* Сводка */}
      <div className="bg-gray-50 border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Итоговая себестоимость</h2>
          <div className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-gray-400" />
            <span className="text-2xl font-bold text-gray-900">{formatPrice(grandTotal)}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-6">
          <div>
            <div className="text-xs text-gray-500 mb-1">Реактивы</div>
            <div className="text-lg font-semibold text-gray-900">{formatPrice(reagentsTotal)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Комплектующие</div>
            <div className="text-lg font-semibold text-gray-900">{formatPrice(equipmentTotal)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Печать</div>
            <div className="text-lg font-semibold text-gray-900">{formatPrice(printTotal)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Работа</div>
            <div className="text-lg font-semibold text-gray-900">{formatPrice(laborTotal)}</div>
          </div>
        </div>
      </div>

      {/* Детальные таблицы */}
      <div className="space-y-8">
        {reagents.length > 0 && <ComponentTable items={reagents} title="Реактивы" />}
        {equipment.length > 0 && <ComponentTable items={equipment} title="Комплектующие" />}
        {printProducts.length > 0 && <ComponentTable items={printProducts} title="Печатная продукция" />}
        {labor.length > 0 && <ComponentTable items={labor} title="Работа" />}
      </div>

      {components.length === 0 && (
        <div className="text-center py-16">
          <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Нет данных для расчета</p>
          <button className="btn btn-primary">
            Импортировать данные
          </button>
        </div>
      )}
    </div>
  )
}

export default CostCalculation
