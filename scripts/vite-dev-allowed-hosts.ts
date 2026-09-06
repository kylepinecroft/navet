function parseAllowedHosts(value: string | undefined) {
  if (!value?.trim()) {
    return []
  }

  return [
    ...new Set(
      value
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]
}

export function resolveViteDevAllowedHosts(
  env: Record<string, string | undefined> = process.env
): string[] | undefined {
  const hosts = parseAllowedHosts(env.NAVET_DEV_ALLOWED_HOSTS)
  return hosts.length > 0 ? hosts : undefined
}
