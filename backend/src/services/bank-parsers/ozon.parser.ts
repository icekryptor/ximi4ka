import * as XLSX from 'xlsx'
import { NormalizedRow, ParseResult } from './types'

// Ozon column header keywords
const OZON_COLS = {
  date:        ['дата'],
  doc_number:  ['номер документа'],
  debit:       ['дебет'],
  credit:      ['кредит'],
  counterparty:['контрагент'],
  description: ['назначение платежа'],
}

function findColumnIndex(headers: any[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase().trim()
    for (const kw of keywords) {
      if (h.includes(kw.toLowerCase())) return i
    }
  }
  return -1
}

function normalizeDate(value: any): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const s = String(value).trim()
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

function parseAmount(value: any): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.').replace(/\s/g, ''))
  return isNaN(n) ? 0 : Math.abs(n)
}

function extractInn(text: string): string | null {
  const m = text.match(/инн[:\s]*(\d{10,12})/i)
  return m ? m[1] : null
}

function extractName(cellText: string): string {
  // Cell example: "ООО Интернет Решения\nИНН:7704217370"
  const lines = String(cellText || '').split(/\n|\r/).map(s => s.trim()).filter(Boolean)
  // First non-INN line is the name
  for (const line of lines) {
    if (!/^инн[:\s]/i.test(line)) return line
  }
  return lines[0] || ''
}

function findHeaderRow(aoa: any[][]): number {
  // Row containing "Дата" + "Дебет" + "Кредит" — that's the headers row
  for (let i = 0; i < Math.min(aoa.length, 25); i++) {
    const row = aoa[i] || []
    const joined = row.map(c => String(c || '').toLowerCase()).join('|')
    if (joined.includes('дата') && joined.includes('дебет') && joined.includes('кредит')) {
      return i
    }
  }
  return -1
}

export function parseOzon(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const sheetName = wb.SheetNames.find(n => n.toLowerCase().startsWith('выписка')) || wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, raw: true }) as any[][]

  const headerRowIdx = findHeaderRow(aoa)
  if (headerRowIdx < 0) throw new Error('Не найдена строка заголовков Озон-выписки')

  const headers = aoa[headerRowIdx] || []
  const cols = {
    date:    findColumnIndex(headers, OZON_COLS.date),
    docNum:  findColumnIndex(headers, OZON_COLS.doc_number),
    debit:   findColumnIndex(headers, OZON_COLS.debit),
    credit:  findColumnIndex(headers, OZON_COLS.credit),
    cp:      findColumnIndex(headers, OZON_COLS.counterparty),
    desc:    findColumnIndex(headers, OZON_COLS.description),
  }

  if (cols.date < 0 || cols.debit < 0 || cols.credit < 0 || cols.cp < 0) {
    throw new Error('Озон: не найдены обязательные колонки (дата/дебет/кредит/контрагент)')
  }

  const rows: NormalizedRow[] = []
  const warnings: string[] = []
  let minDate = '9999-12-31', maxDate = '0000-01-01'

  // Data starts 2 rows after header (sub-header row in between)
  const dataStart = headerRowIdx + 2

  for (let i = dataStart; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || row.length === 0) continue

    const date = normalizeDate(row[cols.date])
    if (!date) continue

    const debit = parseAmount(row[cols.debit])
    const credit = parseAmount(row[cols.credit])
    if (debit === 0 && credit === 0) { warnings.push(`Строка ${i+1}: нулевая сумма, пропуск`); continue }

    const type: 'income' | 'expense' = credit > 0 ? 'income' : 'expense'
    const amount = credit > 0 ? credit : debit
    const cpCellText = String(row[cols.cp] || '')
    const cpName = extractName(cpCellText)
    const inn = extractInn(cpCellText)
    const desc = cols.desc >= 0 ? String(row[cols.desc] || '').trim() : ''
    const docNum = cols.docNum >= 0 ? String(row[cols.docNum] || '').trim() || null : null

    rows.push({
      external_id: docNum,
      date,
      type,
      amount,
      counterparty_name: cpName,
      counterparty_inn: inn,
      description: desc,
      raw: { row_index: i + 1, values: row },
    })

    if (date < minDate) minDate = date
    if (date > maxDate) maxDate = date
  }

  return {
    rows,
    period_start: rows.length ? minDate : null,
    period_end:   rows.length ? maxDate : null,
    bank_code: 'ozon',
    warnings,
  }
}
