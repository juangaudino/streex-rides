import { test, expect } from "bun:test";
import {
  createDrive,
  driveReducer,
  openReceiver,
  createTrivia,
  triviaReducer,
  remaining,
  FOOTBALL_ROUND_MS,
} from "../src/features/passenger/game-weekend/football-engine.ts";
import {
  RIVALRY_QUESTIONS,
  createRivalryDeck,
} from "../src/features/passenger/game-weekend/rivalry-questions.ts";
import {
  rankFootballRecords,
  saveFootballRecord,
  readFootballRecords,
  footballRecordKey,
} from "../src/features/passenger/game-weekend/football-records.ts";
import {
  getPassengerThemePresentation,
  getPassengerSeasonalGame,
  getPassengerVisualTheme,
} from "../src/lib/passenger-visual-theme.ts";
import { CONFIG } from "../src/config.ts";
import {
  mergeSiteConfig,
  parseSiteConfigOverride,
  SiteConfigOverrideSchema,
} from "../src/lib/site-config.ts";
import { PASSENGER_GAME_IDS } from "../src/lib/passenger-analytics.ts";

test("Utes edition persists independently of mode and restores every older theme", () => {
  for (const experienceMode of ["lite", "complete"]) {
    const previous = { ...CONFIG.passengerConsole, experienceMode };
    const saved = SiteConfigOverrideSchema.parse({
      passengerConsole: { experienceMode, visualTheme: "utes-weekend" },
    });
    const config = mergeSiteConfig(
      CONFIG,
      parseSiteConfigOverride(JSON.stringify(saved)),
    ).passengerConsole;
    expect(getPassengerVisualTheme(config)).toBe("utes-weekend");
    expect(getPassengerSeasonalGame(config)).toBe("game-weekend");
    expect(config.music).toEqual(previous.music);
    expect(config.idleReset).toEqual(previous.idleReset);
    for (const view of ["home", "music"]) {
      const p = getPassengerThemePresentation(config, view, false);
      expect(p.hauntedSurface).toBeNull();
      expect(p.gameWeekendSurface).toBe(view);
    }
    expect(getPassengerThemePresentation(config, "home", true).gameWeekendSurface).toBe("idle");
    for (const view of ["games", "streex", "services", "around-you", "tip"])
      expect(getPassengerThemePresentation(config, view, false).gameWeekendSurface).toBeNull();
    for (const visualTheme of ["accent", "original", "halloween", undefined, "garbage"]) {
      const restored = { ...config, visualTheme };
      expect(
        getPassengerThemePresentation(restored, "home", false).gameWeekendSurface,
      ).toBeUndefined();
      expect(getPassengerSeasonalGame(restored)).toBe(
        visualTheme === "halloween" ? "midnight-hunt" : null,
      );
    }
  }
  expect(PASSENGER_GAME_IDS).toContain("touchdown-drive");
  expect(PASSENGER_GAME_IDS).toContain("rivalry-trivia");
});
test("four completions make a touchdown; rapid double passes cannot farm score", () => {
  let state = driveReducer(createDrive(), { type: "start", now: 0, seed: 7 });
  for (let i = 0; i < 4; i++) {
    let time = i * 2000;
    state = driveReducer(state, { type: "pass", now: time, lane: openReceiver(state, time) });
    const duplicate = driveReducer(state, {
      type: "pass",
      now: time + 10,
      lane: openReceiver(state, time + 10),
    });
    expect(duplicate.completions).toBe(state.completions);
  }
  expect(state.touchdowns).toBe(1);
  expect(state.completions).toBe(4);
  expect(state.yards).toBe(20);
  expect(state.down).toBe(1);
});
test("four misses reset the drive and expired input cannot score", () => {
  let s = driveReducer(createDrive(), { type: "start", now: 0, seed: 9 });
  for (let i = 0; i < 4; i++) {
    let now = i * 2000;
    s = driveReducer(s, { type: "pass", now, lane: (openReceiver(s, now) + 1) % 3 });
  }
  expect(s.lastPlay).toBe("turnover");
  expect(s.misses).toBe(4);
  expect(s.down).toBe(1);
  s = driveReducer(s, { type: "pass", now: 60000, lane: openReceiver(s, 60000) });
  expect(s.phase).toBe("finished");
  expect(s.completions).toBe(0);
  expect(driveReducer(s, { type: "tick", now: 70000 })).toBe(s);
});
test("pause freezes game time, eligibility and throw cooldown; replay resets all stats", () => {
  let s = driveReducer(createDrive(), { type: "start", now: 0, seed: 1 });
  s = driveReducer(s, { type: "pass", now: 100, lane: openReceiver(s, 100) });
  s = driveReducer(s, { type: "pause", now: 200 });
  const lane = openReceiver(s, 200);
  expect(remaining(s, 99999)).toBe(59800);
  expect(openReceiver(s, 99999)).toBe(lane);
  expect(driveReducer(s, { type: "pass", now: 99999, lane })).toBe(s);
  s = driveReducer(s, { type: "resume", now: 100000 });
  s = driveReducer(s, { type: "pass", now: 100010, lane: openReceiver(s, 100010) });
  expect(s.completions).toBe(1);
  s = driveReducer(s, { type: "start", now: 200000, seed: 42 });
  expect(s.completions).toBe(0);
  expect(s.remainingMs).toBe(60000);
  expect(s.lastPlay).toBeNull();
});
test("extended drive runs remain bounded across different seeds, invalid inputs and transitions", () => {
  for (let seed = 0; seed < 50; seed++) {
    let s = driveReducer(createDrive(), { type: "start", now: 0, seed });
    for (let time = 0; time <= 61000; time += 100) {
      const lane = openReceiver(s, time);
      expect(lane >= 0 && lane < 3).toBe(true);
      s = driveReducer(s, { type: time % 200 === 0 ? "pass" : "tick", now: time, lane });
      expect(s.yards >= 20 && s.yards < 100).toBe(true);
      expect(s.down >= 1 && s.down <= 4).toBe(true);
      expect(s.remainingMs >= 0).toBe(true);
    }
    expect(s.phase).toBe("finished");
    expect(s.completions).toBeLessThanOrEqual(67);
  }
  let s = driveReducer(createDrive(), { type: "start", now: 0, seed: 0 });
  for (const lane of [-1, NaN, 3, 0.5]) {
    s = driveReducer(s, { type: "pass", now: 100, lane });
    expect(s.completions + s.misses).toBe(0);
  }
});
test("trivia decks have eight unique sourced bilingual questions and shuffled correct options", () => {
  expect(new Set(RIVALRY_QUESTIONS.map((q) => q.id)).size).toBe(RIVALRY_QUESTIONS.length);
  const signatures = new Set();
  for (let i = 0; i < 40; i++) {
    const deck = createRivalryDeck();
    signatures.add(deck.map((q) => q.id).join());
    expect(new Set(deck.map((q) => q.id)).size).toBe(8);
    for (const q of deck) {
      expect(q.optionsOrder).toHaveLength(4);
      expect(new Set(q.optionsOrder).size).toBe(4);
      const source = RIVALRY_QUESTIONS.find((x) => x.id === q.id);
      expect(q.optionsOrder[q.correct]).toBe(source.correct);
      expect(q.es.length > 0 && q.whyEs.length > 0).toBe(true);
      expect(q.url.startsWith("https://")).toBe(true);
    }
  }
  expect(signatures.size).toBeGreaterThan(1);
});
test("trivia locks each answer, refuses skip and invalid input, stops on eighth answer", () => {
  const deck = createRivalryDeck(() => 0.5);
  let s = triviaReducer(createTrivia(), { type: "start", now: 0, deck });
  s = triviaReducer(s, { type: "next", now: 1 });
  expect(s.index).toBe(0);
  for (let i = 0; i < 8; i++) {
    s = triviaReducer(s, { type: "answer", now: i * 1000 + 100, option: deck[i].correct });
    expect(s.correct).toBe(i + 1);
    const duplicate = triviaReducer(s, {
      type: "answer",
      now: i * 1000 + 200,
      option: deck[i].correct,
    });
    expect(duplicate.correct).toBe(i + 1);
    if (i < 7) s = triviaReducer(s, { type: "next", now: i * 1000 + 300 });
  }
  expect(s.phase).toBe("finished");
  expect(s.correct).toBe(8);
  expect(s.index).toBe(7);
  s = triviaReducer(s, { type: "start", now: 90000, deck });
  expect(s.correct).toBe(0);
  expect(s.selected).toBeNull();
  s = triviaReducer(s, { type: "pause", now: 91000 });
  expect(triviaReducer(s, { type: "answer", now: 95000, option: 0 })).toBe(s);
  s = triviaReducer(s, { type: "resume", now: 100000 });
  expect(remaining(s, 100000)).toBe(59000);
  s = triviaReducer(s, { type: "answer", now: 159001, option: 0 });
  expect(s.phase).toBe("finished");
  expect(s.correct).toBe(0);
});
test("separate local Top 10 tables use the right tie breakers and survive corruption/quota errors", () => {
  const data = new Map(),
    storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, v) => data.set(key, v) };
  for (let i = 0; i < 15; i++)
    saveFootballRecord(
      "touchdown-drive",
      { name: `Player ${i}`, score: i, secondary: i * 4, misses: 0 },
      storage,
    );
  expect(readFootballRecords("touchdown-drive", storage)).toHaveLength(10);
  expect(readFootballRecords("touchdown-drive", storage)[0].score).toBe(14);
  expect(readFootballRecords("rivalry-trivia", storage)).toEqual([]);
  saveFootballRecord(
    "rivalry-trivia",
    { name: "Fast", score: 8, secondary: 10000, misses: 0 },
    storage,
  );
  saveFootballRecord(
    "rivalry-trivia",
    { name: "Slow", score: 8, secondary: 20000, misses: 0 },
    storage,
  );
  expect(readFootballRecords("rivalry-trivia", storage)[0].name).toBe("Fast");
  const drive = rankFootballRecords("touchdown-drive", [
    { name: "A", score: 1, secondary: 5, misses: 1 },
    { name: "B", score: 1, secondary: 5, misses: 0 },
  ]);
  expect(drive[0].name).toBe("B");
  data.set(footballRecordKey("rivalry-trivia"), "broken");
  expect(readFootballRecords("rivalry-trivia", storage)).toEqual([]);
  expect(
    rankFootballRecords("rivalry-trivia", [
      null,
      {},
      { name: "bad", score: 9, secondary: 1, misses: 0 },
    ]),
  ).toEqual([]);
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("quota");
    },
  };
  expect(
    saveFootballRecord(
      "touchdown-drive",
      { name: "A", score: 1, secondary: 4, misses: 0 },
      blocked,
    ),
  ).toBeNull();
});

test("a visibly open receiver gets a bounded render-boundary grace, not a permanent free pass", () => {
  const state = driveReducer(createDrive(), { type: "start", now: 0, seed: 0 });
  expect(openReceiver(state, 1799)).toBe(0);
  expect(openReceiver(state, 1801)).toBe(1);
  expect(driveReducer(state, { type: "pass", now: 1850, lane: 0 }).completions).toBe(1);
  expect(driveReducer(state, { type: "pass", now: 1950, lane: 0 }).misses).toBe(1);
});
