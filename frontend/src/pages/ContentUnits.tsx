import { useState, useEffect, useCallback } from 'react'
import { Plus, ExternalLink, X, Trash2, Pencil, Youtube, Instagram, Link as LinkIcon, Download, Loader2, Upload, Hash, Settings } from 'lucide-react'
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
  onDateChange: (item: ContentUnit, platform: 'youtube' | 'instagram' | 'tiktok', date: string | null) => void
  onDelete: (id: string) => void
  onPublishYouTube: (item: ContentUnit) => void
  onMarkPublished: (item: ContentUnit, platform: 'youtube' | 'instagram' | 'tiktok') => void
  ytConnected: boolean
  publishing: boolean
}

function ContentCard({ item, onEdit, onDateChange, onDelete, onPublishYouTube, onMarkPublished, ytConnected, publishing }: ContentCardProps) {
  const allDates = item.youtube_date && item.instagram_date && item.tiktok_date
  const someDates = item.youtube_date || item.instagram_date || item.tiktok_date

  return (
    <div className={`bg-card rounded-2xl border transition-all hover:shadow-md ${
      allDates ? 'border-green-300 dark:border-green-700' : 'border-brand-border'
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

        {/* Description preview (2-3 lines) */}
        <div className="mb-3">
          {item.description ? (
            <p className="text-xs text-brand-text-secondary line-clamp-3 leading-relaxed">{item.description}</p>
          ) : (
            <p className="text-xs text-brand-text-secondary/40 italic">Нет описания</p>
          )}
        </div>

        {/* Tags as colored badges */}
        {item.tags && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.split(/[\s,]+/).filter(Boolean).map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
                  bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Material link */}
        {item.material_url && (
          <div className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 mb-3 truncate">
            <LinkIcon size={12} className="shrink-0" />
            <span className="truncate">{item.material_url}</span>
          </div>
        )}

        {/* Platform date pickers */}
        <div className="space-y-2">
          <div className="space-y-1">
            <PlatformDateRow
              icon={<Youtube size={14} />}
              label="YT"
              date={item.youtube_date}
              onChange={d => onDateChange(item, 'youtube', d)}
              colorClass="text-red-500"
            />
            {item.youtube_date && !item.youtube_published && ytConnected && (
              <button
                onClick={() => onPublishYouTube(item)}
                disabled={publishing}
                className="ml-7 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-lg
                  bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400
                  hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishing ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                {publishing ? 'Загрузка на YT...' : 'Опубликовать на YT'}
              </button>
            )}
            {item.youtube_published && (
              <div className="ml-7 flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
                <span>✓</span>
                {item.youtube_published_url ? (
                  <a href={item.youtube_published_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {item.publish_status === 'scheduled' ? 'Запланировано' : 'Опубликовано'}
                  </a>
                ) : (
                  <span>{item.publish_status === 'scheduled' ? 'Запланировано' : 'Опубликовано'}</span>
                )}
              </div>
            )}
            {item.publish_status === 'error' && item.publish_error && (
              <p className="ml-7 text-[10px] text-red-500 truncate" title={item.publish_error}>Ошибка: {item.publish_error}</p>
            )}
          </div>
          <div className="space-y-1">
            <PlatformDateRow
              icon={<Instagram size={14} />}
              label="IG"
              date={item.instagram_date}
              onChange={d => onDateChange(item, 'instagram', d)}
              colorClass="text-pink-500"
            />
            {item.instagram_published ? (
              <div className="ml-7 flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
                <span>✓</span>
                {item.instagram_published_url ? (
                  <a href={item.instagram_published_url} target="_blank" rel="noopener noreferrer" className="hover:underline">Опубликовано</a>
                ) : <span>Опубликовано</span>}
              </div>
            ) : item.instagram_date ? (
              <button
                onClick={() => onMarkPublished(item, 'instagram')}
                className="ml-7 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-lg
                  bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400
                  hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-colors"
              >
                Отметить опубл.
              </button>
            ) : null}
          </div>
          <div className="space-y-1">
            <PlatformDateRow
              icon={<IconTikTok />}
              label="TT"
              date={item.tiktok_date}
              onChange={d => onDateChange(item, 'tiktok', d)}
              colorClass="text-brand-text"
            />
            {item.tiktok_published ? (
              <div className="ml-7 flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
                <span>✓</span>
                {item.tiktok_published_url ? (
                  <a href={item.tiktok_published_url} target="_blank" rel="noopener noreferrer" className="hover:underline">Опубликовано</a>
                ) : <span>Опубликовано</span>}
              </div>
            ) : item.tiktok_date ? (
              <button
                onClick={() => onMarkPublished(item, 'tiktok')}
                className="ml-7 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-lg
                  bg-gray-100 dark:bg-gray-900/40 text-brand-text-secondary
                  hover:bg-gray-200 dark:hover:bg-gray-800/40 transition-colors"
              >
                Отметить опубл.
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className={`px-4 py-2 rounded-b-2xl text-[11px] font-medium ${
        allDates
          ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400'
          : someDates
          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
          : 'bg-subtle text-brand-text-secondary'
      }`}>
        {allDates ? 'Запланировано везде' : someDates ? 'Частично запланировано' : 'Даты не назначены'}
      </div>
    </div>
  )
}

// ─── Platform Date Row ──────────────────────────────────────────────────

interface PlatformDateRowProps {
  icon: React.ReactNode
  label: string
  date: string | null
  onChange: (date: string | null) => void
  colorClass: string
}

function PlatformDateRow({ icon, label, date, onChange, colorClass }: PlatformDateRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`${colorClass} shrink-0`}>{icon}</span>
      <span className="text-[11px] text-brand-text font-medium w-5 shrink-0">{label}</span>
      <input
        type="date"
        value={date || ''}
        onChange={e => onChange(e.target.value || null)}
        className={`flex-1 text-[11px] rounded-lg border px-2 py-1 outline-none transition-colors
          bg-subtle border-brand-border text-brand-text
          focus:border-primary-400
          ${date ? 'text-brand-text' : 'text-brand-text-secondary'}`}
      />
      {date && (
        <button
          onClick={() => onChange(null)}
          className="p-0.5 rounded text-brand-text-secondary hover:text-red-500 transition-colors"
          title="Убрать дату"
        >
          <X size={12} />
        </button>
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
  const [tags, setTags] = useState(item?.tags || '')

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
      tags: tags.trim() || null,
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

          {/* Tags */}
          <div>
            <label className="text-xs text-brand-text-secondary mb-1 block">Хэштеги</label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="#химия #эксперимент #наука"
                className="w-full text-sm rounded-xl border border-brand-border bg-subtle text-brand-text pl-9 pr-3 py-2.5 outline-none
                  focus:border-primary-400 placeholder:text-brand-text-secondary"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

// ─── Platform Cell (for table view) ─────────────────────────────────────

interface PlatformCellProps {
  date: string | null
  published: boolean
  publishedUrl: string | null
  onDateChange: (date: string | null) => void
  onTogglePublished: () => void
  colorClass: string
}

function PlatformCell({ date, published, publishedUrl, onDateChange, onTogglePublished }: PlatformCellProps) {
  if (!date) {
    return (
      <input
        type="date"
        value=""
        onChange={e => onDateChange(e.target.value || null)}
        className="text-[11px] w-[120px] rounded-lg border border-brand-border bg-card px-2 py-1 text-brand-text-secondary outline-none focus:border-primary-400"
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <input
        type="date"
        value={date}
        onChange={e => onDateChange(e.target.value || null)}
        className="text-[11px] w-[120px] rounded-lg border border-brand-border bg-card px-2 py-1 text-brand-text outline-none focus:border-primary-400"
      />
      <button
        onClick={onTogglePublished}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
          published
            ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-300 dark:border-green-700'
            : 'bg-card text-brand-text-secondary border border-brand-border hover:border-primary-400 hover:text-primary-600'
        }`}
      >
        {published ? '✓ Опубликовано' : 'Отметить'}
      </button>
      {published && publishedUrl && (
        <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary-500 hover:underline">
          Ссылка ↗
        </a>
      )}
    </div>
  )
}

