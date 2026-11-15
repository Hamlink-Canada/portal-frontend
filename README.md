# Portal frontend

The Portal frontend is the management application for generic Portal
deployments. It opens directly into the portal sign-in view; any public product
home page is a separate static deployment. Configure the management hostname at
deployment time.

## Project boundaries

- This repository owns its Vue and Vuetify components.
- English and French are supported from the start.
- Similar components in other Portal frontends are kept aligned by policy;
  this repository does not depend on a shared Vuetify package.
- The backend API is described by a versioned OpenAPI contract maintained in
  the separate backend repository.

## Initial structure

- `src/` — Vue entry point and application shell.
- `src/router.js` — bookmarkable Portal sections with browser history.
- `src/locales/` — English and French message catalogs.
- `index.html` — Portal application entry point.
- `silent-renew.html` — hidden OIDC callback used for token renewal.

The management frontend uses the provider-neutral `oidc-client-ts` library
with OIDC discovery and Authorization Code with PKCE. Set
`VITE_OIDC_AUTHORITY` and `VITE_OIDC_CLIENT_ID` for the selected identity
provider. Register the application root and `silent-renew.html` as redirect
URIs for a public browser client. The API audience must be included in issued
access tokens. The frontend keeps tokens in memory and sends them using the
Bearer authorization header; the backend validates them.

The development server proxies `/api` to `VITE_API_PROXY_TARGET`. In
deployment, route `/api` on the management origin to the backend so browser
requests remain same-origin. Configure the web server to fall back to
`index.html` for Portal section URLs such as `/sites` and `/profile`.

Navigation is withheld until the current access token has been verified by the
backend. The Sites view supports user- or Entity-owned physical Sites, editing,
and permanent Site ID allocation. Users enter a four-character Maidenhead
locator with optional two-letter subsquare precision. Portal derives the grid
center and country, and an optional precise latitude/longitude pair refines the
site location. Entity profiles retain organization website, Site limit, call
sign, and Portal Staff/Viewer membership metadata. The Repeaters view supports
editing call sign, frequency, tone, and enabled status; it reveals or rotates
each unique registration secret once and keeps admin-controlled enablement
separate from live registration freshness.

## Configuration

Use `VITE_MANAGEMENT_DISPLAY_NAME` for the deployed display name. Configure
hostnames in deployment and DNS settings. Do not place deployment-specific values
in reusable source files.

For local frontend review, set `VITE_PORTAL_DEV_MODE=true` in `.env.local` and
run `npm run dev`. This replaces OIDC and the session endpoint with a local mock
and displays a development-preview watermark. Sign in and out with the usual
Portal controls; those actions use the local mock identity. The mode is gated by
Vite's development flag (`import.meta.env.DEV`), so the mock and watermark are
disabled in production builds even if the environment value is accidentally
left enabled. The mock never sends requests to the backend.
While signed in during development preview, use the app-bar “Preview as”
selector to switch between a regular Entity owner and a System Super Admin.
Regular users can view the Entity site limit but cannot edit it; the preview
mock enforces the same restriction.
