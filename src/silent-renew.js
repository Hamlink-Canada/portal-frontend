import { createPortalAuth } from './auth.js'
import { loadRuntimeConfig } from './runtimeConfig.js'

const auth = createPortalAuth(await loadRuntimeConfig())
await auth.completeSilentRenew()
