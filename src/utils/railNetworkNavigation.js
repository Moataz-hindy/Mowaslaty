export const RAIL_NETWORKS = ['metro', 'lrt', 'monorail'];

export function resolveLandingHash(hash) {
  const value = String(hash ?? '').replace(/^#/, '');
  const network = RAIL_NETWORKS.includes(value) ? value : 'metro';
  return {
    section: value === 'routes' ? 'routes' : value === 'community' ? 'community' : RAIL_NETWORKS.includes(value) ? 'metro' : 'home',
    network,
  };
}

export function hashForHomeSection(section, railNetwork) {
  if (section === 'home') return '';
  if (section === 'routes') return '#routes';
  if (section === 'community') return '#community';
  return `#${RAIL_NETWORKS.includes(railNetwork) ? railNetwork : 'metro'}`;
}

export function hashForRailNetwork(network) {
  return `#${RAIL_NETWORKS.includes(network) ? network : 'metro'}`;
}
