import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
} from 'oidc-client-ts'
import { trimOneLeadingSlash, trimOneTrailingSlash } from './utils/regex.js'

const devMode = import.meta.env.DEV && String(import.meta.env.VITE_PORTAL_DEV_MODE).toLowerCase() === 'true'
const backendPreview = devMode && String(import.meta.env.VITE_PORTAL_BACKEND_PREVIEW).toLowerCase() === 'true'
const signOutFlag = 'portal-oidc-signout-callback'
const returnToKey = 'portal-oidc-return-to'
const devTokenKey = 'portal-dev-access-token'
const localRoutes = new Set(['/', '/sites', '/repeaters', '/entities', '/profile'])
const isLocalRoute = (path) => localRoutes.has(path)
  || /^\/(?:sites|entities)\/(?:new|\d+(?:\/edit)?)$/.test(path)
  || /^\/repeaters\/(?:new|\d+(?:\/edit)?)$/.test(path)
function createUserManager(authority, clientId) {
  if (!authority || !clientId) {
    throw new Error('OIDC authority and client ID must be configured.')
  }

  const managementUrl = new URL('./', window.location.href).toString()
  const silentRenewUrl = new URL('silent-renew.html', managementUrl).toString()

  return new UserManager({
    authority,
    client_id: clientId,
    redirect_uri: managementUrl,
    post_logout_redirect_uri: managementUrl,
    silent_redirect_uri: silentRenewUrl,
    response_type: 'code',
    scope: 'openid profile email',
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  })
}

export function createPortalAuth(config) {
  const { oidcAuthority: authority, oidcClientId: clientId, apiBaseUrl } = config
  let manager

  async function initialize() {
    if (devMode) {
      if (!backendPreview) throw new Error('Development mode requires the backend preview to be enabled.')
      return backendPreview
        ? window.sessionStorage.getItem(devTokenKey)
        : null
    }
    manager = createUserManager()
    const url = new URL(window.location.href)
    if (window.sessionStorage.getItem(signOutFlag) && url.searchParams.has('state')) {
      await manager.signoutCallback()
      window.sessionStorage.removeItem(signOutFlag)
    } else if (url.searchParams.has('code') || url.searchParams.has('error')) {
      const user = await manager.signinCallback()
      const returnTo = user?.state?.returnTo
      if (typeof returnTo === 'string' && isLocalRoute(returnTo)) {
        window.sessionStorage.setItem(returnToKey, returnTo)
      }
    }
    return manager.getUser()
  }

  async function completeSilentRenew() {
    if (devMode) return
    manager = createUserManager()
    await manager.signinSilentCallback()
  }

  async function listPreviewUsers() {
    if (!backendPreview) throw new Error('Backend development preview is not enabled.')
    const response = await fetch(`${trimOneTrailingSlash(apiBaseUrl)}/v1/dev-preview/users`)
    if (!response.ok) throw new Error(`Development preview returned HTTP ${response.status}.`)
    return (await response.json()).items || []
  }

  async function signIn(userId) {
    if (devMode) {
      if (!backendPreview) throw new Error('Development mode requires the backend preview to be enabled.')
      const response = await fetch(`${trimOneTrailingSlash(apiBaseUrl)}/v1/dev-preview/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      if (!response.ok) throw new Error(`Development sign-in returned HTTP ${response.status}.`)
      const result = await response.json()
      window.sessionStorage.setItem(devTokenKey, result.access_token)
      return
    }
    await manager.signinRedirect({ state: { returnTo: window.location.pathname } })
  }

  function takeReturnTo() {
    const returnTo = window.sessionStorage.getItem(returnToKey)
    window.sessionStorage.removeItem(returnToKey)
    return returnTo
  }

  async function signOut() {
    if (devMode) {
      window.sessionStorage.removeItem(devTokenKey)
      return
    }
    window.sessionStorage.setItem(signOutFlag, '1')
    await manager.signoutRedirect()
  }

  async function setPreviewUser(userId) {
    if (!devMode || !backendPreview) {
      throw new Error('Preview users are only available in backend development preview mode.')
    }
    return signIn(userId)
  }

  async function getAccessToken() {
    if (devMode) {
      const token = window.sessionStorage.getItem(devTokenKey)
      if (!token) throw new Error('No Portal preview access token is available.')
      return token
    }
    let user = await manager.getUser()
    if (!user || user.expired) {
      user = await manager.signinSilent()
    }
    if (!user?.access_token) {
      throw new Error('No OIDC access token is available.')
    }
    return user.access_token
  }

  async function apiFetch(path, options = {}) {
    if (devMode && !backendPreview) {
      throw new Error('Development mode requires the backend preview to be enabled.')
    }
    const accessToken = await getAccessToken()
    if (!accessToken) throw new Error('No Portal access token is available.')
    const response = await fetch(`${trimOneTrailingSlash(apiBaseUrl)}/${trimOneLeadingSlash(path)}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!response.ok) {
      throw new Error(`Portal API returned HTTP ${response.status}.`)
    }
    return response.json()
  }

  return {
    initialize,
    completeSilentRenew,
    takeReturnTo,
    signIn,
    signOut,
    setPreviewUser,
    listPreviewUsers,
    apiFetch,
  }
}
