import { useCallback, useEffect, useRef } from "react";
import { ingestPassengerAnalytics } from "@/lib/passenger-analytics.functions";
import {
  createPassengerAnalyticsRetryController,
  type PassengerAnalyticsFlushTrigger,
} from "./analytics-retry";
import {
  PASSENGER_ANALYTICS_ENGAGEMENT_QUEUE_LIMIT,
  PASSENGER_ANALYTICS_QUEUE_LIMIT,
  PASSENGER_ANALYTICS_QUEUE_MAX_AGE_MS,
  type PassengerAnalyticsElement,
  type PassengerAnalyticsEngagement,
  type PassengerAnalyticsEngagementEndReason,
  type PassengerAnalyticsEngagementSource,
  type PassengerAnalyticsEvent,
  type PassengerAnalyticsEventName,
  type PassengerAnalyticsMetadata,
  type PassengerAnalyticsScreen,
  type PassengerAnalyticsSession,
} from "@/lib/passenger-analytics";

const DEVICE_KEY = "streex-passenger-analytics-device-v1";
const QUEUE_KEY = "streex-passenger-analytics-queue-v1";
const ENGAGEMENT_QUEUE_KEY = "streex-passenger-analytics-engagement-queue-v1";
const SESSION_SYNC_MS = 30_000;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function readQueue() {
  try {
    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as PassengerAnalyticsEvent[];
    const cutoff = Date.now() - PASSENGER_ANALYTICS_QUEUE_MAX_AGE_MS;
    return Array.isArray(stored)
      ? stored
          .filter((event) => Date.parse(event.occurredAt) >= cutoff)
          .slice(-PASSENGER_ANALYTICS_QUEUE_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function persistQueue(queue: PassengerAnalyticsEvent[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-PASSENGER_ANALYTICS_QUEUE_LIMIT)));
  } catch {
    // Analytics are optional and must not break the in-vehicle console.
  }
}

function readEngagementQueue() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(ENGAGEMENT_QUEUE_KEY) || "[]",
    ) as PassengerAnalyticsEngagement[];
    const cutoff = Date.now() - PASSENGER_ANALYTICS_QUEUE_MAX_AGE_MS;
    return Array.isArray(stored)
      ? stored
          .filter((engagement) => Date.parse(engagement.startedAt) >= cutoff)
          .slice(-PASSENGER_ANALYTICS_ENGAGEMENT_QUEUE_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function persistEngagementQueue(queue: PassengerAnalyticsEngagement[]) {
  try {
    localStorage.setItem(
      ENGAGEMENT_QUEUE_KEY,
      JSON.stringify(queue.slice(-PASSENGER_ANALYTICS_ENGAGEMENT_QUEUE_LIMIT)),
    );
  } catch {
    // The console must remain usable when browser storage is restricted.
  }
}

function getDeviceInstallationId() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(existing))
      return existing;
    const created = createId();
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return createId();
  }
}

function uniqueEngagements(engagements: PassengerAnalyticsEngagement[]) {
  return Array.from(new Map(engagements.map((engagement) => [engagement.id, engagement])).values());
}

type TrackInput = {
  name: PassengerAnalyticsEventName;
  screen?: PassengerAnalyticsScreen;
  element: PassengerAnalyticsElement;
  durationMs?: number;
  metadata?: PassengerAnalyticsMetadata;
  interaction?: boolean;
};

