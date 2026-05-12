import type { ChannelPublisher, PublishContext, PublishResult } from './types'
import { extractPublishText } from './content-extract'
import { getBot, escapeHtml } from '../telegram.service'

function trimChatId(chatId: string): string {
  // Telegram returns negative ints for groups/channels. For URL: https://t.me/c/{abs_id_minus_minus_100}/{msg_id}
  // Public channels: https://t.me/{username}/{msg_id}.
  // We don't know username from chat_id alone here; just trim leading -100 for private.
  const s = String(chatId)
  if (s.startsWith('-100')) return s.substring(4)
  if (s.startsWith('-')) return s.substring(1)
  return s
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
    const escaped = escapeHtml(rawText)
    // Telegram limit: 4096 chars for text message. Truncate with marker if longer.
    const safe = escaped.length > 4000 ? escaped.slice(0, 4000) + '\n…' : escaped

    const msg = await bot.sendMessage(String(chatId), safe, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    })

    // Build public URL — best-effort
    const trimmed = trimChatId(String(chatId))
    const url = `https://t.me/c/${trimmed}/${msg.message_id}`

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
