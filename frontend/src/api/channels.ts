import { createCrudApi } from './crudFactory';

export enum MarketplaceType {
  WILDBERRIES = 'wildberries',
  OZON = 'ozon',
  DETMIR = 'detmir',
  WEBSITE = 'website',
  OTHER = 'other',
}

export const MARKETPLACE_LABELS: Record<MarketplaceType, string> = {
  [MarketplaceType.WILDBERRIES]: 'Wildberries',
  [MarketplaceType.OZON]: 'Ozon',
  [MarketplaceType.DETMIR]: 'Детский мир',
  [MarketplaceType.WEBSITE]: 'Сайт',
  [MarketplaceType.OTHER]: 'Другое',
};

export interface SalesChannel {
  id: string;
  name: string;
  marketplace_type: MarketplaceType;
  commission_pct: number;
  logistics_cost: number;
  storage_cost: number;
  ad_spend_pct: number;
  return_rate_pct: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const channelsApi = createCrudApi<SalesChannel>('/channels');
