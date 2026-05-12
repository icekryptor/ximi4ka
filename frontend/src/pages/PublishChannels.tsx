import { useEffect, useState, FormEvent } from 'react'
import axios from 'axios'
import { Plus, Edit2, Trash2, Check, X, Radio } from 'lucide-react'
import { publishChannelsApi } from '../api/publishChannels'
import { PublishChannel, ChannelPlatform, ChannelIntegrationStatus } from '../api/types'
import { useToast } from '../contexts/ToastContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'

const PLATFORM_LABELS: Record<ChannelPlatform, string> = {
  telegram: 'Telegram',
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  youtube: 'YouTube',
  youtube_shorts: 'YouTube Shorts',
  vk: 'VK',
  x: 'X (Twitter)',
  instagram: 'Instagram',
  yandex_zen: 'Яндекс.Дзен',
  site: 'Сайт',
  wb: 'Wildberries',
  ozon: 'Ozon',
  email: 'Email',
  other: 'Другое',
}

const PLATFORM_ORDER: ChannelPlatform[] = [
  'telegram', 'tiktok', 'reels', 'youtube', 'youtube_shorts',
  'vk', 'x', 'instagram', 'yandex_zen', 'site', 'wb', 'ozon', 'email', 'other',
]

const INTEGRATION_LABELS: Record<ChannelIntegrationStatus, string> = {
  manual: 'Ручная публикация',
  api_connected: 'API подключён',
  api_planned: 'Планируется API',
}

const INTEGRATION_ORDER: ChannelIntegrationStatus[] = ['manual', 'api_connected', 'api_planned']

interface FormState {
  slug: string
  display_name: string
  platform: ChannelPlatform
  account_handle: string
  profile_url: string
  integration_status: ChannelIntegrationStatus
  active: boolean
}

const emptyForm: FormState = {
  slug: '',
  display_name: '',
  platform: 'telegram',
  account_handle: '',
  profile_url: '',
  integration_status: 'manual',
  active: true,
}

