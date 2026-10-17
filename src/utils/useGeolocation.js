import { useCallback, useEffect, useRef, useState } from 'react';

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

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setState(s => ({ ...s, status: 'idle' }));
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState(s => ({ ...s, status: 'unsupported' }));
      return;
    }
    if (watchId.current != null) return; // already watching
    setState(s => ({ ...s, status: s.coord ? 'active' : 'locating' }));
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;
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
        if (err.code === 1) {
          // permission denied: stop watching
          if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
          setState(s => ({ ...s, status: 'denied' }));
        } else {
          // position unavailable / timeout: keep watching, report only if we have nothing yet
          setState(s => (s.coord ? s : { ...s, status: 'unavailable' }));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }, []);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  return { ...state, start, stop };
}
