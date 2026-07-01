import { useEffect, useState } from 'react'
import { Plus, ClipboardCheck, CheckCircle2, XCircle, ListChecks } from 'lucide-react'
import {
  qcApi,
  QcChecklist,
  QcInspection,
  QcStats,
  InspectionResult,
  INSPECTION_RESULT_LABELS,
  INSPECTION_RESULT_COLORS,
  ChecklistItem,
} from '../api/qc'
import { kitsApi, Kit } from '../api/kits'
import { ordersApi, ProductionOrder, OrderStatus, ORDER_STATUS_LABELS } from '../api/orders'
import { employeesApi, Employee } from '../api/employees'
import { useToast } from '../contexts/ToastContext'

// Заказы в этих статусах имеет смысл инспектировать
const INSPECTABLE_STATUSES = [OrderStatus.IN_PRODUCTION, OrderStatus.QC, OrderStatus.PACKING, OrderStatus.READY]

const emptyInspForm = {
  order_id: '',
  checklist_id: '',
  inspector_id: '',
  inspected_qty: '',
  passed_qty: '',
  failed_qty: '',
  batch_number: '',
  defect_description: '',
}

const QualityControl = () => {
  const toast = useToast()
  const [tab, setTab] = useState<'checklists' | 'inspections'>('checklists')
  const [checklists, setChecklists] = useState<QcChecklist[]>([])
  const [inspections, setInspections] = useState<QcInspection[]>([])
  const [stats, setStats] = useState<QcStats | null>(null)
  const [kits, setKits] = useState<Kit[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(true)

  // Checklist form
  const [isChecklistForm, setIsChecklistForm] = useState(false)
  const [clForm, setClForm] = useState<{ name: string; kit_id: string; items: ChecklistItem[] }>({ name: '', kit_id: '', items: [] })
  const [newItemText, setNewItemText] = useState('')

  // Inspection form
  const [isInspForm, setIsInspForm] = useState(false)
  const [inspForm, setInspForm] = useState(emptyInspForm)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [cl, insp, st, k, emps, ords] = await Promise.all([
        qcApi.getChecklists(),
        qcApi.getInspections(),
        qcApi.stats(),
        kitsApi.getAll(),
        employeesApi.getAll(),
        ordersApi.getAll(),
      ])
      setChecklists(cl); setInspections(insp); setStats(st); setKits(k); setEmployees(emps); setOrders(ords)
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
    } catch { toast.error('Не удалось сохранить чек-лист') }
  }

  // ─── Инспекция: производные значения и валидация ───
  const inspectableOrders = orders.filter(o => INSPECTABLE_STATUSES.includes(o.status))
  const selectedOrder = orders.find(o => o.id === inspForm.order_id)
  const orderChecklists = checklists.filter(cl => cl.is_active && (!selectedOrder || cl.kit_id === selectedOrder.kit_id))

  const inspectedNum = parseInt(inspForm.inspected_qty, 10)
  const passedNum = parseInt(inspForm.passed_qty, 10)
  const failedNum = parseInt(inspForm.failed_qty, 10)
  const qtyExceeded = !isNaN(inspectedNum) && !isNaN(passedNum) && !isNaN(failedNum) && passedNum + failedNum > inspectedNum

  // Превью результата — то же правило 10%, что и на бэкенде
  const previewResult: InspectionResult | null =
    !isNaN(inspectedNum) && inspectedNum > 0 && !isNaN(failedNum) && failedNum >= 0
      ? failedNum === 0
        ? InspectionResult.PASS
        : failedNum >= inspectedNum * 0.1
          ? InspectionResult.FAIL
          : InspectionResult.CONDITIONAL
      : null

  const inspFormValid =
    !!inspForm.order_id && !!inspForm.inspector_id &&
    !isNaN(inspectedNum) && inspectedNum > 0 &&
    !isNaN(passedNum) && passedNum >= 0 &&
    !isNaN(failedNum) && failedNum >= 0 &&
    !qtyExceeded

  const saveInspection = async () => {
    if (!inspFormValid) return
    try {
      await qcApi.createInspection({
        order_id: inspForm.order_id,
        checklist_id: inspForm.checklist_id || undefined,
        inspector_id: inspForm.inspector_id,
        inspected_qty: inspectedNum,
        passed_qty: passedNum,
        failed_qty: failedNum,
        batch_number: inspForm.batch_number.trim() || undefined,
        defect_description: inspForm.defect_description.trim() || undefined,
      })
      toast.success('Инспекция сохранена')
      setIsInspForm(false)
      setInspForm(emptyInspForm)
      loadData()
    } catch { toast.error('Не удалось сохранить инспекцию') }
  }

  if (loading) return (
    <div className="p-8"><div className="space-y-4"><div className="skeleton h-8 w-1/4" /><div className="skeleton h-64" /></div></div>
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-brand-text">Контроль качества</h1>
          <p className="text-brand-text-secondary mt-1">Чек-листы и проверки ОТК</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="text-2xl font-bold text-brand-text">{stats.total_inspections}</div>
            <div className="text-sm text-brand-text-secondary">Всего проверок</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-green-700">{stats.pass_count}</span>
            </div>
            <div className="text-sm text-brand-text-secondary">Годен</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-red-700">{stats.fail_count}</span>
            </div>
            <div className="text-sm text-brand-text-secondary">Брак</div>
          </div>
          <div className="card">
            <div className="text-2xl font-bold text-blue-700">{stats.pass_rate.toFixed(1)}%</div>
            <div className="text-sm text-brand-text-secondary">Процент годных</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('checklists')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'checklists' ? 'bg-card text-brand-text shadow-sm' : 'text-brand-text-secondary hover:text-brand-text-secondary'}`}
        >
          <span className="flex items-center gap-2"><ListChecks className="h-4 w-4" />Чек-листы ({checklists.length})</span>
        </button>
        <button
          onClick={() => setTab('inspections')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'inspections' ? 'bg-card text-brand-text shadow-sm' : 'text-brand-text-secondary hover:text-brand-text-secondary'}`}
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
              <ListChecks className="h-16 w-16 text-brand-text-secondary mx-auto mb-4" />
              <p className="text-brand-text-secondary text-lg">Чек-листы не найдены</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checklists.map((cl, index) => (
                <div key={cl.id} className="card-hover stagger-item" style={{ animationDelay: `${index * 60}ms` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-brand-text">{cl.name}</h3>
                      <span className="text-sm text-brand-text-secondary">{cl.kit?.name || '—'} · v{cl.version}</span>
                    </div>
                    {!cl.is_active && <span className="px-2 py-0.5 bg-muted text-brand-text-secondary text-xs rounded-full">Неактивен</span>}
                  </div>
                  <div className="space-y-1.5">
                    {cl.items.map((item, idx) => (
                      <div key={item.id} className="flex items-start gap-2 text-sm text-brand-text-secondary">
                        <span className="text-brand-text-secondary shrink-0">{idx + 1}.</span>
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
          <div className="flex justify-end mb-4">
            <button onClick={() => setIsInspForm(true)} className="btn btn-primary flex items-center space-x-2">
              <Plus className="h-5 w-5" /><span>Новая инспекция</span>
            </button>
          </div>

          {inspections.length === 0 ? (
            <div className="card text-center py-12">
              <ClipboardCheck className="h-16 w-16 text-brand-text-secondary mx-auto mb-4" />
              <p className="text-brand-text-secondary text-lg">Проверки не найдены</p>
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
                        <span className="text-sm text-brand-text-secondary">
                          {insp.order ? `Заказ №${insp.order.order_number}` : '—'}
                          {insp.checklist ? ` · ${insp.checklist.name}` : ''}
                        </span>
                      </div>
                      <div className="text-sm text-brand-text-secondary">
                        Инспектор: {insp.inspector?.name || '—'} · {new Date(insp.created_at).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-sm text-brand-text-secondary shrink-0">
                      {insp.passed_qty}/{insp.inspected_qty} шт. годных
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
          <div className="bg-card rounded-xl p-6 w-full max-w-lg shadow-modal animate-scale-in max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Новый чек-лист ОТК</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Название</label>
                <input className="input" value={clForm.name} onChange={e => setClForm(f => ({ ...f, name: e.target.value }))} placeholder="Чек-лист для набора «Вулкан»" />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Набор (SKU)</label>
                <select className="input" value={clForm.kit_id} onChange={e => setClForm(f => ({ ...f, kit_id: e.target.value }))}>
                  <option value="">Выберите набор</option>
                  {kits.filter(k => k.is_active).map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Пункты проверки</label>
                <div className="space-y-2">
                  {clForm.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2 bg-subtle rounded-lg px-3 py-2">
                      <span className="text-sm text-brand-text-secondary">{idx + 1}.</span>
                      <span className="text-sm text-brand-text-secondary flex-1">{item.text}</span>
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

      {/* Inspection create modal */}
      {isInspForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsInspForm(false)}>
          <div className="bg-card rounded-xl p-6 w-full max-w-lg shadow-modal animate-scale-in max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Новая инспекция ОТК</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Заказ на производство</label>
                <select className="input" value={inspForm.order_id} onChange={e => setInspForm(f => ({ ...f, order_id: e.target.value, checklist_id: '' }))}>
                  <option value="">Выберите заказ</option>
                  {inspectableOrders.map(o => (
                    <option key={o.id} value={o.id}>№{o.order_number} · {o.kit?.name || '—'} · {ORDER_STATUS_LABELS[o.status]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Инспектор</label>
                <select className="input" value={inspForm.inspector_id} onChange={e => setInspForm(f => ({ ...f, inspector_id: e.target.value }))}>
                  <option value="">Выберите инспектора</option>
                  {employees.filter(emp => emp.is_active).map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Чек-лист (необязательно)</label>
                <select className="input" value={inspForm.checklist_id} onChange={e => setInspForm(f => ({ ...f, checklist_id: e.target.value }))}>
                  <option value="">Без чек-листа</option>
                  {orderChecklists.map(cl => <option key={cl.id} value={cl.id}>{cl.name} (v{cl.version})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-brand-text-secondary mb-1">Проверено, шт</label>
                  <input type="number" min="1" className="input" value={inspForm.inspected_qty} onChange={e => setInspForm(f => ({ ...f, inspected_qty: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-text-secondary mb-1">Годных</label>
                  <input type="number" min="0" className="input" value={inspForm.passed_qty} onChange={e => setInspForm(f => ({ ...f, passed_qty: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-text-secondary mb-1">Брак</label>
                  <input type="number" min="0" className="input" value={inspForm.failed_qty} onChange={e => setInspForm(f => ({ ...f, failed_qty: e.target.value }))} placeholder="0" />
                </div>
              </div>
              {qtyExceeded && (
                <p className="text-sm text-red-600">Годные + брак не могут превышать проверенное количество</p>
              )}
              {previewResult && !qtyExceeded && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-brand-text-secondary">Результат:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INSPECTION_RESULT_COLORS[previewResult]}`}>
                    {previewResult === InspectionResult.PASS ? '✅' : previewResult === InspectionResult.FAIL ? '❌' : '⚠️'} {INSPECTION_RESULT_LABELS[previewResult]}
                  </span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Номер партии</label>
                <input className="input" value={inspForm.batch_number} onChange={e => setInspForm(f => ({ ...f, batch_number: e.target.value }))} placeholder="Партия №…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Описание дефектов</label>
                <textarea className="input" rows={2} value={inspForm.defect_description} onChange={e => setInspForm(f => ({ ...f, defect_description: e.target.value }))} placeholder="Что не так с браком…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="btn" onClick={() => setIsInspForm(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={saveInspection} disabled={!inspFormValid}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QualityControl
