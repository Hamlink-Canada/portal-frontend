#!/bin/sh
set -eu

config_file="${PORTAL_CONFIG_FILE:-/etc/portal/config.json}"
config_output="/tmp/portal-config.json"

if [ -e "$config_file" ] && [ ! -f "$config_file" ]; then
    echo "Portal config path is not a regular file: $config_file" >&2
    exit 1
fi

defaults=$(jq -n \
    --arg managementDisplayName "${PORTAL_MANAGEMENT_DISPLAY_NAME:-Portal}" \
    --arg oidcAuthority "${PORTAL_OIDC_AUTHORITY:-}" \
    --arg oidcClientId "${PORTAL_OIDC_CLIENT_ID:-}" \
    --arg accountManagementUrl "${PORTAL_ACCOUNT_MANAGEMENT_URL:-}" \
    --arg apiBaseUrl "${PORTAL_API_BASE_URL:-/api}" \
    '{managementDisplayName: $managementDisplayName,
      oidcAuthority: $oidcAuthority,
      oidcClientId: $oidcClientId,
      accountManagementUrl: $accountManagementUrl,
      apiBaseUrl: $apiBaseUrl}')

file_config='{}'
if [ -f "$config_file" ]; then
    file_config=$(jq -ce '
        if type != "object" then error("must be a JSON object")
        elif (keys - ["managementDisplayName", "oidcAuthority", "oidcClientId", "accountManagementUrl", "apiBaseUrl"] | length) > 0 then error("contains an unknown setting")
        elif any(.[]; type != "string") then error("all settings must be strings")
        else .
        end
    ' "$config_file") || {
        echo "Portal config file is invalid: $config_file" >&2
        exit 1
    }
fi

management_name_set=false
oidc_authority_set=false
oidc_client_id_set=false
account_url_set=false
api_base_url_set=false
[ "${PORTAL_MANAGEMENT_DISPLAY_NAME+x}" = x ] && management_name_set=true
[ "${PORTAL_OIDC_AUTHORITY+x}" = x ] && oidc_authority_set=true
[ "${PORTAL_OIDC_CLIENT_ID+x}" = x ] && oidc_client_id_set=true
[ "${PORTAL_ACCOUNT_MANAGEMENT_URL+x}" = x ] && account_url_set=true
[ "${PORTAL_API_BASE_URL+x}" = x ] && api_base_url_set=true

overrides=$(jq -n \
    --argjson managementNameSet "$management_name_set" \
    --arg managementDisplayName "${PORTAL_MANAGEMENT_DISPLAY_NAME-}" \
    --argjson oidcAuthoritySet "$oidc_authority_set" \
    --arg oidcAuthority "${PORTAL_OIDC_AUTHORITY-}" \
    --argjson oidcClientIdSet "$oidc_client_id_set" \
    --arg oidcClientId "${PORTAL_OIDC_CLIENT_ID-}" \
    --arg devPreview "${PORTAL_DEV_PREVIEW:-false}" \
    --argjson accountUrlSet "$account_url_set" \
    --arg accountManagementUrl "${PORTAL_ACCOUNT_MANAGEMENT_URL-}" \
    --argjson apiBaseUrlSet "$api_base_url_set" \
    --arg apiBaseUrl "${PORTAL_API_BASE_URL-}" \
    'reduce [
        ["managementDisplayName", $managementNameSet, $managementDisplayName],
        ["oidcAuthority", $oidcAuthoritySet, $oidcAuthority],
        ["oidcClientId", $oidcClientIdSet, $oidcClientId],
        ["accountManagementUrl", $accountUrlSet, $accountManagementUrl],
        ["apiBaseUrl", $apiBaseUrlSet, $apiBaseUrl]
    ][] as $setting ({};
        if $setting[1] then . + {($setting[0]): $setting[2]} else . end
    )')

if ! printf '%s\n%s\n%s\n' "$defaults" "$file_config" "$overrides" | jq -se '
    .[0] * .[1] * .[2]
    | if (.managementDisplayName | type == "string" and length > 0)
        and (($devPreview == "true") or ((.oidcAuthority | type == "string" and length > 0)
          and (.oidcClientId | type == "string" and length > 0)))
        and (.accountManagementUrl | type == "string")
        and (.apiBaseUrl | type == "string" and length > 0)
      then .
      else error("managementDisplayName, OIDC authority/client ID, and API base URL must be set")
      end
' > "${config_output}.tmp"; then
    echo "Portal runtime config is invalid; set the required OIDC and API settings." >&2
    rm -f "${config_output}.tmp"
    exit 1
fi

chmod 0644 "${config_output}.tmp"
mv "${config_output}.tmp" "$config_output"
exec "$@"
