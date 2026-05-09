import { ContentStatus, ContentType } from '../../api/contentBank'

const STATUS_CHIP_COLOR: Record<ContentStatus, string> = {
  idea: 'bg-subtle text-brand-text-secondary',
  script: 'bg-blue-50 text-blue-700',
  filming: 'bg-amber-50 text-amber-700',
  editing: 'bg-orange-50 text-orange-700',
  ready: 'bg-green-50 text-green-700',
  published: 'bg-purple-50 text-purple-700',
  rejected: 'bg-red-50 text-red-700',
}

type Props =
  | { variant: 'rubric'; children: React.ReactNode }
  | { variant: 'status'; status: ContentStatus; children: React.ReactNode }
  | { variant: 'type'; contentType: ContentType; children: React.ReactNode }
  | { variant: 'complexity'; children: React.ReactNode }

export function UnitChip(props: Props) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap'
  let cls = ''
  switch (props.variant) {
    case 'rubric':
      cls = 'bg-subtle text-brand-text-secondary'
      break
    case 'status':
      cls = STATUS_CHIP_COLOR[props.status]
      break
    case 'type':
      cls = 'bg-subtle text-brand-text-secondary'
      break
    case 'complexity':
      cls = 'bg-amber-50 text-amber-700'
      break
  }
  return <span className={`${base} ${cls}`}>{props.children}</span>
}
