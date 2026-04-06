import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * Get direct download URL for a Yandex Disk public resource.
 */
async function getDownloadUrl(publicUrl: string): Promise<string> {
  const apiUrl = new URL('https://cloud-api.yandex.net/v1/disk/public/resources/download')
  apiUrl.searchParams.set('public_key', publicUrl)
  const res = await fetch(apiUrl.toString())
  if (!res.ok) {
    throw new Error(`Yandex Disk download API error: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as { href?: string }
  if (!data.href) throw new Error('No download link returned from Yandex Disk')
  return data.href
}

/**
 * Download a file from Yandex Disk public URL to a temporary directory.
 * Returns the path to the downloaded file.
 * Caller is responsible for deleting the file after use.
 */
export async function downloadFromYaDisk(publicUrl: string, fileName?: string): Promise<string> {
  const downloadUrl = await getDownloadUrl(publicUrl)

  const res = await fetch(downloadUrl)
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status} ${res.statusText}`)
  }

  const safeName = (fileName || 'video').replace(/[^a-zA-Z0-9._-]/g, '_')
  const tmpDir = path.join(os.tmpdir(), 'ximfinance-uploads')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  const filePath = path.join(tmpDir, `${Date.now()}-${safeName}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  return filePath
}

/**
 * Clean up a temp file. Safe to call even if file doesn't exist.
 */
export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (err) {
    console.error('Failed to cleanup temp file:', filePath, err)
  }
}
