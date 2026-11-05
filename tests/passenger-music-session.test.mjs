import { describe, expect, test } from "bun:test";
import {
  createSpotifySession,
  createSpotifyRequestScope,
  isSpotifySnapshotUnconfirmed,
} from "../src/features/passenger/spotify-session.ts";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function timers() {
  let id = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout(callback, ms) {
      const key = ++id;
      pending.set(key, { callback, ms });
      return key;
    },
    clearTimeout(key) {
      pending.delete(key);
    },
    fire() {
      const [key, timer] = pending.entries().next().value;
      pending.delete(key);
      timer.callback();
    },
  };
}

describe("Passenger Music continuity", () => {
  test("old metadata is labelled unconfirmed without erasing the song or extending its age", async () => {
    let now = 1000;
    let fails = false;
    const session = createSpotifySession(
      async () => {
        if (fails) throw new Error("offline");
        return { state: "ready" };
      },
      () => now,
    );
    await session.refresh();
    expect(isSpotifySnapshotUnconfirmed(session.getSnapshot(), 31_000)).toBe(false);
    expect(isSpotifySnapshotUnconfirmed(session.getSnapshot(), 31_001)).toBe(true);
    now = 2000;
    fails = true;
    await expect(session.refresh()).rejects.toThrow("offline");
    expect(session.getSnapshot().receivedAt).toBe(1000);
    expect(isSpotifySnapshotUnconfirmed(session.getSnapshot(), 2000)).toBe(true);
    expect(session.getSnapshot().value.state).toBe("ready");
  });

  test("Home, Idle and Music subscribe to the same result with one simultaneous request", async () => {
    const response = deferred();
    let calls = 0;
    const session = createSpotifySession(
      () => {
        calls++;
        return response.promise;
      },
      () => 1200,
    );
    const seen = [[], [], []];
    const unsubscribe = seen.map((values) =>
      session.subscribe(() => values.push(session.getSnapshot())),
    );
    const home = session.refresh();
    const idle = session.refresh();
    const music = session.refresh();
    expect(home).toBe(idle);
    expect(home).toBe(music);
    expect(calls).toBe(1);
    response.resolve({ state: "ready", title: "Track A" });
    await home;
    expect(seen.every((values) => values.length === 1)).toBe(true);
    expect(seen[0][0]).toBe(seen[1][0]);
    expect(session.getSnapshot().receivedAt).toBe(1200);
    unsubscribe.forEach((stop) => stop());
    // Remounting reads the existing snapshot, without another network call.
    expect(session.getSnapshot().value.title).toBe("Track A");
    expect(calls).toBe(1);
  });

  test("failure marks retained metadata unconfirmed, releases single flight and reconnects", async () => {
    let fails = false;
    const session = createSpotifySession(async () => {
      if (fails) throw new Error("offline");
      return { state: "ready" };
    });
    await session.refresh();
    fails = true;
    await expect(session.refresh()).rejects.toThrow("offline");
    expect(session.getSnapshot().value.state).toBe("ready");
    expect(session.getSnapshot().refreshFailed).toBe(true);
    fails = false;
    await session.refresh();
    expect(session.getSnapshot().value.state).toBe("ready");
    expect(session.getSnapshot().refreshFailed).toBe(false);
  });

  test("expired pairing/no device replaces cached playback; consoles do not share identity", async () => {
    let value = { state: "ready", playback: { hasActiveDevice: true } };
    const session = createSpotifySession(async () => value);
    const other = createSpotifySession(async () => ({ state: "disabled" }));
    await session.refresh();
    value = { state: "not-connected" };
    await session.refresh();
    expect(session.getSnapshot().value.state).toBe("not-connected");
    expect(other.getSnapshot().value).toBeNull();
    value = { state: "ready", playback: { hasActiveDevice: false } };
    await session.refresh();
    expect(session.getSnapshot().value.playback.hasActiveDevice).toBe(false);
  });

  test("unsubscribe and repeated transitions do not leave listeners or create polling", async () => {
    let notified = 0;
    const session = createSpotifySession(async () => ({}));
    for (let i = 0; i < 200; i++) {
      const stop = session.subscribe(() => notified++);
      stop();
      await session.refresh();
    }
    expect(notified).toBe(0);
  });
});

describe("Music async lifecycle", () => {
  test("a later search or query edit invalidates earlier results and errors", () => {
    const scope = createSpotifyRequestScope(timers());
    const old = scope.latest();
    const current = scope.latest();
    expect(old()).toBe(false);
    expect(current()).toBe(true);
    scope.latest(); // query edit, no network request
    expect(current()).toBe(false);
    scope.dispose();
    expect(scope.latest()()).toBe(false);
  });

  test("rapid navigation after Play cancels 300ms wait and suppresses follow-up", async () => {
    const host = timers();
    const scope = createSpotifyRequestScope(host);
    let refreshes = 0;
    const followUp = (async () => {
      if (await scope.wait(300)) refreshes++;
    })();
    expect(host.pending.size).toBe(1);
    scope.dispose();
    await followUp;
    expect(host.pending.size).toBe(0);
    expect(refreshes).toBe(0);
    expect(await scope.wait(800)).toBe(false);
  });

  test("navigation during Next sequence or delayed command leaves no stale retries", async () => {
    const host = timers();
    const scope = createSpotifyRequestScope(host);
    const command = deferred();
    let refreshes = 0;
    const sequence = (async () => {
      for (const delay of [500, 800, 1200]) {
        if (!(await scope.wait(delay))) return;
        refreshes++;
        await command.promise;
        if (!scope.isActive()) return;
      }
    })();
    host.fire();
    await Promise.resolve();
    expect(refreshes).toBe(1);
    scope.dispose();
    command.resolve();
    await sequence;
    expect(host.pending.size).toBe(0);
    expect(refreshes).toBe(1);
  });

  test("normal control waits retain existing timing and StrictMode gets a fresh scope", async () => {
    const host = timers();
    const initial = createSpotifyRequestScope(host);
    initial.dispose();
    const scope = createSpotifyRequestScope(host);
    for (const delay of [300, 500, 800, 1200]) {
      const wait = scope.wait(delay);
      expect([...host.pending.values()][0].ms).toBe(delay);
      host.fire();
      expect(await wait).toBe(true);
    }
    scope.dispose();
    expect(host.pending.size).toBe(0);
  });
});
