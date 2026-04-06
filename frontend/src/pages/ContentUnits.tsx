import { useState, useEffect, useCallback } from 'react'
import { Plus, ExternalLink, X, Trash2, Pencil, Youtube, Instagram, Calendar, Check, Link as LinkIcon } from 'lucide-react'
import { contentUnitsApi, ContentUnit } from '../api/contentUnits'
import { useToast } from '../contexts/ToastContext'

// TikTok icon (not in lucide)
const IconTikTok = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2 6.34 6.34 0 0 0 9.49 21.5a6.34 6.34 0 0 0 6.34-6.34V8.71a8.16 8.16 0 0 0 3.76.92V6.19a4.85 4.85 0 0 1-.01.5z" />
  </svg>
)

// ─── Content Card ────────────────────────────────────────────────────────

interface ContentCardProps {
  item: ContentUnit
  onEdit: (item: ContentUnit) => void
  onToggle: (item: ContentUnit, platform: 'youtube' | 'instagram' | 'tiktok') => void
  onDelete: (id: string) => void
}

function ContentCard({ item, onEdit, onToggle, onDelete }: ContentCardProps) {
  const allPublished = item.youtube_published && item.instagram_published && item.tiktok_published
  const somePublished = item.youtube_published || item.instagram_published || item.tiktok_published

  return (
    <div className={`bg-card rounded-2xl border transition-all hover:shadow-md ${
      allPublished ? 'border-green-300 dark:border-green-700' : 'border-brand-border'
    }`}>
      <div className="p-4">
        {/* Header: title + actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-brand-text line-clamp-2 flex-1">{item.title}</h3>
          <div className="flex items-center gap-1 shrink-0">
            {item.material_url && (
              <a
                href={item.material_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded-lg text-brand-text-secondary hover:text-primary-600 dark:hover:text-primary-400 hover:bg-surface-hover transition-colors"
                title="Открыть материал"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <button
              onClick={() => onEdit(item)}
              className="p-1 rounded-lg text-brand-text-secondary hover:text-primary-600 dark:hover:text-primary-400 hover:bg-surface-hover transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1 rounded-lg text-brand-text-secondary hover:text-red-500 dark:hover:text-red-400 hover:bg-surface-hover transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-xs text-brand-text-secondary mb-3 line-clamp-2">{item.description}</p>
        )}

        {/* Material link */}
        {item.material_url && (
          <div className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 mb-3 truncate">
            <LinkIcon size={12} className="shrink-0" />
            <span className="truncate">{item.material_url}</span>
          </div>
        )}

        {/* Platform rows */}
        <div className="space-y-2">
          <PlatformRow
            icon={<Youtube size={16} />}
            label="YouTube"
            date={item.youtube_date}
            published={item.youtube_published}
            onToggle={() => onToggle(item, 'youtube')}
            colorClass="text-red-500"
          />
          <PlatformRow
            icon={<Instagram size={16} />}
            label="Instagram"
            date={item.instagram_date}
            published={item.instagram_published}
            onToggle={() => onToggle(item, 'instagram')}
            colorClass="text-pink-500"
          />
          <PlatformRow
            icon={<IconTikTok />}
            label="TikTok"
            date={item.tiktok_date}
            published={item.tiktok_published}
            onToggle={() => onToggle(item, 'tiktok')}
            colorClass="text-brand-text"
          />
        </div>
      </div>

      {/* Status bar */}
      <div className={`px-4 py-2 rounded-b-2xl text-[11px] font-medium ${
        allPublished
          ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400'
          : somePublished
          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
          : 'bg-subtle text-brand-text-secondary'
      }`}>
        {allPublished ? 'Опубликовано везде' : somePublished ? 'Частично опубликовано' : 'Не опубликовано'}
      </div>
    </div>
  )
}

// ─── Platform Row ────────────────────────────────────────────────────────

interface PlatformRowProps {
  icon: React.ReactNode
  label: string
  date: string | null
  published: boolean
  onToggle: () => void
  colorClass: string
}

