import { describe, expect, test } from "bun:test";
import {
  createPassengerAnalyticsRetryController,
  getPassengerAnalyticsRetryDelayMs,
  PASSENGER_ANALYTICS_MAX_AUTOMATIC_RETRIES,
} from "../src/features/passenger/analytics-retry.ts";
import {
  persistPassengerAnalyticsQueue,
  readPassengerAnalyticsQueue,
} from "../src/features/passenger/analytics-queue-storage.ts";
import {
  createSpotifyPostControlRefreshScheduler,
  createSingleFlight,
  shouldPollSpotifyHome,
  startSpotifyPolling,
} from "../src/features/passenger/spotify-playback-request.ts";
import {
  controlSpotifyPlayback,
  getSpotifyPlayback,
  playSpotifyTrack,
  refreshSpotifyAccessToken,
  setSpotifyRepeatMode,
} from "../src/lib/spotify.server.ts";
import { encryptSpotifyToken } from "../src/lib/spotify-crypto.server.ts";
import {
  createPassengerRepeatSession,
  createPassengerRepeatRetryGate,
  decidePassengerRepeatAction,
  isSamePassengerRepeatSession,
  readPassengerRepeatSession,
  writePassengerRepeatSession,
} from "../src/features/passenger/spotify-passenger-repeat.ts";

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

