import * as XLSX from 'xlsx'
import { NormalizedRow, ParseResult } from './types'

// Tochka column header keywords (search by substring, case-insensitive)
const TOCHKA_COLS = {
  document_number: ['номер документа'],
  date_doc:        ['дата документа'],
  date_op:         ['дата операции'],
  counterparty:    ['контрагент'],
  inn:             ['инн контрагента', 'инн'],
  debit:           ['списание'],
  credit:          ['зачисление'],
  description:     ['назначение платежа', 'назначение'],
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
  // Excel datetime
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  // ISO-ish string
  const s = String(value).trim()
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // DD.MM.YYYY
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function parseAmount(value: any): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.').replace(/\s/g, ''))
  return isNaN(n) ? 0 : Math.abs(n)
}

export function parseTochka(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  // Find sheet starting with "Операции"
  const opsSheetName = wb.SheetNames.find(n => n.toLowerCase().startsWith('операции'))
  if (!opsSheetName) throw new Error('Лист «Операции» не найден')

  const ws = wb.Sheets[opsSheetName]
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, raw: true }) as any[][]

  // Headers in row 2 (index 1)
  const headers = aoa[1] || []
  const cols = {
    docNum:   findColumnIndex(headers, TOCHKA_COLS.document_number),
    dateDoc:  findColumnIndex(headers, TOCHKA_COLS.date_doc),
    dateOp:   findColumnIndex(headers, TOCHKA_COLS.date_op),
    cp:       findColumnIndex(headers, TOCHKA_COLS.counterparty),
    inn:      findColumnIndex(headers, TOCHKA_COLS.inn),
    debit:    findColumnIndex(headers, TOCHKA_COLS.debit),
    credit:   findColumnIndex(headers, TOCHKA_COLS.credit),
    desc:     findColumnIndex(headers, TOCHKA_COLS.description),
  }

  if (cols.dateDoc < 0 || cols.cp < 0 || cols.debit < 0 || cols.credit < 0) {
    throw new Error('Не найдены обязательные колонки (дата/контрагент/списание/зачисление)')
  }

  const rows: NormalizedRow[] = []
  const warnings: string[] = []
  let minDate = '9999-12-31', maxDate = '0000-01-01'

  for (let i = 2; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || row.length === 0) continue

    const date = normalizeDate(row[cols.dateOp >= 0 ? cols.dateOp : cols.dateDoc])
    if (!date) { warnings.push(`Строка ${i+1}: нет даты, пропуск`); continue }

    const debit = parseAmount(row[cols.debit])
    const credit = parseAmount(row[cols.credit])
    if (debit === 0 && credit === 0) { warnings.push(`Строка ${i+1}: нулевая сумма, пропуск`); continue }

    const type: 'income' | 'expense' = credit > 0 ? 'income' : 'expense'
    const amount = credit > 0 ? credit : debit
    const cpName = String(row[cols.cp] || '').replace(/\n/g, ' ').trim()
    const innRaw = cols.inn >= 0 ? String(row[cols.inn] || '').trim() : ''
    const inn = /^\d{10,12}$/.test(innRaw) ? innRaw : null
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
      raw: { row_index: i + 1, header: headers, values: row },
    })

    if (date < minDate) minDate = date
    if (date > maxDate) maxDate = date
  }

  return {
    rows,
    period_start: rows.length ? minDate : null,
    period_end:   rows.length ? maxDate : null,
    bank_code: 'tochka',
    warnings,
  }
}