function PlatformRow({ icon, label, date, published, onToggle, colorClass }: PlatformRowProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        className={`flex items-center justify-center w-6 h-6 rounded-lg border-2 transition-all ${
          published
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-brand-border text-transparent hover:border-green-400'
        }`}
      >
        <Check size={14} />
      </button>
      <span className={`${colorClass} shrink-0`}>{icon}</span>
      <span className="text-xs text-brand-text font-medium flex-1">{label}</span>
      {date && (
        <span className="flex items-center gap-1 text-[11px] text-brand-text-secondary">
          <Calendar size={11} />
          {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  )
}

// ─── Edit/Create Modal ───────────────────────────────────────────────────

interface ModalProps {
  item: Partial<ContentUnit> | null
  onClose: () => void
  onSave: (data: Partial<ContentUnit>) => void
  saving: boolean
}

function ContentUnitModal({ item, onClose, onSave, saving }: ModalProps) {
  const [title, setTitle] = useState(item?.title || '')
  const [description, setDescription] = useState(item?.description || '')
  const [materialUrl, setMaterialUrl] = useState(item?.material_url || '')
  const [youtubeDate, setYoutubeDate] = useState(item?.youtube_date || '')
  const [instagramDate, setInstagramDate] = useState(item?.instagram_date || '')
  const [tiktokDate, setTiktokDate] = useState(item?.tiktok_date || '')

  const isNew = !item?.id

  const handleSubmit = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      material_url: materialUrl.trim() || null,
      youtube_date: youtubeDate || null,
      instagram_date: instagramDate || null,
      tiktok_date: tiktokDate || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-3xl shadow-xl w-full max-w-lg mx-4 border border-brand-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-border">
          <h3 className="text-base font-semibold text-brand-text">
            {isNew ? 'Новая единица контента' : 'Редактирование'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-brand-text-secondary">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-brand-text-secondary mb-1 block">Название *</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Название контента..."
              className="w-full text-sm rounded-xl border border-brand-border bg-subtle text-brand-text px-3 py-2.5 outline-none
                focus:border-primary-400 placeholder:text-brand-text-secondary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-brand-text-secondary mb-1 block">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Описание контента..."
              className="w-full text-sm rounded-xl border border-brand-border bg-subtle text-brand-text px-3 py-2.5 outline-none
                focus:border-primary-400 resize-none placeholder:text-brand-text-secondary"
            />
          </div>

          {/* Material URL */}
          <div>
            <label className="text-xs text-brand-text-secondary mb-1 block">Ссылка на материал</label>
            <div className="relative">
              <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
              <input
                value={materialUrl}
                onChange={e => setMaterialUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-sm rounded-xl border border-brand-border bg-subtle text-brand-text pl-9 pr-3 py-2.5 outline-none
                  focus:border-primary-400 placeholder:text-brand-text-secondary"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-brand-text-secondary mb-1">
                <Youtube size={12} className="text-red-500" /> YouTube
              </label>
              <input
                type="date"
                value={youtubeDate}
                onChange={e => setYoutubeDate(e.target.value)}
                className="w-full text-sm rounded-xl border border-brand-border bg-subtle text-brand-text px-3 py-2 outline-none
                  focus:border-primary-400"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-brand-text-secondary mb-1">
                <Instagram size={12} className="text-pink-500" /> Instagram
              </label>
              <input
                type="date"
                value={instagramDate}
                onChange={e => setInstagramDate(e.target.value)}
                className="w-full text-sm rounded-xl border border-brand-border bg-subtle text-brand-text px-3 py-2 outline-none
                  focus:border-primary-400"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-brand-text-secondary mb-1">
                <IconTikTok /> TikTok
              </label>
              <input
                type="date"
                value={tiktokDate}
                onChange={e => setTiktokDate(e.target.value)}
                className="w-full text-sm rounded-xl border border-brand-border bg-subtle text-brand-text px-3 py-2 outline-none
                  focus:border-primary-400"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-brand-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-brand-text-secondary hover:bg-surface-hover rounded-xl">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            className="px-5 py-2 text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-700
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Сохранение...' : isNew ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function ContentUnits() {
  const toast = useToast()
  const [items, setItems] = useState<ContentUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [modalItem, setModalItem] = useState<Partial<ContentUnit> | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'published' | 'partial' | 'unpublished'>('all')

  const loadItems = useCallback(async () => {
    try {
      const data = await contentUnitsApi.getAll()
      setItems(data)
    } catch {
      toast.error('Ошибка загрузки контента')
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { loadItems() }, [loadItems])

  const handleSave = useCallback(async (data: Partial<ContentUnit>) => {
    setSaving(true)
    try {
      if (modalItem?.id) {
        const updated = await contentUnitsApi.update(modalItem.id, data)
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
        toast.success('Сохранено')
      } else {
        const created = await contentUnitsApi.create(data)
        setItems(prev => [created, ...prev])
        toast.success('Создано')
      }
      setModalItem(null)
    } catch {
      toast.error('Ошибка сохранения')
    }
    setSaving(false)
  }, [modalItem, toast])

  const handleToggle = useCallback(async (item: ContentUnit, platform: 'youtube' | 'instagram' | 'tiktok') => {
    const key = `${platform}_published` as keyof ContentUnit
    const newVal = !item[key]
    // Optimistic
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, [key]: newVal } : i))
    try {
      await contentUnitsApi.update(item.id, { [key]: newVal } as any)
    } catch {
      // Rollback
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, [key]: !newVal } : i))
      toast.error('Ошибка обновления')
    }
  }, [toast])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Удалить единицу контента?')) return
    setItems(prev => prev.filter(i => i.id !== id))
    try {
      await contentUnitsApi.delete(id)
      toast.success('Удалено')
    } catch {
      toast.error('Ошибка удаления')
      loadItems()
    }
  }, [toast, loadItems])

  const filtered = items.filter(item => {
    if (filter === 'all') return true
    const all = item.youtube_published && item.instagram_published && item.tiktok_published
    const some = item.youtube_published || item.instagram_published || item.tiktok_published
    if (filter === 'published') return all
    if (filter === 'partial') return some && !all
    return !some
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-brand-text">Единицы контента</h1>
        <button
          onClick={() => setModalItem({})}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm rounded-xl
            hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          Добавить
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        {([
          ['all', 'Все'],
          ['unpublished', 'Не опубликовано'],
          ['partial', 'Частично'],
          ['published', 'Опубликовано'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-sm rounded-xl border transition-colors ${
              filter === key
                ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-300'
                : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300 dark:hover:border-primary-600'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-brand-text-secondary ml-2">{filtered.length} из {items.length}</span>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-brand-text-secondary">
          <p className="mb-3">{items.length === 0 ? 'Нет единиц контента' : 'Нет результатов по фильтру'}</p>
          {items.length === 0 && (
            <button
              onClick={() => setModalItem({})}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} className="inline mr-1" />
              Создать первую
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              onEdit={setModalItem}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalItem !== null && (
        <ContentUnitModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}
