import { useCallback, useEffect, useRef, useState } from "react";
import { getPassengerWeather } from "@/lib/weather.functions";
import type { PassengerWeatherSnapshot } from "@/lib/weather";
import type { PassengerPosition } from "./around-you/around-you-types";

export type PassengerWeatherStatus = "loading" | "ready" | "unavailable";

const PASSENGER_WEATHER_CACHE_KEY = "streex-passenger-weather-v1";
const PASSENGER_LAST_ACTIVITY_KEY = "streex-passenger-last-activity-v1";

export function usePassengerIdleReset({
  inactivitySeconds,
  onReset,
}: {
  inactivitySeconds: number;
  onReset: () => void;
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [logicalRest, setLogicalRest] = useState(false);
  const onResetRef = useRef(onReset);
  const resumeRef = useRef<() => void>(() => undefined);
  const enterRestRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  useEffect(() => {
    const inactivityMs = Math.max(1, inactivitySeconds) * 1_000;
    let promptVisible = false;
    let lastActivity = Date.now();
    let phaseTimer: number | undefined;

    try {
      const storedActivity = Number(localStorage.getItem(PASSENGER_LAST_ACTIVITY_KEY));
      if (Number.isFinite(storedActivity) && storedActivity > 0) lastActivity = storedActivity;
    } catch {
      // Persistence is helpful for Android suspension, but the timer still works without it.
    }

    const persistActivity = () => {
      try {
        localStorage.setItem(PASSENGER_LAST_ACTIVITY_KEY, String(lastActivity));
      } catch {
        // Ignore storage restrictions in private or hardened browser modes.
      }
    };

    const clearTimers = () => {
      if (phaseTimer !== undefined) window.clearTimeout(phaseTimer);
      phaseTimer = undefined;
    };

    const beginActivePhase = (remainingMs: number) => {
      clearTimers();
      promptVisible = false;
      setLogicalRest(false);
      setPromptOpen(false);
      phaseTimer = window.setTimeout(evaluateElapsedTime, Math.max(0, remainingMs));
    };

    const beginPromptPhase = ({ asLogicalRest = false }: { asLogicalRest?: boolean } = {}) => {
      if (promptVisible) return;
      clearTimers();
      promptVisible = true;
      setLogicalRest(asLogicalRest);
      onResetRef.current();
      setPromptOpen(true);
    };

    function evaluateElapsedTime() {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= inactivityMs) {
        beginPromptPhase();
      } else {
        beginActivePhase(inactivityMs - elapsed);
      }
    }

    const registerActivity = () => {
      if (promptVisible || document.visibilityState === "hidden") return;
      lastActivity = Date.now();
      persistActivity();
      beginActivePhase(inactivityMs);
    };

    const checkAfterWake = () => {
      if (document.visibilityState === "visible") evaluateElapsedTime();
    };

    resumeRef.current = () => {
      lastActivity = Date.now();
      persistActivity();
      beginActivePhase(inactivityMs);
    };
    enterRestRef.current = () => {
      beginPromptPhase({ asLogicalRest: true });
    };

    window.addEventListener("pointerdown", registerActivity, { passive: true });
    window.addEventListener("touchstart", registerActivity, { passive: true });
    window.addEventListener("wheel", registerActivity, { passive: true });
    window.addEventListener("keydown", registerActivity);
    window.addEventListener("scroll", registerActivity, true);
    window.addEventListener("focus", checkAfterWake);
    window.addEventListener("pageshow", checkAfterWake);
    document.addEventListener("visibilitychange", checkAfterWake);
    evaluateElapsedTime();

    return () => {
      clearTimers();
      window.removeEventListener("pointerdown", registerActivity);
      window.removeEventListener("touchstart", registerActivity);
      window.removeEventListener("wheel", registerActivity);
      window.removeEventListener("keydown", registerActivity);
      window.removeEventListener("scroll", registerActivity, true);
      window.removeEventListener("focus", checkAfterWake);
      window.removeEventListener("pageshow", checkAfterWake);
      document.removeEventListener("visibilitychange", checkAfterWake);
      resumeRef.current = () => undefined;
      enterRestRef.current = () => undefined;
    };
  }, [inactivitySeconds]);

  const resume = useCallback(() => resumeRef.current(), []);
  const enterRest = useCallback(() => enterRestRef.current(), []);

  return { promptOpen, logicalRest, resume, enterRest };
}

export function useClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

export function usePassengerWeather({
  online,
  refreshMinutes,
  fallbackCity,
  location,
}: {
  online: boolean;
  refreshMinutes: number;
  fallbackCity: string;
  location: PassengerPosition | null;
}) {
  const [snapshot, setSnapshot] = useState<PassengerWeatherSnapshot | null>(null);
  const [status, setStatus] = useState<PassengerWeatherStatus>("loading");
  const [lastKnownLocation, setLastKnownLocation] = useState<PassengerPosition | null>(null);

  useEffect(() => {
    if (location) setLastKnownLocation(location);
  }, [location]);

  const forecastLocation = location ?? lastKnownLocation;
  // Roughly one kilometre is sufficient for a passenger forecast and prevents exact GPS
  // coordinates from leaving the tablet. It also makes server-side forecast caching effective.
  const latitude = forecastLocation ? Math.round(forecastLocation.latitude * 100) / 100 : null;
  const longitude = forecastLocation ? Math.round(forecastLocation.longitude * 100) / 100 : null;
  const locationKey =
    latitude === null || longitude === null ? "fallback" : `${latitude},${longitude}`;

  const refresh = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus("unavailable");
      return;
    }

    try {
      const response = await getPassengerWeather({
        data: latitude === null || longitude === null ? {} : { latitude, longitude },
      });
      if (response.state !== "ready") {
        setStatus("unavailable");
        return;
      }
      setSnapshot(response.weather);
      setStatus("ready");
      localStorage.setItem(PASSENGER_WEATHER_CACHE_KEY, JSON.stringify(response.weather));
    } catch {
      setStatus("unavailable");
    }
  }, [latitude, longitude]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(PASSENGER_WEATHER_CACHE_KEY);
      if (cached) setSnapshot(JSON.parse(cached) as PassengerWeatherSnapshot);
    } catch {
      localStorage.removeItem(PASSENGER_WEATHER_CACHE_KEY);
    }

    const interval = window.setInterval(
      () => {
        if (document.visibilityState === "visible") void refresh();
      },
      Math.max(1, refreshMinutes) * 60_000,
    );
    return () => window.clearInterval(interval);
  }, [locationKey, refresh, refreshMinutes]);

  useEffect(() => {
    if (online) void refresh();
    else setStatus("unavailable");
  }, [online, refresh]);

  return { snapshot, status, city: snapshot?.locationName ?? fallbackCity };
}
