// Retry only failed images, keeping already-loaded map details on screen.
// Do not add cache-busting parameters: tile providers rely on HTTP caching.
export function attachTileRecovery(layer, onErrorChange, eventTarget = window) {
  const failures = new Map();
  const delays = [1500, 4000];
  const report = () => onErrorChange(failures.size > 0);

  const retryTile = (tile, failure) => {
    clearTimeout(failure.timer);
    failure.timer = null;
    if (failures.has(tile)) tile.src = failure.url;
  };
  const onError = ({ tile }) => {
    let failure = failures.get(tile);
    if (!failure) {
      failure = { url: tile.src, attempts: 0, timer: null };
      failures.set(tile, failure);
    }
    if (failure.timer === null && failure.attempts < delays.length) {
      const delay = delays[failure.attempts++];
      failure.timer = setTimeout(() => retryTile(tile, failure), delay);
    }
    report();
  };
  const forget = ({ tile }) => {
    const failure = failures.get(tile);
    if (!failure) return;
    clearTimeout(failure.timer);
    failures.delete(tile);
    report();
  };
  const retry = () => {
    failures.forEach((failure, tile) => {
      failure.attempts = 0;
      retryTile(tile, failure);
    });
  };

  layer.on('tileerror', onError);
  layer.on('tileload', forget);
  layer.on('tileunload', forget);
  eventTarget.addEventListener('online', retry);

  return {
    retry,
    dispose() {
      layer.off('tileerror', onError);
      layer.off('tileload', forget);
      layer.off('tileunload', forget);
      eventTarget.removeEventListener('online', retry);
      failures.forEach(failure => clearTimeout(failure.timer));
      failures.clear();
    }
  };
}
