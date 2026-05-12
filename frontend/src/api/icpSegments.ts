import { createCrudApi } from './crudFactory'
import { IcpSegment } from './types'

export const icpSegmentsApi = createCrudApi<IcpSegment>('/icp-segments')
