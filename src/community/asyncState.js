export function createEpochController() {
  let epoch = 0;
  return {
    advance() { epoch += 1; return epoch; },
    capture() { return epoch; },
    isCurrent(value) { return value === epoch; },
  };
}

export function advanceIfChanged(controller, previousValue, nextValue) {
  return Object.is(previousValue, nextValue) ? controller.capture() : controller.advance();
}

export function appendUniqueById(existing, incoming) {
  const seen = new Set(existing.map(item => item?.id).filter(id => typeof id === 'string'));
  return [...existing, ...incoming.filter(item => {
    if (typeof item?.id !== 'string' || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  })];
}
