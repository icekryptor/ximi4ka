/**
 * OKR markdown parser — extracts structures needed for the OKR visualization
 * page from the brand_docs.okr_2026_2027 markdown.
 *
 * Parser is intentionally lenient: it ignores annual Objectives (§3-§4),
 * critical paths (§6), risks (§8) — they live in markdown for reading via
 * the BrandDoc editor. Page only renders quarterly OKRs (§5).
 */

export type KrStatus = 'on_track' | 'at_risk' | 'off_track' | 'done' | 'unknown'

export interface ParsedKR {
  /**
   * Composite path "Q<n>-<year>-O<n>-KR<n>". WARNING: stability is positional
   * within the markdown KR table — if the operator reorders rows in the OKR
   * doc, statuses persisted under old positions will reassign to new ones.
   * Acceptable for MVP single-operator workflow.
   */
  id: string         // stable: "Q2-2026-O1-KR1" (composite path)
  text: string       // first column of KR table
  metric: string     // second column
  targetMin: string  // third column as-is ("100% к 20.06" / "5 / 4")
}

export interface ParsedObjective {
  id: string         // "Q2-2026-O1"
  title: string      // "Финализировать R&D детского набора (A1)"
  krs: ParsedKR[]
}

export interface ParsedQuarter {
  id: string                // "Q2-2026"
  label: string             // "Q2 2026 (апрель-июнь)"
  focus: string             // blockquote after header
  objectives: ParsedObjective[]
  antiGoals: string[]
}

export interface ParsedOkr {
  quarters: ParsedQuarter[]
  currentQuarterId: string | null  // by today's date; null if no match
}

/**
 * Given today's date (or `now`), returns the quarter id in "QN-YYYY" form.
 */
export function currentQuarterId(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1  // 1-12
  const q = Math.ceil(month / 3)
  return `Q${q}-${year}`
}

/**
 * Parse the full OKR markdown. Throws if structure is critically broken
 * (no `## 5. Квартальные OKR` section).
 */
export function parseOkr(markdown: string): ParsedOkr {
  const quarterly = extractSection(markdown, '## 5. Квартальные OKR')
  if (!quarterly) {
    return { quarters: [], currentQuarterId: null }
  }

  const quarters: ParsedQuarter[] = []
  // Split by ### Qn YYYY headers
  const quarterBlocks = splitByHeader(quarterly, /^### (Q[1-4]) (\d{4})/m)
  for (const block of quarterBlocks) {
    const headerMatch = block.body.match(/^### (Q[1-4]) (\d{4})\s*(.*)$/m)
    if (!headerMatch) continue
    const [, q, year, suffix] = headerMatch
    const id = `${q}-${year}`
    const label = `${q} ${year}${suffix ? ' ' + suffix.trim() : ''}`.trim()

    quarters.push({
      id,
      label,
      focus: extractFocus(block.body),
      objectives: extractObjectives(block.body, id),
      antiGoals: extractAntiGoals(block.body),
    })
  }

  const todayQid = currentQuarterId()
  const currentQuarterIdResolved =
    quarters.find((q) => q.id === todayQid)?.id ??
    quarters[0]?.id ?? null

  return { quarters, currentQuarterId: currentQuarterIdResolved }
}

// ---- helpers ----

function extractSection(md: string, header: string): string | null {
  const startIdx = md.indexOf(header)
  if (startIdx < 0) return null
  // Find next h2 (## ...) or end of doc
  const restAfterHeader = md.slice(startIdx + header.length)
  const nextH2Match = restAfterHeader.match(/^## (?!#)/m)
  const sectionEnd = nextH2Match
    ? startIdx + header.length + nextH2Match.index!
    : md.length
  return md.slice(startIdx, sectionEnd)
}

interface HeaderBlock { header: string; body: string }

function splitByHeader(md: string, headerRegex: RegExp): HeaderBlock[] {
  const lines = md.split('\n')
  const blocks: HeaderBlock[] = []
  let currentHeader: string | null = null
  let currentLines: string[] = []
  for (const line of lines) {
    if (headerRegex.test(line)) {
      if (currentHeader !== null) {
        blocks.push({ header: currentHeader, body: [currentHeader, ...currentLines].join('\n') })
      }
      currentHeader = line
      currentLines = []
    } else if (currentHeader !== null) {
      currentLines.push(line)
    }
  }
  if (currentHeader !== null) {
    blocks.push({ header: currentHeader, body: [currentHeader, ...currentLines].join('\n') })
  }
  return blocks
}

function extractFocus(quarterBody: string): string {
  const lines = quarterBody.split('\n')
  for (const line of lines) {
    if (line.startsWith('> ')) {
      return line.slice(2).replace(/^Фокус:\s*/, '').trim()
    }
  }
  return ''
}

function extractObjectives(quarterBody: string, quarterId: string): ParsedObjective[] {
  const objectives: ParsedObjective[] = []
  // Match #### Q2-O1. Title
  const objBlocks = splitByHeader(quarterBody, /^#### (Q\d-O\d+)\./)
  for (const block of objBlocks) {
    const headerMatch = block.header.match(/^#### (Q\d-O\d+)\.\s*(.+)$/)
    if (!headerMatch) continue
    const [, shortId, title] = headerMatch
    const id = `${quarterId}-${shortId.split('-')[1]}`  // "Q2-2026-O1"
    const krs = extractKrs(block.body, id)
    objectives.push({ id, title: title.trim(), krs })
  }
  return objectives
}

function extractKrs(objectiveBody: string, objectiveId: string): ParsedKR[] {
  const lines = objectiveBody.split('\n')
  const krs: ParsedKR[] = []
  let inTable = false
  let skipSeparator = false
  let krIndex = 0

  for (const line of lines) {
    if (line.startsWith('| Key Result')) {
      inTable = true
      skipSeparator = true
      continue
    }
    if (inTable && skipSeparator && /^\|\s*-/.test(line)) {
      skipSeparator = false
      continue
    }
    if (inTable && line.startsWith('|') && !skipSeparator) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      if (cells.length >= 3) {
        krIndex++
        krs.push({
          id: `${objectiveId}-KR${krIndex}`,
          text: cells[0],
          metric: cells[1],
          targetMin: cells[2],
        })
      }
    } else if (inTable && !line.startsWith('|')) {
      inTable = false
    }
  }
  return krs
}

function extractAntiGoals(quarterBody: string): string[] {
  // Find subsection "#### Q? — Anti-goals" and collect "- **НЕ** ..." lines
  // until the next #### / ### header or end of body.
  const lines = quarterBody.split('\n')
  let inSection = false
  const items: string[] = []
  for (const line of lines) {
    if (/^####\s*Q\d\s*—\s*Anti-goals/.test(line)) {
      inSection = true
      continue
    }
    if (inSection && /^###{1,2}\s/.test(line)) {
      break
    }
    if (inSection) {
      const m = line.match(/^- (?:\*\*НЕ\*\*|НЕ)\s*(.+)$/)
      if (m) items.push(`НЕ ${m[1].trim()}`)
    }
  }
  return items
}
