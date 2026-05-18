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
    // Log a small preview of response keys so we can spot envelope mismatches
    // without dumping sensitive content. Show top-level keys + Data subkeys.
    const topKeys = r.data && typeof r.data === 'object' ? Object.keys(r.data) : []
    const dataKeys =
      r.data && typeof (r.data as any).Data === 'object'
        ? Object.keys((r.data as any).Data)
        : []
    console.log(
      `[tochka-api] ${label} OK url=${url} topKeys=[${topKeys.join(',')}] dataKeys=[${dataKeys.join(',')}]`,
    )
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
  /** Optional override. Normally we auto-discover via listCustomers(). */
  customer_code?: string
}

interface TochkaCustomer {
  customerCode: string
  customerName?: string
  customerType?: string
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

  /**
   * List customers under this token. Per Tochka Open Banking — entry point for
   * discovering customer_code before fetching accounts.
   * GET /customers
   */
  async listCustomers(): Promise<TochkaCustomer[]> {
    const path = '/customers'
    const data = await loggedRequest<any>(
      'listCustomers',
      `${BASE_URL}${path}`,
      () => this.http.get(path),
    )
    return data?.Data?.Customer ?? data?.customers ?? []
  }

  /**
   * List accounts for a specific customer.
   * GET /customers/{customerCode}/accounts
   */
  async listAccounts(customerCode: string): Promise<TochkaAccount[]> {
    const path = `/customers/${customerCode}/accounts`
    const data = await loggedRequest<any>(
      'listAccounts',
      `${BASE_URL}${path}`,
      () => this.http.get(path),
    )
    return data?.Data?.Account ?? data?.accounts ?? []
  }

  /**
   * Fetch statement (transactions) for a given account over a date range.
   * GET /accounts/{accountCode}/statement?dateFrom=&dateTo=
   */
  async fetchStatement(
    accountCode: string,
    from: string,
    to: string,
  ): Promise<TochkaTransaction[]> {
    const path = `/accounts/${accountCode}/statement`
    const data = await loggedRequest<any>(
      'fetchStatement',
      `${BASE_URL}${path}?dateFrom=${from}&dateTo=${to}`,
      () => this.http.get(path, { params: { dateFrom: from, dateTo: to } }),
    )
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
