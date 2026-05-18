import axios, { AxiosInstance, AxiosError } from 'axios'
import { NormalizedRow } from '../bank-parsers/types'

/**
 * Wrap an axios call with verbose logging for the bank-sync flow.
 * On error: logs request URL, status, and response body (truncated) so we
 * can diagnose 4xx/5xx from Точка without re-deploying. On success: logs
 * URL + count of returned items.
 */
async function loggedRequest<T>(
  label: string,
  url: string,
  fn: () => Promise<{ data: T }>,
): Promise<T> {
  try {
    const r = await fn()
    const count = Array.isArray((r.data as unknown as { Data?: { Account?: unknown[]; Transaction?: unknown[] } })?.Data?.Account)
      ? ((r.data as any).Data.Account as unknown[]).length
      : Array.isArray((r.data as unknown as { Data?: { Account?: unknown[]; Transaction?: unknown[] } })?.Data?.Transaction)
      ? ((r.data as any).Data.Transaction as unknown[]).length
      : 'n/a'
    console.log(`[tochka-api] ${label} OK url=${url} count=${count}`)
    return r.data
  } catch (e: unknown) {
    const ae = e as AxiosError
    const status = ae.response?.status ?? 'no-response'
    const bodyText = ae.response?.data
      ? JSON.stringify(ae.response.data).slice(0, 500)
      : ae.message
    console.error(`[tochka-api] ${label} FAIL url=${url} status=${status} body=${bodyText}`)
    throw e
  }
}

export interface TochkaCredentials {
  token: string
  client_id: string
  customer_code?: string
}

interface TochkaAccount {
  accountId: string
  accountNumber: string
  accountName?: string
  bik?: string
  currency: string
}

interface TochkaTransaction {
  transactionId: string
  operationDate: string         // YYYY-MM-DD
  direction: 'Credit' | 'Debit'
  amount: number
  counterparty?: {
    name?: string
    inn?: string
    bik?: string
    account?: string
  }
  paymentPurpose?: string
  documentNumber?: string
}

const BASE_URL = 'https://enter.tochka.com/uapi/open-banking/v1.0'

export class TochkaApiClient {
  private http: AxiosInstance

  constructor(private creds: TochkaCredentials) {
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'client-id': creds.client_id,
      },
      timeout: 30_000,
    })
  }

  /** List accounts for the customer. If customer_code is set, scopes to that customer. */
  async listAccounts(): Promise<TochkaAccount[]> {
    const path = this.creds.customer_code
      ? `/accounts/${this.creds.customer_code}`
      : '/accounts'
    const data = await loggedRequest<any>(
      'listAccounts',
      `${BASE_URL}${path}`,
      () => this.http.get(path),
    )
    // Tochka responses are envelope-style: {Data: {Account: [...]}}
    return data?.Data?.Account ?? data?.accounts ?? []
  }

  /**
   * Fetch statement (transactions) for a given account over a date range.
   * @param accountCode — accountId returned by listAccounts
   * @param from / to — YYYY-MM-DD
   */
  async fetchStatement(
    accountCode: string,
    from: string,
    to: string,
  ): Promise<TochkaTransaction[]> {
    const customer = this.creds.customer_code ?? ''
    const path = customer
      ? `/accounts/${customer}/${accountCode}/statement`
      : `/accounts/${accountCode}/statement`
    const data = await loggedRequest<any>(
      'fetchStatement',
      `${BASE_URL}${path}?dateFrom=${from}&dateTo=${to}`,
      () => this.http.get(path, { params: { dateFrom: from, dateTo: to } }),
    )
    // Tochka envelope: {Data: {Transaction: [...]}}
    return data?.Data?.Transaction ?? data?.transactions ?? []
  }
}

/**
 * Map Tochka API transaction to our internal NormalizedRow shape.
 * Output matches what tochka.parser.ts produces from Excel, so the same
 * import pipeline downstream works without changes.
 */
export function tochkaApiToNormalizedRow(tx: TochkaTransaction): NormalizedRow {
  const type: 'income' | 'expense' = tx.direction === 'Credit' ? 'income' : 'expense'
  const innRaw = tx.counterparty?.inn || ''
  return {
    external_id: tx.transactionId || tx.documentNumber || null,
    date: tx.operationDate,
    type,
    amount: Math.abs(tx.amount),
    counterparty_name: (tx.counterparty?.name || '').trim(),
    counterparty_inn: /^\d{10,12}$/.test(innRaw) ? innRaw : null,
    description: (tx.paymentPurpose || '').trim(),
    raw: tx,
  }
}
