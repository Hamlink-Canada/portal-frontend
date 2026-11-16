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
with OIDC discovery and Authorization Code with PKCE. Production identity
provider settings are supplied through runtime configuration below; local Vite
development can use the corresponding `VITE_` variables. Register the
application root and `silent-renew.html` as redirect URIs for a public browser
client. The API audience must be included in issued access tokens. The frontend
keeps tokens in memory and sends them using the Bearer authorization header; the
backend validates them.

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

Production configuration is loaded at container startup and served from
`/config.json`; the browser fetches it before initializing Vue or OIDC. The
container merges defaults, an optional JSON file at `/etc/portal/config.json`,
then environment variables. Set `PORTAL_CONFIG_FILE` to use a different mounted
file path. Environment variables override the matching file fields.

| Environment variable | JSON field | Default | Purpose |
| --- | --- | --- | --- |
| `PORTAL_MANAGEMENT_DISPLAY_NAME` | `managementDisplayName` | `Portal` | Display name shown in the app |
| `PORTAL_OIDC_AUTHORITY` | `oidcAuthority` | Required | OIDC issuer/discovery authority |
| `PORTAL_OIDC_CLIENT_ID` | `oidcClientId` | Required | Public browser client ID |
| `PORTAL_ACCOUNT_MANAGEMENT_URL` | `accountManagementUrl` | Empty | Optional account page URL; if empty, Portal derives it from the authority |
| `PORTAL_API_BASE_URL` | `apiBaseUrl` | `/api` | Same-origin backend API path |

The config file must be a JSON object containing only these fields, with string
values. The container rejects invalid JSON, unknown fields, missing OIDC values,
or an empty API base path. These values are public because the browser receives
them; never put credentials or secrets in this configuration. Hostnames remain
deployment and DNS settings rather than frontend values.

Build the generic image from this directory with `docker build -t portal-frontend .`.
GitHub Actions also builds a multi-architecture image for pull requests and pushes
to `main`. Publishing a GitHub release publishes the versioned image to
`ghcr.io/hamlink-canada/portal-frontend`; stable releases also update `latest`.
Run it on port 8080, for example:

```sh
docker run --rm -p 8080:8080 \
  -e PORTAL_OIDC_AUTHORITY=https://identity.example.invalid/realms/example \
  -e PORTAL_OIDC_CLIENT_ID=portal-management \
  portal-frontend
```

To use a JSON file instead, copy `config.example.json`, set its OIDC values, and
mount it read-only at `/etc/portal/config.json`. Per-field environment variables
still override the mounted values. Restart the container after changing its
environment or mounted file. Nginx runs as a non-root user on port 8080, serves
the SPA with history fallback, and does not proxy `/api`; route `/api` and TLS
through the deployment's ingress or reverse proxy. `/config.json` is served with
cache prevention so a browser page load sees the current container config.

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
