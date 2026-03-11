import { useEffect, useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, Search, UserCircle, Phone, Send, Eye, EyeOff, Clock } from 'lucide-react'
import { employeesApi, Employee } from '../api/employees'
import EmployeeModal from '../components/EmployeeModal'
import { useToast } from '../App'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'

const fmt = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(v)

const Employees = () => {
  const { showToast } = useToast()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [revealedPassports, setRevealedPassports] = useState<Set<string>>(new Set())

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await employeesApi.getAll()
      setEmployees(data)
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить сотрудника?')) return
    try {
      await employeesApi.delete(id)
      setEmployees(prev => prev.filter(e => e.id !== id))
    } catch {
        showToast('Не удалось удалить сотрудника', 'error')
    }
  }

  const handleEdit = (emp: Employee) => { setEditing(emp); setIsModalOpen(true) }
  const handleAdd = () => { setEditing(null); setIsModalOpen(true) }
  const handleModalClose = () => { setIsModalOpen(false); setEditing(null); loadData() }

  const togglePassport = (id: string) => {
    setRevealedPassports(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() =>
    employees.filter(e => {
      const q = searchTerm.toLowerCase()
      return !q ||
        e.name.toLowerCase().includes(q) ||
        e.phone?.toLowerCase().includes(q) ||
        e.telegram?.toLowerCase().includes(q) ||
        e.position?.toLowerCase().includes(q)
    }),
  [employees, searchTerm])

  if (loading) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <div className="skeleton h-8 w-1/4" />
          <div className="skeleton h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Сотрудники</h1>
          <p className="text-gray-600 mt-1">Команда и ставки</p>
        </div>
        <button onClick={handleAdd} className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Добавить</span>
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по имени, телефону, должности…"
            className="input pl-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <UserCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">Сотрудники не найдены</p>
          <button onClick={handleAdd} className="btn btn-primary">Добавить</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((emp, index) => (
            <div key={emp.id} className="card-hover stagger-item relative group" style={{ animationDelay: `${index * 60}ms` }}>
              {/* Action buttons */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(emp)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Avatar + Name */}
              <div className="flex items-center space-x-4 mb-4 pr-14">
                {emp.photo_url ? (
                  <img
                    src={`${API_BASE}${emp.photo_url}`}
                    alt={emp.name}
                    className="h-14 w-14 rounded-full object-cover shrink-0 ring-2 ring-gray-100"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shrink-0">
                    <UserCircle className="h-7 w-7 text-blue-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900 leading-tight">{emp.name}</h3>
                  {emp.position && (
                    <p className="text-sm text-gray-500 mt-0.5">{emp.position}</p>
                  )}
                  {!emp.is_active && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Неактивен</span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                {/* Hourly rate */}
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="font-medium">{fmt(Number(emp.hourly_rate))}/час</span>
                </div>

                {/* Phone */}
                {emp.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                    <a href={`tel:${emp.phone}`} className="hover:text-blue-600 transition-colors">{emp.phone}</a>
                  </div>
                )}

                {/* Telegram */}
                {emp.telegram && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Send className="h-4 w-4 text-sky-400 shrink-0" />
                    <a
                      href={`https://t.me/${emp.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-sky-600 transition-colors"
                    >
                      {emp.telegram.startsWith('@') ? emp.telegram : `@${emp.telegram}`}
                    </a>
                  </div>
                )}

                {/* Passport */}
                {emp.passport_data && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => togglePassport(emp.id)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {revealedPassports.has(emp.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      Паспортные данные
                    </button>
                    {revealedPassports.has(emp.id) && (
                      <p className="mt-1.5 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 font-mono whitespace-pre-wrap">
                        {emp.passport_data}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <EmployeeModal employee={editing} onClose={handleModalClose} />
      )}
    </div>
  )
}

export default Employees
