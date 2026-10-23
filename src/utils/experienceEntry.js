export function resolveExperience(pathname, isNative = false) {
  if (isNative || pathname === '/app' || pathname === '/app/') return 'app';
  return 'landing';
}

const APK_PATH = /^\/downloads\/[A-Za-z0-9._-]+\.apk$/;
const SHA256 = /^[a-f\d]{64}$/i;

export function validateReleaseManifest(value, origin = 'https://mowaslaty.example') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.available === false) return { available: false };
  if (value.available !== true || typeof value.version !== 'string' || !value.version.trim()) return null;
  if (!Number.isInteger(value.versionCode) || value.versionCode <= 0) return null;
  if (typeof value.url !== 'string' || !APK_PATH.test(value.url)) return null;
  let url;
  try { url = new URL(value.url, origin); } catch { return null; }
  if (url.origin !== origin || url.pathname !== value.url || url.search || url.hash) return null;
  if (!Number.isInteger(value.sizeBytes) || value.sizeBytes <= 0) return null;
  if (typeof value.sha256 !== 'string' || !SHA256.test(value.sha256)) return null;
  if (typeof value.releasedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/i.test(value.releasedAt) || !Number.isFinite(Date.parse(value.releasedAt))) return null;
  return { available: true, version: value.version.trim(), versionCode: value.versionCode, url: value.url, sizeBytes: value.sizeBytes, sha256: value.sha256.toLowerCase(), releasedAt: value.releasedAt };
}

export function formatReleaseSize(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '';
  const mib = sizeBytes / (1024 * 1024);
  return `${mib < 10 ? mib.toFixed(1) : Math.round(mib)} م.ب`;
}
