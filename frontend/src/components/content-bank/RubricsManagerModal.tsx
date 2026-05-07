import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronUp, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { ContentRubric, rubricsApi } from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'

interface Props {
  onClose: () => void
  onChanged?: () => void
}

interface RubricForm {
  slug: string
  title: string
  emoji: string
  tone: string
  audience: string
  cta_template: string
}

const EMPTY_FORM: RubricForm = {
  slug: '',
  title: '',
  emoji: '',
  tone: '',
  audience: '',
  cta_template: '',
}

function fromRubric(r: ContentRubric): RubricForm {
  return {
    slug: r.slug,
    title: r.title,
    emoji: r.emoji || '',
    tone: r.tone || '',
    audience: r.audience || '',
    cta_template: r.cta_template || '',
  }
}

export function RubricsManagerModal({ onClose, onChanged }: Props) {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [rubrics, setRubrics] = useState<ContentRubric[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editing state: id of rubric being edited inline, or 'new' for the add form, or null
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<RubricForm>(EMPTY_FORM)

  const load = async () => {
    setLoading(true)
    try {
      const list = await rubricsApi.getAll()
      setRubrics(list)
    } catch {
      toast.error('Не удалось загрузить рубрики')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [saving, onClose])

  const startAdd = () => {
    setEditingId('new')
    setForm(EMPTY_FORM)
  }

  const startEdit = (r: ContentRubric) => {
    setEditingId(r.id)
    setForm(fromRubric(r))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const submitForm = async () => {
    if (!form.title.trim()) {
      toast.error('Укажите название рубрики')
      return
    }
    if (!form.slug.trim()) {
      toast.error('Укажите slug')
      return
    }

    const payload: Partial<ContentRubric> = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      emoji: form.emoji.trim() || null,
      tone: form.tone.trim() || null,
      audience: form.audience.trim() || null,
      cta_template: form.cta_template.trim() || null,
    }

    setSaving(true)
    try {
      if (editingId === 'new') {
        // Append at end
        await rubricsApi.create({
          ...payload,
          sort_order: rubrics.length,
        })
        toast.success('Рубрика создана')
      } else if (editingId) {
        await rubricsApi.update(editingId, payload)
        toast.success('Рубрика сохранена')
      }
      cancelEdit()
      await load()
      onChanged?.()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (r: ContentRubric) => {
    const ok = await confirm({
      title: 'Удалить рубрику?',
      message: `Все привязанные единицы потеряют рубрику. Действие нельзя отменить.`,
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    setSaving(true)
    try {
      await rubricsApi.delete(r.id)
      toast.success('Удалено')
      if (editingId === r.id) cancelEdit()
      await load()
      onChanged?.()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка удаления')
    } finally {
      setSaving(false)
    }
  }

  const move = async (r: ContentRubric, direction: -1 | 1) => {
    const idx = rubrics.findIndex((x) => x.id === r.id)
    const newIdx = idx + direction
    if (idx < 0 || newIdx < 0 || newIdx >= rubrics.length) return
    const other = rubrics[newIdx]
    setSaving(true)
    try {
      // Swap sort_order values
      await Promise.all([
        rubricsApi.update(r.id, { sort_order: other.sort_order }),
        rubricsApi.update(other.id, { sort_order: r.sort_order }),
      ])
      await load()
      onChanged?.()
    } catch {
      toast.error('Ошибка перестановки')
    } finally {
      setSaving(false)
    }
  }

  const renderForm = () => (
    <div className="bg-subtle p-4 rounded-xl space-y-3 border border-brand-border">
      <h4 className="text-sm font-semibold text-brand-text">
        {editingId === 'new' ? 'Новая рубрика' : 'Редактирование рубрики'}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-brand-text-secondary">Эмодзи</label>
          <input
            type="text"
            className="input"
            placeholder="💡"
            maxLength={4}
            value={form.emoji}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-brand-text-secondary">Название *</label>
          <input
            type="text"
            className="input"
            placeholder="Как разбогатеть на химии"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-brand-text-secondary">Slug *</label>
        <input
          type="text"
          className="input"
          placeholder="rich-on-chem"
          value={form.slug}
          onChange={(e) =>
            setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })
          }
        />
      </div>
      <div>
        <label className="text-xs text-brand-text-secondary">Tone (тональность)</label>
        <textarea
          className="input"
          rows={2}
          placeholder="Например: дерзкий, ироничный, по-простому"
          value={form.tone}
          onChange={(e) => setForm({ ...form, tone: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-brand-text-secondary">Audience (аудитория)</label>
        <textarea
          className="input"
          rows={2}
          placeholder="Например: подростки 12-16, родители"
          value={form.audience}
          onChange={(e) => setForm({ ...form, audience: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-brand-text-secondary">CTA template</label>
        <textarea
          className="input"
          rows={2}
          placeholder="Шаблон CTA по умолчанию для рубрики"
          value={form.cta_template}
          onChange={(e) => setForm({ ...form, cta_template: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={cancelEdit}
          className="btn btn-secondary"
          disabled={saving}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={submitForm}
          className="btn btn-primary"
          disabled={saving}
        >
          {saving ? 'Сохранение...' : editingId === 'new' ? 'Создать' : 'Сохранить'}
        </button>
      </div>
    </div>
  )

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-brand-border sticky top-0 bg-card z-10">
          <h2 className="text-2xl font-bold text-brand-text">Рубрики</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="py-8 text-center">
              <div className="animate-spin h-6 w-6 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : rubrics.length === 0 && editingId !== 'new' ? (
            <p className="text-sm text-brand-text-secondary text-center py-4">
              Пока нет рубрик
            </p>
          ) : (
            <ul className="space-y-2">
              {rubrics.map((r, idx) => (
                <li key={r.id}>
                  <div className="flex items-center gap-2 bg-card border border-brand-border rounded-xl p-2.5">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(r, -1)}
                        disabled={idx === 0 || saving}
                        className="p-0.5 text-brand-text-secondary hover:text-primary-600 disabled:opacity-30 disabled:hover:text-brand-text-secondary"
                        aria-label="Вверх"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(r, 1)}
                        disabled={idx === rubrics.length - 1 || saving}
                        className="p-0.5 text-brand-text-secondary hover:text-primary-600 disabled:opacity-30 disabled:hover:text-brand-text-secondary"
                        aria-label="Вниз"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-brand-text truncate">
                        {r.emoji ? `${r.emoji} ` : ''}
                        {r.title}
                      </div>
                      <div className="text-xs text-brand-text-secondary truncate">
                        {r.slug}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      title="Редактировать"
                      disabled={saving}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Удалить"
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {editingId === r.id && <div className="mt-2">{renderForm()}</div>}
                </li>
              ))}
            </ul>
          )}

          {editingId === 'new' && renderForm()}

          {editingId === null && (
            <button
              type="button"
              onClick={startAdd}
              className="w-full text-sm px-3 py-2 rounded-xl border border-dashed border-brand-border text-primary-600 hover:border-primary-400 transition-colors"
            >
              + Добавить рубрику
            </button>
          )}

          <div className="flex justify-end pt-2 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={saving}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
