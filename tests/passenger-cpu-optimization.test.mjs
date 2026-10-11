import { describe, expect, test } from "bun:test";
import {
  createPassengerAnalyticsRetryController,
  getPassengerAnalyticsRetryDelayMs,
  PASSENGER_ANALYTICS_MAX_AUTOMATIC_RETRIES,
} from "../src/features/passenger/analytics-retry.ts";
import {
  createSingleFlight,
  shouldPollSpotifyHome,
  startSpotifyPolling,
} from "../src/features/passenger/spotify-playback-request.ts";

function createFakeTimers() {
  let nextId = 0;
  const timers = new Map();
  return {
    timers,
    setTimer(callback, delayMs) {
      const id = ++nextId;
      timers.set(id, { callback, delayMs });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    async runNext() {
      const [id, timer] = timers.entries().next().value ?? [];
      if (!timer) return false;
      timers.delete(id);
      timer.callback();
      await Promise.resolve();
      await Promise.resolve();
      return true;
    },
  };
}

function createPollingHost() {
  let nextId = 0;
  const intervals = new Map();
  const listeners = new Set();
  let visibilityState = "visible";
  return {
    intervals,
    listeners,
    get visibilityState() {
      return visibilityState;
    },
    setVisibility(value) {
      visibilityState = value;
      for (const listener of listeners) listener();
    },
    setInterval(callback, delayMs) {
      const id = ++nextId;
      intervals.set(id, { callback, delayMs });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
  };
}

describe("Passenger CPU optimization safeguards", () => {
  test("uses exponential jitter with a bounded delay", () => {
    expect(getPassengerAnalyticsRetryDelayMs(1, () => 0)).toBe(500);
    expect(getPassengerAnalyticsRetryDelayMs(2, () => 1)).toBe(2_000);
    expect(getPassengerAnalyticsRetryDelayMs(20, () => 1)).toBe(60_000);
  });

  test("preserves queued event IDs through failures and delivers them after recovery", async () => {
    const fake = createFakeTimers();
    const retry = createPassengerAnalyticsRetryController(fake.setTimer, fake.clearTimer);
    const queue = [{ id: "stable-event-id" }];
    const attemptedIds = [];
    let shouldFail = true;
    const flush = async () => {
      attemptedIds.push(queue.map(({ id }) => id));
      if (shouldFail) throw new Error("temporary network failure");
      queue.length = 0;
    };

    await retry.run(flush, () => true);
    expect(queue).toEqual([{ id: "stable-event-id" }]);
    expect(fake.timers.size).toBe(1);
    shouldFail = false;
    await fake.runNext();

    expect(attemptedIds).toEqual([["stable-event-id"], ["stable-event-id"]]);
    expect(queue).toEqual([]);
    expect(fake.timers.size).toBe(0);
    retry.dispose();
  });

  test("prevents overlap and caps rapid retries before the 30-second heartbeat fallback", async () => {
    const fake = createFakeTimers();
    const retry = createPassengerAnalyticsRetryController(fake.setTimer, fake.clearTimer);
    let attempts = 0;
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const overlappingTask = async () => {
      attempts += 1;
      await pending;
    };
    const first = retry.run(overlappingTask, () => true);
    await retry.run(overlappingTask, () => true);
    expect(attempts).toBe(1);
    release();
    await first;

    const failingTask = async () => {
      attempts += 1;
      throw new Error("offline/server error");
    };
    await retry.run(failingTask, () => true);
    for (let index = 0; index < PASSENGER_ANALYTICS_MAX_AUTOMATIC_RETRIES; index += 1) {
      expect(await fake.runNext()).toBe(true);
    }
    expect(fake.timers.size).toBe(0);
    const attemptsAfterRapidRetries = attempts;
    await retry.run(failingTask, () => true, "event");
    expect(attempts).toBe(attemptsAfterRapidRetries);
    await retry.run(failingTask, () => true, "heartbeat");
    expect(attempts).toBe(attemptsAfterRapidRetries + 1);
    retry.dispose();
  });

  test("retries immediately on reconnection and clears pending retry timers on cleanup", async () => {
    const fake = createFakeTimers();
    const retry = createPassengerAnalyticsRetryController(fake.setTimer, fake.clearTimer);
    let attempts = 0;
    await retry.run(
      async () => {
        attempts += 1;
        throw new Error("failed");
      },
      () => true,
    );
    expect(fake.timers.size).toBe(1);
    await retry.run(
      async () => {
        attempts += 1;
      },
      () => true,
      "online",
    );
    expect(attempts).toBe(2);
    expect(fake.timers.size).toBe(0);

    await retry.run(
      async () => {
        throw new Error("failed again");
      },
      () => true,
    );
    retry.dispose();
    expect(fake.timers.size).toBe(0);
  });

  test("shares only overlapping Spotify playback requests", async () => {
    let resolveRequest;
    let requestCount = 0;
    const sharedRequest = createSingleFlight(
      () =>
        new Promise((resolve) => {
          requestCount += 1;
          resolveRequest = resolve;
        }),
    );
    const first = sharedRequest();
    const second = sharedRequest();
    expect(first).toBe(second);
    expect(requestCount).toBe(1);
    resolveRequest({ state: "ready" });
    await first;
    const later = sharedRequest();
    expect(requestCount).toBe(2);
    resolveRequest({ state: "ready" });
    await later;
  });

  test("stops Home polling under idle overlay and resumes immediately when the screen is active", async () => {
    const host = createPollingHost();
    const refresh = async () => {};
    expect(shouldPollSpotifyHome("home", true)).toBe(false);
    const idleCleanup = startSpotifyPolling({
      refresh,
      intervalMs: 30_000,
      enabled: shouldPollSpotifyHome("home", true),
      host,
    });
    expect(host.intervals.size).toBe(0);

    let activeRefreshes = 0;
    const activeCleanup = startSpotifyPolling({
      refresh: async () => {
        activeRefreshes += 1;
      },
      intervalMs: 30_000,
      enabled: shouldPollSpotifyHome("home", false),
      host,
    });
    expect(activeRefreshes).toBe(1);
    expect([...host.intervals.values()].map(({ delayMs }) => delayMs)).toEqual([30_000]);
    activeCleanup();
    idleCleanup();
    expect(host.intervals.size).toBe(0);
  });

  test("preserves idle 10-second and Music 5-second refreshes, visibility refresh, and cleanup", () => {
    const host = createPollingHost();
    let idleRefreshes = 0;
    const stopIdle = startSpotifyPolling({
      refresh: async () => {
        idleRefreshes += 1;
      },
      intervalMs: 10_000,
      refreshOnlyWhenVisible: true,
      host,
    });
    expect(idleRefreshes).toBe(1);
    expect([...host.intervals.values()].map(({ delayMs }) => delayMs)).toEqual([10_000]);
    host.setVisibility("hidden");
    host.intervals.values().next().value.callback();
    expect(idleRefreshes).toBe(1);
    host.setVisibility("visible");
    expect(idleRefreshes).toBe(2);
    stopIdle();
    expect(host.intervals.size).toBe(0);
    expect(host.listeners.size).toBe(0);

    let musicRefreshes = 0;
    const stopMusic = startSpotifyPolling({
      refresh: async () => {
        musicRefreshes += 1;
      },
      intervalMs: 5_000,
      refreshOnlyWhenVisible: true,
      host,
    });
    expect(musicRefreshes).toBe(1);
    expect([...host.intervals.values()].map(({ delayMs }) => delayMs)).toEqual([5_000]);
    stopMusic();
    expect(host.intervals.size).toBe(0);
    expect(host.listeners.size).toBe(0);
  });
});
