type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export function readPassengerAnalyticsQueue<T>(
  storage: KeyValueStorage,
  key: string,
  {
    now = Date.now(),
    maxAgeMs,
    limit,
    getTimestamp,
  }: { now?: number; maxAgeMs: number; limit: number; getTimestamp: (item: T) => string },
): T[] {
  try {
    const stored = JSON.parse(storage.getItem(key) || "[]") as T[];
    const cutoff = now - maxAgeMs;
    return Array.isArray(stored)
      ? stored.filter((item) => Date.parse(getTimestamp(item)) >= cutoff).slice(-limit)
      : [];
  } catch {
    return [];
  }
}

export function persistPassengerAnalyticsQueue<T>(
  storage: KeyValueStorage,
  key: string,
  queue: T[],
  limit: number,
) {
  try {
    storage.setItem(key, JSON.stringify(queue.slice(-limit)));
  } catch {
    // Analytics are optional and must not break the in-vehicle console.
  }
}
