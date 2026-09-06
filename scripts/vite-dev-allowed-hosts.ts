const DEFAULT_VITE_DEV_ALLOWED_HOSTS = ['navet.pinecroftfamily.com'] as const
export const DEFAULT_VITE_DEV_HOME_ASSISTANT_URL =
  'https://homeassistant.pinecroftfamily.com'

function parseAllowedHosts(value: string | undefined) {
  if (!value?.trim()) {
    return []
  }

  return value
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

export function resolveViteDevAllowedHosts(
  env: Record<string, string | undefined> = process.env
): string[] {
  return [
    ...new Set([
      ...DEFAULT_VITE_DEV_ALLOWED_HOSTS,
      ...parseAllowedHosts(env.NAVET_DEV_ALLOWED_HOSTS),
    ]),
  ]
}

export function resolveViteDevHomeAssistantUrl(
  env: Record<string, string | undefined> = process.env
): string {
  return env.NAVET_HASS_URL?.trim().replace(/\/+$/, '') || DEFAULT_VITE_DEV_HOME_ASSISTANT_URL
}
