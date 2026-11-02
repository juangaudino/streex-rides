export type GamePhase = "intro" | "playing" | "paused" | "finished";
export const FOOTBALL_ROUND_MS = 60_000;
export const PASS_COOLDOWN_MS = 900;
export type RoundClock = { phase: GamePhase; remainingMs: number; anchor: number };
export function remaining(clock: RoundClock, now: number) {
  return clock.phase === "playing"
    ? Math.max(0, clock.remainingMs - Math.max(0, now - clock.anchor))
    : clock.remainingMs;
}
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export type DriveState = RoundClock & {
  seed: number;
  touchdowns: number;
  completions: number;
  misses: number;
  yards: number;
  down: number;
  nextPassAt: number;
  lastLane: number | null;
  lastPlay: "complete" | "miss" | "touchdown" | "turnover" | null;
};
export function createDrive(): DriveState {
  return {
    phase: "intro",
    remainingMs: FOOTBALL_ROUND_MS,
    anchor: 0,
    seed: 0,
    touchdowns: 0,
    completions: 0,
    misses: 0,
    yards: 20,
    down: 1,
    nextPassAt: 0,
    lastLane: null,
    lastPlay: null,
  };
}
export function openReceiver(state: DriveState, now: number): number {
  const elapsed = FOOTBALL_ROUND_MS - remaining(state, now);
  // One readable window is always available. It narrows as the player scores.
  const windowMs = Math.max(900, 1800 - state.touchdowns * 120);
  return (Math.floor((elapsed + (state.seed % windowMs)) / windowMs) + (state.seed % 3)) % 3;
}
export type DriveAction =
  | { type: "start"; now: number; seed: number }
  | { type: "tick" | "pause" | "resume"; now: number }
  | { type: "pass"; now: number; lane: number };
export function driveReducer(state: DriveState, action: DriveAction): DriveState {
  if (action.type === "start")
    return { ...createDrive(), phase: "playing", anchor: action.now, seed: action.seed };
  if (action.type === "resume")
    return state.phase === "paused" ? { ...state, phase: "playing", anchor: action.now } : state;
  if (state.phase !== "playing") return state;
  const remainingMs = remaining(state, action.now);
  const next = { ...state, remainingMs, anchor: action.now };
  if (!remainingMs) return { ...next, phase: "finished" };
  if (action.type === "pause") return { ...next, phase: "paused" };
  if (action.type !== "pass") return next;
  const elapsed = FOOTBALL_ROUND_MS - remainingMs;
  if (
    !Number.isInteger(action.lane) ||
    action.lane < 0 ||
    action.lane > 2 ||
    elapsed < state.nextPassAt
  )
    return next;
  // Allow one render interval at a window boundary so a visibly OPEN tap stays fair.
  const success =
    action.lane === openReceiver(state, action.now) ||
    action.lane === openReceiver(state, action.now - 120);
  const touchdown = success && state.yards + 20 >= 100;
  const turnover = !success && state.down === 4;
  return {
    ...next,
    lastLane: action.lane,
    lastPlay: touchdown ? "touchdown" : turnover ? "turnover" : success ? "complete" : "miss",
    touchdowns: state.touchdowns + Number(touchdown),
    completions: state.completions + Number(success),
    misses: state.misses + Number(!success),
    yards: touchdown || turnover ? 20 : success ? state.yards + 20 : state.yards,
    down: success || turnover ? 1 : state.down + 1,
    nextPassAt: elapsed + (touchdown ? 1400 : PASS_COOLDOWN_MS),
  };
}

export type TriviaCard = { id: string; correct: number };
export type TriviaState = RoundClock & {
  deck: TriviaCard[];
  index: number;
  selected: number | null;
  correct: number;
};
export function createTrivia(): TriviaState {
  return {
    phase: "intro",
    remainingMs: FOOTBALL_ROUND_MS,
    anchor: 0,
    deck: [],
    index: 0,
    selected: null,
    correct: 0,
  };
}
export type TriviaAction =
  | { type: "start"; now: number; deck: TriviaCard[] }
  | { type: "tick" | "pause" | "resume" | "next"; now: number }
  | { type: "answer"; now: number; option: number };
export function triviaReducer(state: TriviaState, action: TriviaAction): TriviaState {
  if (action.type === "start")
    return action.deck.length
      ? { ...createTrivia(), phase: "playing", anchor: action.now, deck: action.deck }
      : state;
  if (action.type === "resume")
    return state.phase === "paused" ? { ...state, phase: "playing", anchor: action.now } : state;
  if (state.phase !== "playing") return state;
  const remainingMs = remaining(state, action.now),
    next = { ...state, remainingMs, anchor: action.now };
  if (!remainingMs) return { ...next, phase: "finished" };
  if (action.type === "pause") return { ...next, phase: "paused" };
  if (
    action.type === "answer" &&
    state.selected === null &&
    Number.isInteger(action.option) &&
    action.option >= 0 &&
    action.option < 4
  ) {
    const correct = state.correct + Number(action.option === state.deck[state.index].correct);
    return {
      ...next,
      selected: action.option,
      correct,
      phase: state.index === state.deck.length - 1 ? "finished" : "playing",
    };
  }
  if (action.type === "next" && state.selected !== null)
    return { ...next, index: state.index + 1, selected: null };
  return next;
}
