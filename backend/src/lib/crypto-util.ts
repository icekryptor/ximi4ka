import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

/**
 * Encrypts a JSON-serializable value with AES-256-GCM.
 * Output format: base64(iv(12) || authTag(16) || ciphertext)
 *
 * Master key — base64-encoded 32 bytes (256 bits) from env var.
 *
 * NOTE: blob has no key-id prefix; rotating BANK_SYNC_SECRET_KEY invalidates
 * all existing encrypted configs. Acceptable at current scale (single
 * operator, handful of bank configs) — re-onboarding flow on rotation is a
 * manual SQL clear + re-enter creds via UI.
 */
export function encryptJson(value: unknown, masterKeyBase64: string): string {
  const key = Buffer.from(masterKeyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('Master key must be 32 bytes (base64 of 32 bytes)')
  }
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/**
 * Decrypts a string produced by encryptJson and returns parsed JSON.
 * Throws if tampered, wrong key, or invalid format.
 */
export function decryptJson<T = unknown>(blob: string, masterKeyBase64: string): T {
  const key = Buffer.from(masterKeyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('Master key must be 32 bytes (base64 of 32 bytes)')
  }
  const buf = Buffer.from(blob, 'base64')
  if (buf.length < IV_BYTES + 16 + 1) {
    throw new Error('Encrypted blob too short')
  }
  const iv = buf.subarray(0, IV_BYTES)
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + 16)
  const ciphertext = buf.subarray(IV_BYTES + 16)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plaintext.toString('utf8')) as T
}

/**
 * Generate a fresh master key as base64. Use this once when first setting up
 * BANK_SYNC_SECRET_KEY env var. Output goes into Railway env. Never log.
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('base64')
}
