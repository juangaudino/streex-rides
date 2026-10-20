import type { PricingLocation, PricingRouteLeg } from "@/features/pricing/pricing-types";

type GoogleWaypoint = { address: string } | { placeId: string };

type GoogleRoute = {
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;
  legs?: Array<{
    distanceMeters?: number;
    duration?: string;
    staticDuration?: string;
  }>;
};

type GoogleErrorPayload = {
  status?: string;
  error?: { status?: string; code?: number };
};

const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;

export type ResolvedLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

function serverMapsKey() {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    throw new Error("Google Maps is not configured for server-side pricing requests.");
  }
  return key;
}

function waypoint(location: PricingLocation): GoogleWaypoint {
  if (location.placeId) return { placeId: location.placeId };
  return { address: location.address };
}

function durationSeconds(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/s$/, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function isFutureDeparture(serviceAt: string) {
  const date = new Date(serviceAt);
  return Number.isFinite(date.valueOf()) && date.valueOf() > Date.now();
}

function apiStatus(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as GoogleErrorPayload;
  return body.status || body.error?.status || null;
}

function googleErrorMessage(status: string | null, operation: string) {
  if (status === "ZERO_RESULTS") {
    return "Google Maps could not find this address. Check the address and try again.";
  }
  if (["REQUEST_DENIED", "PERMISSION_DENIED"].includes(status || "")) {
    return "Google Maps rejected this request. Check API access and key restrictions.";
  }
  if (["OVER_DAILY_LIMIT", "OVER_QUERY_LIMIT", "RESOURCE_EXHAUSTED"].includes(status || "")) {
    return "Google Maps is over its configured quota or billing limit.";
  }
  if (status === "INVALID_REQUEST" || status === "INVALID_ARGUMENT") {
    return "Google Maps could not process the location request. Check the address and request.";
  }
  return operation === "geocoding"
    ? "Google Maps could not resolve this address. Verify the server API setup."
    : "Google Maps could not calculate this route. Verify the address and server API setup.";
}

async function googleJson<T>(operation: string, url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const timedOut = name === "TimeoutError" || name === "AbortError";
    console.error("[pricing-maps] Google request failed", {
      operation,
      failure: timedOut ? "timeout" : "network",
      errorName: name,
    });
    throw new Error(
      timedOut
        ? "Google Maps took too long to respond. Try again."
        : "Google Maps is temporarily unavailable. Try again.",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error("[pricing-maps] Google returned an unreadable response", {
      operation,
      httpStatus: response.status,
    });
    throw new Error(googleErrorMessage(null, operation));
  }

  const status = apiStatus(payload);
  if (!response.ok || (status && status !== "OK")) {
    console.error("[pricing-maps] Google API error", {
      operation,
      httpStatus: response.status,
      apiStatus: status,
    });
    throw new Error(googleErrorMessage(status, operation));
  }
  return payload as T;
}

export async function computeDrivingRoute(input: {
  origin: PricingLocation;
  destination: PricingLocation;
  stops?: PricingLocation[];
  serviceAt: string;
  labels: string[];
}) {
  const key = serverMapsKey();
  const useTraffic = isFutureDeparture(input.serviceAt);
  const body: Record<string, unknown> = {
    origin: waypoint(input.origin),
    destination: waypoint(input.destination),
    intermediates: (input.stops ?? []).map(waypoint),
    travelMode: "DRIVE",
  };
  if (useTraffic) {
    body.routingPreference = "TRAFFIC_AWARE";
    body.departureTime = new Date(input.serviceAt).toISOString();
  }
  const result = await googleJson<{ routes?: GoogleRoute[] }>(
    "routes",
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.staticDuration,routes.legs.distanceMeters,routes.legs.duration,routes.legs.staticDuration",
      },
      body: JSON.stringify(body),
    },
  );
  const route = result.routes?.[0];
  if (!route?.distanceMeters || !route.duration) {
    console.warn("[pricing-maps] Google returned no drivable route", { operation: "routes" });
    throw new Error("Google Maps did not return a drivable route.");
  }
  const legs: PricingRouteLeg[] = (route.legs ?? []).map((leg, index) => ({
    label: input.labels[index] || `Leg ${index + 1}`,
    distanceMeters: leg.distanceMeters ?? 0,
    durationSeconds: durationSeconds(leg.duration),
    staticDurationSeconds: leg.staticDuration ? durationSeconds(leg.staticDuration) : null,
  }));
  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: durationSeconds(route.duration),
    staticDurationSeconds: route.staticDuration ? durationSeconds(route.staticDuration) : null,
    legs,
    trafficUsed: useTraffic,
  };
}

export async function resolvePricingLocation(location: PricingLocation): Promise<ResolvedLocation> {
  const key = serverMapsKey();
  if (location.placeId) {
    const result = await googleJson<{
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
    }>(
      "places",
      `https://places.googleapis.com/v1/places/${encodeURIComponent(location.placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "formattedAddress,location",
        },
      },
    );
    if (result.location?.latitude == null || result.location.longitude == null) {
      console.warn("[pricing-maps] Google Place details returned no coordinates", {
        operation: "places",
      });
      throw new Error("Google Places could not resolve this location.");
    }
    return {
      address: result.formattedAddress || location.address,
      latitude: result.location.latitude,
      longitude: result.location.longitude,
    };
  }

  const encodedAddress = encodeURIComponent(location.address);
  const result = await googleJson<{
    status?: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  }>(
    "geocoding",
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${key}`,
    {
      headers: { Accept: "application/json" },
    },
  );
  const match = result.results?.[0];
  const coordinates = match?.geometry?.location;
  if (coordinates?.lat == null || coordinates.lng == null) {
    console.warn("[pricing-maps] Google Geocoding returned no coordinates", {
      operation: "geocoding",
      apiStatus: result.status || "missing_status",
    });
    throw new Error("Google Maps could not resolve this address for zone matching.");
  }
  return {
    address: match?.formatted_address || location.address,
    latitude: coordinates.lat,
    longitude: coordinates.lng,
  };
}
