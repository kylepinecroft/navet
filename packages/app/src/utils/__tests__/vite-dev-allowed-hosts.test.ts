import { resolveViteDevAllowedHosts } from '@scripts/vite-dev-allowed-hosts';
import { describe, expect, it } from 'vitest';

describe('resolveViteDevAllowedHosts', () => {
  it('leaves Vite defaults alone when NAVET_DEV_ALLOWED_HOSTS is unset', () => {
    expect(resolveViteDevAllowedHosts({})).toBeUndefined();
  });

  it('parses extra hosts from NAVET_DEV_ALLOWED_HOSTS', () => {
    expect(
      resolveViteDevAllowedHosts({
        NAVET_DEV_ALLOWED_HOSTS: ' Navet.Example.com , ,dashboard.local ',
      })
    ).toEqual(['navet.example.com', 'dashboard.local']);
  });

  it('deduplicates overlapping extra hosts', () => {
    expect(
      resolveViteDevAllowedHosts({
        NAVET_DEV_ALLOWED_HOSTS: 'navet.pinecroftfamily.com,navet.pinecroftfamily.com',
      })
    ).toEqual(['navet.pinecroftfamily.com']);
  });
});
