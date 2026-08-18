import { describe, expect, it } from 'vitest';
import {
  createDashboardDefinition,
  createLegacyDashboardCollection,
  deleteDashboardFromCollection,
  resolveDashboard,
  resolveDashboardNavigationRooms,
  sanitizeDashboardCollection,
} from './dashboard-collection';

describe('dashboard collection contract', () => {
  it('migrates the existing Home layout into one stable dashboard without changing its cards', () => {
    const collection = createLegacyDashboardCollection({
      homeLayout: {
        mode: 'flow',
        showHero: true,
        cardIds: ['light.upstairs', 'custom-note'],
        sections: [],
        cardSectionAssignments: {},
      },
      cardSizes: {
        'light.upstairs': 'small',
        'light.downstairs': 'large',
        'custom-note': 'medium',
      },
      customCards: [
        {
          id: 'custom-note',
          type: 'note',
          size: 'medium',
          room: '__home__',
          createdAt: 1,
        },
      ],
    });

    expect(collection.order).toEqual(['home']);
    expect(collection.defaultDashboardId).toBe('home');
    expect(collection.dashboardsById.home.homeLayout.cardIds).toEqual([
      'home_assistant:light.upstairs',
      'custom-note',
    ]);
    expect(collection.dashboardsById.home.homeCardSizes).toEqual({
      'home_assistant:light.upstairs': 'small',
      'custom-note': 'medium',
    });
    expect(collection.dashboardsById.home.homeCustomCards).toHaveLength(1);
    expect(collection.dashboardsById.home.homeRoomNames).toBeNull();
    expect(collection.dashboardsById.home.summaryBarScope).toBe('global');
  });

  it('resolves direct links before previews, device assignments, and the workspace default', () => {
    const home = createDashboardDefinition({ id: 'home', name: 'Home' });
    const upstairs = createDashboardDefinition({ id: 'upstairs', name: 'Upstairs' });
    const wall = createDashboardDefinition({ id: 'wall', name: 'Wall' });
    const collection = sanitizeDashboardCollection(
      {
        schemaVersion: 1,
        defaultDashboardId: 'home',
        order: ['home', 'upstairs', 'wall'],
        dashboardsById: { home, upstairs, wall },
        dashboardIdByClientId: { sonoff: 'wall' },
      },
      createLegacyDashboardCollection({ homeLayout: null })
    );

    expect(
      resolveDashboard(collection, {
        clientId: 'sonoff',
        previewDashboardId: 'upstairs',
        directDashboardId: 'home',
      })
    ).toEqual({ dashboardId: 'home', source: 'link' });
    expect(
      resolveDashboard(collection, { clientId: 'sonoff', previewDashboardId: 'upstairs' })
    ).toEqual({ dashboardId: 'upstairs', source: 'preview' });
    expect(resolveDashboard(collection, { clientId: 'sonoff' })).toEqual({
      dashboardId: 'wall',
      source: 'assignment',
    });
  });

  it('builds an upstairs lights dashboard from room selection without one-by-one card setup', () => {
    const dashboard = createDashboardDefinition({
      id: 'upstairs',
      name: 'Upstairs lights',
      source: {
        kind: 'rooms',
        roomNames: ['Bedroom', 'Landing'],
        include: 'lights',
        devices: [
          { id: 'homey:light.bed', room: 'Bedroom', type: 'lights', size: 'small' },
          { id: 'openhab:light.landing', room: 'Landing', type: 'lights', size: 'medium' },
          { id: 'homey:sensor.bed', room: 'Bedroom', type: 'sensors', size: 'small' },
          { id: 'homey:light.kitchen', room: 'Kitchen', type: 'lights', size: 'small' },
        ],
      },
    });

    expect(dashboard.homeLayout.cardIds).toEqual(['homey:light.bed', 'openhab:light.landing']);
    expect(dashboard.summaryBarScope).toBe('local');
    expect(dashboard.homeCardSizes).toEqual({
      'homey:light.bed': 'small',
      'openhab:light.landing': 'medium',
    });
    expect(dashboard.homeRoomNames).toEqual(['Bedroom', 'Landing']);
    expect(
      resolveDashboardNavigationRooms(
        ['Kitchen', 'Bedroom', 'Landing', 'Outside'],
        dashboard.homeRoomNames
      )
    ).toEqual(['Bedroom', 'Landing']);
  });

  it('sanitizes room scope and preserves it when copying a dashboard', () => {
    const fallback = createLegacyDashboardCollection({ homeLayout: null });
    const scoped = createDashboardDefinition({
      id: 'upstairs',
      name: 'Upstairs',
      source: {
        kind: 'rooms',
        roomNames: [' Living Room ', 'Office', 'living room', 'All'],
        include: 'common',
        devices: [],
      },
    });
    const collection = sanitizeDashboardCollection(
      {
        schemaVersion: 1,
        defaultDashboardId: 'upstairs',
        order: ['upstairs'],
        dashboardsById: { upstairs: scoped },
        dashboardIdByClientId: {},
      },
      fallback
    );
    const copy = createDashboardDefinition({
      id: 'upstairs-copy',
      name: 'Upstairs copy',
      source: { kind: 'copy', dashboard: collection.dashboardsById.upstairs },
    });

    expect(collection.dashboardsById.upstairs.homeRoomNames).toEqual(['Living Room', 'Office']);
    expect(collection.dashboardsById.upstairs.summaryBarScope).toBe('local');
    expect(copy.homeRoomNames).toEqual(['Living Room', 'Office']);
    expect(copy.summaryBarScope).toBe('local');
    expect(
      resolveDashboardNavigationRooms(['living room', 'Kitchen', 'Office'], copy.homeRoomNames)
    ).toEqual(['living room', 'Office']);
  });

  it('copies card placements with remapped custom card ids', () => {
    const source = createDashboardDefinition({
      id: 'wall',
      name: 'Wall',
      source: { kind: 'blank' },
    });
    source.homeLayout = {
      ...source.homeLayout,
      mode: 'sectioned',
      cardIds: ['custom-note'],
      sections: [
        {
          id: 'section-1',
          title: 'Pinned',
          x: 0,
          y: 0,
          w: 12,
          h: 1,
          span: 12,
        },
      ],
      cardSectionAssignments: { 'custom-note': 'section-1' },
      cardLayouts: { 'custom-note': { x: 2, y: 4 } },
      cardGridColumns: 12,
    };
    source.homeCustomCards = [
      {
        id: 'custom-note',
        type: 'note',
        size: 'small',
        room: '__home__',
        createdAt: 1,
      },
    ];

    const copy = createDashboardDefinition({
      id: 'wall-copy',
      name: 'Wall copy',
      source: { kind: 'copy', dashboard: source },
    });

    expect(copy.homeCustomCards[0]?.id).not.toBe('custom-note');
    const copiedId = copy.homeCustomCards[0]?.id ?? '';
    expect(copy.homeLayout.cardLayouts[copiedId]).toEqual({ x: 2, y: 4 });
    expect(copy.homeLayout.cardSectionAssignments[copiedId]).toBe('section-1');
  });

  it('atomically remaps the default and every assigned display when deleting a dashboard', () => {
    const home = createDashboardDefinition({ id: 'home', name: 'Home' });
    const upstairs = createDashboardDefinition({ id: 'upstairs', name: 'Upstairs' });
    const collection = sanitizeDashboardCollection(
      {
        schemaVersion: 1,
        defaultDashboardId: 'upstairs',
        order: ['home', 'upstairs'],
        dashboardsById: { home, upstairs },
        dashboardIdByClientId: { sonoff: 'upstairs', phone: 'home' },
      },
      createLegacyDashboardCollection({ homeLayout: null })
    );

    const next = deleteDashboardFromCollection(collection, 'upstairs');

    expect(next.defaultDashboardId).toBe('home');
    expect(next.order).toEqual(['home']);
    expect(next.dashboardIdByClientId).toEqual({ sonoff: 'home', phone: 'home' });
    expect(next.dashboardsById.upstairs).toBeUndefined();
  });

  it('defaults a missing summary bar scope to global and keeps a valid local scope', () => {
    const fallback = createLegacyDashboardCollection({ homeLayout: null });
    const collection = sanitizeDashboardCollection(
      {
        schemaVersion: 1,
        defaultDashboardId: 'home',
        order: ['home', 'upstairs'],
        dashboardsById: {
          home: {
            id: 'home',
            name: 'Home',
            icon: 'layout-dashboard',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            homeRoomNames: null,
            homeLayout: null,
            homeCardSizes: {},
            homeCustomCards: [],
            homeCardZones: {},
          },
          upstairs: {
            id: 'upstairs',
            name: 'Upstairs',
            icon: 'layout-dashboard',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            homeRoomNames: ['Bedroom'],
            homeLayout: null,
            homeCardSizes: {},
            homeCustomCards: [],
            homeCardZones: {},
            summaryBarScope: 'local',
          },
        },
        dashboardIdByClientId: {},
      },
      fallback
    );

    expect(collection.dashboardsById.home.summaryBarScope).toBe('global');
    expect(collection.dashboardsById.upstairs.summaryBarScope).toBe('local');
  });
});
