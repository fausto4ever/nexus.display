// Prevent multiple interval ticks from issuing overlapping Gateway state requests.
export function createPollGate() {
  let inFlight = false;
  return {
    get inFlight() { return inFlight; },
    async run(task) {
      if (inFlight) return false;
      inFlight = true;
      try { await task(); return true; }
      finally { inFlight = false; }
    }
  };
}
