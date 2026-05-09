import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  ContentUnit,
  ContentRubric,
  ContentType,
  ContentStatus,
  unitsApi,
  rubricsApi,
  CONTENT_TYPE_LABELS,
  COMPLEXITY_LABELS,
} from '../../api/contentBank'
import { StatusPicker } from './StatusPicker'
import { PublicationsEditor } from './PublicationsEditor'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  unit: ContentUnit | 'new'
  onClose: () => void
  onSaved?: (saved: ContentUnit) => void
}

interface FormData {
  content_type: ContentType
  rubric_id: string | null
  status: ContentStatus
  complexity: number | null
  title: string
  hook: string
  hook_ab: string
  visual: string
  essence: string
  notes: string
  video_url: string
  script_text: string
  video_brief: string
  voiceover_text: string
  ready_at: string
}

function initialFormData(unit: ContentUnit | 'new'): FormData {
  if (unit === 'new') {
    return {
      content_type: 'short_video',
      rubric_id: null,
      status: 'idea',
      complexity: null,
      title: '',
      hook: '',
      hook_ab: '',
      visual: '',
      essence: '',
      notes: '',
      video_url: '',
      script_text: '',
      video_brief: '',
      voiceover_text: '',
      ready_at: '',
    }
  }
  return {
    content_type: unit.content_type,
    rubric_id: unit.rubric_id,
    status: unit.status,
    complexity: unit.complexity,
    title: unit.title || '',
    hook: unit.hook || '',
    hook_ab: unit.hook_ab || '',
    visual: unit.visual || '',
    essence: unit.essence || '',
    notes: unit.notes || '',
    video_url: unit.video_url || '',
    script_text: unit.script_text ?? '',
    video_brief: unit.video_brief ?? '',
    voiceover_text: unit.voiceover_text ?? '',
    ready_at: unit.ready_at ? new Date(unit.ready_at).toISOString().slice(0, 10) : '',
  }
}

