const pendingRequests = new Map();

// Shares a currently running read across StrictMode effect replays.
export function requestOnce(key, request) {
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const promise = Promise.resolve()
    .then(request)
    .finally(() => {
      if (pendingRequests.get(key) === promise) pendingRequests.delete(key);
    });
  pendingRequests.set(key, promise);
  return promise;
}
