const isDevelopmentPreview = String(import.meta.env.VITE_PORTAL_DEV_MODE).toLowerCase() === 'true'

function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Portal runtime configuration must be a JSON object.')
  }

  for (const key of [
    'managementDisplayName',
    'oidcAuthority',
    'oidcClientId',
    'accountManagementUrl',
    'apiBaseUrl',
  ]) {
    if (typeof config[key] !== 'string') {
      throw new Error(`Portal runtime configuration field "${key}" must be a string.`)
    }
  }

  if (!isDevelopmentPreview && (!config.oidcAuthority.trim() || !config.oidcClientId.trim())) {
    throw new Error('Portal runtime configuration must include the OIDC authority and client ID.')
  }

  return config
}

function loadDevelopmentConfig() {
  return validateConfig({
    managementDisplayName: import.meta.env.VITE_MANAGEMENT_DISPLAY_NAME || 'Portal',
    oidcAuthority: import.meta.env.VITE_OIDC_AUTHORITY || '',
    oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID || '',
    accountManagementUrl: import.meta.env.VITE_ACCOUNT_MANAGEMENT_URL || '',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  })
}

export async function loadRuntimeConfig() {
  if (import.meta.env.DEV) return loadDevelopmentConfig()

  const configUrl = new URL(`${import.meta.env.BASE_URL}config.json`, window.location.origin)
  const response = await fetch(configUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Portal runtime configuration returned HTTP ${response.status}.`)
  }
  return validateConfig(await response.json())
}
