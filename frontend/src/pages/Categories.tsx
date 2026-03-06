import { useEffect, useState } from 'react'
import { categoriesApi } from '../api/categories'
import { Category, TransactionType } from '../api/types'
import { Plus, Edit2, Trash2, FolderOpen, TrendingUp, TrendingDown } from 'lucide-react'
import CategoryModal from '../components/CategoryModal'

// Extracted outside component to prevent remount on every render
const CategoryCard = ({
  category,
  onEdit,
  onDelete,
}: {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
}) => (
  <div className="card hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center space-x-3 flex-1">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: category.color || '#e5e7eb' }}
        >
          <FolderOpen className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{category.name}</h3>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
            category.type === TransactionType.INCOME
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {category.type === TransactionType.INCOME ? (
              <>
                <TrendingUp className="h-3 w-3 mr-1" />
                Доход
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3 mr-1" />
                Расход
              </>
            )}
          </span>
        </div>
      </div>
      {!category.is_active && (
        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
          Неактивна
        </span>
      )}
    </div>

    {category.description && (
      <p className="text-sm text-gray-600 mb-3">{category.description}</p>
    )}

    <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
      <button
        onClick={() => onEdit(category)}
        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
      >
        <Edit2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => onDelete(category.id)}
        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  </div>
)

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await categoriesApi.getAll()
      setCategories(data)
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту категорию?')) {
      return
    }

    try {
      await categoriesApi.delete(id)
      setCategories(categories.filter(c => c.id !== id))
    } catch (error) {
      console.error('Ошибка удаления категории:', error)
      alert('Не удалось удалить категорию')
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingCategory(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
    loadData()
  }

  const filteredCategories = categories.filter(category => {
    if (filterType === 'all') return true
    return category.type === filterType
  })

  const incomeCategories = filteredCategories.filter(c => c.type === TransactionType.INCOME)
  const expenseCategories = filteredCategories.filter(c => c.type === TransactionType.EXPENSE)

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
          <h1 className="text-3xl font-bold text-gray-900">Категории</h1>
          <p className="text-gray-600 mt-1">Управление категориями доходов и расходов</p>
        </div>
        <button onClick={handleAdd} className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Добавить категорию</span>
        </button>
      </div>

      {/* Filter */}
      <div className="card mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Все категории
          </button>
          <button
            onClick={() => setFilterType(TransactionType.INCOME)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === TransactionType.INCOME
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Доходы
          </button>
          <button
            onClick={() => setFilterType(TransactionType.EXPENSE)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === TransactionType.EXPENSE
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Расходы
          </button>
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="card text-center py-12">
          <FolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">Категории не найдены</p>
          <button onClick={handleAdd} className="btn btn-primary">
            Добавить первую категорию
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {(filterType === 'all' || filterType === TransactionType.INCOME) && incomeCategories.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
                Категории доходов
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {incomeCategories.map(category => (
                  <CategoryCard key={category.id} category={category} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}

          {(filterType === 'all' || filterType === TransactionType.EXPENSE) && expenseCategories.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <TrendingDown className="h-6 w-6 text-red-600 mr-2" />
                Категории расходов
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {expenseCategories.map(category => (
                  <CategoryCard key={category.id} category={category} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <CategoryModal
          category={editingCategory}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

export default Categories
