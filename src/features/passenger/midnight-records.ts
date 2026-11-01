/** Device-only leaderboard: never sent to analytics or a server. */
export const HUNT_RECORDS_KEY = "streex.midnight-hunt.records.v1";
export type HuntRecord = { name: string; elapsedMs: number };
type RecordStorage = Pick<Storage, "getItem" | "setItem">;
export function cleanHuntName(value: string): string {
  return value
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (
        code >= 32 &&
        !(code >= 127 && code <= 159) &&
        !(code >= 0x202a && code <= 0x202e) &&
        !(code >= 0x2066 && code <= 0x2069)
      );
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}
export function parseHuntRecords(raw: string | null): HuntRecord[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (r): r is HuntRecord =>
          !!r &&
          typeof r.name === "string" &&
          Number.isInteger(r.elapsedMs) &&
          r.elapsedMs > 0 &&
          r.elapsedMs < 60000,
      )
      .map((r) => ({ name: cleanHuntName(r.name) || "Guest", elapsedMs: r.elapsedMs }))
      .sort((a, b) => a.elapsedMs - b.elapsedMs)
      .slice(0, 10);
  } catch {
    return [];
  }
}
export function readHuntRecords(storage: RecordStorage): HuntRecord[] {
  try {
    return parseHuntRecords(storage.getItem(HUNT_RECORDS_KEY));
  } catch {
    return [];
  }
}
export function saveHuntRecord(storage: RecordStorage, record: HuntRecord): HuntRecord[] | null {
  try {
    const records = parseHuntRecords(JSON.stringify([...readHuntRecords(storage), record]));
    storage.setItem(HUNT_RECORDS_KEY, JSON.stringify(records));
    return records;
  } catch {
    return null;
  }
}
export function formatHuntTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}
