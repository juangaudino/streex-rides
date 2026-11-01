import { describe, expect, test } from "bun:test";
import {
  createHuntLanternTracker,
  isSpiritIlluminated,
  HUNT_DISCOVERY_MS,
  HUNT_LANTERN_RADIUS,
} from "../src/features/passenger/midnight-lantern.ts";

const board = { width: 1000, height: 600 };
const spirits = [
  { id: 0, x: 20, y: 50 },
  { id: 1, x: 80, y: 50 },
];
const left = { x: 200, y: 300 };
const right = { x: 800, y: 300 };

describe("Midnight Hunt lantern discovery", () => {
  test("requires a beam in the playable area and keeps discovery inside its bright core", () => {
    expect(isSpiritIlluminated(spirits[0], null, board)).toBe(false);
    expect(isSpiritIlluminated(spirits[0], left, { width: 0, height: 600 })).toBe(false);
    expect(isSpiritIlluminated(spirits[0], left, board)).toBe(true);
    expect(
      isSpiritIlluminated(spirits[0], { x: left.x + HUNT_LANTERN_RADIUS, y: left.y }, board),
    ).toBe(false);
  });
  test("a blind first tap can reveal but cannot collect, even if release is delayed", () => {
    const tracker = createHuntLanternTracker();
    tracker.beginPointer(0, 0);
    tracker.update(left, spirits, board, 0);
    expect(tracker.isIlluminated(0)).toBe(true);
    expect(tracker.canCollectPointer(0, HUNT_DISCOVERY_MS + 1000)).toBe(false);
    tracker.beginPointer(0, HUNT_DISCOVERY_MS);
    expect(tracker.canCollectPointer(0, HUNT_DISCOVERY_MS)).toBe(true);
  });
  test("requires a short deliberate discovery rather than an instantaneous hover/click", () => {
    const tracker = createHuntLanternTracker();
    tracker.update(left, spirits, board, 100);
    expect(tracker.canCollect(0, 100 + HUNT_DISCOVERY_MS - 1)).toBe(false);
    tracker.beginPointer(0, 100 + HUNT_DISCOVERY_MS - 1);
    expect(tracker.canCollectPointer(0, 1000)).toBe(false);
    tracker.beginPointer(0, 100 + HUNT_DISCOVERY_MS);
    expect(tracker.canCollectPointer(0, 100 + HUNT_DISCOVERY_MS)).toBe(true);
  });
  test("moving away removes discovery and blocks stale presses", () => {
    const tracker = createHuntLanternTracker();
    tracker.update(left, spirits, board, 0);
    tracker.beginPointer(0, 300);
    tracker.update(right, spirits, board, 310);
    expect(tracker.isIlluminated(0)).toBe(false);
    expect(tracker.canCollectPointer(0, 500)).toBe(false);
    expect(tracker.isIlluminated(1)).toBe(true);
    tracker.update(left, spirits, board, 600);
    expect(tracker.canCollect(0, 601)).toBe(false);
  });
  test("dragging across a discovered spirit never collects on release", () => {
    const tracker = createHuntLanternTracker();
    tracker.update(left, spirits, board, 0);
    tracker.beginPointer(0, 300);
    tracker.markDrag();
    expect(tracker.canCollectPointer(0, 500)).toBe(false);
    tracker.beginPointer(0, 600);
    expect(tracker.canCollectPointer(0, 600)).toBe(true);
  });
  test("the beam can stay after lifting, while cancellation blocks a stale click", () => {
    const tracker = createHuntLanternTracker();
    tracker.update(left, spirits, board, 0);
    tracker.beginPointer(0, 300);
    tracker.cancelPointer();
    expect(tracker.canCollectPointer(0, 400)).toBe(false);
    expect(tracker.canCollect(0, 400)).toBe(true);
  });
  test("replay and removal clear all discovery and press eligibility", () => {
    const tracker = createHuntLanternTracker();
    tracker.update(left, spirits, board, 0);
    tracker.beginPointer(0, 300);
    tracker.reset();
    expect(tracker.isIlluminated(0)).toBe(false);
    expect(tracker.canCollectPointer(0, 400)).toBe(false);
    tracker.update(left, spirits, board, 500);
    tracker.update(left, [], board, 600);
    expect(tracker.isIlluminated(0)).toBe(false);
  });
  test("re-evaluates targets after a board resize", () => {
    const tracker = createHuntLanternTracker();
    tracker.update(left, spirits, board, 0);
    tracker.beginPointer(0, 300);
    tracker.update(left, spirits, { width: 2000, height: 1200 }, 310);
    expect(tracker.canCollectPointer(0, 500)).toBe(false);
  });
});
