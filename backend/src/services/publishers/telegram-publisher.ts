import type { ChannelPublisher, PublishContext, PublishResult } from './types'
import { extractPublishText } from './content-extract'
import { getBot, escapeHtml } from '../telegram.service'

function buildMessageUrl(chatId: string, messageId: number): string {
  const s = String(chatId)
  // Public channel: chat_id starts with '@' → https://t.me/{username}/{msg_id}
  if (s.startsWith('@')) {
    return `https://t.me/${s.slice(1)}/${messageId}`
  }
  // Private channel: chat_id is numeric, starts with '-100' → https://t.me/c/{stripped}/{msg_id}
  if (s.startsWith('-100')) {
    return `https://t.me/c/${s.substring(4)}/${messageId}`
  }
  // Generic negative (legacy supergroups): fallback to /c/
  if (s.startsWith('-')) {
    return `https://t.me/c/${s.substring(1)}/${messageId}`
  }
  // Positive numeric (1-on-1 chat) — no public URL; return /c/ as best-effort fallback
  return `https://t.me/c/${s}/${messageId}`
}

export const telegramPublisher: ChannelPublisher = {
  canPublish(ctx: PublishContext): boolean {
    if (ctx.channel.platform !== 'telegram') return false
    const config = ctx.channel.config_json as Record<string, unknown> | null
    return !!(config?.chat_id)
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const bot = getBot()
    if (!bot) throw new Error('TELEGRAM_BOT_TOKEN не задан в env')
    const config = ctx.channel.config_json as Record<string, unknown> | null
    const chatId = config?.chat_id
    if (!chatId) throw new Error(`У канала "${ctx.channel.slug}" не задан chat_id в config_json`)

    const rawText = extractPublishText(ctx.unit)
    // Truncate the RAW text first, then escape — slicing escaped HTML can sever
    // multi-char entities like `&amp;` and break parse_mode: 'HTML'.
    // 3900 char budget leaves headroom for worst-case escape expansion.
    const truncated = rawText.length > 3900 ? rawText.slice(0, 3900) + '\n…' : rawText
    const safe = escapeHtml(truncated)

    const msg = await bot.sendMessage(String(chatId), safe, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    })

    // Build public URL — best-effort
    const url = buildMessageUrl(String(chatId), msg.message_id)

    return {
      published_url: url,
      raw_response: {
        message_id: msg.message_id,
        chat: msg.chat,
        date: msg.date,
      },
    }
  },
}
