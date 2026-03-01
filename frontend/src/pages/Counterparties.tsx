import { useEffect, useState } from 'react'
import { counterpartiesApi } from '../api/counterparties'
import { Counterparty, CounterpartyType } from '../api/types'
import { Plus, Edit2, Trash2, Users, Search, Building2 } from 'lucide-react'
import CounterpartyModal from '../components/CounterpartyModal'

const Counterparties = () => {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCounterparty, setEditingCounterparty] = useState<Counterparty | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await counterpartiesApi.getAll()
      setCounterparties(data)
    } catch (error) {
      console.error('Ошибка загрузки контрагентов:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого контрагента?')) {
      return
    }

    try {
      await counterpartiesApi.delete(id)
      setCounterparties(counterparties.filter(c => c.id !== id))
    } catch (error) {
      console.error('Ошибка удаления контрагента:', error)
      alert('Не удалось удалить контрагента')
    }
  }

  const handleEdit = (counterparty: Counterparty) => {
    setEditingCounterparty(counterparty)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingCounterparty(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingCounterparty(null)
    loadData()
  }

  const getTypeLabel = (type: CounterpartyType) => {
    switch (type) {
      case CounterpartyType.SUPPLIER:
        return 'Поставщик'
      case CounterpartyType.CUSTOMER:
        return 'Клиент'
      case CounterpartyType.BOTH:
        return 'Поставщик и клиент'
      default:
        return type
    }
  }

  const getTypeBadgeColor = (type: CounterpartyType) => {
    switch (type) {
      case CounterpartyType.SUPPLIER:
        return 'bg-orange-100 text-orange-700'
      case CounterpartyType.CUSTOMER:
        return 'bg-primary-100 text-primary-700'
      case CounterpartyType.BOTH:
        return 'bg-purple-100 text-purple-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const filteredCounterparties = counterparties.filter(counterparty =>
    counterparty.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    counterparty.inn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    counterparty.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Контрагенты</h1>
          <p className="text-gray-600 mt-1">Управление поставщиками и клиентами</p>
        </div>
        <button onClick={handleAdd} className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Добавить контрагента</span>
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию, ИНН, контактному лицу..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Counterparties Grid */}
      {filteredCounterparties.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">Контрагенты не найдены</p>
          <button onClick={handleAdd} className="btn btn-primary">
            Добавить первого контрагента
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCounterparties.map((counterparty) => (
            <div key={counterparty.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-100 p-3 rounded-full">
                    <Building2 className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{counterparty.name}</h3>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${getTypeBadgeColor(counterparty.type)}`}>
                      {getTypeLabel(counterparty.type)}
                    </span>
                  </div>
                </div>
                {!counterparty.is_active && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    Неактивен
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                {counterparty.inn && (
                  <div className="flex items-center">
                    <span className="font-medium w-24">ИНН:</span>
                    <span>{counterparty.inn}</span>
                  </div>
                )}
                {counterparty.contact_person && (
                  <div className="flex items-center">
                    <span className="font-medium w-24">Контакт:</span>
                    <span>{counterparty.contact_person}</span>
                  </div>
                )}
                {counterparty.phone && (
                  <div className="flex items-center">
                    <span className="font-medium w-24">Телефон:</span>
                    <span>{counterparty.phone}</span>
                  </div>
                )}
                {counterparty.email && (
                  <div className="flex items-center">
                    <span className="font-medium w-24">Email:</span>
                    <span className="truncate">{counterparty.email}</span>
                  </div>
                )}
                {counterparty.address && (
                  <div className="flex items-start">
                    <span className="font-medium w-24">Адрес:</span>
                    <span className="flex-1">{counterparty.address}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleEdit(counterparty)}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(counterparty.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <CounterpartyModal
          counterparty={editingCounterparty}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

export default Counterparties
