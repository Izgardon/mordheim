/** Full reload: the fallback when the running bundle is broken or out of date (a new deploy). */
export function reloadApp() {
  window.location.reload();
}

/** A lazy route's chunk failed to download, usually because a deploy replaced its hashed file. */
export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /dynamically imported module|importing a module script failed|chunkloaderror|loading chunk/i.test(
    message
  );
}
