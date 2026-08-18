import { isAllRooms } from '@navet/app/constants/rooms';
import type { DeviceWithType } from '@navet/app/types/device.types';
import { ensureCanonicalEntityId } from '@navet/app/utils/provider-entity-id';
import type { CustomCard } from '../stores/custom-cards-store';

export type DashboardSummaryBarScope = 'global' | 'local';

export function sanitizeDashboardSummaryBarScope(value: unknown): DashboardSummaryBarScope {
  return value === 'local' ? 'local' : 'global';
}

function addEntityIdVariants(target: Set<string>, value: string) {
  if (!value) {
    return;
  }
  target.add(value);
  target.add(ensureCanonicalEntityId(value));
}

function collectStringIds(value: unknown, target: Set<string>) {
  if (typeof value === 'string') {
    addEntityIdVariants(target, value);
    return;
  }
  if (!Array.isArray(value)) {
    return;
  }
  for (const entry of value) {
    if (typeof entry === 'string') {
      addEntityIdVariants(target, entry);
    }
  }
}

export function collectCustomCardEntityIds(card: CustomCard): Set<string> {
  const entityIds = new Set<string>();
  const data = card.data;
  if (!data) {
    return entityIds;
  }

  collectStringIds(data.entityId, entityIds);
  collectStringIds(data.entityIds, entityIds);
  collectStringIds(data.sensorEntityIds, entityIds);
  return entityIds;
}

export function collectPlacedDashboardEntityIds(
  cardIds: readonly string[],
  customCards: readonly CustomCard[] = []
): Set<string> {
  const customCardsById = new Map(customCards.map((card) => [card.id, card]));
  const entityIds = new Set<string>();

  for (const cardId of cardIds) {
    const customCard = customCardsById.get(cardId);
    if (!customCard) {
      addEntityIdVariants(entityIds, cardId);
      continue;
    }
    for (const entityId of collectCustomCardEntityIds(customCard)) {
      addEntityIdVariants(entityIds, entityId);
    }
  }

  return entityIds;
}

function deviceMatchesEntityIds(device: DeviceWithType, entityIds: ReadonlySet<string>): boolean {
  return (
    entityIds.has(device.id) ||
    (typeof device.canonicalId === 'string' && entityIds.has(device.canonicalId)) ||
    (typeof device.nativeId === 'string' && entityIds.has(device.nativeId))
  );
}

export function filterDeviceMapByEntityIds(
  deviceMap: Map<string, DeviceWithType>,
  entityIds: ReadonlySet<string>
): Map<string, DeviceWithType> {
  if (entityIds.size === 0) {
    return new Map();
  }

  const next = new Map<string, DeviceWithType>();
  for (const [id, device] of deviceMap) {
    if (entityIds.has(id) || deviceMatchesEntityIds(device, entityIds)) {
      next.set(id, device);
    }
  }
  return next;
}

export function resolveStatusSummaryDeviceMap({
  activeRoom,
  availableDeviceMap,
  cardIds,
  customCards,
  deviceMap,
  scope,
}: {
  activeRoom: string;
  availableDeviceMap: Map<string, DeviceWithType>;
  cardIds: readonly string[];
  customCards: readonly CustomCard[];
  deviceMap: Map<string, DeviceWithType>;
  scope: DashboardSummaryBarScope;
}): Map<string, DeviceWithType> {
  if (scope !== 'local') {
    return availableDeviceMap;
  }

  if (!isAllRooms(activeRoom)) {
    return deviceMap;
  }

  return filterDeviceMapByEntityIds(
    availableDeviceMap,
    collectPlacedDashboardEntityIds(cardIds, customCards)
  );
}
