import { useCallback, useEffect, useRef, useState } from 'react';
import { clearLocationWatch, isNativeLocation, watchLocation } from './locationAdapter';

// Live device location via the browser's Geolocation API.
// Nothing is sent anywhere: the position only lives in this page's memory.
export function useGeolocation() {
  const [state, setState] = useState({
    status: 'idle',        // idle | locating | active | denied | unavailable | unsupported
    coord: null,           // [lat, lng]
    accuracy: null,        // metres
    heading: null,         // degrees, when moving
    speed: null,           // m/s, when moving
    timestamp: null
  });
  const watchId = useRef(null);
  const pending = useRef(null);
  const generation = useRef(0);
  const mounted = useRef(true);

  const stop = useCallback(() => {
    generation.current += 1;
    pending.current = null;
    clearLocationWatch(watchId.current).catch(() => {});
    watchId.current = null;
    setState(s => ({ ...s, status: 'idle' }));
  }, []);

  const start = useCallback(() => {
    if (!isNativeLocation() && (typeof navigator === 'undefined' || !('geolocation' in navigator))) {
      setState(s => ({ ...s, status: 'unsupported' }));
      return;
    }
    if (watchId.current != null || pending.current != null) return; // active or starting
    const request = ++generation.current;
    pending.current = request;
    let permissionDenied = false;
    setState(s => ({ ...s, status: s.coord ? 'active' : 'locating' }));
    watchLocation(
      (pos) => {
        const c = pos.coords;
        if (!mounted.current || request !== generation.current) return;
        setState({
          status: 'active',
          coord: [c.latitude, c.longitude],
          accuracy: c.accuracy,
          heading: Number.isFinite(c.heading) ? c.heading : null,
          speed: Number.isFinite(c.speed) ? c.speed : null,
          timestamp: pos.timestamp
        });
      },
      (err) => {
        if (err.code === 1 || err.code === 'OS-PLUG-GLOC-0003') {
          // permission denied: stop watching
          if (request !== generation.current) return;
          permissionDenied = true;
          clearLocationWatch(watchId.current).catch(() => {});
          watchId.current = null;
          if (mounted.current) setState(s => ({ ...s, status: 'denied' }));
        } else {
          // position unavailable / timeout: keep watching, report only if we have nothing yet
          if (request === generation.current && mounted.current) setState(s => (s.coord ? s : { ...s, status: 'unavailable' }));
        }
      },
    ).then(watch => {
      if (request === generation.current) pending.current = null;
      if (!mounted.current || request !== generation.current || permissionDenied) clearLocationWatch(watch).catch(() => {});
      else { pending.current = null; watchId.current = watch; }
    }).catch(err => {
      if (!mounted.current || request !== generation.current) return;
      pending.current = null;
      setState(s => ({ ...s, status: err?.code === 'UNSUPPORTED' ? 'unsupported' : (err?.code === 1 || err?.code === 'PERMISSION_DENIED' || err?.code === 'OS-PLUG-GLOC-0003' ? 'denied' : 'unavailable') }));
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      pending.current = null;
      clearLocationWatch(watchId.current).catch(() => {});
      watchId.current = null;
    };
  }, []);

  return { ...state, start, stop };
}