function createMemoryStorage() {
  const data = new Map();
  return {
    data,
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
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

  test("persists analytics IDs across reloads, retains recent events, and enforces queue limits", () => {
    const storage = createMemoryStorage();
    const now = Date.parse("2026-10-11T12:00:00.000Z");
    const events = [
      { id: "old", occurredAt: new Date(now - 86_401_000).toISOString() },
      { id: "kept-1", occurredAt: new Date(now - 60_000).toISOString() },
      { id: "kept-2", occurredAt: new Date(now).toISOString() },
    ];
    persistPassengerAnalyticsQueue(storage, "events", events, 2);
    const reloaded = readPassengerAnalyticsQueue(storage, "events", {
      now,
      maxAgeMs: 86_400_000,
      limit: 2,
      getTimestamp: (event) => event.occurredAt,
    });
    expect(reloaded.map(({ id }) => id)).toEqual(["kept-1", "kept-2"]);
    expect(JSON.parse(storage.getItem("events"))).toEqual(events.slice(-2));
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

  test("recovers after an offline failure without losing queued IDs, then flushes exactly once", async () => {
    const fake = createFakeTimers();
    const retry = createPassengerAnalyticsRetryController(fake.setTimer, fake.clearTimer);
    const storage = createMemoryStorage();
    const queue = [{ id: "offline-event", occurredAt: new Date().toISOString() }];
    persistPassengerAnalyticsQueue(storage, "events", queue, 100);
    let online = false;
    let delivered = [];
    const flush = async () => {
      const pending = readPassengerAnalyticsQueue(storage, "events", {
        maxAgeMs: 86_400_000,
        limit: 100,
        getTimestamp: (event) => event.occurredAt,
      });
      if (!online) throw new Error("offline");
      delivered = [...delivered, ...pending.map(({ id }) => id)];
      persistPassengerAnalyticsQueue(storage, "events", [], 100);
    };
    await retry.run(flush, () => online);
    expect(delivered).toEqual([]);
    expect(
      readPassengerAnalyticsQueue(storage, "events", {
        maxAgeMs: 86_400_000,
        limit: 100,
        getTimestamp: (event) => event.occurredAt,
      }),
    ).toEqual(queue);
    online = true;
    await retry.run(flush, () => online, "online");
    expect(delivered).toEqual(["offline-event"]);
    expect(storage.getItem("events")).toBe("[]");
    retry.dispose();
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

  test("deduplicates delayed Spotify polling, releases the flight on failure, and retries on reconnect", async () => {
    let resolveRequest;
    let requestCount = 0;
    let shouldFail = true;
    const shared = createSingleFlight(async () => {
      requestCount += 1;
      if (shouldFail) throw new Error("expired Spotify session");
      if (requestCount > 2) return { state: "ready", title: "Recovered" };
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    });
    await expect(shared()).rejects.toThrow("expired Spotify session");
    shouldFail = false;
    const delayed1 = shared();
    const delayed2 = shared();
    expect(delayed1).toBe(delayed2);
    expect(requestCount).toBe(2);
    resolveRequest({ state: "ready", title: "Recovered" });
    await expect(delayed1).resolves.toEqual({ state: "ready", title: "Recovered" });
    expect(await shared()).toEqual({ state: "ready", title: "Recovered" });
    expect(requestCount).toBe(3);
  });

  test("cancels the 300/800 ms Spotify refresh when the passenger navigates immediately", async () => {
    for (const [command, expectedDelay] of [
      ["pause", 300],
      ["next", 800],
    ]) {
      const fake = createFakeTimers();
      const scheduler = createSpotifyPostControlRefreshScheduler({
        setTimeout: fake.setTimer,
        clearTimeout: fake.clearTimer,
      });
      let refreshRequests = 0;
      let stateUpdates = 0;

      // Playback control succeeds, queues its unchanged delayed refresh, then the
      // passenger immediately navigates away and unmount cleanup runs.
      scheduler.schedule(
        expectedDelay,
        async () => {
          refreshRequests += 1;
          return { state: "ready" };
        },
        () => {
          stateUpdates += 1;
        },
        () => {
          stateUpdates += 1;
        },
      );
      expect([...fake.timers.values()].map(({ delayMs }) => delayMs)).toEqual([expectedDelay]);
      scheduler.dispose();
      expect(fake.timers.size).toBe(0);
      expect(await fake.runNext()).toBe(false);
      expect(refreshRequests).toBe(0);
      expect(stateUpdates).toBe(0);
      expect(command === "pause" ? 300 : 800).toBe(expectedDelay);
    }
  });

  test("ignores a Spotify refresh response that resolves after navigating away", async () => {
    const fake = createFakeTimers();
    const scheduler = createSpotifyPostControlRefreshScheduler({
      setTimeout: fake.setTimer,
      clearTimeout: fake.clearTimer,
    });
    let resolveRefresh;
    let stateUpdates = 0;
    scheduler.schedule(
      300,
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
      () => {
        stateUpdates += 1;
      },
      () => {
        stateUpdates += 1;
      },
    );
    expect(await fake.runNext()).toBe(true);
    scheduler.dispose();
    resolveRefresh({ state: "ready" });
    await Promise.resolve();
    await Promise.resolve();
    expect(stateUpdates).toBe(0);
  });

  test("simulates Spotify expired-token refresh and transient API recovery with mocked fetch", async () => {
    const previousFetch = globalThis.fetch;
    const previousEnv = {
      enabled: process.env.SPOTIFY_PERSONAL_INTEGRATION_ENABLED,
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      key: process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY,
    };
    process.env.SPOTIFY_PERSONAL_INTEGRATION_ENABLED = "true";
    process.env.SPOTIFY_CLIENT_ID = "phase-b-mock-client";
    process.env.SPOTIFY_CLIENT_SECRET = "phase-b-mock-secret";
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const calls = [];
    let playbackAttempts = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("accounts.spotify.com")) {
        return new Response(JSON.stringify({ access_token: "mock-access-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      playbackAttempts += 1;
      if (playbackAttempts === 1) {
        return new Response(JSON.stringify({ error: { message: "temporary unavailable" } }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          device: { name: "mock vehicle audio" },
          is_playing: true,
          repeat_state: "context",
          progress_ms: 2_000,
          item: {
            uri: "spotify:track:1234567890123456789012",
            name: "Mock Recovery Track",
            duration_ms: 180_000,
            artists: [{ name: "Mock Artist" }],
            album: { name: "Mock Album", images: [{ url: "https://mock.invalid/art.jpg" }] },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      const encryptedToken = encryptSpotifyToken("mock-refresh-token");
      await expect(refreshSpotifyAccessToken(encryptedToken)).resolves.toBe("mock-access-token");
      await expect(getSpotifyPlayback("mock-access-token")).rejects.toThrow(
        "temporary unavailable",
      );
      await expect(getSpotifyPlayback("mock-access-token")).resolves.toMatchObject({
        hasActiveDevice: true,
        isPlaying: true,
        repeatMode: "context",
        track: {
          uri: "spotify:track:1234567890123456789012",
          title: "Mock Recovery Track",
          artist: "Mock Artist",
          durationMs: 180_000,
        },
      });
      expect(calls).toHaveLength(3);
      expect(calls.every((url) => url.includes("spotify.com"))).toBe(true);

      globalThis.fetch = async () => new Response(null, { status: 204 });
      await expect(controlSpotifyPlayback("mock-access-token", "pause")).resolves.toBeUndefined();
      const playerCommands = [];
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url.endsWith("/me/player")) {
          return new Response(
            JSON.stringify({
              device: { id: "vehicle-device-id", is_active: true, name: "mock vehicle audio" },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        playerCommands.push({ url, init });
        return new Response(null, { status: 204 });
      };
      await expect(setSpotifyRepeatMode("mock-access-token", "track")).resolves.toBeUndefined();
      await expect(
        playSpotifyTrack("mock-access-token", "spotify:track:1234567890123456789012"),
      ).resolves.toBeUndefined();
      expect(playerCommands[0].url).toBe(
        "https://api.spotify.com/v1/me/player/repeat?state=track&device_id=vehicle-device-id",
      );
      expect(playerCommands[0].init.method).toBe("PUT");
      expect(playerCommands[1].url).toBe(
        "https://api.spotify.com/v1/me/player/play?device_id=vehicle-device-id",
      );
      expect(JSON.parse(playerCommands[1].init.body)).toEqual({
        uris: ["spotify:track:1234567890123456789012"],
      });

      globalThis.fetch = async (input) => {
        if (String(input).endsWith("/me/player")) return new Response(null, { status: 204 });
        return new Response(JSON.stringify({ devices: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      };
      await expect(
        playSpotifyTrack("mock-access-token", "spotify:track:1234567890123456789012"),
      ).rejects.toThrow("Spotify has no active device");

      const fallbackCalls = [];
      globalThis.fetch = async (input) => {
        const url = String(input);
        fallbackCalls.push(url);
        if (url.endsWith("/me/player")) return new Response(null, { status: 204 });
        if (url.endsWith("/me/player/devices")) {
          return new Response(
            JSON.stringify({ devices: [{ id: "active-car-id", is_active: true }] }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 204 });
      };
      await expect(
        playSpotifyTrack("mock-access-token", "spotify:track:1234567890123456789012"),
      ).resolves.toBeUndefined();
      expect(fallbackCalls).toEqual([
        "https://api.spotify.com/v1/me/player",
        "https://api.spotify.com/v1/me/player/devices",
        "https://api.spotify.com/v1/me/player/play?device_id=active-car-id",
      ]);

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      await expect(refreshSpotifyAccessToken(encryptedToken)).rejects.toThrow(
        "Spotify needs to be reconnected by the driver.",
      );
    } finally {
      globalThis.fetch = previousFetch;
      if (previousEnv.enabled === undefined)
        delete process.env.SPOTIFY_PERSONAL_INTEGRATION_ENABLED;
      else process.env.SPOTIFY_PERSONAL_INTEGRATION_ENABLED = previousEnv.enabled;
      if (previousEnv.clientId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
      else process.env.SPOTIFY_CLIENT_ID = previousEnv.clientId;
      if (previousEnv.clientSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
      else process.env.SPOTIFY_CLIENT_SECRET = previousEnv.clientSecret;
      if (previousEnv.key === undefined) delete process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
      else process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = previousEnv.key;
    }
  });

  test("enables track repeat only after the selected track is observed, then restores the prior mode", () => {
    const storage = new Map();
    const storageAdapter = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    };
    const session = createPassengerRepeatSession(
      "spotify:track:aaaaaaaaaaaaaaaaaaaaaa",
      "spotify:track:bbbbbbbbbbbbbbbbbbbbbb",
      "context",
      1_000,
    );

    writePassengerRepeatSession(storageAdapter, session);
    expect(readPassengerRepeatSession(storageAdapter)).toEqual(session);
    expect(decidePassengerRepeatAction(session, null, null)).toEqual({ type: "wait", session });
    expect(
      decidePassengerRepeatAction(session, "spotify:track:bbbbbbbbbbbbbbbbbbbbbb", "context"),
    ).toEqual({ type: "wait", session });

    const enable = decidePassengerRepeatAction(
      session,
      "spotify:track:aaaaaaaaaaaaaaaaaaaaaa",
      "context",
    );
    expect(enable).toEqual({
      type: "enable-track",
      session: { ...session, targetTrackConfirmed: true },
    });

    const repeatingSession = { ...enable.session, repeatApplied: true };
    expect(
      decidePassengerRepeatAction(
        repeatingSession,
        "spotify:track:aaaaaaaaaaaaaaaaaaaaaa",
        "track",
      ),
    ).toEqual({ type: "wait", session: repeatingSession });
    expect(
      decidePassengerRepeatAction(
        repeatingSession,
        "spotify:track:cccccccccccccccccccccc",
        "track",
      ),
    ).toEqual({ type: "restore", mode: "context" });
  });

  test("clears pending repeat without changing global mode if the driver changes tracks before passenger selection takes effect", () => {
    const session = createPassengerRepeatSession(
      "spotify:track:aaaaaaaaaaaaaaaaaaaaaa",
      "spotify:track:bbbbbbbbbbbbbbbbbbbbbb",
      "off",
    );
    expect(
      decidePassengerRepeatAction(session, "spotify:track:cccccccccccccccccccccc", "off"),
    ).toEqual({ type: "clear" });
  });

  test("waits briefly when the prior track is unknown, then clears an unconfirmed selection", () => {
    const session = createPassengerRepeatSession(
      "spotify:track:aaaaaaaaaaaaaaaaaaaaaa",
      null,
      "off",
      1_000,
    );
    expect(
      decidePassengerRepeatAction(session, "spotify:track:cccccccccccccccccccccc", "off", 10_000),
    ).toEqual({ type: "wait", session });
    expect(
      decidePassengerRepeatAction(session, "spotify:track:cccccccccccccccccccccc", "off", 20_000),
    ).toEqual({ type: "clear" });
  });

  test("scopes repeat retries to a specific track selection and ignores stale session completions", () => {
    const enableRetryGate = createPassengerRepeatRetryGate();
    const restoreRetryGate = createPassengerRepeatRetryGate();
    const first = createPassengerRepeatSession(
      "spotify:track:aaaaaaaaaaaaaaaaaaaaaa",
      null,
      "off",
      1_000,
    );
    const second = createPassengerRepeatSession(
      "spotify:track:bbbbbbbbbbbbbbbbbbbbbb",
      "spotify:track:aaaaaaaaaaaaaaaaaaaaaa",
      "off",
      2_000,
    );

    enableRetryGate.failed(first, 60_000);
    expect(enableRetryGate.shouldWait(first, 10_000)).toBe(true);
    expect(isSamePassengerRepeatSession(first, second)).toBe(false);
    expect(enableRetryGate.shouldWait(second, 10_000)).toBe(false);
    enableRetryGate.succeeded(first);
    expect(enableRetryGate.shouldWait(second, 10_000)).toBe(false);
    expect(restoreRetryGate.shouldWait(first, 10_000)).toBe(false);
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

  test("does not multiply intervals or listeners through 250 repeated screen transitions", () => {
    const host = createPollingHost();
    for (let transition = 0; transition < 250; transition += 1) {
      const cleanup = startSpotifyPolling({
        refresh: async () => {},
        intervalMs: transition % 2 === 0 ? 10_000 : 5_000,
        refreshOnlyWhenVisible: true,
        enabled: true,
        host,
      });
      expect(host.intervals.size).toBe(1);
      expect(host.listeners.size).toBe(1);
      cleanup();
      expect(host.intervals.size).toBe(0);
      expect(host.listeners.size).toBe(0);
    }
  });

  test("simulates ten hours of idle polling at the unchanged 10-second cadence", () => {
    const host = createPollingHost();
    let refreshCount = 0;
    const cleanup = startSpotifyPolling({
      refresh: async () => {
        refreshCount += 1;
      },
      intervalMs: 10_000,
      refreshOnlyWhenVisible: true,
      host,
    });
    const timer = host.intervals.values().next().value;
    for (let tick = 0; tick < 3_600; tick += 1) timer.callback();
    expect(refreshCount).toBe(3_601);
    expect(host.intervals.size).toBe(1);
    expect(host.listeners.size).toBe(1);
    cleanup();
    expect(host.intervals.size).toBe(0);
    expect(host.listeners.size).toBe(0);
  });

  test("global fetch is fail-closed during local validation and no request escaped", async () => {
    expect(globalThis.__phaseBBlockedNetworkRequests).toEqual([]);
    await expect(fetch("https://production.example.invalid/should-be-blocked")).rejects.toThrow(
      "Network is disabled in local Phase B validation",
    );
    expect(globalThis.__phaseBBlockedNetworkRequests).toEqual([
      "https://production.example.invalid/should-be-blocked",
    ]);
    globalThis.__phaseBBlockedNetworkRequests.length = 0;
  });
});
