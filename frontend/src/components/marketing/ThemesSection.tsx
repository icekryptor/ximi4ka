import { useEffect, useState, FormEvent, Fragment } from 'react'
import { Plus, Edit2, Trash2, Tag } from 'lucide-react'
import { strategicThemesApi } from '../../api/strategicThemes'
import type { StrategicTheme } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { errorMessage, truncate } from './utils'

export const ThemesSection = () => {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [themes, setThemes] = useState<StrategicTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newTheme, setNewTheme] = useState<Partial<StrategicTheme>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<StrategicTheme>>({})

  useEffect(() => {
    let cancelled = false
    strategicThemesApi
      .getAll()
      .then((rows) => { if (!cancelled) setThemes(rows) })
      .catch((e) => { if (!cancelled) toast.error(errorMessage(e, 'Не удалось загрузить темы')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const closeEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newTheme.slug?.trim() || !newTheme.name?.trim()) {
      toast.error('Заполните slug и название темы')
      return
    }
    try {
      setSubmitting(true)
      const created = await strategicThemesApi.create({
        slug: newTheme.slug.trim(),
        name: newTheme.name.trim(),
        active_from: newTheme.active_from?.trim() || null,
        active_to: newTheme.active_to?.trim() || null,
      })
      setThemes((prev) => [...prev, created])
      setNewTheme({})
      toast.success('Тема создана')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось создать тему'))
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
      const updated = await strategicThemesApi.update(editingId, {
        slug: editForm.slug.toString().trim(),
        name: editForm.name.toString().trim(),
        description: editForm.description?.toString().trim() || null,
        active_from: editForm.active_from?.toString().trim() || null,
        active_to: editForm.active_to?.toString().trim() || null,
      })
      setThemes((prev) => prev.map((t) => (t.id === editingId ? updated : t)))
      closeEdit()
      toast.success('Тема обновлена')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось обновить тему'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (t: StrategicTheme) => {
    const ok = await confirm({
      title: 'Удалить тему?',
      message: 'Удалить тему? Это нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await strategicThemesApi.delete(t.id)
      setThemes((prev) => prev.filter((x) => x.id !== t.id))
      if (editingId === t.id) closeEdit()
      toast.success('Тема удалена')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось удалить тему'))
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
          <Tag className="h-6 w-6 text-primary-600" />
          <span>Стратегические темы</span>
        </h2>
        <p className="text-brand-text-secondary mt-1">
          Тематические фокусы на квартал/период. Контент тегается темой для аналитики.
        </p>
      </div>

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <input type="text" className="input" placeholder="slug"
          value={newTheme.slug ?? ''}
          onChange={(e) => setNewTheme({ ...newTheme, slug: e.target.value })}
          required aria-label="Slug" />
        <input type="text" className="input" placeholder="Название темы"
          value={newTheme.name ?? ''}
          onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
          required aria-label="Название темы" />
        <input type="date" className="input"
          value={newTheme.active_from ?? ''}
          onChange={(e) => setNewTheme({ ...newTheme, active_from: e.target.value })}
          aria-label="Дата начала" />
        <input type="date" className="input"
          value={newTheme.active_to ?? ''}
          onChange={(e) => setNewTheme({ ...newTheme, active_to: e.target.value })}
          aria-label="Дата окончания" />
        <button type="submit" className="btn btn-primary flex items-center justify-center space-x-2" disabled={submitting}>
          <Plus className="h-4 w-4" /><span>Добавить</span>
        </button>
      </form>

      {themes.length === 0 ? (
        <div className="text-center py-8 text-brand-text-secondary">Темы не настроены</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Название</th>
                <th className="px-3 py-2 font-medium">Описание</th>
                <th className="px-3 py-2 font-medium">С</th>
                <th className="px-3 py-2 font-medium">По</th>
                <th className="px-3 py-2 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((t) => (
                <Fragment key={t.id}>
                  <tr className="border-b border-brand-border last:border-b-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">{t.slug}</td>
                    <td className="px-3 py-2 text-brand-text">{t.name}</td>
                    <td className="px-3 py-2 text-brand-text-secondary" title={t.description ?? ''}>
                      {truncate(t.description) || <span className="text-brand-text-secondary/60">—</span>}
                    </td>
                    <td className="px-3 py-2 text-brand-text-secondary">{t.active_from || <span className="text-brand-text-secondary/60">—</span>}</td>
                    <td className="px-3 py-2 text-brand-text-secondary">{t.active_to || <span className="text-brand-text-secondary/60">—</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end space-x-1">
                        <button type="button"
                          onClick={() => {
                            if (editingId === t.id) {
                              closeEdit()
                            } else {
                              setEditForm({
                                slug: t.slug, name: t.name, description: t.description,
                                active_from: t.active_from, active_to: t.active_to,
                              })
                              setEditingId(t.id)
                            }
                          }}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          aria-label="Редактировать">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(t)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Удалить">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === t.id && (
                    <tr className="bg-primary-50/30 border-b border-brand-border">
                      <td colSpan={6} className="px-3 py-4">
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
                            <input type="date" className="input"
                              value={editForm.active_from ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, active_from: e.target.value })}
                              aria-label="Дата начала" />
                            <input type="date" className="input"
                              value={editForm.active_to ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, active_to: e.target.value })}
                              aria-label="Дата окончания" />
                          </div>
                          <textarea className="input min-h-[6rem]" placeholder="Описание темы"
                            value={editForm.description ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            aria-label="Описание темы" />
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
