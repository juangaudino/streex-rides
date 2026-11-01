import { describe, expect, test } from "bun:test";
import {
  createHuntSpirits,
  createHuntState,
  huntReducer,
  huntRemaining,
  MIDNIGHT_HUNT_DURATION_MS,
} from "../src/features/passenger/midnight-hunt.ts";
import { PASSENGER_GAME_IDS } from "../src/lib/passenger-analytics.ts";

const start = (now = 0) =>
  huntReducer(createHuntState(), { type: "start", now, spirits: createHuntSpirits(() => 0.5) });

describe("Midnight Hunt seasonal game", () => {
  test("places five distinct, separated targets clear of the HUD at every shuffle", () => {
    for (let sample = 0; sample < 100; sample++) {
      const spirits = createHuntSpirits();
      expect(spirits).toHaveLength(5);
      expect(new Set(spirits.map((s) => `${s.x},${s.y}`)).size).toBe(5);
      for (const a of spirits) {
        expect(a.x).toBeGreaterThanOrEqual(15);
        expect(a.x).toBeLessThanOrEqual(85);
        expect(a.y).toBeGreaterThanOrEqual(34);
        expect(a.y).toBeLessThanOrEqual(77);
      }
    }
  });
  test("starts a fresh one-minute round and ignores duplicate/unknown targets", () => {
    let state = start();
    expect(state.remainingMs).toBe(MIDNIGHT_HUNT_DURATION_MS);
    state = huntReducer(state, { type: "collect", id: 0, now: 1000 });
    expect(state.found).toEqual([0]);
    expect(huntReducer(state, { type: "collect", id: 0, now: 1200 })).toBe(state);
    expect(huntReducer(state, { type: "collect", id: 99, now: 1200 })).toBe(state);
  });
  test("pauses elapsed time on backgrounding and resumes without charging hidden time", () => {
    let state = huntReducer(start(1000), { type: "pause", now: 11_000 });
    expect(state.phase).toBe("paused");
    expect(huntRemaining(state, 999_000)).toBe(50_000);
    expect(huntReducer(state, { type: "collect", id: 0, now: 99_000 })).toBe(state);
    state = huntReducer(state, { type: "resume", now: 999_000 });
    expect(huntRemaining(state, 1_000_000)).toBe(49_000);
  });
  test("expires using elapsed monotonic time even if browser callbacks are delayed", () => {
    const state = huntReducer(start(), { type: "tick", now: 75_000 });
    expect(state.phase).toBe("finished");
    expect(state.remainingMs).toBe(0);
    expect(huntReducer(state, { type: "collect", id: 0, now: 76_000 })).toBe(state);
  });
  test("a tap at the deadline cannot win or add a late target", () => {
    const state = huntReducer(start(), { type: "collect", id: 0, now: 60_000 });
    expect(state.phase).toBe("finished");
    expect(state.found).toHaveLength(0);
  });
  test("finishes after five discoveries, ignores later actions and resets on replay", () => {
    let state = start();
    for (let id = 0; id < 5; id++)
      state = huntReducer(state, { type: "collect", id, now: (id + 1) * 1000 });
    expect(state.phase).toBe("finished");
    expect(state.found).toHaveLength(5);
    expect(state.remainingMs).toBe(55_000);
    expect(huntReducer(state, { type: "tick", now: 90_000 })).toBe(state);
    const replay = huntReducer(state, {
      type: "start",
      now: 100_000,
      spirits: createHuntSpirits(),
    });
    expect(replay.round).toBe(2);
    expect(replay.found).toEqual([]);
    expect(replay.remainingMs).toBe(60_000);
  });
  test("allows the seasonal identifier in the existing semantic analytics contract", () => {
    expect(PASSENGER_GAME_IDS).toContain("midnight-hunt");
    expect(PASSENGER_GAME_IDS).toContain("trivia");
    expect(PASSENGER_GAME_IDS).toContain("choice");
    expect(PASSENGER_GAME_IDS).toContain("higher-lower");
  });
});
