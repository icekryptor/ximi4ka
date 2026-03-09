import { useEffect, useState } from 'react'
import { Plus, ClipboardCheck, CheckCircle2, XCircle, ListChecks } from 'lucide-react'
import {
  qcApi,
  QcChecklist,
  QcInspection,
  QcStats,
  INSPECTION_RESULT_LABELS,
  INSPECTION_RESULT_COLORS,
  ChecklistItem,
} from '../api/qc'
import { kitsApi, Kit } from '../api/kits'
// import { employeesApi } from '../api/employees'  // TODO: нужно для формы инспекции
import { useToast } from '../App'

const QualityControl = () => {
  const { showToast } = useToast()
  const [tab, setTab] = useState<'checklists' | 'inspections'>('checklists')
  const [checklists, setChecklists] = useState<QcChecklist[]>([])
  const [inspections, setInspections] = useState<QcInspection[]>([])
  const [stats, setStats] = useState<QcStats | null>(null)
  const [kits, setKits] = useState<Kit[]>([])
  // const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // Checklist form
  const [isChecklistForm, setIsChecklistForm] = useState(false)
  const [clForm, setClForm] = useState<{ name: string; kit_id: string; items: ChecklistItem[] }>({ name: '', kit_id: '', items: [] })
  const [newItemText, setNewItemText] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [cl, insp, st, k] = await Promise.all([
        qcApi.getChecklists(),
        qcApi.getInspections(),
        qcApi.stats(),
        kitsApi.getAll(),
      ])
      setChecklists(cl); setInspections(insp); setStats(st); setKits(k)
    } catch (e) { console.error('Ошибка загрузки ОТК:', e) }
    finally { setLoading(false) }
  }

  const addItem = () => {
    if (!newItemText.trim()) return
    setClForm(f => ({
      ...f,
      items: [...f.items, { id: crypto.randomUUID(), text: newItemText.trim() }],
    }))
    setNewItemText('')
  }

  const removeItem = (id: string) => {
    setClForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  }

  const saveChecklist = async () => {
    try {
      await qcApi.createChecklist(clForm)
      setIsChecklistForm(false)
      setClForm({ name: '', kit_id: '', items: [] })
      loadData()
    } catch { showToast('Не удалось сохранить чек-лист', 'error') }
  }

  if (loading) return (
    <div className="p-8"><div className="space-y-4"><div className="skeleton h-8 w-1/4" /><div className="skeleton h-64" /></div></div>
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Контроль качества</h1>
          <p className="text-gray-600 mt-1">Чек-листы и проверки ОТК</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="text-2xl font-bold text-gray-900">{stats.total_inspections}</div>
            <div className="text-sm text-gray-500">Всего проверок</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-green-700">{stats.pass_count}</span>
            </div>
            <div className="text-sm text-gray-500">Годен</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-red-700">{stats.fail_count}</span>
            </div>
            <div className="text-sm text-gray-500">Брак</div>
          </div>
          <div className="card">
            <div className="text-2xl font-bold text-blue-700">{stats.pass_rate.toFixed(1)}%</div>
            <div className="text-sm text-gray-500">Процент годных</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('checklists')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'checklists' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2"><ListChecks className="h-4 w-4" />Чек-листы ({checklists.length})</span>
        </button>
        <button
          onClick={() => setTab('inspections')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'inspections' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" />Проверки ({inspections.length})</span>
        </button>
      </div>

      {/* Checklists tab */}
      {tab === 'checklists' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => setIsChecklistForm(true)} className="btn btn-primary flex items-center space-x-2">
              <Plus className="h-5 w-5" /><span>Новый чек-лист</span>
            </button>
          </div>

          {checklists.length === 0 ? (
            <div className="card text-center py-12">
              <ListChecks className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Чек-листы не найдены</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checklists.map((cl, index) => (
                <div key={cl.id} className="card-hover stagger-item" style={{ animationDelay: `${index * 60}ms` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{cl.name}</h3>
                      <span className="text-sm text-gray-500">{cl.kit?.name || '—'} · v{cl.version}</span>
                    </div>
                    {!cl.is_active && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Неактивен</span>}
                  </div>
                  <div className="space-y-1.5">
                    {cl.items.map((item, idx) => (
                      <div key={item.id} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-gray-400 shrink-0">{idx + 1}.</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Inspections tab */}
      {tab === 'inspections' && (
        <>
          {inspections.length === 0 ? (
            <div className="card text-center py-12">
              <ClipboardCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Проверки не найдены</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inspections.map((insp, index) => (
                <div key={insp.id} className="card-hover stagger-item" style={{ animationDelay: `${index * 60}ms` }}>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INSPECTION_RESULT_COLORS[insp.result]}`}>
                          {INSPECTION_RESULT_LABELS[insp.result]}
                        </span>
                        <span className="text-sm text-gray-500">{insp.checklist?.name || '—'}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Инспектор: {insp.inspector?.name || '—'} · {new Date(insp.inspected_at).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 shrink-0">
                      {insp.item_results.filter(r => r.passed).length}/{insp.item_results.length} пунктов
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Checklist create modal */}
      {isChecklistForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsChecklistForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-modal animate-scale-in max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Новый чек-лист ОТК</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input className="input" value={clForm.name} onChange={e => setClForm(f => ({ ...f, name: e.target.value }))} placeholder="Чек-лист для набора «Вулкан»" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Набор (SKU)</label>
                <select className="input" value={clForm.kit_id} onChange={e => setClForm(f => ({ ...f, kit_id: e.target.value }))}>
                  <option value="">Выберите набор</option>
                  {kits.filter(k => k.is_active).map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пункты проверки</label>
                <div className="space-y-2">
                  {clForm.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-400">{idx + 1}.</span>
                      <span className="text-sm text-gray-700 flex-1">{item.text}</span>
                      <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input className="input flex-1" value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="Добавить пункт проверки…" />
                    <button onClick={addItem} className="btn btn-primary px-3" disabled={!newItemText.trim()}>+</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="btn" onClick={() => setIsChecklistForm(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={saveChecklist} disabled={!clForm.name || !clForm.kit_id || clForm.items.length === 0}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QualityControl
