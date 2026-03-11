import { Fragment, useState, useRef } from 'react'
import { X, Upload, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { Dialog, Transition } from '@headlessui/react'
import { transactionsApi, ParsedTransactionRow, ImportPreview } from '../api/transactions'
import { formatCurrency } from '../utils/format'
import { useToast } from '../App'

interface ImportModalProps {
  onClose: () => void
}

type Step = 'upload' | 'preview' | 'done'

const ImportModal = ({ onClose }: ImportModalProps) => {
  const { showToast } = useToast()
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showToast('Поддерживаются только файлы .xlsx', 'error')
      return
    }

    setLoading(true)
    try {
      const result = await transactionsApi.importXlsx(file)
      setPreview(result)

      // Auto-select non-duplicate rows
      const nonDupIndexes = new Set(
        result.parsed
          .filter((r) => !r.is_duplicate)
          .map((_, idx) => idx)
      )
      setSelectedRows(nonDupIndexes)
      setStep('preview')
    } catch (error) {
      console.error('Ошибка загрузки файла:', error)
      showToast('Ошибка при разборе файла', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleConfirm = async () => {
    if (!preview) return

    const rowsToImport = preview.parsed.filter((_, idx) => selectedRows.has(idx))
    if (rowsToImport.length === 0) {
      showToast('Нет выбранных строк', 'error')
      return
    }

    setLoading(true)
    try {
      const result = await transactionsApi.confirmImport(rowsToImport)
      setImportedCount(result.imported)
      setStep('done')
    } catch (error) {
      console.error('Ошибка импорта:', error)
      showToast('Ошибка при импорте', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (idx: number) => {
    const next = new Set(selectedRows)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setSelectedRows(next)
  }

  const toggleAll = () => {
    if (!preview) return
    if (selectedRows.size === preview.parsed.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(preview.parsed.map((_, i) => i)))
    }
  }

  // formatCurrency imported from utils/format

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95 translate-y-2"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="modal-panel max-w-5xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-brand-border">
                <h2 className="text-2xl font-bold text-brand-text">
                  {step === 'upload' && 'Импорт транзакций'}
                  {step === 'preview' && 'Предпросмотр импорта'}
                  {step === 'done' && 'Импорт завершён'}
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-brand-surface rounded-lg transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                {/* Step 1: Upload */}
                {step === 'upload' && (
                  <div
                    className="border-2 border-dashed border-brand-border rounded-xl p-12 text-center hover:border-primary-400 transition-colors cursor-pointer"
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileRef.current?.click()}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileSelect(file)
                      }}
                    />
                    {loading ? (
                      <div className="space-y-3">
                        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
                        <p className="text-brand-text-secondary">Анализ файла...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <FileSpreadsheet className="h-12 w-12 text-primary-400 mx-auto" />
                        <p className="text-lg font-medium text-brand-text">
                          Перетащите файл .xlsx сюда
                        </p>
                        <p className="text-brand-text-secondary">или нажмите для выбора файла</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Preview */}
                {step === 'preview' && preview && (
                  <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-green-700">{preview.newRows}</p>
                        <p className="text-sm text-green-600">Новых</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-amber-700">{preview.duplicates}</p>
                        <p className="text-sm text-amber-600">Дубликатов</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-red-700">{preview.errors.length}</p>
                        <p className="text-sm text-red-600">Ошибок</p>
                      </div>
                    </div>

                    {/* Errors */}
                    {preview.errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-sm font-medium text-red-700 mb-1">Ошибки:</p>
                        {preview.errors.slice(0, 5).map((err, i) => (
                          <p key={i} className="text-xs text-red-600">{err}</p>
                        ))}
                        {preview.errors.length > 5 && (
                          <p className="text-xs text-red-500 mt-1">...и ещё {preview.errors.length - 5}</p>
                        )}
                      </div>
                    )}

                    {/* Table */}
                    <div className="border border-brand-border rounded-xl overflow-hidden">
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-brand-surface sticky top-0">
                            <tr>
                              <th className="py-2 px-3 text-left w-10">
                                <input
                                  type="checkbox"
                                  checked={selectedRows.size === preview.parsed.length}
                                  onChange={toggleAll}
                                />
                              </th>
                              <th className="py-2 px-3 text-left text-xs font-medium">Тип</th>
                              <th className="py-2 px-3 text-left text-xs font-medium">Дата</th>
                              <th className="py-2 px-3 text-left text-xs font-medium">Описание</th>
                              <th className="py-2 px-3 text-right text-xs font-medium">Сумма</th>
                              <th className="py-2 px-3 text-left text-xs font-medium">Категория</th>
                              <th className="py-2 px-3 text-left text-xs font-medium">Контрагент</th>
                              <th className="py-2 px-3 text-center text-xs font-medium w-16">Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.parsed.map((row, idx) => (
                              <tr
                                key={idx}
                                className={`border-t border-gray-100 ${
                                  row.is_duplicate ? 'bg-amber-50/50' : ''
                                }`}
                              >
                                <td className="py-2 px-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedRows.has(idx)}
                                    onChange={() => toggleRow(idx)}
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                      row.type === 'income'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {row.type === 'income' ? 'Д' : 'Р'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap">{row.date}</td>
                                <td className="py-2 px-3 max-w-[200px] truncate">{row.description}</td>
                                <td className="py-2 px-3 text-right font-medium">
                                  {formatCurrency(row.amount)}
                                </td>
                                <td className="py-2 px-3 text-xs">{row.category_name || '—'}</td>
                                <td className="py-2 px-3 text-xs">{row.counterparty_name || '—'}</td>
                                <td className="py-2 px-3 text-center">
                                  {row.is_duplicate ? (
                                    <span title="Дубликат"><AlertTriangle className="h-4 w-4 text-amber-500 inline" /></span>
                                  ) : (
                                    <span title="Новая"><CheckCircle className="h-4 w-4 text-green-500 inline" /></span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                      <p className="text-sm text-brand-text-secondary">
                        Выбрано: <span className="font-medium text-brand-text">{selectedRows.size}</span> из{' '}
                        {preview.parsed.length}
                      </p>
                      <div className="flex space-x-3">
                        <button onClick={onClose} className="btn btn-secondary" disabled={loading}>
                          Отмена
                        </button>
                        <button
                          onClick={handleConfirm}
                          className="btn btn-primary"
                          disabled={loading || selectedRows.size === 0}
                        >
                          {loading ? 'Импорт...' : `Импортировать (${selectedRows.size})`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Done */}
                {step === 'done' && (
                  <div className="text-center py-8 space-y-4">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                    <h3 className="text-xl font-bold text-brand-text">
                      Импортировано {importedCount} транзакций
                    </h3>
                    <button onClick={onClose} className="btn btn-primary">
                      Закрыть
                    </button>
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

export default ImportModal
