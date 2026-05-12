import { createCrudApi } from './crudFactory'
import { StrategicTheme } from './types'

export const strategicThemesApi = createCrudApi<StrategicTheme>('/strategic-themes')
