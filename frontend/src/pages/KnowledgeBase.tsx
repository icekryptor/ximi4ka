import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, FileText, Pencil, Plus, Save, X } from 'lucide-react'
import { brandDocsApi } from '../api/brandDocs'
import type { BrandDoc } from '../api/types'
import { useToast } from '../contexts/ToastContext'
import { errorMessage } from '../components/marketing/utils'

const KB_PREFIX = 'kb-'

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

/** «Розлив растворов» → 'kb-rozliv-rastvorov'. Пустая база → '' (создание блокируется). */
const makeKbSlug = (name: string): string => {
  const base = name
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return base ? KB_PREFIX + base : ''
}

const formatDate = (iso: string | undefined): string => {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const KnowledgeBase = () => {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [docs, setDocs] = useState<BrandDoc[]>([])
  const [loading, setLoading] = useState(true)

  // Создание нового документа
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  // Черновик: документ ещё не сохранён на сервере (появится после первого «Сохранить»)
  const [draftDoc, setDraftDoc] = useState<{ slug: string; title: string } | null>(null)

  // Редактор
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [contentDraft, setContentDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedSlug = searchParams.get('doc')
  const selectedDoc = useMemo(
    () => (selectedSlug ? docs.find((d) => d.slug === selectedSlug) ?? null : null),
    [docs, selectedSlug],
  )
  const newSlug = makeKbSlug(newName)

  const load = async () => {
    try {
      const all = await brandDocsApi.list()
      setDocs(
        all
          .filter((d) => d.slug.startsWith(KB_PREFIX))
          .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
      )
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось загрузить базу знаний'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // one-shot: обновление списка — через load() после сохранения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // При переходе между документами (в т.ч. кнопкой «назад») сбрасываем режим редактирования
  useEffect(() => {
    setEditing(false)
    setDraftDoc(null)
  }, [selectedSlug])

  const openDoc = (slug: string) => {
    setSearchParams({ doc: slug })
  }

  const backToList = () => {
    setEditing(false)
    setDraftDoc(null)
    setSearchParams({})
  }

  const startCreate = () => {
    const slug = makeKbSlug(newName)
    if (!slug) {
      toast.error('Введите название документа')
      return
    }
    if (docs.some((d) => d.slug === slug)) {
      toast.info('Документ с таким слагом уже существует — открываю его')
      setShowCreate(false)
      setNewName('')
      openDoc(slug)
      return
    }
    setDraftDoc({ slug, title: newName.trim() })
    setTitleDraft(newName.trim())
    setContentDraft('')
    setEditing(true)
    setShowCreate(false)
    setNewName('')
  }

  const startEdit = (doc: BrandDoc) => {
    setTitleDraft(doc.title)
    setContentDraft(doc.content)
    setEditing(true)
  }

  const cancelEdit = () => {
    if (draftDoc) {
      backToList()
      return
    }
    setEditing(false)
  }

  const handleSave = async () => {
    const slug = draftDoc?.slug ?? selectedDoc?.slug
    if (!slug) return
    try {
      setSaving(true)
      await brandDocsApi.upsert(slug, {
        title: titleDraft.trim() || slug,
        content: contentDraft,
      })
      toast.success('Документ сохранён')
      setEditing(false)
      setDraftDoc(null)
      await load()
      setSearchParams({ doc: slug })
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось сохранить документ'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 bg-muted rounded w-1/4 mb-6 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Режим документа (сохранённый, черновик или не найден) ────────────────
  if (draftDoc || selectedSlug) {
    const currentTitle = draftDoc ? draftDoc.title : selectedDoc?.title
    const currentSlug = draftDoc ? draftDoc.slug : selectedSlug

    if (!draftDoc && !selectedDoc) {
      return (
        <div className="p-8">
          <button
            type="button"
            onClick={backToList}
            className="flex items-center gap-2 text-brand-text-secondary hover:text-brand-text mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>К списку</span>
          </button>
          <section className="card text-center py-12">
            <FileText className="h-10 w-10 text-brand-text-secondary/50 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-brand-text mb-1">Регламент не найден</h2>
            <p className="text-brand-text-secondary">
              Документа со слагом <code className="font-mono">{selectedSlug}</code> нет в базе знаний.
            </p>
          </section>
        </div>
      )
    }

    return (
      <div className="p-8">
        <button
          type="button"
          onClick={backToList}
          className="flex items-center gap-2 text-brand-text-secondary hover:text-brand-text mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>К списку</span>
        </button>

        <section className="card">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              {editing ? (
                <input
                  className="input text-lg font-semibold w-full md:w-96"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="Название документа"
                  aria-label="Название документа"
                />
              ) : (
                <h1 className="text-2xl font-semibold text-brand-text flex items-center gap-2">
                  <FileText className="h-6 w-6 text-primary-600 shrink-0" />
                  <span className="truncate" title={currentTitle}>{currentTitle}</span>
                </h1>
              )}
              <p className="text-xs text-brand-text-secondary/70 mt-1 font-mono">{currentSlug}</p>
              {!draftDoc && selectedDoc?.updated_at && (
                <p className="text-xs text-brand-text-secondary/70 mt-0.5">
                  Обновлён: {formatDate(selectedDoc.updated_at)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="btn btn-secondary flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    <span>Отмена</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Сохранение…' : 'Сохранить'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => selectedDoc && startEdit(selectedDoc)}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Редактировать</span>
                </button>
              )}
            </div>
          </div>

          {editing ? (
            <textarea
              className="w-full min-h-[24rem] p-4 border border-brand-border rounded-2xl font-mono text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/40"
              value={contentDraft}
              onChange={(e) => setContentDraft(e.target.value)}
              placeholder="# Регламент&#10;&#10;## Шаги&#10;1. ..."
              spellCheck={false}
              aria-label="Содержимое документа (markdown)"
            />
          ) : selectedDoc?.content ? (
            <pre className="whitespace-pre-wrap font-mono text-sm text-brand-text bg-muted/40 border border-brand-border rounded-2xl p-4 overflow-x-auto">
              {selectedDoc.content}
            </pre>
          ) : (
            <p className="text-brand-text-secondary text-sm py-8 text-center">
              Документ пуст — нажмите «Редактировать», чтобы заполнить.
            </p>
          )}
        </section>
      </div>
    )
  }

  // ─── Список ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-text flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary-600" />
            <span>База знаний</span>
          </h1>
          <p className="text-brand-text-secondary mt-1">
            Регламенты производства и рабочие инструкции. Привязываются к операциям схемы сборки.
          </p>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn btn-primary flex items-center gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Документ</span>
          </button>
        )}
      </header>

      {showCreate && (
        <section className="card mb-6">
          <h2 className="text-lg font-semibold text-brand-text mb-3">Новый регламент</h2>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm text-brand-text-secondary mb-1" htmlFor="kb-new-name">
                Название
              </label>
              <input
                id="kb-new-name"
                className="input w-full"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') startCreate() }}
                placeholder="Розлив растворов"
                autoFocus
              />
              <p className="text-xs text-brand-text-secondary/70 mt-1 font-mono">
                Слаг: {newSlug || '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewName('') }}
                className="btn btn-secondary"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={startCreate}
                disabled={!newSlug}
                className="btn btn-primary disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </section>
      )}

      {docs.length === 0 ? (
        <section className="card text-center py-12">
          <BookOpen className="h-10 w-10 text-brand-text-secondary/50 mx-auto mb-3" />
          <p className="text-brand-text-secondary">
            Пока нет ни одного регламента — создайте первый.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {docs.map((doc) => (
            <button
              key={doc.slug}
              type="button"
              onClick={() => openDoc(doc.slug)}
              className="text-left rounded-2xl border border-brand-border bg-card p-4 hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3 mb-2">
                <FileText className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-brand-text truncate" title={doc.title}>
                    {doc.title}
                  </h3>
                  <p className="text-xs text-brand-text-secondary/70 font-mono truncate">{doc.slug}</p>
                </div>
              </div>
              <p className="text-xs text-brand-text-secondary">
                Обновлён: {formatDate(doc.updated_at)}
              </p>
              <p className="mt-2 text-xs text-primary-600">
                {doc.content ? 'Открыть →' : 'Заполнить →'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default KnowledgeBase
