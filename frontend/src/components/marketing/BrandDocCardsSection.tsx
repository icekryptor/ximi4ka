import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { brandDocsApi } from '../../api/brandDocs'
import type { BrandDoc } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'
import { BrandDocEditorModal } from './BrandDocEditorModal'

interface CardDef {
  slug: string
  icon: string
  title: string
  subtitle: string
}

const STYLE_CARDS: CardDef[] = [
  { slug: 'style_instagram',       icon: '📷', title: 'Instagram',          subtitle: 'Reels + Stories + Posts + Carousels' },
  { slug: 'style_tiktok_youtube',  icon: '🎬', title: 'TikTok + YouTube',   subtitle: 'Shorts + long video' },
  { slug: 'style_telegram',        icon: '💬', title: 'Telegram',           subtitle: 'Тёплая аудитория, long-form' },
]

const FORMAT_CARDS: CardDef[] = [
  { slug: 'format_short_video',  icon: '🎞️', title: 'Короткое видео',  subtitle: 'Reels / Shorts / TikTok' },
  { slug: 'format_long_video',   icon: '🎥', title: 'Длинное видео',   subtitle: 'YouTube long' },
  { slug: 'format_carousel',     icon: '🖼️', title: 'Карусель',        subtitle: 'Слайды + caption' },
  { slug: 'format_post',         icon: '📝', title: 'Пост',            subtitle: 'TG / VK короткие' },
  { slug: 'format_longread',     icon: '📄', title: 'Лонгрид',         subtitle: 'TG longread' },
  { slug: 'format_seo_article',  icon: '🔎', title: 'SEO-статья',      subtitle: 'Дзен / сайт' },
]

function formatKb(len: number): string {
  if (len === 0) return '0 KB · пусто'
  return `${(len / 1024).toFixed(1)} KB`
}

function formatShortDate(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function Card({
  def,
  doc,
  onClick,
}: {
  def: CardDef
  doc: BrandDoc | undefined
  onClick: () => void
}) {
  const len = doc?.content?.length ?? 0
  const date = formatShortDate(doc?.updated_at as unknown as string)
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl border border-brand-border bg-card p-4 hover:border-primary-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3 mb-2">
        <span className="text-2xl">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-brand-text truncate">{def.title}</h3>
          <p className="text-xs text-brand-text-secondary truncate">{def.subtitle}</p>
        </div>
      </div>
      <p className="text-xs text-brand-text-secondary">
        {formatKb(len)}
        {date && len > 0 ? ` · ${date}` : ''}
      </p>
      <p className="mt-2 text-xs text-primary-600">
        {len === 0 ? 'Заполнить →' : 'Открыть →'}
      </p>
    </button>
  )
}

export const BrandDocCardsSection = () => {
  const toast = useToast()
  const [docs, setDocs] = useState<Record<string, BrandDoc>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CardDef | null>(null)

  const allSlugs = useMemo(
    () => [...STYLE_CARDS, ...FORMAT_CARDS].map((c) => c.slug),
    [],
  )

  const load = async () => {
    setLoading(true)
    try {
      const all = await brandDocsApi.list()
      const map: Record<string, BrandDoc> = {}
      for (const d of all) {
        if (allSlugs.includes(d.slug)) map[d.slug] = d
      }
      setDocs(map)
    } catch {
      toast.error('Не удалось загрузить документы')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // intentionally one-shot — refresh happens via onSaved
  }, [])

  if (loading) {
    return (
      <section className="card mb-6">
        <div className="h-6 bg-muted rounded w-1/3 mb-3 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="card mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-brand-text flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary-600" />
              <span>Гайдлайны и форматы</span>
            </h2>
            <p className="text-brand-text-secondary mt-1">
              Стилевые гайды по сетям и требования по форматам — на эти доки ссылается агент при генерации сценариев.
            </p>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">
          🎨 Стиль по сетям
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {STYLE_CARDS.map((def) => (
            <Card
              key={def.slug}
              def={def}
              doc={docs[def.slug]}
              onClick={() => setEditing(def)}
            />
          ))}
        </div>

        <h3 className="text-sm font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">
          📐 Требования по форматам
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {FORMAT_CARDS.map((def) => (
            <Card
              key={def.slug}
              def={def}
              doc={docs[def.slug]}
              onClick={() => setEditing(def)}
            />
          ))}
        </div>
      </section>

      {editing && (
        <BrandDocEditorModal
          slug={editing.slug}
          title={editing.title}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void load()
          }}
        />
      )}
    </>
  )
}