// ─── Content Table ────────────────────────────────────────────────────────

interface ContentTableProps {
  items: ContentUnit[]
  onEdit: (item: ContentUnit) => void
  onDelete: (id: string) => void
  onDateChange: (item: ContentUnit, platform: 'youtube' | 'instagram' | 'tiktok', date: string | null) => void
  onMarkPublished: (item: ContentUnit, platform: 'youtube' | 'instagram' | 'tiktok') => void
  onPublishYouTube: (item: ContentUnit) => void
  ytConnected: boolean
  publishing: boolean
}

function ContentTable({ items, onEdit, onDelete, onDateChange, onMarkPublished }: ContentTableProps) {
  return (
    <div className="bg-card rounded-2xl border border-brand-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Название</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider min-w-[200px]">Описание</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Теги</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-red-500 uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1"><Youtube size={12} /> YT</div>
              </th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-pink-500 uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1"><Instagram size={12} /> IG</div>
              </th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1"><IconTikTok /> TT</div>
              </th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-brand-border/50 hover:bg-brand-surface transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-brand-text text-sm max-w-[250px] truncate">{item.title}</div>
                  {item.material_url && (
                    <a href={item.material_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-500 hover:underline truncate block max-w-[250px]">
                      {item.material_url}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-brand-text-secondary line-clamp-2 max-w-[300px]">{item.description || '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {item.tags?.split(/[\s,]+/).filter(Boolean).slice(0, 3).map((tag, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded-full text-[10px] bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <PlatformCell
                    date={item.youtube_date}
                    published={item.youtube_published}
                    publishedUrl={item.youtube_published_url}
                    onDateChange={d => onDateChange(item, 'youtube', d)}
                    onTogglePublished={() => onMarkPublished(item, 'youtube')}
                    colorClass="text-red-500"
                  />
                </td>
                <td className="px-3 py-3 text-center">
                  <PlatformCell
                    date={item.instagram_date}
                    published={item.instagram_published}
                    publishedUrl={item.instagram_published_url}
                    onDateChange={d => onDateChange(item, 'instagram', d)}
                    onTogglePublished={() => onMarkPublished(item, 'instagram')}
                    colorClass="text-pink-500"
                  />
                </td>
                <td className="px-3 py-3 text-center">
                  <PlatformCell
                    date={item.tiktok_date}
                    published={item.tiktok_published}
                    publishedUrl={item.tiktok_published_url}
                    onDateChange={d => onDateChange(item, 'tiktok', d)}
                    onTogglePublished={() => onMarkPublished(item, 'tiktok')}
                    colorClass="text-brand-text"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-brand-text-secondary hover:text-primary-600 hover:bg-brand-surface transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg text-brand-text-secondary hover:text-red-500 hover:bg-brand-surface transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncUrl, setSyncUrl] = useState(() => localStorage.getItem('yadisk_folder_url') || '')
  const [syncing, setSyncing] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportPlatforms, setExportPlatforms] = useState<Record<string, boolean>>({ youtube: true, instagram: true, tiktok: true })
  const [ytConnected, setYtConnected] = useState(false)
  const [ytChannelName, setYtChannelName] = useState<string | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')

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

  useEffect(() => {
    contentUnitsApi.getYouTubeStatus().then(s => {
      setYtConnected(s.connected)
      setYtChannelName(s.channelName)
    }).catch(() => {})

    // Handle OAuth callback params
    const params = new URLSearchParams(window.location.search)
    if (params.get('youtube_connected') === 'true') {
      setYtConnected(true)
      setYtChannelName(params.get('channel') || 'YouTube')
      toast.success(`YouTube подключён: ${params.get('channel') || ''}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('youtube_error')) {
      toast.error(`Ошибка YouTube: ${params.get('youtube_error')}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

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

  const handleDateChange = useCallback(async (item: ContentUnit, platform: 'youtube' | 'instagram' | 'tiktok', date: string | null) => {
    const key = `${platform}_date` as keyof ContentUnit
    const oldVal = item[key]
    // Optimistic
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, [key]: date } : i))
    try {
      await contentUnitsApi.update(item.id, { [key]: date } as any)
    } catch {
      // Rollback
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, [key]: oldVal } : i))
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

  const handleYouTubeConnect = useCallback(async () => {
    try {
      const url = await contentUnitsApi.getYouTubeAuthUrl()
      window.location.href = url
    } catch {
      toast.error('Ошибка получения ссылки авторизации YouTube')
    }
  }, [toast])

  const handlePublishYouTube = useCallback(async (item: ContentUnit) => {
    if (!confirm(`Опубликовать "${item.title}" на YouTube?`)) return
    setPublishing(item.id)
    try {
      const result = await contentUnitsApi.publishYouTube(item.id)
      setItems(prev => prev.map(i => i.id === item.id ? {
        ...i,
        youtube_published: true,
        youtube_video_id: result.videoId,
        youtube_published_url: result.videoUrl,
        publish_status: result.status,
      } : i))
      toast.success(result.status === 'scheduled'
        ? `Запланировано на YouTube: ${item.youtube_date}`
        : 'Опубликовано на YouTube!'
      )
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Ошибка публикации'
      toast.error(msg)
      loadItems()
    }
    setPublishing(null)
  }, [toast, loadItems])

  const handleMarkPublished = useCallback(async (item: ContentUnit, platform: 'youtube' | 'instagram' | 'tiktok') => {
    const publishedKey = `${platform}_published` as keyof ContentUnit
    const isCurrentlyPublished = item[publishedKey]

    if (isCurrentlyPublished) {
      // Already published — unpublish by updating the field to false
      const optimistic = { ...item, [publishedKey]: false, [`${platform}_published_url`]: null }
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...optimistic } : i))
      try {
        await contentUnitsApi.update(item.id, { [publishedKey]: false, [`${platform}_published_url`]: null } as any)
      } catch {
        toast.error('Ошибка обновления')
        loadItems()
      }
    } else {
      // Not published — mark as published
      const optimistic = { ...item, [publishedKey]: true }
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...optimistic } : i))
      try {
        const updated = await contentUnitsApi.markPublished(item.id, platform)
        setItems(prev => prev.map(i => i.id === item.id ? updated : i))
        toast.success('Отмечено как опубликованное')
      } catch {
        toast.error('Ошибка обновления')
        loadItems()
      }
    }
  }, [toast, loadItems])

  const handleSync = useCallback(async (url?: string) => {
    const targetUrl = (url || syncUrl).trim()
    if (!targetUrl) {
      setSyncModalOpen(true)
      return
    }
    setSyncing(true)
    try {
      localStorage.setItem('yadisk_folder_url', targetUrl)
      setSyncUrl(targetUrl)
      const result = await contentUnitsApi.syncYaDisk(targetUrl)
      if (result.created > 0) {
        setItems(prev => [...result.items, ...prev])
        toast.success(`Загружено ${result.created} новых единиц контента`)
      } else {
        toast.success('Новых файлов не найдено')
      }
      if (result.skipped > 0) {
        toast.success(`Пропущено дубликатов: ${result.skipped}`)
      }
      setSyncModalOpen(false)
    } catch {
      toast.error('Ошибка загрузки с Яндекс.Диска')
    }
    setSyncing(false)
  }, [syncUrl, toast])

  const handleExport = useCallback(async () => {
    const selectedPlatforms = Object.entries(exportPlatforms)
      .filter(([, v]) => v)
      .map(([k]) => k) as ('youtube' | 'instagram' | 'tiktok')[]
    if (selectedPlatforms.length === 0) return

    // Export items that have dates set for selected platforms and aren't published yet
    const exportableIds = items
      .filter(item => selectedPlatforms.some(p => {
        const dateKey = `${p}_date` as keyof ContentUnit
        const pubKey = `${p}_published` as keyof ContentUnit
        return item[dateKey] && !item[pubKey]
      }))
      .map(item => item.id)

    if (exportableIds.length === 0) {
      toast.error('Нет карточек для выгрузки (нужны даты и контент не должен быть опубликован)')
      return
    }

    setExporting(true)
    try {
      const result = await contentUnitsApi.exportToSheets(exportableIds, selectedPlatforms)
      const msgs: string[] = []
      for (const [platform, r] of Object.entries(result.results)) {
        const name = platform === 'youtube' ? 'YouTube' : platform === 'instagram' ? 'Instagram' : 'TikTok'
        if (r.exported > 0) msgs.push(`${name}: ${r.exported}`)
        if (r.skipped > 0) msgs.push(`${name} (пропущено): ${r.skipped}`)
      }
      toast.success(msgs.length > 0 ? `Выгружено: ${msgs.join(', ')}` : 'Нет новых записей для выгрузки')
      setExportModalOpen(false)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Неизвестная ошибка'
      toast.error(`Ошибка выгрузки: ${msg}`)
    }
    setExporting(false)
  }, [items, exportPlatforms, toast])

  const filtered = items.filter(item => {
    if (filter === 'all') return true
    const all = item.youtube_date && item.instagram_date && item.tiktok_date
    const some = item.youtube_date || item.instagram_date || item.tiktok_date
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
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-brand-text">Единицы контента</h1>
          <button
            onClick={() => setModalItem({})}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm rounded-xl
              hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Добавить</span>
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center">
            <button
              onClick={() => handleSync()}
              disabled={syncing}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-brand-border text-brand-text text-xs sm:text-sm rounded-l-xl
                hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
              title={syncUrl ? `Папка: ${syncUrl}` : 'Нажмите для настройки'}
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span className="hidden sm:inline">{syncing ? 'Загрузка...' : 'Загрузить с Я.Диска'}</span>
            </button>
            <button
              onClick={() => setSyncModalOpen(true)}
              className="px-2 py-2 sm:py-2.5 bg-card border border-l-0 border-brand-border text-brand-text-secondary text-sm rounded-r-xl
                hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              title="Изменить папку"
            >
              <Settings size={14} />
            </button>
          </div>
          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-brand-border text-brand-text text-xs sm:text-sm rounded-xl
              hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">Выгрузить в таблицу</span>
          </button>
          {ytConnected ? (
            <div className="flex items-center gap-1.5 px-3 py-2 sm:py-2.5 text-sm text-green-600 dark:text-green-400 bg-card border border-green-300 dark:border-green-700 rounded-xl">
              <Youtube size={16} />
              <span className="text-xs hidden sm:inline">{ytChannelName || 'YouTube'}</span>
              <span className="text-[10px]">✓</span>
            </div>
          ) : (
            <button
              onClick={handleYouTubeConnect}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-red-600 text-white text-xs sm:text-sm rounded-xl hover:bg-red-700 transition-colors"
            >
              <Youtube size={16} />
              <span className="hidden sm:inline">Подключить YouTube</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {([
          ['all', 'Все'],
          ['unpublished', 'Без дат'],
          ['partial', 'Частично'],
          ['published', 'Запланировано'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-xl border transition-colors ${
              filter === key
                ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-300'
                : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300 dark:hover:border-primary-600'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'cards' ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600' : 'text-brand-text-secondary hover:text-brand-text'}`}
            title="Карточки"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600' : 'text-brand-text-secondary hover:text-brand-text'}`}
            title="Таблица"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <span className="text-xs text-brand-text-secondary ml-2">{filtered.length} из {items.length}</span>
        </div>
      </div>

      {/* Cards/Table view */}
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
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              onEdit={setModalItem}
              onDateChange={handleDateChange}
              onDelete={handleDelete}
              onPublishYouTube={handlePublishYouTube}
              onMarkPublished={handleMarkPublished}
              ytConnected={ytConnected}
              publishing={publishing === item.id}
            />
          ))}
        </div>
      ) : (
        <ContentTable
          items={filtered}
          onEdit={setModalItem}
          onDelete={handleDelete}
          onDateChange={handleDateChange}
          onMarkPublished={handleMarkPublished}
          onPublishYouTube={handlePublishYouTube}
          ytConnected={ytConnected}
          publishing={publishing !== null}
        />
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

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50" onClick={() => !exporting && setExportModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card rounded-3xl shadow-xl w-full max-w-md mx-4 border border-brand-border">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h3 className="text-base font-semibold text-brand-text">Выгрузить в Google Таблицу</h3>
              <button onClick={() => !exporting && setExportModalOpen(false)} className="p-1 rounded-lg hover:bg-surface-hover text-brand-text-secondary">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-brand-text-secondary">
                Неопубликованные карточки с заданными датами будут выгружены в таблицу для автопостинга через n8n. Дубликаты пропускаются.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-brand-text">Платформы:</p>
                {([
                  ['youtube', 'YouTube', 'text-red-500'],
                  ['instagram', 'Instagram', 'text-pink-500'],
                  ['tiktok', 'TikTok', 'text-brand-text'],
                ] as const).map(([key, label, color]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportPlatforms[key]}
                      onChange={e => setExportPlatforms(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded border-brand-border text-primary-600 focus:ring-primary-500"
                    />
                    <span className={`text-sm ${color}`}>{label}</span>
                  </label>
                ))}
              </div>
              <div className="bg-subtle rounded-xl p-3 text-xs text-brand-text-secondary">
                К выгрузке: {items.filter(item => {
                  const platforms = Object.entries(exportPlatforms).filter(([, v]) => v).map(([k]) => k)
                  return platforms.some(p => {
                    const dk = `${p}_date` as keyof ContentUnit
                    const pk = `${p}_published` as keyof ContentUnit
                    return item[dk] && !item[pk]
                  })
                }).length} карточек
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-brand-border">
              <button
                onClick={() => !exporting && setExportModalOpen(false)}
                className="px-4 py-2 text-sm text-brand-text-secondary hover:bg-surface-hover rounded-xl"
                disabled={exporting}
              >
                Отмена
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || !Object.values(exportPlatforms).some(v => v)}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700
                  disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {exporting && <Loader2 size={14} className="animate-spin" />}
                {exporting ? 'Выгрузка...' : 'Выгрузить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Modal — folder URL setup */}
      {syncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50" onClick={() => !syncing && setSyncModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card rounded-3xl shadow-xl w-full max-w-md mx-4 border border-brand-border">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h3 className="text-base font-semibold text-brand-text">Папка Яндекс.Диска</h3>
              <button onClick={() => !syncing && setSyncModalOpen(false)} className="p-1 rounded-lg hover:bg-surface-hover text-brand-text-secondary">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-brand-text-secondary">
                Укажите ссылку на публичную папку Яндекс.Диска с файлами контента. Все файлы из папки будут загружены как карточки. Уже существующие пропускаются.
              </p>
              <div className="relative">
                <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
                <input
                  autoFocus
                  value={syncUrl}
                  onChange={e => setSyncUrl(e.target.value)}
                  placeholder="https://disk.yandex.ru/d/..."
                  className="w-full text-sm rounded-xl border border-brand-border bg-subtle text-brand-text pl-9 pr-3 py-2.5 outline-none
                    focus:border-primary-400 placeholder:text-brand-text-secondary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-brand-border">
              <button
                onClick={() => !syncing && setSyncModalOpen(false)}
                className="px-4 py-2 text-sm text-brand-text-secondary hover:bg-surface-hover rounded-xl"
                disabled={syncing}
              >
                Отмена
              </button>
              <button
                onClick={() => handleSync(syncUrl)}
                disabled={!syncUrl.trim() || syncing}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-700
                  disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {syncing && <Loader2 size={14} className="animate-spin" />}
                {syncing ? 'Загрузка...' : 'Сохранить и загрузить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
