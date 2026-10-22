// Resolve promptly when an obsolete SSE generation is aborted, rather than
// retaining its retry timer for up to 30 seconds.
export function waitForReconnect(delayMs, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise(resolve => {
    let timer;
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    signal?.addEventListener('abort', done, { once: true });
    timer = setTimeout(done, Math.max(0, delayMs));
    if (signal?.aborted) done();
  });
}
