export const MIDNIGHT_HUNT_DURATION_MS = 60_000;
export const MIDNIGHT_HUNT_SPIRITS = 5;

const hidingPlaces = [
  [15, 39],
  [34, 48],
  [52, 34],
  [84, 43],
  [22, 72],
  [44, 76],
  [65, 65],
  [85, 77],
] as const;

export type HuntSpirit = { id: number; x: number; y: number };
export type HuntState = {
  phase: "intro" | "playing" | "paused" | "finished";
  remainingMs: number;
  anchor: number;
  spirits: HuntSpirit[];
  found: number[];
  round: number;
};
export type HuntAction =
  | { type: "start"; now: number; spirits: HuntSpirit[] }
  | { type: "tick" | "pause" | "resume"; now: number }
  | { type: "collect"; id: number; now: number };

export function createHuntState(): HuntState {
  return {
    phase: "intro",
    remainingMs: MIDNIGHT_HUNT_DURATION_MS,
    anchor: 0,
    spirits: [],
    found: [],
    round: 0,
  };
}

/** A bounded shuffle keeps targets separated, inside the scene and away from the HUD. */
export function createHuntSpirits(random = Math.random, previous: HuntSpirit[] = []): HuntSpirit[] {
  const places = [...hidingPlaces];
  for (let i = places.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [places[i], places[j]] = [places[j], places[i]];
  }
  const same =
    previous.length === MIDNIGHT_HUNT_SPIRITS &&
    places
      .slice(0, MIDNIGHT_HUNT_SPIRITS)
      .every(([x, y]) => previous.some((p) => p.x === x && p.y === y));
  if (same) [places[0], places[MIDNIGHT_HUNT_SPIRITS]] = [places[MIDNIGHT_HUNT_SPIRITS], places[0]];
  return places.slice(0, MIDNIGHT_HUNT_SPIRITS).map(([x, y], id) => ({ id, x, y }));
}

export function huntRemaining(state: HuntState, now: number): number {
  return state.phase === "playing"
    ? Math.max(0, state.remainingMs - Math.max(0, now - state.anchor))
    : state.remainingMs;
}

export function huntReducer(state: HuntState, action: HuntAction): HuntState {
  if (action.type === "start") {
    return {
      ...createHuntState(),
      phase: "playing",
      anchor: action.now,
      spirits: action.spirits,
      round: state.round + 1,
    };
  }
  if (action.type === "resume") {
    return state.phase === "paused" ? { ...state, phase: "playing", anchor: action.now } : state;
  }
  if (state.phase !== "playing") return state;
  const remainingMs = huntRemaining(state, action.now);
  if (remainingMs === 0) return { ...state, phase: "finished", remainingMs: 0, anchor: action.now };
  if (action.type === "collect") {
    if (state.found.includes(action.id) || !state.spirits.some(({ id }) => id === action.id))
      return state;
    const found = [...state.found, action.id];
    return {
      ...state,
      found,
      remainingMs,
      anchor: action.now,
      phase: found.length === MIDNIGHT_HUNT_SPIRITS ? "finished" : "playing",
    };
  }
  return {
    ...state,
    remainingMs,
    anchor: action.now,
    phase: action.type === "pause" ? "paused" : "playing",
  };
}
