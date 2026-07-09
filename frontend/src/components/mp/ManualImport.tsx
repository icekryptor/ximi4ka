import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react'
import { mpAnalyticsApi, MpPlatform, MpUploadResult } from '../../api/mpAnalytics'
import { useToast } from '../../contexts/ToastContext'

/**
 * Ручная заливка дневных показателей (фоллбэк автосинка).
 * Шаг 1 «Проверить» — dryRun (предпросмотр: что распозналось). Шаг 2 «Импортировать».
 * kind: funnel (Аналитика продаж) | ads (Реклама). platform — из вкладки страницы.
 */
export const ManualImport = ({
  platform, kind, onImported,
}: {
  platform: MpPlatform
  kind: 'funnel' | 'ads'
  onImported?: () => void
}) => {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<MpUploadResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const reset = () => { setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = '' }

  const check = async (f: File) => {
    setBusy(true); setPreview(null)
    try {
      setPreview(await mpAnalyticsApi.upload(f, platform, kind, true))
    } catch (e: any) {
      toast.error('Не удалось разобрать файл: ' + (e.response?.data?.error || e.message))
    } finally { setBusy(false) }
  }

  const commit = async () => {
    if (!file) return
    setBusy(true)
    try {
      const r = await mpAnalyticsApi.upload(file, platform, kind, false)
      toast.success(`Импортировано строк: ${r.imported ?? 0}`)
      reset(); setOpen(false); onImported?.()
    } catch (e: any) {
      toast.error('Ошибка импорта: ' + (e.response?.data?.error || e.message))
    } finally { setBusy(false) }
  }

  const label = kind === 'ads' ? 'рекламы' : 'показателей'

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-card px-3 py-2 text-sm text-brand-text-secondary hover:border-primary-300 hover:text-primary-700">
        <Upload className="h-4 w-4" /> Загрузить {label} из файла
      </button>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-brand-text">Ручная заливка {label} ({platform === 'ozon' ? 'Озон' : 'ВБ'})</h3>
        </div>
        <button onClick={() => { reset(); setOpen(false) }} className="text-xs text-brand-text-secondary hover:text-brand-text">закрыть</button>
      </div>

      <p className="text-xs text-brand-text-secondary">
        Фоллбэк, когда автосинк не сработал. Загрузите выгрузку {platform === 'ozon' ? 'Озон' : 'ВБ'} (xlsx/csv)
        с колонками по дням и артикулам — колонки сопоставляются по названиям. Сначала «Проверить» (предпросмотр),
        затем «Импортировать».
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv"
          onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); if (f) check(f) }}
          className="text-sm text-brand-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-primary-700" />
        {busy && <span className="text-xs text-brand-text-secondary">обработка…</span>}
      </div>

      {preview && (
        <div className="space-y-2 rounded-xl border border-brand-border/70 bg-muted/30 p-3 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-brand-text">Распознано строк: <b>{preview.rows_parsed}</b></span>
            {preview.rows_skipped > 0 && <span className="text-brand-text-secondary">пропущено (без даты/SKU): {preview.rows_skipped}</span>}
          </div>
          <div>
            <div className="mb-1 text-brand-text-secondary">Сопоставление колонок:</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(preview.field_map).map(([f, h]) => (
                <span key={f} className="rounded-md bg-green-50 px-2 py-0.5 text-green-700 ring-1 ring-inset ring-green-200">
                  {f} ← {h}
                </span>
              ))}
            </div>
          </div>
          {preview.unmatched_headers.length > 0 && (
            <div className="flex items-start gap-1.5 text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Не привязаны (игнорируются): {preview.unmatched_headers.join(', ')}</span>
            </div>
          )}
          {preview.rows_parsed === 0 && (
            <div className="text-red-600">Ни одной строки не распознано — проверьте, что есть колонки «Дата» и «Артикул/SKU».</div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={commit} disabled={busy || !preview || preview.rows_parsed === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">
          <Check className="h-4 w-4" /> Импортировать{preview ? ` ${preview.rows_parsed} строк` : ''}
        </button>
        {file && <button onClick={reset} disabled={busy} className="text-xs text-brand-text-secondary hover:text-brand-text">сбросить</button>}
      </div>
    </div>
  )
}
