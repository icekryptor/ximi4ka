import { google, youtube_v3 } from 'googleapis'
import fs from 'fs'
import { AppDataSource } from '../config/database'
import { OAuthToken } from '../entities/OAuthToken'

const PROVIDER = 'youtube'

function getOAuth2Client() {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('YouTube OAuth credentials not configured (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI)')
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

function tokenRepo() {
  return AppDataSource.getRepository(OAuthToken)
}

export function getAuthUrl(): string {
  const oauth2 = getOAuth2Client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
  })
}

export async function handleCallback(code: string): Promise<{ channelName: string }> {
  const oauth2 = getOAuth2Client()
  const { tokens } = await oauth2.getToken(code)

  if (!tokens.refresh_token) {
    throw new Error('No refresh_token received. Try revoking access at https://myaccount.google.com/permissions and re-authorizing.')
  }

  oauth2.setCredentials(tokens)

  const yt = google.youtube({ version: 'v3', auth: oauth2 })
  const channelRes = await yt.channels.list({ part: ['snippet'], mine: true })
  const channelName = channelRes.data.items?.[0]?.snippet?.title || 'Unknown'

  let existing = await tokenRepo().findOne({ where: { provider: PROVIDER } })
  if (existing) {
    existing.access_token = tokens.access_token!
    existing.refresh_token = tokens.refresh_token
    existing.expires_at = tokens.expiry_date ? new Date(tokens.expiry_date) : null
    existing.channel_name = channelName
    await tokenRepo().save(existing)
  } else {
    const token = tokenRepo().create({
      provider: PROVIDER,
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      channel_name: channelName,
    })
    await tokenRepo().save(token)
  }

  return { channelName }
}

async function getAuthenticatedClient(): Promise<youtube_v3.Youtube> {
  const tokenRecord = await tokenRepo().findOne({ where: { provider: PROVIDER } })
  if (!tokenRecord) {
    throw new Error('YouTube not connected. Please authorize first via settings.')
  }

  const oauth2 = getOAuth2Client()
  oauth2.setCredentials({
    access_token: tokenRecord.access_token,
    refresh_token: tokenRecord.refresh_token,
    expiry_date: tokenRecord.expires_at?.getTime(),
  })

  oauth2.on('tokens', async (newTokens) => {
    tokenRecord.access_token = newTokens.access_token || tokenRecord.access_token
    if (newTokens.expiry_date) tokenRecord.expires_at = new Date(newTokens.expiry_date)
    if (newTokens.refresh_token) tokenRecord.refresh_token = newTokens.refresh_token
    await tokenRepo().save(tokenRecord)
  })

  return google.youtube({ version: 'v3', auth: oauth2 })
}

export async function getConnectionStatus(): Promise<{ connected: boolean; channelName: string | null }> {
  const token = await tokenRepo().findOne({ where: { provider: PROVIDER } })
  return {
    connected: !!token,
    channelName: token?.channel_name || null,
  }
}

export async function uploadVideo(params: {
  filePath: string
  title: string
  description: string
  tags?: string | null
  publishAt?: string | null
}): Promise<{ videoId: string; videoUrl: string }> {
  const yt = await getAuthenticatedClient()

  const now = new Date()
  const publishDate = params.publishAt ? new Date(params.publishAt) : null
  const isScheduled = publishDate && publishDate > now

  const tagList = params.tags
    ? params.tags.split(/[,\s#]+/).filter(Boolean).map(t => t.trim())
    : []

  const requestBody: youtube_v3.Schema$Video = {
    snippet: {
      title: params.title,
      description: params.description,
      tags: tagList.length > 0 ? tagList : undefined,
      defaultLanguage: 'ru',
    },
    status: {
      privacyStatus: isScheduled ? 'private' : 'public',
      selfDeclaredMadeForKids: false,
      ...(isScheduled ? { publishAt: publishDate!.toISOString() } : {}),
    },
  }

  const res = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody,
    media: {
      body: fs.createReadStream(params.filePath),
    },
  })

  const videoId = res.data.id
  if (!videoId) throw new Error('YouTube upload failed: no video ID returned')

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  }
}
