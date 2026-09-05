import { ALL_ROOMS_ID } from '@navet/app/constants/rooms';
import type { DeviceWithType } from '@navet/app/types/device.types';
import { describe, expect, it } from 'vitest';
import type { CustomCard } from '../stores/custom-cards-store';
import {
  collectPlacedDashboardEntityIds,
  resolveStatusSummaryDeviceMap,
  sanitizeDashboardSummaryBarScope,
} from './dashboard-summary-scope';

function device(overrides: Partial<DeviceWithType> & Pick<DeviceWithType, 'id' | 'type'>) {
  return {
    name: overrides.id,
    room: 'Living Room',
    size: 'small',
    ...overrides,
  } as DeviceWithType;
}

describe('dashboard summary bar scope', () => {
  it('defaults unknown values to global', () => {
    expect(sanitizeDashboardSummaryBarScope(undefined)).toBe('global');
    expect(sanitizeDashboardSummaryBarScope('room')).toBe('global');
    expect(sanitizeDashboardSummaryBarScope('local')).toBe('local');
  });

  it('collects placed device cards and custom card entity references', () => {
    const customCards: CustomCard[] = [
      {
        id: 'custom-info',
        type: 'info',
        size: 'small',
        room: '__home__',
        createdAt: 1,
        data: {
          sensorEntityIds: ['sensor.kitchen_temperature', 'home_assistant:sensor.humidity'],
        },
      },
      {
        id: 'custom-note',
        type: 'note',
        size: 'small',
        room: '__home__',
        createdAt: 2,
      },
    ];

    expect(
      collectPlacedDashboardEntityIds(['light.kitchen', 'custom-info', 'custom-note'], customCards)
    ).toEqual(
      new Set([
        'light.kitchen',
        'home_assistant:light.kitchen',
        'sensor.kitchen_temperature',
        'home_assistant:sensor.kitchen_temperature',
        'home_assistant:sensor.humidity',
      ])
    );
  });

  it('keeps the whole-home map for global scope', () => {
    const kitchenLight = device({
      id: 'home_assistant:light.kitchen',
      type: 'lights',
      state: true,
    });
    const officeLock = device({ id: 'home_assistant:lock.office', type: 'locks', state: true });
    const availableDeviceMap = new Map([
      [kitchenLight.id, kitchenLight],
      [officeLock.id, officeLock],
    ]);

    expect(
      resolveStatusSummaryDeviceMap({
        activeRoom: ALL_ROOMS_ID,
        availableDeviceMap,
        cardIds: [kitchenLight.id],
        customCards: [],
        deviceMap: new Map([[kitchenLight.id, kitchenLight]]),
        scope: 'global',
      })
    ).toBe(availableDeviceMap);
  });

  it('limits the home overview summary to entities placed on the dashboard', () => {
    const kitchenLight = device({
      id: 'home_assistant:light.kitchen',
      type: 'lights',
      state: true,
    });
    const officeLock = device({
      id: 'home_assistant:lock.office',
      type: 'locks',
      state: true,
      securityKind: 'lock',
    });
    const availableDeviceMap = new Map([
      [kitchenLight.id, kitchenLight],
      [officeLock.id, officeLock],
    ]);

    expect(
      resolveStatusSummaryDeviceMap({
        activeRoom: ALL_ROOMS_ID,
        availableDeviceMap,
        cardIds: [kitchenLight.id],
        customCards: [],
        deviceMap: availableDeviceMap,
        scope: 'local',
      })
    ).toEqual(new Map([[kitchenLight.id, kitchenLight]]));
  });

  it('uses the visible room-page map for a local room summary', () => {
    const visibleKitchenLight = device({
      id: 'home_assistant:light.kitchen',
      type: 'lights',
      room: 'Kitchen',
      state: true,
    });
    const hiddenKitchenLock = device({
      id: 'home_assistant:lock.kitchen',
      type: 'locks',
      room: 'Kitchen',
      state: false,
    });
    const availableDeviceMap = new Map([
      [visibleKitchenLight.id, visibleKitchenLight],
      [hiddenKitchenLock.id, hiddenKitchenLock],
    ]);
    const deviceMap = new Map([[visibleKitchenLight.id, visibleKitchenLight]]);

    expect(
      resolveStatusSummaryDeviceMap({
        activeRoom: 'Kitchen',
        availableDeviceMap,
        cardIds: [visibleKitchenLight.id],
        customCards: [],
        deviceMap,
        scope: 'local',
      })
    ).toBe(deviceMap);
  });
});
