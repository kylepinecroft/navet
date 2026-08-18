import { describe, expect, it } from 'vitest';
import {
  getEntityDisplayNameOverride,
  normalizeHeaderGreetingName,
  resolveEntityDisplayName,
  resolveGreetingDisplayName,
  sanitizeEntityDisplayNames,
  sanitizeHeaderGreetingName,
} from './display-overrides';

describe('display overrides', () => {
  it('keeps a custom greeting and falls back to the provider first name', () => {
    expect(
      resolveGreetingDisplayName({
        override: '  Chef  ',
        providerUserName: 'Jane Doe',
        guestName: 'there',
      })
    ).toBe('Chef');
    expect(
      resolveGreetingDisplayName({
        override: '   ',
        providerUserName: 'Jane Doe',
        guestName: 'there',
      })
    ).toBe('Jane');
    expect(
      resolveGreetingDisplayName({
        override: '',
        providerUserName: null,
        guestName: 'there',
      })
    ).toBe('there');
  });

  it('uses a dashboard entity label only when one is set', () => {
    expect(resolveEntityDisplayName('Kitchen Lights', 'Island')).toBe('Island');
    expect(resolveEntityDisplayName('Kitchen Lights', '  ')).toBe('Kitchen Lights');
    expect(resolveEntityDisplayName('Kitchen Lights', undefined)).toBe('Kitchen Lights');
  });

  it('canonicalizes persisted entity label keys and drops empty values', () => {
    expect(
      sanitizeEntityDisplayNames({
        'light.kitchen': '  Island  ',
        'home_assistant:light.kitchen': 'Kitchen island',
        'light.blank': '   ',
        12: 'nope',
      })
    ).toEqual({
      'home_assistant:light.kitchen': 'Kitchen island',
    });
  });

  it('keeps synthetic aggregate label keys for grouped dashboard cards', () => {
    expect(
      sanitizeEntityDisplayNames({
        'security.aggregate.motion.secure': '  Yard motion  ',
        'not-an-id': 'Nope',
      })
    ).toEqual({
      'security.aggregate.motion.secure': 'Yard motion',
    });
  });

  it('looks up an override by canonical or legacy entity id', () => {
    const overrides = {
      'home_assistant:light.kitchen': 'Island',
    };

    expect(getEntityDisplayNameOverride(overrides, 'light.kitchen')).toBe('Island');
    expect(
      getEntityDisplayNameOverride(overrides, 'switch.other', {
        canonicalId: 'home_assistant:light.kitchen',
      })
    ).toBe('Island');
    expect(getEntityDisplayNameOverride(overrides, 'light.missing')).toBeUndefined();
  });

  it('trims greeting names to the display limit', () => {
    expect(normalizeHeaderGreetingName(`  ${'A'.repeat(80)}  `)).toBe('A'.repeat(40));
    expect(normalizeHeaderGreetingName(12)).toBe('');
  });

  it('preserves trailing spaces while greeting names are being edited', () => {
    expect(sanitizeHeaderGreetingName('Jane ')).toBe('Jane ');
    expect(normalizeHeaderGreetingName('Jane ')).toBe('Jane');
  });
});
