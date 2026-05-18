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
   * List accounts for the authorized customer.
   * GET /accounts
   * Per Tochka docs slug: get-accounts-list-open-banking-v-1-0-accounts-get
   */
  async listAccounts(): Promise<TochkaAccount[]> {
    const path = '/accounts'
    const data = await loggedRequest<any>(
      'listAccounts',
      `${BASE_URL}${path}`,
      () => this.http.get(path),
    )
    return data?.Data?.Account ?? data?.accounts ?? []
  }

  /**
   * Step 1 of async statement flow: ask Tochka to prepare a statement for
   * a date range. Returns statementId which we poll until status=Ready.
   *
   * POST /statements
   * Per Tochka docs slug: init-statement-open-banking-v-1-0-statements-post
   *
   * Body schema is best-guess (Open Banking style) — likely:
   *   { Data: { accountId, startDate, endDate } }
   * If the real schema differs, verbose logging will show 400-response body
   * and we tune.
   */
  async createStatement(
    accountId: string,
    from: string,
    to: string,
  ): Promise<{ statementId: string; status?: string }> {
    const path = '/statements'
    // Per Точка validation error "Field Statement : Field required" — body must
    // nest the statement parameters under {Data: {Statement: {...}}}.
    const body = {
      Data: {
        Statement: {
          accountId,
          startDate: from,
          endDate: to,
        },
      },
    }
    const data = await loggedRequest<any>(
      'createStatement',
      `${BASE_URL}${path}`,
      () => this.http.post(path, body),
    )
    const payload = data?.Data?.Statement ?? data?.Data ?? data
    return {
      statementId: payload?.statementId ?? payload?.statement_id,
      status: payload?.status,
    }
  }

  /**
   * Step 2/3 of async statement flow: poll the statement by id.
   * Returns status (Created / Processing / Ready / Failed) + transactions if ready.
   *
   * GET /accounts/{accountId}/statements/{statementId}
   * Per Tochka docs slug: get-statement-open-banking-v-1-0-accounts-account-id-statements-statement-id-get
   */
  async getStatement(
    accountId: string,
    statementId: string,
  ): Promise<{ status: string; transactions: TochkaTransaction[] }> {
    const path = `/accounts/${accountId}/statements/${statementId}`
    const data = await loggedRequest<any>(
      'getStatement',
      `${BASE_URL}${path}`,
      () => this.http.get(path),
    )
    const inner = data?.Data ?? data
    const txs =
      inner?.Transaction ??
      inner?.transactions ??
      inner?.Statement?.Transaction ??
      []
    const status = inner?.status ?? inner?.Statement?.status ?? 'Unknown'
    return { status, transactions: txs }
  }

  /**
   * High-level: create statement + poll until Ready (or timeout) + return transactions.
   * Poll interval 2s, max ~60s. Tochka usually returns Ready within 5-15s.
   */
  async fetchStatement(
    accountId: string,
    from: string,
    to: string,
  ): Promise<TochkaTransaction[]> {
    const { statementId } = await this.createStatement(accountId, from, to)
    if (!statementId) throw new Error('Точка не вернула statementId')

    const POLL_INTERVAL_MS = 2000
    const MAX_ATTEMPTS = 30 // ~60 seconds total

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      const { status, transactions } = await this.getStatement(accountId, statementId)
      console.log(`[tochka-api] statement poll attempt=${i + 1} status=${status}`)
      if (status === 'Ready' || status === 'ready') return transactions
      if (status === 'Failed' || status === 'failed') {
        throw new Error(`Точка вернула status=Failed для statement ${statementId}`)
      }
    }
    throw new Error(`Точка не подготовила выписку за ${(MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000} сек`)
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
