import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export const isNativeLocation = () => Capacitor.isNativePlatform();

export function nativeLocationCallback(onPosition, onError) {
  return (position, error) => {
    if (error) onError(error);
    else if (position) onPosition(position);
  };
}

export async function watchLocation(onPosition, onError) {
  if (!isNativeLocation()) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) throw Object.assign(new Error('Geolocation unavailable'), { code: 'UNSUPPORTED' });
    return { kind: 'web', id: navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }) };
  }
  const id = await Geolocation.watchPosition(
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    nativeLocationCallback(onPosition, onError)
  );
  return { kind: 'native', id };
}

export async function clearLocationWatch(watch) {
  if (!watch) return;
  if (watch.kind === 'native') await Geolocation.clearWatch({ id: watch.id });
  else if (typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.clearWatch(watch.id);
}
