export type SpotifyRepeatMode = "off" | "context" | "track";

export type PassengerRepeatSession = {
  expectedTrackUri: string;
  previousTrackUri: string | null;
  originalRepeatMode: SpotifyRepeatMode;
  selectedAtMs: number;
  targetTrackConfirmed: boolean;
  repeatApplied: boolean;
};

export type PassengerRepeatAction =
  | { type: "none" }
  | { type: "wait"; session: PassengerRepeatSession }
  | { type: "clear" }
  | { type: "enable-track"; session: PassengerRepeatSession }
  | { type: "restore"; mode: SpotifyRepeatMode };

const PASSENGER_REPEAT_SESSION_KEY = "streex-passenger-spotify-repeat-v1";
let memoryPassengerRepeatSession: PassengerRepeatSession | null = null;

export function isSamePassengerRepeatSession(
  current: PassengerRepeatSession | null,
  candidate: PassengerRepeatSession,
) {
  return (
    current?.expectedTrackUri === candidate.expectedTrackUri &&
    current.selectedAtMs === candidate.selectedAtMs
  );
}

export function createPassengerRepeatRetryGate() {
  let retrySession: PassengerRepeatSession | null = null;
  let retryAfterMs = 0;

  return {
    shouldWait(session: PassengerRepeatSession, nowMs: number) {
      if (!isSamePassengerRepeatSession(retrySession, session)) {
        retrySession = null;
        retryAfterMs = 0;
      }
      return nowMs < retryAfterMs;
    },
    failed(session: PassengerRepeatSession, nextAttemptAtMs: number) {
      retrySession = session;
      retryAfterMs = nextAttemptAtMs;
    },
    succeeded(session: PassengerRepeatSession) {
      if (isSamePassengerRepeatSession(retrySession, session)) {
        retrySession = null;
        retryAfterMs = 0;
      }
    },
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readPassengerRepeatSession(storage: StorageLike): PassengerRepeatSession | null {
  try {
    const value = storage.getItem(PASSENGER_REPEAT_SESSION_KEY);
    if (!value) return memoryPassengerRepeatSession;
    const parsed = JSON.parse(value) as Partial<PassengerRepeatSession>;
    if (
      typeof parsed.expectedTrackUri !== "string" ||
      !(parsed.previousTrackUri === null || typeof parsed.previousTrackUri === "string") ||
      !isSpotifyRepeatMode(parsed.originalRepeatMode) ||
      typeof parsed.selectedAtMs !== "number" ||
      typeof parsed.targetTrackConfirmed !== "boolean" ||
      typeof parsed.repeatApplied !== "boolean"
    ) {
      storage.removeItem(PASSENGER_REPEAT_SESSION_KEY);
      memoryPassengerRepeatSession = null;
      return null;
    }
    memoryPassengerRepeatSession = parsed as PassengerRepeatSession;
    return memoryPassengerRepeatSession;
  } catch {
    return memoryPassengerRepeatSession;
  }
}

export function writePassengerRepeatSession(
  storage: StorageLike,
  session: PassengerRepeatSession | null,
) {
  memoryPassengerRepeatSession = session;
  try {
    if (session) storage.setItem(PASSENGER_REPEAT_SESSION_KEY, JSON.stringify(session));
    else storage.removeItem(PASSENGER_REPEAT_SESSION_KEY);
  } catch {
    // Keep the marker in memory when kiosk/private mode disables browser storage.
  }
}

export function createPassengerRepeatSession(
  expectedTrackUri: string,
  previousTrackUri: string | null,
  originalRepeatMode: SpotifyRepeatMode,
  selectedAtMs = Date.now(),
): PassengerRepeatSession {
  return {
    expectedTrackUri,
    previousTrackUri,
    originalRepeatMode,
    selectedAtMs,
    targetTrackConfirmed: false,
    repeatApplied: false,
  };
}

export function decidePassengerRepeatAction(
  session: PassengerRepeatSession | null,
  currentTrackUri: string | null,
  repeatMode: SpotifyRepeatMode | null,
  nowMs = Date.now(),
): PassengerRepeatAction {
  if (!session) return { type: "none" };
  if (!currentTrackUri) return { type: "wait", session };

  if (currentTrackUri === session.expectedTrackUri) {
    const confirmed = { ...session, targetTrackConfirmed: true };
    if (confirmed.repeatApplied || repeatMode === "track") {
      return { type: "wait", session: { ...confirmed, repeatApplied: true } };
    }
    return { type: "enable-track", session: confirmed };
  }

  if (!session.targetTrackConfirmed) {
    if (currentTrackUri === session.previousTrackUri) return { type: "wait", session };
    if (session.previousTrackUri === null && nowMs - session.selectedAtMs < 15_000) {
      return { type: "wait", session };
    }
    return { type: "clear" };
  }

  return { type: "restore", mode: session.originalRepeatMode };
}

function isSpotifyRepeatMode(value: unknown): value is SpotifyRepeatMode {
  return value === "off" || value === "context" || value === "track";
}
