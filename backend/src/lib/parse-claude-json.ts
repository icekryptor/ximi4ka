/**
 * Robust JSON parser for Claude responses. Claude sometimes wraps JSON in:
 * - markdown code fences (```json ... ```)
 * - leading prose ("Here is the JSON:\n...")
 * - trailing commentary ("...Hope this helps!")
 *
 * Tries 4 strategies in order:
 * 1. Direct parse of trimmed input
 * 2. Strip markdown fences, then parse
 * 3. Extract first {...} block (greedy)
 * 4. Extract first [...] block (greedy) — for endpoints that return arrays
 *
 * On every strategy, validates via the caller-supplied `validate` function.
 * Returns the first validated result, or null if all strategies fail.
 *
 * When all strategies fail, logs the first 500 chars of raw to console.error
 * so Railway logs can show what Claude actually returned.
 */
export function parseClaudeJson<T>(
  raw: string,
  validate: (parsed: unknown) => T | null,
  endpointName: string,
): T | null {
  const tryParse = (text: string): T | null => {
    try {
      const v = JSON.parse(text)
      return validate(v)
    } catch {
      return null
    }
  }

  // Strategy 1: direct
  let result = tryParse(raw.trim())
  if (result) return result

  // Strategy 2: strip markdown fences
  result = tryParse(raw.replace(/```json|```/g, '').trim())
  if (result) return result

  // Strategy 3: extract first {...} block (object)
  const objMatch = raw.match(/\{[\s\S]*\}/)
  if (objMatch) {
    result = tryParse(objMatch[0])
    if (result) return result
  }

  // Strategy 4: extract first [...] block (array)
  const arrMatch = raw.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    result = tryParse(arrMatch[0])
    if (result) return result
  }

  // All strategies failed
  console.error(
    `[${endpointName}] JSON parse fallback hit. Raw response first 500 chars:`,
    raw.slice(0, 500),
  )
  return null
}

/**
 * Splits a Russian text into chunks of approximately `targetSize` chars,
 * preferring sentence boundaries (period, question mark, exclamation,
 * newline). Used as a last-resort fallback for the preprocess endpoint
 * when Claude's JSON output couldn't be parsed.
 */
export function splitIntoSentenceChunks(text: string, targetSize = 300): string[] {
  const trimmed = text.trim()
  if (trimmed.length <= targetSize) return [trimmed]

  const chunks: string[] = []
  let current = ''
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = trimmed.split(/(?<=[.!?])\s+/)
  for (const s of sentences) {
    if (!s) continue
    if ((current + ' ' + s).trim().length > targetSize && current) {
      chunks.push(current.trim())
      current = s
    } else {
      current = current ? current + ' ' + s : s
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
