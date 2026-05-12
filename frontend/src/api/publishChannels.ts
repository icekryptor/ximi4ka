import { createCrudApi } from './crudFactory'
import { PublishChannel } from './types'

export const publishChannelsApi = createCrudApi<PublishChannel>('/channels')
