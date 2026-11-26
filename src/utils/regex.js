// Keep browser-side validation and mock-route patterns in one place.
export const CALL_SIGN_RE = /^[A-Z0-9]{1,3}[0-9][A-Z]{1,4}(?:\/(?:P|M|MM|AM|QRP|[A-Z]{1,3}[0-9]))?$/i
export const GRID_SQUARE_RE = /^[A-R]{2}[0-9]{2}(?:[A-X]{2})?$/i

export const ORG_ROUTE_RE = /^v1\/orgs\/(\d+)$/
export const SITE_ROUTE_RE = /^v1\/sites\/(\d+)$/
export const SITE_REPEATERS_ROUTE_RE = /^v1\/sites\/(\d+)\/repeaters$/
export const REPEATER_ROUTE_RE = /^v1\/repeaters\/(\d+)(?:\/credential\/rotate)?$/

export function trimOneLeadingSlash(value) {
  return value.startsWith('/') ? value.slice(1) : value
}

export function trimOneTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}