export function usePassengerAnalytics(screen: PassengerAnalyticsScreen) {
  const screenRef = useRef(screen);
  const sessionRef = useRef<PassengerAnalyticsSession | null>(null);
  const engagementRef = useRef<PassengerAnalyticsEngagement | null>(null);
  const queueRef = useRef<PassengerAnalyticsEvent[]>([]);
  const engagementQueueRef = useRef<PassengerAnalyticsEngagement[]>([]);
  const retryControllerRef = useRef<ReturnType<
    typeof createPassengerAnalyticsRetryController
  > | null>(null);
  const activeSinceRef = useRef<number | null>(null);
  const engagementActiveSinceRef = useRef<number | null>(null);
  const firstInteractionRef = useRef(false);

  const refreshActiveDuration = useCallback(() => {
    const session = sessionRef.current;
    const activeSince = activeSinceRef.current;
    if (!session || activeSince === null) return;
    const now = Date.now();
    session.activeDurationMs = Math.min(86_400_000, session.activeDurationMs + (now - activeSince));
    session.lastActiveAt = new Date(now).toISOString();
    activeSinceRef.current = now;
  }, []);

  const refreshEngagementDuration = useCallback(() => {
    const engagement = engagementRef.current;
    const activeSince = engagementActiveSinceRef.current;
    if (!engagement || engagement.endedAt || activeSince === null) return;
    const now = Date.now();
    engagement.activeDurationMs = Math.min(
      86_400_000,
      engagement.activeDurationMs + (now - activeSince),
    );
    engagement.lastActiveAt = new Date(now).toISOString();
    engagementActiveSinceRef.current = now;
  }, []);

  const queueEngagement = useCallback((engagement: PassengerAnalyticsEngagement) => {
    engagementQueueRef.current = [
      ...engagementQueueRef.current.filter((candidate) => candidate.id !== engagement.id),
      { ...engagement },
    ].slice(-PASSENGER_ANALYTICS_ENGAGEMENT_QUEUE_LIMIT);
    persistEngagementQueue(engagementQueueRef.current);
  }, []);

  const flush = useCallback(
    (trigger: PassengerAnalyticsFlushTrigger = "event") => {
      void retryControllerRef.current?.run(
        async () => {
          if (!sessionRef.current) return;
          refreshActiveDuration();
          refreshEngagementDuration();
          const batch = queueRef.current.slice(0, 25);
          const activeEngagement = engagementRef.current;
          const engagements = uniqueEngagements([
            ...engagementQueueRef.current,
            ...(activeEngagement ? [{ ...activeEngagement }] : []),
          ]);
          try {
            await ingestPassengerAnalytics({
              data: { session: sessionRef.current, engagements, events: batch },
            });
            if (batch.length) {
              const delivered = new Set(batch.map((event) => event.id));
              queueRef.current = queueRef.current.filter((event) => !delivered.has(event.id));
              persistQueue(queueRef.current);
            }
            if (engagements.length) {
              const delivered = new Set(engagements.map((engagement) => engagement.id));
              engagementQueueRef.current = engagementQueueRef.current.filter(
                (engagement) => !delivered.has(engagement.id),
              );
              persistEngagementQueue(engagementQueueRef.current);
            }
          } catch (error) {
            if (activeEngagement) queueEngagement(activeEngagement);
            // Preserve event IDs and queued data; the retry controller owns retry timing.
            throw error;
          }
        },
        () => navigator.onLine,
        trigger,
      );
    },
    [queueEngagement, refreshActiveDuration, refreshEngagementDuration],
  );

  const track = useCallback(
    ({
      name,
      screen: eventScreen,
      element,
      durationMs,
      metadata,
      interaction = false,
    }: TrackInput) => {
      const session = sessionRef.current;
      if (!session) return;
      refreshActiveDuration();
      refreshEngagementDuration();
      const engagement = engagementRef.current;
      if (interaction) {
        session.interactionCount += 1;
        if (engagement && !engagement.endedAt) engagement.interactionCount += 1;
      }
      queueRef.current = [
        ...queueRef.current,
        {
          id: createId(),
          name,
          screen: eventScreen ?? screenRef.current,
          element,
          occurredAt: new Date().toISOString(),
          ...(durationMs === undefined ? {} : { durationMs }),
          ...(metadata ? { metadata } : {}),
          ...(engagement ? { engagementId: engagement.id } : {}),
        },
      ].slice(-PASSENGER_ANALYTICS_QUEUE_LIMIT);
      persistQueue(queueRef.current);
      if (engagement) queueEngagement(engagement);
      void flush();
    },
    [flush, queueEngagement, refreshActiveDuration, refreshEngagementDuration],
  );

  const beginEngagement = useCallback(
    ({
      source,
      screen: entryScreen = screenRef.current,
    }: {
      source: PassengerAnalyticsEngagementSource;
      screen?: PassengerAnalyticsScreen;
    }) => {
      const current = engagementRef.current;
      if (current && !current.endedAt) {
        if (source !== "initial_interaction" && current.entrySource === "initial_interaction") {
          current.entrySource = source;
          queueEngagement(current);
        }
        return current.id;
      }
      const now = new Date().toISOString();
      const engagement: PassengerAnalyticsEngagement = {
        id: createId(),
        deviceInstallationId: getDeviceInstallationId(),
        entryScreen,
        entrySource: source,
        startedAt: now,
        lastActiveAt: now,
        activeDurationMs: 0,
        interactionCount: 0,
      };
      engagementRef.current = engagement;
      engagementActiveSinceRef.current = document.visibilityState === "visible" ? Date.now() : null;
      queueEngagement(engagement);
      track({ name: "engagement_started", screen: entryScreen, element: "console" });
      return engagement.id;
    },
    [queueEngagement, track],
  );

  const endEngagement = useCallback(
    (reason: PassengerAnalyticsEngagementEndReason) => {
      const engagement = engagementRef.current;
      if (!engagement || engagement.endedAt) return;
      refreshEngagementDuration();
      const endedAt = new Date().toISOString();
      engagement.endedAt = endedAt;
      engagement.endedBy = reason;
      engagement.lastActiveAt = endedAt;
      track({
        name: "engagement_ended",
        screen: "idle",
        element: reason === "logical_rest" ? "logical_rest" : "idle",
      });
      queueEngagement(engagement);
      engagementRef.current = null;
      engagementActiveSinceRef.current = null;
      void flush();
    },
    [flush, queueEngagement, refreshEngagementDuration, track],
  );

  useEffect(() => {
    screenRef.current = screen;
    if (sessionRef.current) {
      track({ name: "screen_viewed", element: "navigation" });
    }
  }, [screen, track]);

  useEffect(() => {
    const retryController = createPassengerAnalyticsRetryController();
    retryControllerRef.current = retryController;
    const now = new Date().toISOString();
    sessionRef.current = {
      id: createId(),
      deviceInstallationId: getDeviceInstallationId(),
      startedAt: now,
      lastActiveAt: now,
      activeDurationMs: 0,
      interactionCount: 0,
    };
    queueRef.current = readQueue();
    engagementQueueRef.current = readEngagementQueue();
    activeSinceRef.current = document.visibilityState === "visible" ? Date.now() : null;
    track({ name: "session_started", element: "console", screen: screenRef.current });
    track({ name: "screen_viewed", element: "console", screen: screenRef.current });

    const markInteraction = () => {
      beginEngagement({ source: "initial_interaction" });
      if (firstInteractionRef.current) return;
      firstInteractionRef.current = true;
      track({ name: "first_interaction", element: "console", interaction: true });
    };
    const syncVisibility = () => {
      if (document.visibilityState === "hidden") {
        refreshActiveDuration();
        refreshEngagementDuration();
        activeSinceRef.current = null;
        engagementActiveSinceRef.current = null;
        flush("heartbeat");
      } else if (activeSinceRef.current === null) {
        activeSinceRef.current = Date.now();
        if (engagementRef.current && !engagementRef.current.endedAt) {
          engagementActiveSinceRef.current = Date.now();
        }
        flush("heartbeat");
      }
    };
    const syncOnline = () => flush("online");
    const syncPageHide = () => {
      endEngagement("pagehide");
      flush("heartbeat");
    };
    const interval = window.setInterval(() => flush("heartbeat"), SESSION_SYNC_MS);

    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("online", syncOnline);
    window.addEventListener("pagehide", syncPageHide);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      refreshActiveDuration();
      refreshEngagementDuration();
      flush("heartbeat");
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("pagehide", syncPageHide);
      document.removeEventListener("visibilitychange", syncVisibility);
      retryController.dispose();
      if (retryControllerRef.current === retryController) retryControllerRef.current = null;
    };
  }, [
    beginEngagement,
    endEngagement,
    flush,
    refreshActiveDuration,
    refreshEngagementDuration,
    track,
  ]);

  return { beginEngagement, endEngagement, track };
}