export function UnitEditModal({ unit, onClose, onSaved }: Props) {
  const toast = useToast()
  const [formData, setFormData] = useState<FormData>(() => initialFormData(unit))
  const [rubrics, setRubrics] = useState<ContentRubric[]>([])
  const [saving, setSaving] = useState(false)
  // Tracks the unit after first save in 'new' mode so PublicationsEditor can render
  const [unitInternal, setUnitInternal] = useState<ContentUnit | null>(
    unit !== 'new' ? unit : null,
  )

  // Load rubrics once
  useEffect(() => {
    rubricsApi
      .getAll()
      .then(setRubrics)
      .catch(() => toast.error('Не удалось загрузить рубрики'))
  }, [toast])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [saving, onClose])

  const selectedRubric = rubrics.find((r) => r.id === formData.rubric_id) || null

  const handleSave = async () => {
    let title = formData.title.trim()
    if (!title && formData.hook.trim()) {
      title = formData.hook.trim().slice(0, 80)
    }
    if (!title) {
      toast.error('Укажите заголовок или крючок')
      return
    }

    const payload: Partial<ContentUnit> = {
      content_type: formData.content_type,
      rubric_id: formData.rubric_id,
      status: formData.status,
      complexity: formData.complexity,
      title,
      hook: formData.hook.trim() || null,
      hook_ab: formData.hook_ab.trim() || null,
      visual: formData.visual.trim() || null,
      essence: formData.essence.trim() || null,
      notes: formData.notes.trim() || null,
      video_url: formData.video_url.trim() || null,
      script_text: formData.script_text.trim() || null,
      video_brief: formData.video_brief.trim() || null,
      voiceover_text: formData.voiceover_text.trim() || null,
      ready_at: formData.ready_at ? new Date(formData.ready_at).toISOString() : null,
    }

    setSaving(true)
    try {
      // Create-and-stay-open path: when prop is 'new' AND we haven't created yet
      if (unit === 'new' && unitInternal === null) {
        const created = await unitsApi.create(payload)
        setUnitInternal(created)
        // Sync formData.title in case backend trimmed/normalized it
        setFormData((prev) => ({ ...prev, title: created.title }))
        toast.success('Создано')
        return
      }

      // Update path (existing unit, or 'new' that was already created and is being re-saved)
      const idToUpdate = unit !== 'new' ? unit.id : unitInternal!.id
      const updated = await unitsApi.update(idToUpdate, payload)
      // Preserve publications from local state since update endpoint may not return them refreshed
      const merged: ContentUnit = {
        ...updated,
        publications: unitInternal?.publications ?? updated.publications,
      }
      setUnitInternal(merged)
      toast.success('Сохранено')
      onSaved?.(merged)
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const isNewUnsaved = unit === 'new' && unitInternal === null
  const showPublications = !isNewUnsaved
  const publicationsUnitId = unitInternal?.id || (unit !== 'new' ? unit.id : '')
  const publications =
    unitInternal?.publications || (unit !== 'new' ? unit.publications : [])

  // ---- conditional fields by content_type ----
  const renderTypeFields = () => {
    if (formData.content_type === 'short_video') {
      return (
        <>
          <div>
            <label className="label">Hook (крючок)</label>
            <input
              type="text"
              className="input"
              placeholder="Что цепляет в первые 3 секунды?"
              value={formData.hook}
              onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Hook A/B (альтернативный вариант)</label>
            <input
              type="text"
              className="input"
              placeholder="Запасной крючок для A/B-тестов"
              value={formData.hook_ab}
              onChange={(e) => setFormData({ ...formData, hook_ab: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Визуал / план съёмки</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Что снимаем, какие планы, какие реакции?"
              value={formData.visual}
              onChange={(e) => setFormData({ ...formData, visual: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Суть / структура</label>
            <textarea
              className="input"
              rows={4}
              placeholder="О чём ролик, какая мораль/CTA?"
              value={formData.essence}
              onChange={(e) => setFormData({ ...formData, essence: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Заметки</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Любые внутренние заметки"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </>
      )
    }

    if (formData.content_type === 'text_post') {
      return (
        <>
          <div>
            <label className="label">Заголовок</label>
            <input
              type="text"
              className="input"
              placeholder="Заголовок поста"
              value={formData.hook}
              onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Тело поста</label>
            <textarea
              className="input"
              rows={8}
              placeholder="Полный текст поста..."
              value={formData.essence}
              onChange={(e) => setFormData({ ...formData, essence: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Заметки</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Любые внутренние заметки"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </>
      )
    }

    // 'other' — show all
    return (
      <>
        <div>
          <label className="label">Hook</label>
          <input
            type="text"
            className="input"
            value={formData.hook}
            onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Hook A/B</label>
          <input
            type="text"
            className="input"
            value={formData.hook_ab}
            onChange={(e) => setFormData({ ...formData, hook_ab: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Визуал</label>
          <textarea
            className="input"
            rows={3}
            value={formData.visual}
            onChange={(e) => setFormData({ ...formData, visual: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Суть</label>
          <textarea
            className="input"
            rows={4}
            value={formData.essence}
            onChange={(e) => setFormData({ ...formData, essence: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Заметки</label>
          <textarea
            className="input"
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>
      </>
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        className="bg-card rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-brand-border sticky top-0 bg-card z-10">
          <h2 className="text-2xl font-bold text-brand-text">
            {unit === 'new' && unitInternal === null
              ? 'Новая единица контента'
              : 'Редактирование'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type + Rubric */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Тип</label>
              <div className="flex flex-col gap-1">
                {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      name="content_type"
                      value={t}
                      checked={formData.content_type === t}
                      onChange={() =>
                        setFormData({ ...formData, content_type: t })
                      }
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-brand-text">{CONTENT_TYPE_LABELS[t]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Рубрика</label>
              <select
                className="input"
                value={formData.rubric_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    rubric_id: e.target.value || null,
                  })
                }
              >
                <option value="">Без рубрики</option>
                {rubrics.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.emoji ? `${r.emoji} ` : ''}
                    {r.title}
                  </option>
                ))}
              </select>
              {selectedRubric && (
                <div className="mt-2 text-xs text-brand-text-secondary space-y-0.5">
                  {selectedRubric.tone && (
                    <div>
                      <span className="font-medium">Tone:</span> {selectedRubric.tone}
                    </div>
                  )}
                  {selectedRubric.audience && (
                    <div>
                      <span className="font-medium">Audience:</span>{' '}
                      {selectedRubric.audience}
                    </div>
                  )}
                  {selectedRubric.cta_template && (
                    <div>
                      <span className="font-medium">CTA:</span>{' '}
                      {selectedRubric.cta_template}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="label">Статус</label>
            <StatusPicker
              value={formData.status}
              onChange={(s) => setFormData({ ...formData, status: s })}
            />
          </div>

          {/* Complexity */}
          <div>
            <label className="label">Сложность</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((n) => {
                const active = formData.complexity === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        complexity: active ? null : n,
                      })
                    }
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      active
                        ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-400 text-primary-700'
                        : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
                    }`}
                  >
                    {COMPLEXITY_LABELS[n]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ready-at date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
              📅 Дата готовности
            </label>
            <input
              type="date"
              value={formData.ready_at}
              onChange={(e) => setFormData({ ...formData, ready_at: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
            />
          </div>

          {/* Title */}
          <div>
            <label className="label">Название</label>
            <input
              type="text"
              className="input"
              placeholder="Короткое внутреннее название"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Conditional fields */}
          {renderTypeFields()}

          {/* Master video URL */}
          <div>
            <label className="label">Master-видео URL</label>
            <input
              type="url"
              className="input"
              placeholder="https://..."
              value={formData.video_url}
              onChange={(e) =>
                setFormData({ ...formData, video_url: e.target.value })
              }
            />
          </div>

          {/* Production section */}
          <section className="space-y-3 border-t border-brand-border pt-4">
            <h3 className="text-sm font-semibold text-brand-text">🎬 Производство</h3>

            <div>
              <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
                Сценарий
              </label>
              <textarea
                value={formData.script_text}
                onChange={(e) => setFormData({ ...formData, script_text: e.target.value })}
                rows={10}
                placeholder="Полный текст сценария — проговаривается при съёмке."
                className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y font-mono text-sm whitespace-pre-line"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
                  ТЗ для видео
                </label>
                <textarea
                  value={formData.video_brief}
                  onChange={(e) => setFormData({ ...formData, video_brief: e.target.value })}
                  rows={5}
                  placeholder="Что снимаем, ракурсы, реквизит, локация…"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
                  Озвучка
                </label>
                <textarea
                  value={formData.voiceover_text}
                  onChange={(e) => setFormData({ ...formData, voiceover_text: e.target.value })}
                  rows={5}
                  placeholder="Текст голоса за кадром."
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm"
                />
              </div>
            </div>
          </section>

          {/* Publications section */}
          <div className="pt-4 border-t border-brand-border">
            {showPublications ? (
              <PublicationsEditor
                unitId={publicationsUnitId}
                publications={publications}
                onChange={(next) => {
                  if (unitInternal) {
                    setUnitInternal({ ...unitInternal, publications: next })
                  }
                }}
              />
            ) : (
              <p className="text-xs text-brand-text-secondary italic">
                Сохраните единицу, чтобы добавить публикации
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={saving}
            >
              {unitInternal && unit === 'new' ? 'Закрыть' : 'Отмена'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving
                ? 'Сохранение...'
                : isNewUnsaved
                  ? 'Создать'
                  : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
