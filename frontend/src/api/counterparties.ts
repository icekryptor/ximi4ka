import { createCrudApi } from './crudFactory';
import { Counterparty } from './types';

export const counterpartiesApi = createCrudApi<Counterparty>('/counterparties');
