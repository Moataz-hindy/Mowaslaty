import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export default function NativeAppBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let active = true;
    let registration;
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (!active) return;
      const handled = !window.dispatchEvent(new Event('mowaslaty:native-back', { cancelable: true }));
      if (handled) return;
      if (canGoBack && window.history.length > 1) window.history.back();
      else CapacitorApp.exitApp();
    }).then(handle => {
      registration = handle;
      if (!active) handle.remove();
    }).catch(error => console.warn('Unable to register native back handler', error));
    return () => {
      active = false;
      registration?.remove();
    };
  }, []);
  return null;
}
