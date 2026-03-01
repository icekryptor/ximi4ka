export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense'
}

export enum CounterpartyType {
  SUPPLIER = 'supplier',
  CARRIER  = 'carrier',
  CUSTOMER = 'customer',
  BOTH = 'both'
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  category_id?: string;
  category?: Category;
  counterparty_id?: string;
  counterparty?: Counterparty;
  document_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Counterparty {
  id: string;
  name: string;
  type: CounterpartyType;
  country?: string;
  inn?: string;
  address?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialSummary {
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface CategoryReport {
  name: string;
  total: number;
  count: number;
}

export interface CounterpartyReport {
  name: string;
  total: number;
  count: number;
}
