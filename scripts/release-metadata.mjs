export function validateReleaseMetadata({ version, versionCode, releasedAt = new Date().toISOString() }) {
  if (typeof version !== 'string' || !/^[0-9]+(?:\.[0-9A-Za-z-]+)*$/.test(version)) {
    throw new Error('ANDROID_VERSION must use digits, dots, letters, and hyphens only.');
  }
  const code = Number(versionCode);
  if (!Number.isSafeInteger(code) || code < 1) throw new Error('ANDROID_VERSION_CODE must be a positive integer.');
  if (typeof releasedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(releasedAt) || !Number.isFinite(Date.parse(releasedAt))) {
    throw new Error('ANDROID_RELEASED_AT must be an ISO date/time.');
  }
  return { version, versionCode: code, releasedAt };
}

export function createReleaseManifest(metadata, { sizeBytes, sha256 }) {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1) throw new Error('APK size must be a positive integer.');
  if (!/^[a-f\d]{64}$/i.test(sha256)) throw new Error('APK SHA-256 must be 64 hexadecimal characters.');
  const { version, versionCode, releasedAt } = validateReleaseMetadata(metadata);
  return { available: true, version, versionCode, url: `/downloads/mowaslaty-${version}.apk`, sizeBytes, sha256: sha256.toLowerCase(), releasedAt };
}
