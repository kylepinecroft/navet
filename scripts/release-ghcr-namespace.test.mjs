import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hostedPreviewChecksRequired } from './pages-gate.mjs';
import {
  ghcrImage,
  ghcrNamespace,
  isUpstreamRepository,
  publicationRepositories,
} from './release-ghcr-namespace.mjs';

const publishWorkflows = [
  '.github/workflows/release-image.yml',
  '.github/workflows/dev-tag-release.yml',
  '.github/workflows/release.yml',
  '.github/workflows/release-runtime.yml',
];

describe('GHCR namespace', () => {
  it('lowercases the repository owner for the image path', () => {
    expect(ghcrNamespace('KylePinecroft')).toBe('kylepinecroft');
    expect(ghcrImage('navet', 'navet-app')).toBe('ghcr.io/navet-app/navet');
    expect(ghcrImage('amd64-navet-addon', 'kylepinecroft')).toBe(
      'ghcr.io/kylepinecroft/amd64-navet-addon',
    );
  });

  it('rejects a missing owner instead of publishing to a hardcoded namespace', () => {
    expect(() => ghcrNamespace('')).toThrow(/repository owner/);
    expect(() => ghcrNamespace(undefined)).toThrow(/repository owner/);
  });

  it('treats the upstream Navet repositories as the owners of hosted release infrastructure', () => {
    expect(isUpstreamRepository('navet-app/navet')).toBe(true);
    expect(isUpstreamRepository('awesomestvi/navet')).toBe(true);
    expect(isUpstreamRepository('kylepinecroft/navet')).toBe(false);
    expect(isUpstreamRepository('navet-app/navet-home-assistant')).toBe(false);
  });

  it('checks the HACS repository only for an upstream publish', () => {
    expect(publicationRepositories('navet-app/navet')).toEqual([
      'navet-app/navet',
      'navet-app/navet-home-assistant',
    ]);
    expect(publicationRepositories('kylepinecroft/navet')).toEqual(['kylepinecroft/navet']);
  });

  it('requires hosted previews only in the upstream repository', () => {
    expect(hostedPreviewChecksRequired('navet-app/navet')).toBe(true);
    expect(hostedPreviewChecksRequired('kylepinecroft/navet')).toBe(false);
  });

  it.each(publishWorkflows)('%s authenticates to GHCR as the repository', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toContain('NAVET_GHCR_TOKEN');
    expect(source).not.toContain('ghcr.io/awesomestvi');
    expect(source).not.toContain('username: awesomestvi');
    expect(source).toContain('secrets.GITHUB_TOKEN');
    expect(source).toContain('GITHUB_REPOSITORY_OWNER');
  });
});
