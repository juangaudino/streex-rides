export const PASSENGER_ANALYTICS_MAX_AUTOMATIC_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 60_000;

export type PassengerAnalyticsFlushTrigger = "event" | "heartbeat" | "online" | "retry";

export function getPassengerAnalyticsRetryDelayMs(attempt: number, random = Math.random) {
  const exponent = Math.max(0, Math.floor(attempt) - 1);
  const cappedDelay = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** exponent);
  // Equal jitter keeps a useful delay while spreading clients across the capped window.
  return Math.round(cappedDelay * (0.5 + random() * 0.5));
}

export function createPassengerAnalyticsRetryController(
  setTimer: typeof setTimeout = setTimeout,
  clearTimer: typeof clearTimeout = clearTimeout,
) {
  let inFlight = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let failureCount = 0;
  let pausedUntilHeartbeat = false;
  let disposed = false;

  const clearScheduledRetry = () => {
    if (retryTimer === null) return;
    clearTimer(retryTimer);
    retryTimer = null;
  };

  const run = async (
    task: () => Promise<void>,
    isOnline: () => boolean,
    trigger: PassengerAnalyticsFlushTrigger = "event",
  ) => {
    if (disposed || inFlight || !isOnline()) return;
    if (retryTimer !== null && trigger !== "online") return;
    if (pausedUntilHeartbeat && trigger === "event") return;

    if (trigger === "online") {
      clearScheduledRetry();
      failureCount = 0;
      pausedUntilHeartbeat = false;
    }

    inFlight = true;
    try {
      await task();
      failureCount = 0;
      pausedUntilHeartbeat = false;
    } catch {
      failureCount += 1;
      if (failureCount <= PASSENGER_ANALYTICS_MAX_AUTOMATIC_RETRIES && isOnline() && !disposed) {
        const delay = getPassengerAnalyticsRetryDelayMs(failureCount);
        retryTimer = setTimer(() => {
          retryTimer = null;
          void run(task, isOnline, "retry");
        }, delay);
      } else {
        // Stop the rapid retry burst. The existing 30-second heartbeat remains the slow fallback.
        pausedUntilHeartbeat = true;
      }
    } finally {
      inFlight = false;
    }
  };

  return {
    run,
    dispose() {
      disposed = true;
      clearScheduledRetry();
    },
  };
}
