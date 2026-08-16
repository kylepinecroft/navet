import type { IntegrationProviderId } from '@navet/app/types/provider';
import {
  ensureCanonicalEntityId,
  isLegacyHomeAssistantEntityId,
  normalizePersistedEntityRecord,
} from '@navet/app/utils/provider-entity-id';
import { createProviderScopedId, parseProviderScopedId } from '@navet/app/utils/provider-ids';

export const HEADER_GREETING_NAME_MAX_LENGTH = 40;
export const ENTITY_DISPLAY_NAME_MAX_LENGTH = 64;
const SYNTHETIC_DISPLAY_OVERRIDE_ID_PATTERN = /^security\.aggregate\.[a-z0-9][a-z0-9_.-]*$/i;

function normalizeDisplayText(value: string, maxLength: number): string {
  return Array.from(value.normalize('NFKC'))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)
    .trim();
}

export function normalizeHeaderGreetingName(value: unknown): string {
  return typeof value === 'string'
    ? normalizeDisplayText(value, HEADER_GREETING_NAME_MAX_LENGTH)
    : '';
}

export function normalizeEntityDisplayName(value: unknown): string {
  return typeof value === 'string'
    ? normalizeDisplayText(value, ENTITY_DISPLAY_NAME_MAX_LENGTH)
    : '';
}

export function isSyntheticDisplayOverrideId(value: string): boolean {
  return SYNTHETIC_DISPLAY_OVERRIDE_ID_PATTERN.test(value);
}

export function sanitizeEntityDisplayNames(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entityNames: Record<string, string> = {};
  const syntheticNames: Record<string, string> = {};
  for (const [entityId, name] of Object.entries(value)) {
    if (typeof entityId !== 'string' || entityId.trim().length === 0) {
      continue;
    }
    const nextName = normalizeEntityDisplayName(name);
    if (!nextName) {
      continue;
    }
    if (isSyntheticDisplayOverrideId(entityId)) {
      syntheticNames[entityId] = nextName;
      continue;
    }
    if (!parseProviderScopedId(entityId) && !isLegacyHomeAssistantEntityId(entityId)) {
      continue;
    }
    entityNames[entityId] = nextName;
  }

  return {
    ...normalizePersistedEntityRecord(entityNames),
    ...syntheticNames,
  };
}

export function getEntityDisplayNameOverride(
  overrides: Record<string, string>,
  entityId: string,
  extras?: {
    canonicalId?: string;
    nativeId?: string;
    providerId?: IntegrationProviderId;
  }
): string | undefined {
  const direct = overrides[entityId] ?? overrides[ensureCanonicalEntityId(entityId)];
  if (direct) {
    return direct;
  }

  if (extras?.canonicalId) {
    const canonical =
      overrides[extras.canonicalId] ?? overrides[ensureCanonicalEntityId(extras.canonicalId)];
    if (canonical) {
      return canonical;
    }
  }

  if (extras?.nativeId && extras.providerId) {
    return overrides[createProviderScopedId(extras.providerId, extras.nativeId)];
  }

  return undefined;
}

export function resolveEntityDisplayName(
  providerName: string,
  override: string | undefined
): string {
  const nextName = override?.trim();
  return nextName && nextName.length > 0 ? nextName : providerName;
}

function getFirstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

export function resolveGreetingDisplayName({
  guestName,
  override,
  providerUserName,
}: {
  guestName: string;
  override: string;
  providerUserName: string | null | undefined;
}): string {
  const customName = override.trim();
  if (customName) {
    return customName;
  }

  const providerName = providerUserName?.trim();
  if (!providerName) {
    return guestName;
  }

  return getFirstName(providerName);
}
