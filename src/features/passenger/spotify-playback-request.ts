export function createSingleFlight<T>(request: () => Promise<T>) {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (inFlight) return inFlight;
    const current = request().finally(() => {
      if (inFlight === current) inFlight = null;
    });
    inFlight = current;
    return current;
  };
}

export function shouldPollSpotifyHome(view: string, idleOverlayActive: boolean) {
  return view === "home" && !idleOverlayActive;
}

export type SpotifyPollingHost = {
  setInterval: (callback: () => void, delayMs: number) => number;
  clearInterval: (timer: number) => void;
  readonly visibilityState: DocumentVisibilityState;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
};

function getBrowserSpotifyPollingHost(): SpotifyPollingHost {
  return {
    setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
    clearInterval: (timer) => window.clearInterval(timer),
    get visibilityState() {
      return document.visibilityState;
    },
    addEventListener: (type, listener) => document.addEventListener(type, listener),
    removeEventListener: (type, listener) => document.removeEventListener(type, listener),
  };
}

export function startSpotifyPolling({
  refresh,
  intervalMs,
  enabled = true,
  refreshOnlyWhenVisible = false,
  host = getBrowserSpotifyPollingHost(),
}: {
  refresh: () => Promise<unknown>;
  intervalMs: number;
  enabled?: boolean;
  refreshOnlyWhenVisible?: boolean;
  host?: SpotifyPollingHost;
}) {
  if (!enabled) return () => {};

  let active = true;
  const runRefresh = () => {
    if (active && (!refreshOnlyWhenVisible || host.visibilityState === "visible")) {
      void refresh();
    }
  };
  const refreshOnVisible = () => {
    if (host.visibilityState === "visible") runRefresh();
  };

  // Match current behavior: fetch immediately on mount/re-enable, then on the existing cadence.
  void refresh();
  const interval = host.setInterval(runRefresh, intervalMs);
  if (refreshOnlyWhenVisible) host.addEventListener("visibilitychange", refreshOnVisible);

  return () => {
    active = false;
    host.clearInterval(interval);
    if (refreshOnlyWhenVisible) host.removeEventListener("visibilitychange", refreshOnVisible);
  };
}
