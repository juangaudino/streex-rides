import { CONFIG } from "@/config";
import { mergeSiteConfig, SiteConfigOverrideSchema } from "@/lib/site-config";

const storageKey = "streex-haunted-local-config";
const tenant = {
  id: "local-qa",
  slug: "local-qa",
  display_name: "STREEX · Local QA",
  owner_name: "Juan",
  owner_email: "local@example.invalid",
  owner_phone: null,
  status: "active",
  onboarding: { configurationReady: true, calendarConnected: false, availabilityReady: false },
};
const artwork = "/album-fixture.svg";
const track = {
  uri: "spotify:track:1234567890123456789012",
  title: "Midnight City",
  artist: "M83",
  album: "Hurry Up, We're Dreaming",
  artworkUrl: artwork,
  durationMs: 244000,
  progressMs: 125000,
};
let playing = true;
let currentTrack = track;

export function readLocalConfig() {
  const override = SiteConfigOverrideSchema.parse(
    JSON.parse(localStorage.getItem(storageKey) || "{}"),
  );
  const config = mergeSiteConfig(CONFIG, override);
  return {
    ...config,
    passengerConsole: {
      ...config.passengerConsole,
      aroundYou: { ...config.passengerConsole.aroundYou, enabled: false },
    },
  };
}

export function prepareLocalFixture(params: URLSearchParams) {
  const override = JSON.parse(localStorage.getItem(storageKey) || "{}");
  const theme = params.get("theme");
  const mode = params.get("mode");
  if (theme || mode) {
    override.passengerConsole = {
      ...override.passengerConsole,
      ...(theme ? { visualTheme: theme } : {}),
      ...(mode ? { experienceMode: mode } : {}),
    };
    localStorage.setItem(storageKey, JSON.stringify(SiteConfigOverrideSchema.parse(override)));
  }
  const forcedIdleAgeMs =
    Math.max(300, readLocalConfig().passengerConsole.idleReset.inactivitySeconds) * 1000 + 5000;
  localStorage.setItem(
    "streex-passenger-last-activity-v1",
    String(Date.now() - (params.get("surface") === "idle" ? forcedIdleAgeMs : 0)),
  );
}

export async function callLocalFixture(name: string, input?: { data?: Record<string, unknown> }) {
  type FixtureCall = { name: string; data?: Record<string, unknown>; at: number };
  type FixtureEvent = { id: string; name: string; metadata?: { game?: string; source?: string } };
  const log = ((window as unknown as { __hauntedQaCalls?: FixtureCall[] }).__hauntedQaCalls ??= []);
  log.push({ name, data: input?.data, at: performance.now() });
  if (name === "getAdminSession")
    return {
      user: { id: "local-qa", email: "local@example.invalid" },
      activeTenantId: tenant.id,
      isSuperAdmin: false,
      emergencyAccess: false,
      tenants: [tenant],
    };
  if (name === "getPublicSiteConfig" || name === "getAdminSiteConfig")
    return {
      config: readLocalConfig(),
      tenant,
      override: JSON.parse(localStorage.getItem(storageKey) || "{}"),
      source: "local-qa",
    };
  if (name === "updateAdminSiteConfig") {
    const override = SiteConfigOverrideSchema.parse(input?.data?.config);
    localStorage.setItem(storageKey, JSON.stringify(override));
    return { ok: true, config: readLocalConfig() };
  }
  if (name === "getPersonalSpotifyPlayback")
    return {
      state: "ready",
      playback: {
        hasActiveDevice: true,
        isPlaying: playing,
        repeatMode: "track",
        track: currentTrack,
      },
    };
  if (name === "controlPersonalSpotifyPlayback") {
    playing = input?.data?.command !== "pause";
    return { ok: true };
  }
  if (name === "setPersonalSpotifyRepeatMode") return { ok: true };
  if (name === "playPersonalSpotifyTrack") {
    playing = true;
    currentTrack = { ...track, title: "Nightcall", artist: "Kavinsky", album: "OutRun" };
    return { ok: true };
  }
  if (name === "searchPersonalSpotifyTracks")
    return {
      tracks: [
        {
          id: "1234567890123456789012",
          uri: track.uri,
          albumUri: "spotify:album:abcdefghijklmnopqrstuv",
          title: "Nightcall",
          artist: "Kavinsky",
          album: "OutRun",
          artworkUrl: artwork,
          durationMs: 254000,
          explicit: false,
        },
      ],
    };
  if (name === "getPersonalSpotifyPlaylistArtwork") return { playlists: [] };
  if (name === "listPublicReviews") return { reviews: [] };
  if (name === "getPassengerWeather") {
    const period = (index: number, daily = false) => ({
      startTime: new Date(Date.now() + index * (daily ? 86400000 : 3600000)).toISOString(),
      temperatureFahrenheit: 54 - index * 2,
      condition: "clear",
      shortForecast: "Clear",
      windSpeed: "4 mph",
      windDirection: "N",
      precipitationChance: 0,
    });
    return {
      state: "ready",
      weather: {
        updatedAt: new Date().toISOString(),
        locationName: "Salt Lake City",
        periods: Array.from({ length: 6 }, (_, i) => period(i)),
        dailyPeriods: Array.from({ length: 4 }, (_, i) => period(i, true)),
      },
    };
  }
  if (name === "ingestPassengerAnalytics") {
    // Expose semantic fixture-only evidence to the DOM inspection API, never production telemetry.
    const events = log.flatMap((call) =>
      call.name === name ? ((call.data?.events as FixtureEvent[] | undefined) ?? []) : [],
    );
    document.documentElement.dataset.qaGameEvents = JSON.stringify(
      events
        .filter((event) => event.metadata?.game === "midnight-hunt")
        .map((event) => ({ id: event.id, name: event.name, source: event.metadata?.source })),
    );
    return { ok: true };
  }
  if (name === "getAdminTickerTheme" || name === "getTickerTheme")
    return { tickerStyle: "boarding", source: "local-qa" };
  // Other Admin surfaces are not exercised by this harness.
  throw new Error(`Local QA fixture not implemented: ${name}`);
}
