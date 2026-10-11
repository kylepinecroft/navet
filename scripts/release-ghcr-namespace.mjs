/** Resolve the GHCR namespace from the repository that is running the workflow. */

export const UPSTREAM_REPOSITORY_OWNERS = ['navet-app', 'awesomestvi'];
export const UPSTREAM_HACS_REPOSITORY = 'navet-app/navet-home-assistant';

const namespacePattern = /^[a-z0-9][a-z0-9_.-]{0,38}$/;

export function ghcrNamespace(owner = process.env.GITHUB_REPOSITORY_OWNER) {
  const namespace = String(owner ?? '')
    .trim()
    .toLowerCase();
  if (!namespacePattern.test(namespace)) {
    throw new Error('A repository owner is required to resolve the GHCR namespace.');
  }
  return namespace;
}

export function ghcrImage(name, owner = process.env.GITHUB_REPOSITORY_OWNER) {
  if (!/^[a-z0-9_.-]+$/.test(name ?? '')) {
    throw new Error(`Invalid image name ${name}.`);
  }
  return `ghcr.io/${ghcrNamespace(owner)}/${name}`;
}

export function isUpstreamRepository(repository = process.env.GITHUB_REPOSITORY) {
  const [owner, name] = String(repository ?? '').split('/');
  return name === 'navet' && UPSTREAM_REPOSITORY_OWNERS.includes(String(owner ?? '').toLowerCase());
}

/** Repositories whose releases must be newer than the one being published. */
export function publicationRepositories(repository = process.env.GITHUB_REPOSITORY) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) {
    throw new Error('GITHUB_REPOSITORY is required.');
  }
  return isUpstreamRepository(repository)
    ? [repository, UPSTREAM_HACS_REPOSITORY]
    : [repository];
}
