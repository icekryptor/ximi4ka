import { Request, Response } from 'express'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { ContentUnit } from '../entities/ContentUnit'
import { Not, IsNull } from 'typeorm'
import { appendToSheet, readSheetColumn } from '../services/google-sheets.service'
import { downloadFromYaDisk, cleanupTempFile } from '../services/yadisk-download.service'
import { uploadVideo as youtubeUpload } from '../services/youtube.service'

const repo = () => AppDataSource.getRepository(ContentUnit)

// Strip extension from filename for title
function fileNameToTitle(name: string): string {
  return name.replace(/\.[^/.]+$/, '')
}

// Fetch Yandex Disk public resource metadata
async function fetchYaDiskPublicResource(publicUrl: string, offset = 0, limit = 100): Promise<any> {
  const apiUrl = new URL('https://cloud-api.yandex.net/v1/disk/public/resources')
  apiUrl.searchParams.set('public_key', publicUrl)
  apiUrl.searchParams.set('offset', String(offset))
  apiUrl.searchParams.set('limit', String(limit))
  const res = await fetch(apiUrl.toString())
  if (!res.ok) throw new Error(`Yandex Disk API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export const contentUnitController = {
  async getAll(req: Request, res: Response) {
    try {
      const items = await repo().find({
        order: { created_at: 'DESC' },
      })
      res.json(items)
    } catch (error) {
      console.error('Error fetching content units:', error)
      res.status(500).json({ error: 'Ошибка загрузки единиц контента' })
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const item = await repo().findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Не найдено' })
      res.json(item)
    } catch (error) {
      console.error('Error fetching content unit:', error)
      res.status(500).json({ error: 'Ошибка загрузки' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId
      const item = repo().create({
        ...req.body,
        created_by: userId,
      })
      const saved = await repo().save(item)
      res.status(201).json(saved)
    } catch (error) {
      console.error('Error creating content unit:', error)
      res.status(500).json({ error: 'Ошибка создания' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await repo().findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Не найдено' })
      repo().merge(item, req.body)
      const saved = await repo().save(item)
      res.json(saved)
    } catch (error) {
      console.error('Error updating content unit:', error)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo().delete(req.params.id)
      if (result.affected === 0) return res.status(404).json({ error: 'Не найдено' })
      res.json({ success: true })
    } catch (error) {
      console.error('Error deleting content unit:', error)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },

  async syncYaDisk(req: Request, res: Response) {
    try {
      const { public_url } = req.body
      if (!public_url) return res.status(400).json({ error: 'public_url обязателен' })

      const userId = (req as any).user?.userId

      // Fetch resource metadata from Yandex Disk
      const resource = await fetchYaDiskPublicResource(public_url)

      // Collect files: single file or folder contents
      let files: Array<{ name: string; public_url: string; mime_type?: string }> = []

      if (resource.type === 'dir') {
        // It's a folder — collect all items (handle pagination)
        let items = resource._embedded?.items || []
        files = items.map((f: any) => ({
          name: f.name,
          public_url: f.public_url || `${public_url}/${encodeURIComponent(f.name)}`,
          mime_type: f.mime_type,
        }))

        // Paginate if there are more items
        const total = resource._embedded?.total || 0
        let offset = items.length
        while (offset < total) {
          const page = await fetchYaDiskPublicResource(public_url, offset)
          const pageItems = page._embedded?.items || []
          files.push(...pageItems.map((f: any) => ({
            name: f.name,
            public_url: f.public_url || `${public_url}/${encodeURIComponent(f.name)}`,
            mime_type: f.mime_type,
          })))
          offset += pageItems.length
          if (pageItems.length === 0) break
        }
      } else {
        // Single file
        files = [{
          name: resource.name,
          public_url: resource.public_url || public_url,
          mime_type: resource.mime_type,
        }]
      }

      if (files.length === 0) {
        return res.json({ created: 0, skipped: 0, total_files: 0 })
      }

      // Get existing material_urls for deduplication
      const existing = await repo().find({
        where: { material_url: Not(IsNull()) },
        select: ['material_url'],
      })
      const existingUrls = new Set(existing.map(e => e.material_url))

      // Also deduplicate by title
      const existingByTitle = await repo().find({ select: ['title'] })
      const existingTitles = new Set(existingByTitle.map(e => e.title))

      const newItems: ContentUnit[] = []
      let skipped = 0

      for (const file of files) {
        const title = fileNameToTitle(file.name)
        const url = file.public_url

        // Skip if URL or title already exists
        if (existingUrls.has(url) || existingTitles.has(title)) {
          skipped++
          continue
        }

        const item = repo().create({
          title,
          material_url: url,
          description: null,
          youtube_date: null,
          instagram_date: null,
          tiktok_date: null,
          youtube_published: false,
          instagram_published: false,
          tiktok_published: false,
          created_by: userId,
        })
        newItems.push(item)
        existingUrls.add(url)
        existingTitles.add(title)
      }

      let created: ContentUnit[] = []
      if (newItems.length > 0) {
        created = await repo().save(newItems)
      }

      res.json({
        created: created.length,
        skipped,
        total_files: files.length,
        items: created,
      })
    } catch (error) {
      console.error('Error syncing from Yandex Disk:', error)
      res.status(500).json({ error: 'Ошибка синхронизации с Яндекс.Диском' })
    }
  },

  async getPending(req: Request, res: Response) {
    try {
      const platform = req.query.platform as string
      if (!platform || !['youtube', 'instagram', 'tiktok'].includes(platform)) {
        return res.status(400).json({ error: 'platform query param required: youtube|instagram|tiktok' })
      }

      const dateField = `${platform}_date`
      const publishedField = `${platform}_published`

      const today = new Date().toISOString().split('T')[0]

      const items = await repo()
        .createQueryBuilder('cu')
        .where(`cu.${dateField} IS NOT NULL`)
        .andWhere(`cu.${dateField} <= :today`, { today })
        .andWhere(`cu.${publishedField} = false`)
        .andWhere('cu.material_url IS NOT NULL')
        .orderBy(`cu.${dateField}`, 'ASC')
        .getMany()

      res.json(items)
    } catch (error: any) {
      console.error('Error fetching pending content units:', error)
      res.status(500).json({ error: error.message || 'Internal error' })
    }
  },

  async markPublished(req: Request, res: Response) {
    try {
      const { platform, published_url } = req.body as {
        platform: 'youtube' | 'instagram' | 'tiktok'
        published_url?: string
      }

      if (!platform || !['youtube', 'instagram', 'tiktok'].includes(platform)) {
        return res.status(400).json({ error: 'platform required: youtube|instagram|tiktok' })
      }

      const item = await repo().findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Not found' })

      const publishedField = `${platform}_published` as keyof ContentUnit
      const urlField = `${platform}_published_url` as keyof ContentUnit

      ;(item as any)[publishedField] = true
      if (published_url) (item as any)[urlField] = published_url

      // Update publish_status: check if all platforms with dates are now published
      const platforms = ['youtube', 'instagram', 'tiktok'] as const
      const allPublished = platforms.every(p => {
        const df = `${p}_date` as keyof ContentUnit
        const pf = `${p}_published` as keyof ContentUnit
        return !item[df] || item[pf]
      })
      item.publish_status = allPublished ? 'published' : item.publish_status

      await repo().save(item)
      res.json({ success: true })
    } catch (error: any) {
      console.error('Error marking content unit published:', error)
      res.status(500).json({ error: error.message || 'Internal error' })
    }
  },

  async exportToSheets(req: Request, res: Response) {
    try {
      const { ids, platforms } = req.body as {
        ids: string[]
        platforms: ('youtube' | 'instagram' | 'tiktok')[]
      }

      if (!ids?.length) return res.status(400).json({ error: 'ids обязателен' })
      if (!platforms?.length) return res.status(400).json({ error: 'platforms обязателен' })

      const spreadsheetId = process.env.GOOGLE_SHEET_ID
      if (!spreadsheetId) return res.status(500).json({ error: 'GOOGLE_SHEET_ID не настроен в переменных окружения сервера' })

      if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON не настроен в переменных окружения сервера' })
      }

      const items = await repo().find({ where: { id: In(ids) } })
      if (items.length === 0) return res.status(404).json({ error: 'Карточки не найдены' })

      const results: Record<string, { exported: number; skipped: number }> = {}

      // Sheet name mapping
      const sheetNames: Record<string, string> = {
        youtube: 'YouTube',
        instagram: 'Instagram',
        tiktok: 'TikTok',
      }

      for (const platform of platforms) {
        const sheetName = sheetNames[platform]
        const dateField = `${platform}_date` as keyof ContentUnit
        const publishedField = `${platform}_published` as keyof ContentUnit

        // Get existing video_urls from the sheet for deduplication
        let existingUrls: Set<string> = new Set()
        try {
          const urls = await readSheetColumn(spreadsheetId, sheetName, 'B')
          existingUrls = new Set(urls.filter(u => u && u !== 'video_url'))
        } catch {
          // Sheet might not exist yet or be empty — proceed without dedup
        }

        const rows: string[][] = []
        let skipped = 0

        for (const item of items) {
          const date = item[dateField] as string | null
          if (!date) continue // Skip if no date set for this platform
          if (item[publishedField]) continue // Skip already published

          const videoUrl = item.material_url || ''
          if (existingUrls.has(videoUrl)) {
            skipped++
            continue
          }

          // Format: publish_date, video_url, caption, tags
          rows.push([
            date,
            videoUrl,
            item.description || item.title,
            item.tags || '',
            'pending', // status for n8n
          ])
        }

        let exported = 0
        if (rows.length > 0) {
          exported = await appendToSheet(spreadsheetId, sheetName, rows)
        }

        results[platform] = { exported, skipped }
      }

      res.json({ success: true, results })
    } catch (error: any) {
      console.error('Error exporting to Google Sheets:', error)
      res.status(500).json({ error: error.message || 'Ошибка выгрузки в таблицу' })
    }
  },

  async publishYouTube(req: Request, res: Response) {
    let tempFile: string | null = null
    try {
      const item = await repo().findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Карточка не найдена' })

      if (!item.material_url) {
        return res.status(400).json({ error: 'Нет ссылки на материал (material_url)' })
      }
      if (!item.youtube_date) {
        return res.status(400).json({ error: 'Не задана дата публикации на YouTube' })
      }
      if (item.youtube_published) {
        return res.status(400).json({ error: 'Уже опубликовано на YouTube' })
      }

      // Mark as uploading
      item.publish_status = 'uploading'
      item.publish_error = null
      await repo().save(item)

      // Download from Yandex Disk
      tempFile = await downloadFromYaDisk(item.material_url, item.title)

      // Upload to YouTube
      const result = await youtubeUpload({
        filePath: tempFile,
        title: item.title,
        description: item.description || item.title,
        tags: item.tags,
        publishAt: item.youtube_date,
      })

      // Update record
      item.youtube_video_id = result.videoId
      item.youtube_published_url = result.videoUrl
      item.youtube_published = true

      const now = new Date()
      const pubDate = new Date(item.youtube_date)
      item.publish_status = pubDate > now ? 'scheduled' : 'published'
      item.publish_error = null

      await repo().save(item)

      res.json({
        success: true,
        videoId: result.videoId,
        videoUrl: result.videoUrl,
        status: item.publish_status,
      })
    } catch (error: any) {
      console.error('YouTube publish error:', error)

      // Update status to error
      try {
        const item = await repo().findOne({ where: { id: req.params.id } })
        if (item) {
          item.publish_status = 'error'
          item.publish_error = error.message || 'Unknown error'
          await repo().save(item)
        }
      } catch {}

      res.status(500).json({ error: error.message || 'Ошибка публикации на YouTube' })
    } finally {
      if (tempFile) cleanupTempFile(tempFile)
    }
  },
}
