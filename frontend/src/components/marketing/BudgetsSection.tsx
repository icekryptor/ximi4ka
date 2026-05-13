import { useEffect, useState, FormEvent, Fragment } from 'react'
import { Plus, Edit2, Trash2, Wallet } from 'lucide-react'
import { channelBudgetsApi } from '../../api/channelBudgets'
import { publishChannelsApi } from '../../api/publishChannels'
import type { ChannelBudget, PublishChannel } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { errorMessage, truncate, rubFormatter } from './utils'

export const BudgetsSection = () => {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [budgets, setBudgets] = useState<ChannelBudget[]>([])
  const [channels, setChannels] = useState<PublishChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newBudget, setNewBudget] = useState<Partial<ChannelBudget>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ChannelBudget>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all([channelBudgetsApi.getAll(), publishChannelsApi.getAll()])
      .then(([buds, chs]) => {
        if (cancelled) return
        setBudgets(buds)
        setChannels(chs)
      })
      .catch((e) => { if (!cancelled) toast.error(errorMessage(e, 'Не удалось загрузить бюджеты')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const channelById = (id: string | undefined): PublishChannel | undefined =>
    id ? channels.find((c) => c.id === id) : undefined

  const closeEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newBudget.channel_id || !newBudget.period_start || !newBudget.period_end || !newBudget.amount_rub) {
      toast.error('Заполните все обязательные поля бюджета')
      return
    }
    try {
      setSubmitting(true)
      const created = await channelBudgetsApi.create({
        channel_id: newBudget.channel_id,
        period_start: newBudget.period_start.toString(),
        period_end: newBudget.period_end.toString(),
        amount_rub: newBudget.amount_rub.toString(),
        notes: newBudget.notes?.toString().trim() || null,
      })
      setBudgets((prev) => [...prev, created])
      setNewBudget({})
      toast.success('Бюджет создан')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось создать бюджет'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    if (
      !editForm.channel_id || !editForm.period_start || !editForm.period_end ||
      editForm.amount_rub === undefined || editForm.amount_rub === null || editForm.amount_rub === ''
    ) {
      toast.error('Заполните все обязательные поля бюджета')
      return
    }
    try {
      setSubmitting(true)
      const updated = await channelBudgetsApi.update(editingId, {
        channel_id: editForm.channel_id.toString(),
        period_start: editForm.period_start.toString(),
        period_end: editForm.period_end.toString(),
        amount_rub: editForm.amount_rub.toString(),
        notes: editForm.notes?.toString().trim() || null,
      })
      setBudgets((prev) => prev.map((b) => (b.id === editingId ? updated : b)))
      closeEdit()
      toast.success('Бюджет обновлён')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось обновить бюджет'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (b: ChannelBudget) => {
    const ok = await confirm({
      title: 'Удалить бюджет?',
      message: 'Удалить бюджет? Это нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await channelBudgetsApi.delete(b.id)
      setBudgets((prev) => prev.filter((x) => x.id !== b.id))
      if (editingId === b.id) closeEdit()
      toast.success('Бюджет удалён')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось удалить бюджет'))
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
          <Wallet className="h-6 w-6 text-primary-600" />
          <span>Бюджеты каналов</span>
        </h2>
        <p className="text-brand-text-secondary mt-1">
          Плановые бюджеты на платную рекламу по каналам. Сверяется с фактом расходов в PPC-модуле и аналитике.
        </p>
      </div>

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <select className="input" value={newBudget.channel_id ?? ''}
          onChange={(e) => setNewBudget({ ...newBudget, channel_id: e.target.value })}
          required aria-label="Канал">
          <option value="">— Канал —</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
        </select>
        <input type="date" className="input"
          value={newBudget.period_start ?? ''}
          onChange={(e) => setNewBudget({ ...newBudget, period_start: e.target.value })}
          required aria-label="Дата начала" />
        <input type="date" className="input"
          value={newBudget.period_end ?? ''}
          onChange={(e) => setNewBudget({ ...newBudget, period_end: e.target.value })}
          required aria-label="Дата окончания" />
        <input type="number" step="0.01" min="0" className="input" placeholder="Бюджет, ₽"
          value={newBudget.amount_rub ?? ''}
          onChange={(e) => setNewBudget({ ...newBudget, amount_rub: e.target.value })}
          required aria-label="Сумма в рублях" />
        <button type="submit" className="btn btn-primary flex items-center justify-center space-x-2" disabled={submitting}>
          <Plus className="h-4 w-4" /><span>Добавить</span>
        </button>
      </form>

      {budgets.length === 0 ? (
        <div className="text-center py-8 text-brand-text-secondary">Бюджеты не настроены</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                <th className="px-3 py-2 font-medium">Канал</th>
                <th className="px-3 py-2 font-medium">С</th>
                <th className="px-3 py-2 font-medium">По</th>
                <th className="px-3 py-2 font-medium text-right">Бюджет</th>
                <th className="px-3 py-2 font-medium">Заметки</th>
                <th className="px-3 py-2 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => {
                const channel = b.channel ?? channelById(b.channel_id)
                return (
                  <Fragment key={b.id}>
                    <tr className="border-b border-brand-border last:border-b-0 hover:bg-muted/40">
                      <td className="px-3 py-2 text-brand-text">
                        {channel?.display_name ?? <span className="text-brand-text-secondary/60">— канал не найден —</span>}
                      </td>
                      <td className="px-3 py-2 text-brand-text-secondary">{b.period_start}</td>
                      <td className="px-3 py-2 text-brand-text-secondary">{b.period_end}</td>
                      <td className="px-3 py-2 text-brand-text text-right font-medium tabular-nums">
                        {rubFormatter.format(parseFloat(b.amount_rub))} ₽
                      </td>
                      <td className="px-3 py-2 text-brand-text-secondary" title={b.notes ?? ''}>
                        {truncate(b.notes, 60) || <span className="text-brand-text-secondary/60">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end space-x-1">
                          <button type="button"
                            onClick={() => {
                              if (editingId === b.id) {
                                closeEdit()
                              } else {
                                setEditForm({
                                  channel_id: b.channel_id, period_start: b.period_start,
                                  period_end: b.period_end, amount_rub: b.amount_rub, notes: b.notes,
                                })
                                setEditingId(b.id)
                              }
                            }}
                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            aria-label="Редактировать">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(b)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Удалить">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === b.id && (
                      <tr className="bg-primary-50/30 border-b border-brand-border">
                        <td colSpan={6} className="px-3 py-4">
                          <form onSubmit={handleUpdate} className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <select className="input" value={editForm.channel_id ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, channel_id: e.target.value })}
                                required aria-label="Канал">
                                <option value="">— Канал —</option>
                                {channels.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                              </select>
                              <input type="date" className="input"
                                value={editForm.period_start ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, period_start: e.target.value })}
                                required aria-label="Дата начала" />
                              <input type="date" className="input"
                                value={editForm.period_end ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, period_end: e.target.value })}
                                required aria-label="Дата окончания" />
                              <input type="number" step="0.01" min="0" className="input" placeholder="Бюджет, ₽"
                                value={editForm.amount_rub ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, amount_rub: e.target.value })}
                                required aria-label="Сумма в рублях" />
                            </div>
                            <textarea className="input min-h-[5rem]" placeholder="Заметки"
                              value={editForm.notes ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              aria-label="Заметки" />
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
