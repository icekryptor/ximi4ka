import { createCrudApi } from './crudFactory'
import { ChannelBudget } from './types'

export const channelBudgetsApi = createCrudApi<ChannelBudget>('/channel-budgets')
