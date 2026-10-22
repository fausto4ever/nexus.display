// A polling response must not overwrite a newer SSE state or a new screen identity.
export function createStateGuard() {
  let epoch = 0;
  return {
    capture(screenId) { return { screenId, epoch }; },
    advance() { epoch += 1; },
    isCurrent(snapshot, screenId) {
      return snapshot.screenId === screenId && snapshot.epoch === epoch;
    }
  };
}
