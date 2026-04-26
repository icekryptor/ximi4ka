import { apiClient as api } from './client'

export interface BankAccount {
  id: string
  name: string
  bank_code: string
  account_number: string | null
  currency: string
  opening_balance: number
  opening_date: string | null
  is_active: boolean
}

export const bankAccountsApi = {
  list:   (): Promise<BankAccount[]> => api.get('/bank-accounts').then(r => r.data),
  create: (d: Partial<BankAccount>): Promise<BankAccount> => api.post('/bank-accounts', d).then(r => r.data),
  update: (id: string, d: Partial<BankAccount>): Promise<BankAccount> => api.put(`/bank-accounts/${id}`, d).then(r => r.data),
  remove: (id: string): Promise<void> => api.delete(`/bank-accounts/${id}`).then(() => {}),
}
