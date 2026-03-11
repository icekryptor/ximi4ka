import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, FileText, FileImage, FileSpreadsheet, File, ExternalLink, Loader2 } from 'lucide-react'
import { supplyDocumentsApi, SupplyDocument, DOC_TYPE_LABELS } from '../api/supplyDocuments'
import { useToast } from '../App'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS)

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext ?? '')) return <FileImage className="h-4 w-4 text-blue-500" />
  if (['xls', 'xlsx'].includes(ext ?? ''))  return <FileSpreadsheet className="h-4 w-4 text-green-600" />
  if (ext === 'pdf')                         return <FileText className="h-4 w-4 text-red-500" />
  return <File className="h-4 w-4 text-gray-400" />
}

function formatBytes(name: string) {
  // just show extension
  return name.split('.').pop()?.toUpperCase() ?? 'FILE'
}

interface Props {
  supplyId: string
}

export default function SupplyDocuments({ supplyId }: Props) {
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docs,       setDocs]       = useState<SupplyDocument[]>([])
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [docType,    setDocType]    = useState('invoice')
  const [docNotes,   setDocNotes]   = useState('')
  const [error,      setError]      = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setDocs(await supplyDocumentsApi.getAll(supplyId))
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [supplyId])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''
    setUploading(true)
    setError('')
    try {
      await supplyDocumentsApi.upload(supplyId, files, docType, docNotes || undefined)
      setDocNotes('')
      await load()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Ошибка загрузки файлов')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc: SupplyDocument) => {
    if (!window.confirm(`Удалить документ «${doc.original_name}»?`)) return
    try {
      await supplyDocumentsApi.delete(supplyId, doc.id)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
    } catch {
      showToast('Не удалось удалить документ', 'error')
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Документы</h3>

      {/* Upload controls */}
      <div className="flex gap-2 flex-wrap">
        <select
          className="input text-sm flex-1 min-w-32"
          value={docType}
          onChange={e => setDocType(e.target.value)}
        >
          {DOC_TYPES.map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <input
          type="text"
          className="input text-sm flex-[2] min-w-40"
          placeholder="Примечание (необязательно)"
          value={docNotes}
          onChange={e => setDocNotes(e.target.value)}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn btn-secondary flex items-center gap-2 text-sm shrink-0"
        >
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin" />Загрузка…</>
            : <><Upload className="h-4 w-4" />Прикрепить файлы</>
          }
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.doc,.docx"
          onChange={handleFile}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Documents list */}
      {loading ? (
        <div className="text-sm text-gray-400 py-2">Загрузка...</div>
      ) : docs.length === 0 ? (
        <div className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
          Нет прикреплённых документов
        </div>
      ) : (
        <div className="space-y-1.5">
          {docs.map(doc => (
            <div key={doc.id}
              className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg group"
            >
              {fileIcon(doc.original_name)}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate">{doc.original_name}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-500 shrink-0">
                    {formatBytes(doc.original_name)}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded shrink-0">
                    {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                  </span>
                </div>
                {doc.notes && (
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{doc.notes}</div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={`${API_BASE}${doc.file_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Открыть"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(doc)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Удалить"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
