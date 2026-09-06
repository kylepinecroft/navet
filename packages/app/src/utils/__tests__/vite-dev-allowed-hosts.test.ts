import {
  DEFAULT_VITE_DEV_HOME_ASSISTANT_URL,
  resolveViteDevAllowedHosts,
  resolveViteDevHomeAssistantUrl,
} from '@scripts/vite-dev-allowed-hosts';
import { describe, expect, it } from 'vitest';

describe('resolveViteDevAllowedHosts', () => {
  it('allows the household hostname by default', () => {
    expect(resolveViteDevAllowedHosts({})).toEqual(['navet.pinecroftfamily.com']);
  });

  it('merges extra hosts from NAVET_DEV_ALLOWED_HOSTS', () => {
    expect(
      resolveViteDevAllowedHosts({
        NAVET_DEV_ALLOWED_HOSTS: ' Navet.Example.com , ,dashboard.local ',
      })
    ).toEqual(['navet.pinecroftfamily.com', 'navet.example.com', 'dashboard.local']);
  });

  it('deduplicates overlapping extra hosts', () => {
    expect(
      resolveViteDevAllowedHosts({
        NAVET_DEV_ALLOWED_HOSTS: 'navet.pinecroftfamily.com,navet.pinecroftfamily.com',
      })
    ).toEqual(['navet.pinecroftfamily.com']);
  });
});

describe('resolveViteDevHomeAssistantUrl', () => {
  it('defaults to the household Home Assistant URL', () => {
    expect(resolveViteDevHomeAssistantUrl({})).toBe(DEFAULT_VITE_DEV_HOME_ASSISTANT_URL);
    expect(DEFAULT_VITE_DEV_HOME_ASSISTANT_URL).toBe('https://homeassistant.pinecroftfamily.com');
  });

  it('uses NAVET_HASS_URL when set', () => {
    expect(
      resolveViteDevHomeAssistantUrl({
        NAVET_HASS_URL: ' https://ha.example.test:8123/ ',
      })
    ).toBe('https://ha.example.test:8123');
  });
});
