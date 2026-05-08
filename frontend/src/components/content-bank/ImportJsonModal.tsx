import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, FileJson, Loader2, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import {
  unitsApi,
  ImportPreviewResponse,
  ImportCommitResponse,
} from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  onClose: () => void
}

type Step = 'upload' | 'preview' | 'done'

export default function ImportJsonModal({ onClose }: Props) {
  const toast = useToast()
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [result, setResult] = useState<ImportCommitResponse | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      toast.warning('Поддерживаются только .json файлы')
      return
    }
    setLoading(true)
    try {
      const r = await unitsApi.importPreview(file)
      setPreview(r)
      setStep('preview')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка разбора файла')
    }
    setLoading(false)
  }

  const onCommit = async () => {
    if (!preview) return
    setLoading(true)
    try {
      const r = await unitsApi.importCommit(preview.preview_token)
      setResult(r)
      setStep('done')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка применения импорта')
    }
    setLoading(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-border flex-shrink-0">
          <h3 className="text-lg font-bold text-brand-text">
            {step === 'upload' && 'Импорт JSON'}
            {step === 'preview' && 'Предпросмотр импорта'}
            {step === 'done' && 'Импорт завершён'}
          </h3>
          <button
            onClick={() => !loading && onClose()}
            disabled={loading}
            className="p-2 hover:bg-subtle rounded-lg disabled:opacity-40"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) onFileSelect(f)
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-brand-border rounded-xl p-12 text-center hover:border-primary-400 cursor-pointer"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onFileSelect(f)
                }}
              />
              {loading ? (
                <div className="space-y-2">
                  <Loader2 size={32} className="animate-spin mx-auto text-primary-500" />
                  <p className="text-brand-text-secondary">Разбор файла...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileJson size={32} className="text-primary-400 mx-auto" />
                  <p className="text-base font-medium text-brand-text">
                    Перетащи .json файл сюда
                  </p>
                  <p className="text-sm text-brand-text-secondary">или кликни для выбора</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-subtle rounded-xl p-4">
                  <p className="text-xs uppercase text-brand-text-secondary mb-2">Рубрики</p>
                  <p className="text-sm text-brand-text">
                    <span className="font-bold text-green-700">{preview.rubrics.to_create}</span> новых,{' '}
                    <span className="text-brand-text-secondary">{preview.rubrics.to_skip}</span> пропустим
                  </p>
                </div>
                <div className="bg-subtle rounded-xl p-4">
                  <p className="text-xs uppercase text-brand-text-secondary mb-2">Идеи</p>
                  <p className="text-sm text-brand-text">
                    <span className="font-bold text-green-700">{preview.units.to_insert}</span> новых,{' '}
                    <span className="font-bold text-amber-700">{preview.units.to_update}</span> обновим,{' '}
                    <span className="text-brand-text-secondary">{preview.units.to_skip_duplicate}</span> дублей
                  </p>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                    <AlertTriangle size={14} /> Предупреждения:
                  </p>
                  {preview.warnings.slice(0, 5).map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">{w}</p>
                  ))}
                  {preview.warnings.length > 5 && (
                    <p className="text-xs text-amber-700">…и ещё {preview.warnings.length - 5}</p>
                  )}
                </div>
              )}

              {preview.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                    <AlertCircle size={14} /> Ошибки:
                  </p>
                  {preview.errors.slice(0, 5).map((er, i) => (
                    <p key={i} className="text-xs text-red-700">{er}</p>
                  ))}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                ОБНОВЛЕНИЕ перезапишет: <code>hook</code>, <code>hook_ab</code>, <code>visual</code>, <code>essence</code>, <code>notes</code>, <code>video_url</code>, <code>publications</code>.
                НЕ перезапишет: <code>review_grade</code>, <code>review_feedback</code>, <code>reviewed_at</code>, <code>created_*</code>.
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && result && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle size={48} className="text-green-500 mx-auto" />
              <h4 className="text-lg font-bold text-brand-text">Импорт завершён</h4>
              <div className="text-sm text-brand-text-secondary space-y-1">
                <p>
                  Рубрики: создано <strong className="text-green-700">{result.rubrics.created}</strong>, пропущено {result.rubrics.skipped}
                </p>
                <p>
                  Идеи: вставлено <strong className="text-green-700">{result.units.inserted}</strong>, обновлено <strong className="text-amber-700">{result.units.updated}</strong>, пропущено {result.units.skipped}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-brand-border flex-shrink-0">
          {step === 'upload' && (
            <button onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Закрыть
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={onClose} className="btn btn-secondary" disabled={loading}>
                Отмена
              </button>
              <button
                onClick={onCommit}
                disabled={
                  loading ||
                  preview!.errors.length > 0 ||
                  preview!.units.to_insert + preview!.units.to_update === 0
                }
                className="btn btn-primary flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Импортировать ✓
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose} className="btn btn-primary">
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