const PublishChannels = () => {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [channels, setChannels] = useState<PublishChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await publishChannelsApi.getAll()
      setChannels(data)
    } catch (error) {
      console.error('Ошибка загрузки каналов:', error)
      toast.error('Не удалось загрузить каналы публикации')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setIsFormOpen(false)
  }

  const handleAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setIsFormOpen(true)
  }

  const handleEdit = (channel: PublishChannel) => {
    setForm({
      slug: channel.slug,
      display_name: channel.display_name,
      platform: channel.platform,
      account_handle: channel.account_handle ?? '',
      profile_url: channel.profile_url ?? '',
      integration_status: channel.integration_status,
      active: channel.active,
    })
    setEditingId(channel.id)
    setIsFormOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.slug.trim() || !form.display_name.trim()) {
      toast.error('Заполните slug и название канала')
      return
    }

    const payload: Partial<PublishChannel> = {
      slug: form.slug.trim(),
      display_name: form.display_name.trim(),
      platform: form.platform,
      account_handle: form.account_handle.trim() ? form.account_handle.trim() : null,
      profile_url: form.profile_url.trim() ? form.profile_url.trim() : null,
      integration_status: form.integration_status,
      active: form.active,
    }

    try {
      setSubmitting(true)
      if (editingId) {
        await publishChannelsApi.update(editingId, payload)
        toast.success('Канал обновлён')
      } else {
        await publishChannelsApi.create(payload)
        toast.success('Канал создан')
      }
      resetForm()
      await loadData()
    } catch (error) {
      console.error('Ошибка сохранения канала:', error)
      const message =
        axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : 'Не удалось сохранить канал'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (channel: PublishChannel) => {
    const ok = await confirm({
      title: 'Удалить канал?',
      message: 'Удалить канал? Это нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return

    try {
      await publishChannelsApi.delete(channel.id)
      setChannels((prev) => prev.filter((c) => c.id !== channel.id))
      toast.success('Канал удалён')
    } catch (error) {
      console.error('Ошибка удаления канала:', error)
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error('Канал используется в публикациях, удаление запрещено')
      } else {
        toast.error('Не удалось удалить канал')
      }
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-text">Каналы публикации</h1>
          <p className="text-brand-text-secondary mt-1">
            Площадки, на которых публикуется контент. Используются модулем контент-маркетинга и аналитикой.
          </p>
        </div>
        {!isFormOpen && (
          <button onClick={handleAdd} className="btn btn-primary flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Добавить канал</span>
          </button>
        )}
      </div>

      {/* Inline add/edit form */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="card mb-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-brand-text">
              {editingId ? 'Редактирование канала' : 'Новый канал'}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="p-2 text-brand-text-secondary hover:bg-muted rounded-lg transition-colors"
              aria-label="Закрыть форму"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
                placeholder="tiktok"
              />
              <p className="text-xs text-brand-text-secondary mt-1">
                Уникальный идентификатор; для каналов с публикациями — должен совпадать с legacy network: tiktok / instagram / youtube.
              </p>
            </div>

            <div>
              <label className="label">
                Название <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                required
                placeholder="TikTok @ximi4ka"
              />
            </div>

            <div>
              <label className="label">Платформа</label>
              <select
                className="input"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value as ChannelPlatform })}
              >
                {PLATFORM_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Статус интеграции</label>
              <select
                className="input"
                value={form.integration_status}
                onChange={(e) =>
                  setForm({ ...form, integration_status: e.target.value as ChannelIntegrationStatus })
                }
              >
                {INTEGRATION_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {INTEGRATION_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Аккаунт / handle</label>
              <input
                type="text"
                className="input"
                value={form.account_handle}
                onChange={(e) => setForm({ ...form, account_handle: e.target.value })}
                placeholder="@ximi4ka"
              />
            </div>

            <div>
              <label className="label">URL профиля</label>
              <input
                type="url"
                className="input"
                value={form.profile_url}
                onChange={(e) => setForm({ ...form, profile_url: e.target.value })}
                placeholder="https://tiktok.com/@ximi4ka"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-brand-border text-primary-600 focus:ring-primary-400/50"
                />
                <span className="text-sm text-brand-text">Активен</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-brand-border">
            <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Сохранение…' : editingId ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {channels.length === 0 ? (
        <div className="card text-center py-12">
          <Radio className="h-16 w-16 text-brand-text-secondary mx-auto mb-4" />
          <p className="text-brand-text-secondary text-lg mb-4">Каналы публикации не настроены</p>
          {!isFormOpen && (
            <button onClick={handleAdd} className="btn btn-primary">
              Добавить первый канал
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Платформа</th>
                <th className="px-4 py-3 font-medium">Аккаунт</th>
                <th className="px-4 py-3 font-medium">Интеграция</th>
                <th className="px-4 py-3 font-medium text-center">Активен</th>
                <th className="px-4 py-3 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id} className="border-b border-brand-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs text-brand-text">{channel.slug}</td>
                  <td className="px-4 py-3 text-brand-text">{channel.display_name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                      {PLATFORM_LABELS[channel.platform]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brand-text-secondary">
                    {channel.account_handle || <span className="text-brand-text-secondary/60">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        channel.integration_status === 'api_connected'
                          ? 'bg-green-100 text-green-700'
                          : channel.integration_status === 'api_planned'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-muted text-brand-text-secondary'
                      }`}
                    >
                      {INTEGRATION_LABELS[channel.integration_status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {channel.active ? (
                      <Check className="h-4 w-4 text-green-600 inline" />
                    ) : (
                      <X className="h-4 w-4 text-brand-text-secondary/60 inline" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end space-x-1">
                      <button
                        onClick={() => handleEdit(channel)}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        aria-label="Редактировать"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(channel)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default PublishChannels
