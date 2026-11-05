/** In-memory, per-console state. No browser storage or server-global playback cache. */
export function createSpotifySession<T>(request: () => Promise<T>, now = Date.now) {
  let snapshot: { value: T | null; receivedAt: number; refreshFailed: boolean } = {
    value: null,
    receivedAt: 0,
    refreshFailed: false,
  };
  let inFlight: Promise<T> | null = null;
  const listeners = new Set<() => void>();
  const publish = (value: T | null) => {
    snapshot = { value, receivedAt: now(), refreshFailed: false };
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh() {
      if (inFlight) return inFlight;
      const current = request()
        .then(
          (value) => {
            publish(value);
            return value;
          },
          (error: unknown) => {
            // Retain recent metadata, explicitly unconfirmed; do not extend its age.
            snapshot = { ...snapshot, refreshFailed: true };
            listeners.forEach((listener) => listener());
            throw error;
          },
        )
        .finally(() => {
          if (inFlight === current) inFlight = null;
        });
      inFlight = current;
      return current;
    },
  };
}

/** Cancels follow-up work, not an already-sent Spotify command. */
export function createSpotifyRequestScope(host: {
  setTimeout: (callback: () => void, delayMs: number) => number;
  clearTimeout: (timer: number) => void;
}) {
  let active = true;
  let version = 0;
  const waits = new Map<number, (active: boolean) => void>();
  return {
    isActive: () => active,
    latest() {
      const requestVersion = ++version;
      return () => active && requestVersion === version;
    },
    wait(delayMs: number): Promise<boolean> {
      if (!active) return Promise.resolve(false);
      return new Promise((resolve) => {
        const timer = host.setTimeout(() => {
          waits.delete(timer);
          resolve(active);
        }, delayMs);
        waits.set(timer, resolve);
      });
    },
    dispose() {
      active = false;
      version += 1;
      waits.forEach((resolve, timer) => {
        host.clearTimeout(timer);
        resolve(false);
      });
      waits.clear();
    },
  };
}

/** Metadata may remain useful offline, but it must not be presented as confirmed live playback. */
export function isSpotifySnapshotUnconfirmed(
  snapshot: { value: unknown; receivedAt: number; refreshFailed: boolean },
  now: number,
) {
  return snapshot.value != null && (snapshot.refreshFailed || now - snapshot.receivedAt > 30_000);
}
