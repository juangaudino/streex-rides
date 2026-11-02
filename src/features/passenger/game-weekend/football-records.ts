import { cleanHuntName } from "../midnight-records";
export type FootballGame = "touchdown-drive" | "rivalry-trivia";
export type FootballRecord = { name: string; score: number; secondary: number; misses: number };
type Store = Pick<Storage, "getItem" | "setItem">;
export function footballRecordKey(game: FootballGame) {
  return `streex.game-weekend.${game}.v1`;
}
export function rankFootballRecords(game: FootballGame, data: unknown): FootballRecord[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (r): r is FootballRecord =>
        !!r &&
        typeof r.name === "string" &&
        [r.score, r.secondary, r.misses].every((n) => Number.isInteger(n) && n >= 0) &&
        r.score <= (game === "rivalry-trivia" ? 8 : 100) &&
        r.secondary <= (game === "rivalry-trivia" ? 60000 : 1000) &&
        r.misses <= 1000,
    )
    .map((r) => ({ ...r, name: cleanHuntName(r.name) || "Guest" }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (game === "rivalry-trivia" ? a.secondary - b.secondary : b.secondary - a.secondary) ||
        a.misses - b.misses,
    )
    .slice(0, 10);
}
export function readFootballRecords(game: FootballGame, storage: Store): FootballRecord[] {
  try {
    return rankFootballRecords(game, JSON.parse(storage.getItem(footballRecordKey(game)) || "[]"));
  } catch {
    return [];
  }
}
export function saveFootballRecord(
  game: FootballGame,
  record: FootballRecord,
  storage: Store,
): FootballRecord[] | null {
  try {
    const next = rankFootballRecords(game, [...readFootballRecords(game, storage), record]);
    storage.setItem(footballRecordKey(game), JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}
