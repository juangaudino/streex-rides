import { test, expect } from "bun:test";
import {
  createHuntSpirits,
  createHuntState,
  huntReducer,
} from "../src/features/passenger/midnight-hunt.ts";
import {
  parseHuntRecords,
  saveHuntRecord,
  readHuntRecords,
  cleanHuntName,
  formatHuntTime,
} from "../src/features/passenger/midnight-records.ts";
test("identical random input cannot repeat the previous set of hiding places", () => {
  const first = createHuntSpirits(() => 0.5);
  const second = createHuntSpirits(() => 0.5, first);
  expect(second).toHaveLength(5);
  expect(new Set(second.map((p) => `${p.x},${p.y}`)).size).toBe(5);
  expect(second.some((p) => !first.some((q) => q.x === p.x && q.y === p.y))).toBe(true);
});
test("local records survive reload, rank by actual milliseconds and keep only ten", () => {
  let raw = null;
  const storage = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  for (let i = 15; i > 0; i--) saveHuntRecord(storage, { name: `Guest ${i}`, elapsedMs: i * 1000 });
  expect(readHuntRecords(storage)).toHaveLength(10);
  expect(readHuntRecords(storage)[0].elapsedMs).toBe(1000);
  expect(readHuntRecords(storage)[9].elapsedMs).toBe(10000);
  expect(formatHuntTime(12345)).toBe("12.35 s");
});
test("corrupt and unavailable storage do not break gameplay", () => {
  expect(parseHuntRecords("{")).toEqual([]);
  expect(parseHuntRecords("{}")).toEqual([]);
  expect(
    parseHuntRecords('[null,{}, {"name":"bad","elapsedMs":-1},{"name":"bad","elapsedMs":60000}]'),
  ).toEqual([]);
  const storage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("quota");
    },
  };
  expect(readHuntRecords(storage)).toEqual([]);
  expect(saveHuntRecord(storage, { name: "a", elapsedMs: 1000 })).toBe(null);
  expect(cleanHuntName("  A\u202e B\n ")).toBe("A B");
  expect(cleanHuntName("x".repeat(100))).toHaveLength(20);
});
test("winning time excludes paused duration and stops at final collection", () => {
  let state = huntReducer(createHuntState(), {
    type: "start",
    now: 0,
    spirits: createHuntSpirits(),
  });
  state = huntReducer(state, { type: "pause", now: 1000 });
  state = huntReducer(state, { type: "resume", now: 100000 });
  for (let id = 0; id < 5; id++) state = huntReducer(state, { type: "collect", id, now: 101000 });
  expect(state.phase).toBe("finished");
  expect(60000 - state.remainingMs).toBe(2000);
  expect(huntReducer(state, { type: "tick", now: 200000 }).remainingMs).toBe(state.remainingMs);
});
