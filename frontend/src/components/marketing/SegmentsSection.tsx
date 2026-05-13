import { useEffect, useState, FormEvent, Fragment } from 'react'
import { Plus, Edit2, Trash2, Check, X, Users } from 'lucide-react'
import { icpSegmentsApi } from '../../api/icpSegments'
import type { IcpSegment } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { errorMessage, truncate } from './utils'

export const SegmentsSection = () => {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [segments, setSegments] = useState<IcpSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newSegment, setNewSegment] = useState<Partial<IcpSegment>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<IcpSegment>>({})

  useEffect(() => {
    let cancelled = false
    icpSegmentsApi
      .getAll()
      .then((rows) => { if (!cancelled) setSegments(rows) })
      .catch((e) => { if (!cancelled) toast.error(errorMessage(e, 'Не удалось загрузить сегменты')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const closeEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newSegment.slug?.trim() || !newSegment.name?.trim()) {
      toast.error('Заполните slug и название сегмента')
      return
    }
    try {
      setSubmitting(true)
      const created = await icpSegmentsApi.create({
        slug: newSegment.slug.trim(),
        name: newSegment.name.trim(),
        age_range: newSegment.age_range?.trim() || null,
        role: newSegment.role?.trim() || null,
        active: true,
      })
      setSegments((prev) => [...prev, created])
      setNewSegment({})
      toast.success('Сегмент создан')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось создать сегмент'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    if (!editForm.slug?.toString().trim() || !editForm.name?.toString().trim()) {
      toast.error('Заполните slug и название')
      return
    }
    try {
      setSubmitting(true)
      const updated = await icpSegmentsApi.update(editingId, {
        slug: editForm.slug.toString().trim(),
        name: editForm.name.toString().trim(),
        description: editForm.description?.toString().trim() || null,
        age_range: editForm.age_range?.toString().trim() || null,
        role: editForm.role?.toString().trim() || null,
        active: editForm.active ?? true,
      })
      setSegments((prev) => prev.map((s) => (s.id === editingId ? updated : s)))
      closeEdit()
      toast.success('Сегмент обновлён')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось обновить сегмент'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (s: IcpSegment) => {
    const ok = await confirm({
      title: 'Удалить сегмент?',
      message: 'Удалить сегмент? Это нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await icpSegmentsApi.delete(s.id)
      setSegments((prev) => prev.filter((x) => x.id !== s.id))
      if (editingId === s.id) closeEdit()
      toast.success('Сегмент удалён')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось удалить сегмент'))
    }
  }

  if (loading) {
    return (
      <section className="card mb-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/4 mb-3"></div>
        <div className="h-32 bg-muted rounded"></div>
      </section>
    )
  }

  return (
    <section className="card mb-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-brand-text flex items-center space-x-2">
          <Users className="h-6 w-6 text-primary-600" />
          <span>ICP-сегменты</span>
        </h2>
        <p className="text-brand-text-secondary mt-1">
          Целевые аудитории, к которым относятся контент-юниты и рекламные кампании.
        </p>
      </div>

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <input type="text" className="input" placeholder="slug"
          value={newSegment.slug ?? ''}
          onChange={(e) => setNewSegment({ ...newSegment, slug: e.target.value })}
          required aria-label="Slug" />
        <input type="text" className="input" placeholder="Название"
          value={newSegment.name ?? ''}
          onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
          required aria-label="Название" />
        <input type="text" className="input" placeholder="Возраст (например 8-12)"
          value={newSegment.age_range ?? ''}
          onChange={(e) => setNewSegment({ ...newSegment, age_range: e.target.value })}
          aria-label="Возраст" />
        <input type="text" className="input" placeholder="Роль (родитель/ребёнок/педагог)"
          value={newSegment.role ?? ''}
          onChange={(e) => setNewSegment({ ...newSegment, role: e.target.value })}
          aria-label="Роль" />
        <button type="submit" className="btn btn-primary flex items-center justify-center space-x-2" disabled={submitting}>
          <Plus className="h-4 w-4" /><span>Добавить</span>
        </button>
      </form>

      {segments.length === 0 ? (
        <div className="text-center py-8 text-brand-text-secondary">Сегменты не настроены</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Название</th>
                <th className="px-3 py-2 font-medium">Описание</th>
                <th className="px-3 py-2 font-medium">Возраст</th>
                <th className="px-3 py-2 font-medium">Роль</th>
                <th className="px-3 py-2 font-medium text-center">Активен</th>
                <th className="px-3 py-2 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s) => (
                <Fragment key={s.id}>
                  <tr className="border-b border-brand-border last:border-b-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">{s.slug}</td>
                    <td className="px-3 py-2 text-brand-text">{s.name}</td>
                    <td className="px-3 py-2 text-brand-text-secondary" title={s.description ?? ''}>
                      {truncate(s.description) || <span className="text-brand-text-secondary/60">—</span>}
                    </td>
                    <td className="px-3 py-2 text-brand-text-secondary">{s.age_range || <span className="text-brand-text-secondary/60">—</span>}</td>
                    <td className="px-3 py-2 text-brand-text-secondary">{s.role || <span className="text-brand-text-secondary/60">—</span>}</td>
                    <td className="px-3 py-2 text-center">
                      {s.active ? <Check className="h-4 w-4 text-green-600 inline" /> : <X className="h-4 w-4 text-brand-text-secondary/60 inline" />}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end space-x-1">
                        <button type="button"
                          onClick={() => {
                            if (editingId === s.id) {
                              closeEdit()
                            } else {
                              setEditForm({
                                slug: s.slug, name: s.name, description: s.description,
                                age_range: s.age_range, role: s.role, active: s.active,
                              })
                              setEditingId(s.id)
                            }
                          }}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          aria-label="Редактировать">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(s)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Удалить">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === s.id && (
                    <tr className="bg-primary-50/30 border-b border-brand-border">
                      <td colSpan={7} className="px-3 py-4">
                        <form onSubmit={handleUpdate} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input type="text" className="input" placeholder="slug"
                              value={editForm.slug ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                              required aria-label="Slug" />
                            <input type="text" className="input" placeholder="Название"
                              value={editForm.name ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              required aria-label="Название" />
                            <input type="text" className="input" placeholder="Возраст"
                              value={editForm.age_range ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, age_range: e.target.value })}
                              aria-label="Возраст" />
                            <input type="text" className="input" placeholder="Роль"
                              value={editForm.role ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                              aria-label="Роль" />
                          </div>
                          <textarea className="input min-h-[6rem]" placeholder="Описание сегмента"
                            value={editForm.description ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            aria-label="Описание сегмента" />
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox"
                              checked={editForm.active ?? true}
                              onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                              className="h-4 w-4 rounded border-brand-border text-primary-600 focus:ring-primary-400/50" />
                            <span className="text-sm text-brand-text">Активен</span>
                          </label>
                          <div className="flex justify-end space-x-2">
                            <button type="button" onClick={closeEdit} className="btn btn-secondary" disabled={submitting}>Отмена</button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                              {submitting ? 'Сохранение…' : 'Сохранить'}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
