import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Sparkles, X } from 'lucide-react'
import { bankImportsApi, PreviewResponse, PreviewRow, CommitRow, RuleToCreate } from '../api/bankImports'
import { bankAccountsApi, BankAccount } from '../api/bankAccounts'
import { counterpartiesApi } from '../api/counterparties'
import { categoriesApi } from '../api/categories'
import { Counterparty, Category } from '../api/types'
import { useToast } from './../contexts/ToastContext'

interface Props {
  onClose: () => void
}

function CounterpartySelect({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [items, setItems] = useState<Counterparty[]>([])
  useEffect(() => { counterpartiesApi.getAll().then(setItems).catch(console.error) }, [])
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className="text-xs border border-brand-border rounded-lg px-2 py-1 bg-card max-w-[180px]"
    >
      <option value="">— выбрать —</option>
      {items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}

function CategorySelect({ value, type, onChange }: { value: string | null; type: 'income' | 'expense'; onChange: (id: string | null) => void }) {
  const [items, setItems] = useState<Category[]>([])
  useEffect(() => { categoriesApi.getAll().then(setItems).catch(console.error) }, [])
  const filtered = items.filter(c => c.type === type || !c.type)
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className="text-xs border border-brand-border rounded-lg px-2 py-1 bg-card max-w-[180px]"
    >
      <option value="">— выбрать —</option>
      {filtered.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}

export default function BankImportModal({ onClose }: Props) {
  const toast = useToast()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')   // empty = auto-detect
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [autoCategorizing, setAutoCategorizing] = useState(false)

  // Per-row UI state (edited fields, learn flag, skip flag)
  type RowState = {
    counterparty_id: string | null
    counterparty_name: string
    counterparty_inn: string | null
    category_id: string | null
    is_transfer: boolean
    transfer_match_id: string | null
    skip: boolean
    learn: boolean
  }
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({})

  useEffect(() => { bankAccountsApi.list().then(setAccounts).catch(console.error) }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !committing && !loadingPreview && !autoCategorizing) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [committing, loadingPreview, autoCategorizing, onClose])

  // When preview arrives, init row states
  useEffect(() => {
    if (!preview) return
    const states: Record<number, RowState> = {}
    for (const r of preview.rows) {
      states[r.index] = {
        counterparty_id: r.suggested_counterparty_id,
        counterparty_name: r.counterparty_name,
        counterparty_inn: r.counterparty_inn,
        category_id: r.suggested_category_id,
        is_transfer: r.is_transfer,
        transfer_match_id: r.transfer_match_id,
        skip: r.is_duplicate,
        learn: r.match_quality === 'none',  // by default learn for new mappings
      }
    }
    setRowStates(states)
  }, [preview])

  const onFileSelect = (f: File) => {
    setFile(f)
    setPreview(null)
  }

  const runPreview = async () => {
    if (!file) return
    setLoadingPreview(true)
    try {
      const r = await bankImportsApi.preview(file, selectedAccount || undefined)
      setPreview(r)
      toast.success(`Распарсено ${r.total_rows} строк`)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка парсинга')
    } finally { setLoadingPreview(false) }
  }

  const counts = useMemo(() => {
    if (!preview) return null
    let auto = 0, partial = 0, manual = 0, dup = 0, transfer = 0
    for (const r of preview.rows) {
      if (r.is_duplicate) dup++
      else if (r.is_transfer) transfer++
      else if (r.match_quality === 'inn' && r.suggested_category_id) auto++
      else if (r.suggested_counterparty_id || r.suggested_category_id) partial++
      else manual++
    }
    return { auto, partial, manual, dup, transfer }
  }, [preview])

  const commit = async () => {
    if (!preview) return
    setCommitting(true)
    try {
      const rows: CommitRow[] = preview.rows.map(r => {
        const s = rowStates[r.index]
        return {
          external_id: r.external_id,
          date: r.date,
          type: r.type,
          amount: r.amount,
          counterparty_name: s.counterparty_name || r.counterparty_name,
          counterparty_inn: s.counterparty_inn,
          description: r.description,
          counterparty_id: s.counterparty_id,
          category_id: s.category_id,
          is_transfer: s.is_transfer,
          transfer_match_id: s.transfer_match_id,
          skip: s.skip,
        }
      })

      // Build rules to create from rows where `learn` is true and we have manual mapping
      const rules_to_create: RuleToCreate[] = []
      for (const r of preview.rows) {
        const s = rowStates[r.index]
        if (!s.learn || s.skip) continue
        if (!s.counterparty_id && !s.category_id && !s.is_transfer) continue

        if (r.counterparty_inn) {
          rules_to_create.push({
            match_type: 'inn',
            match_value: r.counterparty_inn,
            counterparty_id: s.counterparty_id,
            category_id: s.category_id,
            is_inter_transfer: s.is_transfer,
          })
        }
      }

      const result = await bankImportsApi.commit({
        bank_account_id: preview.bank_account_id,
        file_name: file?.name || 'unknown.xlsx',
        period_start: preview.period_start,
        period_end: preview.period_end,
        rows,
        rules_to_create,
      })
      toast.success(`Импортировано ${result.imported_rows} строк, правил создано: ${rules_to_create.length}`)
      // Caller is responsible for reloading the transactions list on close
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка импорта')
    } finally { setCommitting(false) }
  }

  const autoCategorize = async () => {
    if (!preview) return
    // Collect rows that have counterparty mapped but no category, and aren't transfers/skipped
    const candidates = preview.rows
      .filter(r => {
        const s = rowStates[r.index]
        if (!s) return false
        return s.counterparty_id && !s.category_id && !s.is_transfer && !s.skip
      })
      .map(r => ({ index: r.index, counterparty_id: rowStates[r.index].counterparty_id, type: r.type }))

    if (candidates.length === 0) {
      toast.success('Нет строк для авто-распределения (у всех уже есть категория или нет контрагента)')
      return
    }
    setAutoCategorizing(true)
    try {
      const { suggestions } = await bankImportsApi.autoCategorize(candidates)
      if (suggestions.length === 0) {
        toast.success('Не удалось подобрать категории — нет истории по этим контрагентам')
        return
      }
      setRowStates(prev => {
        const next = { ...prev }
        for (const s of suggestions) {
          if (next[s.index]) next[s.index] = { ...next[s.index], category_id: s.category_id }
        }
        return next
      })
      toast.success(`Проставлено ${suggestions.length} из ${candidates.length}. Проверьте перед импортом.`)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка авто-распределения')
    } finally { setAutoCategorizing(false) }
  }

  // Portal to <body> — same containing-block bypass as TransactionModal/ImportModal
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-border flex-shrink-0">
          <h2 className="text-xl font-bold text-brand-text">Импорт банковских выписок</h2>
          <button
            onClick={onClose}
            disabled={committing}
            className="p-2 hover:bg-subtle rounded-lg transition-colors disabled:opacity-40"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Upload card */}
          <div className="bg-subtle border border-brand-border rounded-xl p-4 mb-5">
            <h3 className="text-sm font-semibold text-brand-text mb-3">1. Загрузка файла</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text"
              >
                <option value="">Автоопределение банка</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.bank_code})</option>
                ))}
              </select>
              <label className="flex-1 cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text-secondary hover:border-primary-400">
                <FileSpreadsheet size={16} />
                <span className="truncate">{file?.name || 'Выбрать .xlsx файл'}</span>
                <input type="file" accept=".xlsx,.xls" hidden onChange={e => e.target.files && onFileSelect(e.target.files[0])} />
              </label>
              <button
                onClick={runPreview}
                disabled={!file || loadingPreview}
                className="px-5 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {loadingPreview && <Loader2 size={16} className="animate-spin" />}
                <Upload size={16} />
                Проверить
              </button>
            </div>
          </div>

          {/* Preview area */}
          {preview && counts && (
            <div className="bg-card border border-brand-border rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-brand-text">2. Превью ({preview.total_rows} строк)</h3>
                  <p className="text-xs text-brand-text-secondary mt-1">
                    {preview.period_start} → {preview.period_end} · банк: {preview.bank_code}
                  </p>
                  <div className="flex gap-2 mt-2 text-xs flex-wrap">
                    <span className="px-2 py-1 rounded bg-green-100 text-green-700">✓ авто: {counts.auto}</span>
                    <span className="px-2 py-1 rounded bg-amber-100 text-amber-700">⚠ частично: {counts.partial}</span>
                    <span className="px-2 py-1 rounded bg-red-100 text-red-700">⛔ ручная разметка: {counts.manual}</span>
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">🔄 переводы: {counts.transfer}</span>
                    <span className="px-2 py-1 rounded bg-gray-100 text-gray-600">❌ дубли: {counts.dup}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={autoCategorize}
                    disabled={autoCategorizing || committing}
                    className="px-4 py-2 bg-card border border-primary-300 text-primary-700 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-40 flex items-center gap-2 text-sm"
                    title="Проставить категории по истории контрагентов"
                  >
                    {autoCategorizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Авто-распределить категории
                  </button>
                  <button
                    onClick={commit}
                    disabled={committing || autoCategorizing}
                    className="px-5 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 flex items-center gap-2"
                  >
                    {committing && <Loader2 size={16} className="animate-spin" />}
                    <CheckCircle2 size={16} />
                    Импортировать {preview.total_rows - counts.dup} строк
                  </button>
                </div>
              </div>

              <p className="text-xs text-brand-text-secondary mb-4 flex items-start gap-1.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <span>
                  «Авто-распределить» проставляет категории по самой частой из истории каждого контрагента.
                  <strong> Проверьте предложенные значения перед импортом</strong> — это эвристика, не правило.
                </span>
              </p>

              {/* Preview table */}
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-xs text-brand-text-secondary">
                      <th className="text-left px-2 py-2 w-8">☑</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Дата</th>
                      <th className="text-right px-2 py-2">Сумма</th>
                      <th className="text-left px-2 py-2">Контрагент</th>
                      <th className="text-left px-2 py-2">→ ERP</th>
                      <th className="text-left px-2 py-2">Категория</th>
                      <th className="text-left px-2 py-2">Запомнить</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r: PreviewRow) => {
                      const s = rowStates[r.index]
                      if (!s) return null
                      const bg =
                        s.skip ? 'opacity-40' :
                        s.is_transfer ? 'bg-blue-50' :
                        r.match_quality === 'inn' && s.category_id ? 'bg-green-50' :
                        s.counterparty_id || s.category_id ? 'bg-amber-50' :
                        'bg-red-50'
                      return (
                        <tr key={r.index} className={`border-b border-brand-border/50 ${bg}`}>
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={!s.skip}
                              onChange={e => setRowStates(prev => ({ ...prev, [r.index]: { ...prev[r.index], skip: !e.target.checked } }))}
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.date}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            <span className={r.type === 'income' ? 'text-green-700' : 'text-red-700'}>
                              {r.type === 'income' ? '+' : '−'}{r.amount.toLocaleString('ru-RU')} ₽
                            </span>
                          </td>
                          <td className="px-2 py-2 max-w-[200px] truncate" title={r.counterparty_name}>
                            {r.counterparty_name}
                            {r.counterparty_inn && <span className="text-xs text-brand-text-secondary block">ИНН {r.counterparty_inn}</span>}
                          </td>
                          <td className="px-2 py-2">
                            {s.is_transfer ? (
                              <span className="text-xs text-blue-700">🔄 Перевод между счетами</span>
                            ) : (
                              <CounterpartySelect
                                value={s.counterparty_id}
                                onChange={cpId => setRowStates(prev => ({ ...prev, [r.index]: { ...prev[r.index], counterparty_id: cpId } }))}
                              />
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {s.is_transfer ? (
                              <span className="text-xs text-brand-text-secondary">—</span>
                            ) : (
                              <CategorySelect
                                value={s.category_id}
                                type={r.type}
                                onChange={catId => setRowStates(prev => ({ ...prev, [r.index]: { ...prev[r.index], category_id: catId } }))}
                              />
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <label className="text-xs flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={s.learn}
                                disabled={!r.counterparty_inn}
                                onChange={e => setRowStates(prev => ({ ...prev, [r.index]: { ...prev[r.index], learn: e.target.checked } }))}
                              />
                              {r.counterparty_inn ? 'для ИНН' : '—'}
                            </label>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
