import axios, { AxiosInstance } from 'axios'
import { NormalizedRow } from '../bank-parsers/types'

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
    const r = await this.http.get(path)
    // Tochka responses are envelope-style: {Data: {Account: [...]}}
    return r.data?.Data?.Account ?? r.data?.accounts ?? []
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
    const r = await this.http.get(path, { params: { dateFrom: from, dateTo: to } })
    // Tochka envelope: {Data: {Transaction: [...]}}
    return r.data?.Data?.Transaction ?? r.data?.transactions ?? []
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
