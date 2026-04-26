import * as XLSX from 'xlsx'
import { ParseResult, NormalizedRow } from './types'
import { parseTochka } from './tochka.parser'
import { parseOzon } from './ozon.parser'

export type BankCode = 'tochka' | 'ozon'

export function detectBank(buffer: Buffer): BankCode | null {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  // Ozon: first sheet name === "Выписка", row 1 contains "ОЗОН БАНК"
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false }) as any[][]
    const head = JSON.stringify(aoa.slice(0, 5)).toUpperCase()
    if (head.includes('ОЗОН БАНК')) return 'ozon'
    if (name.toLowerCase().startsWith('операции')) return 'tochka'
  }
  return null
}

export function parse(buffer: Buffer, bank?: BankCode): ParseResult {
  const detected = bank || detectBank(buffer)
  if (!detected) throw new Error('Не удалось определить банк по файлу. Укажите счёт вручную.')

  if (detected === 'tochka') return parseTochka(buffer)
  if (detected === 'ozon')   return parseOzon(buffer)
  throw new Error(`Парсер для банка '${detected}' не реализован`)
}

export { NormalizedRow, ParseResult }
