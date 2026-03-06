export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense'
}

export enum TransactionSource {
  MANUAL = 'manual',
  SUPPLY = 'supply',
  IMPORT = 'import'
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
  source?: TransactionSource;
  source_id?: string;
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

export enum CategoryGroup {
  OPERATING_INCOME = 'operating_income',
  OPERATING_EXPENSE = 'operating_expense',
  COGS = 'cogs',
  INVESTING = 'investing',
  FINANCING = 'financing',
  OTHER = 'other'
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color?: string;
  description?: string;
  is_active: boolean;
  group?: CategoryGroup;
  created_at: string;
  updated_at: string;
}

export interface SupplyItem {
  id?: string;
  supply_id?: string;
  component_id: string;
  component?: { id: string; name: string; sku?: string; category: string };
  quantity: number;
  price_mode: 'unit' | 'total';
  entered_price: number;
  unit_cost: number;
  total_cost: number;
  unit_delivery_cost: number;
  created_at?: string;
}

export interface Supply {
  id: string;
  supplier_id?: string;
  supplier?: Counterparty;
  carrier_id?: string;
  carrier?: Counterparty;
  delivery_cost: number;
  supply_date?: string;
  notes?: string;
  items: SupplyItem[];
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

// ===== Financial Reports =====

export interface CashFlowSection {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  details: {
    income: { name: string; amount: number; type: string }[];
    expense: { name: string; amount: number; type: string }[];
  };
}

export interface CashFlowReport {
  period: { year: number; period: string; value?: number; startDate: string; endDate: string };
  openingBalance: number;
  sections: {
    operating: CashFlowSection;
    investing: CashFlowSection;
    financing: CashFlowSection;
  };
  totalNet: number;
  closingBalance: number;
}

export interface PnlReport {
  period: { startDate: string; endDate: string };
  revenue: { total: number; details: { name: string; amount: number; type: string }[] };
  cogs: { total: number; details: { name: string; amount: number; type: string }[] };
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: { total: number; details: { name: string; amount: number; type: string }[] };
  operatingProfit: number;
  operatingMargin: number;
  other: { income: number; expenses: number; net: number; details: { name: string; amount: number; type: string }[] };
  netProfit: number;
  netMargin: number;
}

export interface BalanceReport {
  date: string;
  assets: { total: number; items: { name: string; amount: number }[] };
  liabilities: { total: number; items: { name: string; amount: number }[] };
  equity: { total: number; items: { name: string; amount: number }[] };
}

// ===== Marketplace =====

export enum MarketplaceType {
  WILDBERRIES = 'wildberries',
  WEBSITE = 'website',
}

export interface MarketplaceSale {
  id: string;
  marketplace: MarketplaceType;
  date: string;
  sku: string;
  product_name?: string;
  orders_count: number;
  buyouts_count: number;
  revenue: number;
  commission: number;
  commission_rate: number;
  logistics_cost: number;
  storage_cost: number;
  other_costs: number;
  acquiring_cost: number;
  payout: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SkuMapping {
  id: string;
  marketplace_sku: string;
  product_name: string;
  kit_id?: string;
  kit?: { id: string; name: string };
  created_at: string;
}

export interface MarketplaceAnalytics {
  marketplace: string;
  totals: {
    orders: number;
    buyouts: number;
    revenue: number;
    commission: number;
    logistics: number;
    storage: number;
    other: number;
    acquiring: number;
    payout: number;
    buyoutRate: number;
  };
  bySku: {
    sku: string;
    product_name: string;
    orders: number;
    buyouts: number;
    revenue: number;
    commission: number;
    logistics: number;
    storage: number;
    other: number;
    acquiring: number;
    payout: number;
    days: number;
  }[];
  byDate: {
    date: string;
    orders: number;
    buyouts: number;
    revenue: number;
    payout: number;
  }[];
  salesCount: number;
}

// ===== WB Ads Analytics =====

export interface WbAdAnalytics {
  dates: string[];
  metrics: Record<string, number[]>;
  totals: Record<string, number>;
  nmIds: number[];
}

export interface WbAdNote {
  id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface WbAdArticle {
  nm_id: number;
  product_name: string;
}

export interface WbAdSyncStatus {
  lastDate: string | null;
  firstDate: string | null;
  daysCount: number;
}

export interface WbTokenStatus {
  hasToken: boolean;
  maskedToken: string | null;
}

// ===== WB Financial Reports =====

export interface WbFinanceAnalytics {
  dates: string[];
  metrics: Record<string, number[]>;
  totals: Record<string, number>;
  nmIds: number[];
}

export interface WbFinanceArticle {
  nm_id: number;
  product_name: string;
}

export interface WbFinanceSyncStatus {
  lastDate: string | null;
  firstDate: string | null;
  daysCount: number;
}
