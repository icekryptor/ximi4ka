import { createCrudApi } from './crudFactory';
import { Category } from './types';

export const categoriesApi = createCrudApi<Category>('/categories');
