import { useEffect, useMemo, useState } from 'react'
import { categoriesApi } from '../api/categories'
import { Category, CashflowSection, TransactionType } from '../api/types'
import {
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react'
import CategoryModal from '../components/CategoryModal'
import { useToast } from '../contexts/ToastContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'

const SECTION_OPTIONS: { value: '' | CashflowSection; label: string }[] = [
  { value: '', label: 'Без раздела' },
  { value: 'operational', label: 'Операционная' },
  { value: 'investing', label: 'Инвестиционная' },
  { value: 'financing', label: 'Финансовая' },
]

const SECTION_BADGE: Record<CashflowSection, { label: string; cls: string }> = {
  operational: {
    label: 'Операционная',
    cls: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  investing: {
    label: 'Инвестиционная',
    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  financing: {
    label: 'Финансовая',
    cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
}

const Categories = () => {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [savingId, setSavingId] = useState<string | null>(null)

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
    const ok = await confirm({
      title: 'Удалить категорию?',
      message: 'Вы уверены, что хотите удалить эту категорию? Это действие нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return

    try {
      await categoriesApi.delete(id)
      setCategories(categories.filter(c => c.id !== id))
    } catch (error) {
      console.error('Ошибка удаления категории:', error)
      toast.error('Не удалось удалить категорию')
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

  const updateCategoryField = async (
    id: string,
    patch: Partial<Pick<Category, 'parent_id' | 'cashflow_section'>>,
  ) => {
    const previous = categories
    // Оптимистичное обновление
    setCategories(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)))
    setSavingId(id)
    try {
      await categoriesApi.update(id, patch as Partial<Category>)
    } catch (error) {
      console.error('Ошибка сохранения категории:', error)
      toast.error('Не удалось сохранить изменения')
      setCategories(previous)
    } finally {
      setSavingId(null)
    }
  }

  const filteredCategories = useMemo(
    () =>
      categories.filter(category => {
        if (filterType === 'all') return true
        return category.type === filterType
      }),
    [categories, filterType],
  )

  // Дерево: сначала родители (alpha), затем дети под каждым родителем (alpha).
  // Сироты (parent_id указан, но родитель отсутствует / отфильтрован) показываем
  // в конце как «висящие», чтобы не терять их.
  const tree = useMemo(() => {
    const visibleIds = new Set(filteredCategories.map(c => c.id))
    const parents = filteredCategories
      .filter(c => !c.parent_id)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    const out: { category: Category; isChild: boolean }[] = []
    for (const p of parents) {
      out.push({ category: p, isChild: false })
      filteredCategories
        .filter(c => c.parent_id === p.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .forEach(c => out.push({ category: c, isChild: true }))
    }
    // Сироты: parent_id есть, но родитель не виден
    const orphans = filteredCategories
      .filter(c => c.parent_id && !visibleIds.has(c.parent_id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    for (const o of orphans) {
      out.push({ category: o, isChild: true })
    }
    return out
  }, [filteredCategories])

  const incomeTree = useMemo(
    () => tree.filter(t => t.category.type === TransactionType.INCOME),
    [tree],
  )
  const expenseTree = useMemo(
    () => tree.filter(t => t.category.type === TransactionType.EXPENSE),
    [tree],
  )

  const missingSectionCount = useMemo(
    () => categories.filter(c => !c.cashflow_section).length,
    [categories],
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  const renderTable = (rows: { category: Category; isChild: boolean }[]) => (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-brand-text-secondary border-b border-brand-border">
            <th className="py-2 px-3 font-medium">Название</th>
            <th className="py-2 px-3 font-medium">Раздел БДДС</th>
            <th className="py-2 px-3 font-medium">Родитель</th>
            <th className="py-2 px-3 font-medium">Статус</th>
            <th className="py-2 px-3 font-medium text-right">Действия</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ category, isChild }) => {
            const possibleParents = categories.filter(
              c =>
                c.id !== category.id &&
                !c.parent_id &&
                c.type === category.type,
            )
            const badge = category.cashflow_section
              ? SECTION_BADGE[category.cashflow_section]
              : null
            return (
              <tr
                key={category.id}
                className="border-b border-brand-border last:border-0 hover:bg-muted/40"
              >
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color || '#e5e7eb' }}
                    />
                    <span className="text-brand-text">
                      {isChild ? `├─ ${category.name}` : category.name}
                    </span>
                    {badge && (
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3">
                  <select
                    className="input py-1 text-sm"
                    value={category.cashflow_section ?? ''}
                    disabled={savingId === category.id}
                    onChange={e => {
                      const v = e.target.value as '' | CashflowSection
                      updateCategoryField(category.id, {
                        cashflow_section: v === '' ? null : v,
                      })
                    }}
                  >
                    {SECTION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  <select
                    className="input py-1 text-sm"
                    value={category.parent_id ?? ''}
                    disabled={savingId === category.id}
                    onChange={e => {
                      const v = e.target.value
                      updateCategoryField(category.id, {
                        parent_id: v === '' ? null : v,
                      })
                    }}
                  >
                    <option value="">— Без родителя —</option>
                    {possibleParents.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  {category.is_active ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs rounded-full">
                      Активна
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-muted text-brand-text-secondary text-xs rounded-full">
                      Неактивна
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Редактировать"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-text">Категории</h1>
          <p className="text-brand-text-secondary mt-1">Управление категориями доходов и расходов</p>
        </div>
        <button onClick={handleAdd} className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Добавить категорию</span>
        </button>
      </div>

      {missingSectionCount > 0 && (
        <div className="card mb-6 flex items-start gap-3 border border-amber-300 bg-amber-50 dark:bg-amber-900/30">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {missingSectionCount}{' '}
            {missingSectionCount === 1 ? 'категория' : 'категорий'} без раздела БДДС.
            Это значит, что транзакции в этих категориях попадут в блок «Без раздела»
            в БДДС-отчёте. Проставьте раздел через выпадающий список в каждой строке.
          </p>
        </div>
      )}

      {/* Filter */}
      <div className="card mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-muted text-brand-text-secondary hover:bg-subtle'
            }`}
          >
            Все категории
          </button>
          <button
            onClick={() => setFilterType(TransactionType.INCOME)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === TransactionType.INCOME
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'bg-muted text-brand-text-secondary hover:bg-subtle'
            }`}
          >
            Доходы
          </button>
          <button
            onClick={() => setFilterType(TransactionType.EXPENSE)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === TransactionType.EXPENSE
                ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                : 'bg-muted text-brand-text-secondary hover:bg-subtle'
            }`}
          >
            Расходы
          </button>
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-brand-text-secondary text-lg mb-4">Категории не найдены</p>
          <button onClick={handleAdd} className="btn btn-primary">
            Добавить первую категорию
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {(filterType === 'all' || filterType === TransactionType.INCOME) && incomeTree.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-brand-text mb-4 flex items-center">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
                Категории доходов
              </h2>
              {renderTable(incomeTree)}
            </div>
          )}

          {(filterType === 'all' || filterType === TransactionType.EXPENSE) && expenseTree.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-brand-text mb-4 flex items-center">
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
                Категории расходов
              </h2>
              {renderTable(expenseTree)}
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
