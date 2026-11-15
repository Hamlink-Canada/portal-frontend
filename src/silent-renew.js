import { createPortalAuth } from './auth.js'

const auth = createPortalAuth()
await auth.completeSilentRenew()
