import { Youtube, Instagram, Send, X as XIcon } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

export interface NetworkDef {
  value: string
  label: string
  color: string
  icon: ComponentType<SVGProps<SVGSVGElement>> | null
}

export const KNOWN_NETWORKS: NetworkDef[] = [
  { value: 'youtube',   label: 'YouTube',     color: '#FF0000', icon: Youtube },
  { value: 'instagram', label: 'Instagram',   color: '#E4405F', icon: Instagram },
  { value: 'tiktok',    label: 'TikTok',      color: '#000000', icon: null },
  { value: 'telegram',  label: 'Telegram',    color: '#0088CC', icon: Send },
  { value: 'vk',        label: 'VK',          color: '#0077FF', icon: null },
  { value: 'twitter',   label: 'X / Twitter', color: '#000000', icon: XIcon },
]

const byValue = new Map(KNOWN_NETWORKS.map((n) => [n.value, n]))

export function getNetworkDef(value: string): NetworkDef {
  return (
    byValue.get(value) || {
      value,
      label: value,
      color: '#9F95B0',
      icon: null,
    }
  )
}
