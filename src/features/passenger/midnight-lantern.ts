import type { HuntSpirit } from "./midnight-hunt";

export const HUNT_LANTERN_RADIUS = 155;
export const HUNT_DISCOVERY_RADIUS = 110;
export const HUNT_DISCOVERY_MS = 200;

export type LanternPoint = { x: number; y: number };
export type LanternBoard = { width: number; height: number };

export function isSpiritIlluminated(
  spirit: HuntSpirit,
  point: LanternPoint | null,
  board: LanternBoard,
) {
  if (!point || board.width <= 0 || board.height <= 0) return false;
  return (
    Math.hypot(
      (spirit.x * board.width) / 100 - point.x,
      (spirit.y * board.height) / 100 - point.y,
    ) <= HUNT_DISCOVERY_RADIUS
  );
}

/** Discovery is continuous, not a permanent unlock. A press snapshots eligibility
 * before moving the beam, so a blind tap can reveal a spirit but cannot collect it. */
export function createHuntLanternTracker() {
  const illuminatedSince = new Map<number, number>();
  let press: { id: number | null; eligible: boolean; dragged: boolean } | null = null;
  const canCollect = (id: number, now: number) => {
    const since = illuminatedSince.get(id);
    return since !== undefined && now - since >= HUNT_DISCOVERY_MS;
  };
  return {
    update(point: LanternPoint | null, spirits: HuntSpirit[], board: LanternBoard, now: number) {
      const active = new Set<number>();
      for (const spirit of spirits) {
        if (!isSpiritIlluminated(spirit, point, board)) continue;
        active.add(spirit.id);
        if (!illuminatedSince.has(spirit.id)) illuminatedSince.set(spirit.id, now);
      }
      for (const id of illuminatedSince.keys()) if (!active.has(id)) illuminatedSince.delete(id);
    },
    isIlluminated: (id: number) => illuminatedSince.has(id),
    canCollect,
    beginPointer(id: number | null, now: number) {
      press = { id, eligible: id !== null && canCollect(id, now), dragged: false };
    },
    markDrag() {
      if (press) press.dragged = true;
    },
    canCollectPointer(id: number, now: number) {
      return !!press && press.id === id && press.eligible && !press.dragged && canCollect(id, now);
    },
    cancelPointer() {
      press = null;
    },
    reset() {
      press = null;
      illuminatedSince.clear();
    },
  };
}
