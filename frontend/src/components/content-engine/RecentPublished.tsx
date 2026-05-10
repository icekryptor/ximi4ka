import { ExternalLink } from 'lucide-react'
import { RecentItem } from '../../api/contentEngine'

interface Props {
  items: RecentItem[]
}

const NETWORK_LABEL: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RecentPublished({ items }: Props) {
  if (items.length === 0) return null
  const visible = items.slice(0, 5)

  return (
    <div className="rounded-2xl border border-brand-border bg-card p-4">
      <h2 className="text-sm font-semibold text-brand-text mb-3">Недавно опубликовано</h2>
      <ul className="space-y-1.5">
        {visible.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-subtle"
          >
            <span className="font-mono text-xs text-brand-text-secondary w-24 shrink-0">
              {formatDate(it.published_at)}
            </span>
            <span className="text-xs text-brand-text-secondary w-16 shrink-0">
              {NETWORK_LABEL[it.network] ?? it.network}
            </span>
            <span className="flex-1 text-sm text-brand-text truncate">{it.unit_title}</span>
            {it.published_url && (
              <a
                href={it.published_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-text-secondary hover:text-primary-600 shrink-0"
                title="Открыть публикацию"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
