import {
  createSpotifyOAuthState,
  decryptSpotifyToken,
  encryptSpotifyToken,
  verifySpotifyOAuthState,
} from "./spotify-crypto.server";

const SPOTIFY_API = "https://api.spotify.com/v1";

export const SPOTIFY_PERSONAL_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
] as const;

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type SpotifyPlaybackResponse = {
  device?: { name?: string };
  is_playing?: boolean;
  repeat_state?: "off" | "context" | "track";
  progress_ms?: number | null;
  item?: {
    uri?: string;
    name?: string;
    duration_ms?: number;
    album?: { name?: string; images?: Array<{ url?: string }> };
    artists?: Array<{ name?: string }>;
  } | null;
  error?: { message?: string };
};

type SpotifySearchResponse = {
  tracks?: {
    items?: Array<{
      id?: string;
      uri?: string;
      name?: string;
      duration_ms?: number;
      explicit?: boolean;
      album?: { name?: string; images?: Array<{ url?: string }> };
      artists?: Array<{ name?: string }>;
    }>;
  };
  error?: { message?: string };
};

type SpotifyOEmbedResponse = {
  thumbnail_url?: string;
};

export type PersonalSpotifyPlayback = {
  hasActiveDevice: boolean;
  isPlaying: boolean;
  repeatMode: "off" | "context" | "track" | null;
  track: {
    uri: string | null;
    title: string;
    artist: string;
    album: string | null;
    artworkUrl: string | null;
    durationMs: number | null;
    progressMs: number | null;
  } | null;
};

export type SpotifyTrackSearchResult = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  explicit: boolean;
};

export type SpotifyPlaylistArtwork = {
  id: string;
  artworkUrl: string | null;
};

function getSpotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI?.trim() || "https://rides.getstreex.com/spotify/callback";

  if (!clientId || !clientSecret) {
    throw new Error("Spotify personal integration is not configured.");
  }
  return { clientId, clientSecret, redirectUri };
}

export function isSpotifyPersonalIntegrationEnabled() {
  return process.env.SPOTIFY_PERSONAL_INTEGRATION_ENABLED === "true";
}

export function assertSpotifyPersonalIntegrationEnabled() {
  if (!isSpotifyPersonalIntegrationEnabled()) {
    throw new Error("Spotify personal integration is disabled.");
  }
}

export function buildSpotifyAuthorizationUrl() {
  assertSpotifyPersonalIntegrationEnabled();
  const { clientId, redirectUri } = getSpotifyConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_PERSONAL_SCOPES.join(" "),
    state: createSpotifyOAuthState(),
    show_dialog: "true",
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(code: string, state: string) {
  assertSpotifyPersonalIntegrationEnabled();
  verifySpotifyOAuthState(state);
  const { clientId, clientSecret, redirectUri } = getSpotifyConfig();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await response.json()) as TokenResponse;
  if (!response.ok || !tokens.refresh_token) {
    console.error("[Spotify] token exchange failed", tokens.error);
    throw new Error(tokens.error_description || "Spotify did not return offline access.");
  }

  return {
    encryptedRefreshToken: encryptSpotifyToken(tokens.refresh_token),
    scopes: (tokens.scope || SPOTIFY_PERSONAL_SCOPES.join(" ")).split(" ").filter(Boolean),
  };
}

export async function refreshSpotifyAccessToken(encryptedRefreshToken: string) {
  assertSpotifyPersonalIntegrationEnabled();
  const { clientId, clientSecret } = getSpotifyConfig();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptSpotifyToken(encryptedRefreshToken),
    }),
  });
  const tokens = (await response.json()) as TokenResponse;
  if (!response.ok || !tokens.access_token) {
    console.error("[Spotify] token refresh failed", tokens.error);
    throw new Error("Spotify needs to be reconnected by the driver.");
  }
  return tokens.access_token;
}

export async function getSpotifyCatalogAccessToken() {
  assertSpotifyPersonalIntegrationEnabled();
  const { clientId, clientSecret } = getSpotifyConfig();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const tokens = (await response.json()) as TokenResponse;
  if (!response.ok || !tokens.access_token) {
    console.error("[Spotify] catalog token request failed", tokens.error);
    throw new Error("Spotify search is unavailable.");
  }
  return tokens.access_token;
}

export async function getSpotifyPlayback(accessToken: string): Promise<PersonalSpotifyPlayback> {
  const response = await spotifyFetch(`${SPOTIFY_API}/me/player`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 204) {
    return { hasActiveDevice: false, isPlaying: false, repeatMode: null, track: null };
  }

  const result = (await response.json()) as SpotifyPlaybackResponse;
  if (!response.ok) throw new Error(result.error?.message || "Spotify playback is unavailable.");

  const item = result.item;
  return {
    hasActiveDevice: Boolean(result.device?.name),
    isPlaying: Boolean(result.is_playing),
    repeatMode: result.repeat_state ?? null,
    track: item?.name
      ? {
          uri: item.uri ?? null,
          title: item.name,
          artist:
            (item.artists ?? [])
              .flatMap((artist) => (artist.name ? [artist.name] : []))
              .join(", ") || "Spotify",
          album: item.album?.name ?? null,
          artworkUrl: item.album?.images?.find((image) => image.url)?.url ?? null,
          durationMs: typeof item.duration_ms === "number" ? item.duration_ms : null,
          progressMs: typeof result.progress_ms === "number" ? result.progress_ms : null,
        }
      : null,
  };
}

export async function setSpotifyRepeatMode(accessToken: string, mode: "off" | "context" | "track") {
  const url = new URL(`${SPOTIFY_API}/me/player/repeat`);
  url.searchParams.set("state", mode);
  const response = await spotifyFetch(url.toString(), {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.ok || response.status === 204) return;

  const result = (await response.json().catch(() => ({}))) as SpotifyPlaybackResponse;
  throw new Error(result.error?.message || "Spotify could not update repeat mode.");
}

export async function controlSpotifyPlayback(
  accessToken: string,
  command: "play" | "pause" | "next",
) {
  const endpoint =
    command === "play"
      ? "/me/player/play"
      : command === "pause"
        ? "/me/player/pause"
        : "/me/player/next";
  const response = await spotifyFetch(`${SPOTIFY_API}${endpoint}`, {
    method: command === "next" ? "POST" : "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.ok || response.status === 204) return;

  const result = (await response.json().catch(() => ({}))) as SpotifyPlaybackResponse;
  throw new Error(result.error?.message || "Spotify could not control the active audio device.");
}

export async function searchSpotifyTracks(
  accessToken: string,
  query: string,
  limit: number,
  market: string,
): Promise<SpotifyTrackSearchResult[]> {
  const url = new URL(`${SPOTIFY_API}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("market", market);

  const response = await spotifyFetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const result = (await response.json()) as SpotifySearchResponse;
  if (!response.ok) throw new Error(result.error?.message || "Spotify search is unavailable.");

  return (result.tracks?.items ?? []).flatMap((track) => {
    if (!track.id || !track.uri || !track.name) return [];
    return [
      {
        id: track.id,
        uri: track.uri,
        title: track.name,
        artist:
          (track.artists ?? [])
            .flatMap((artist) => (artist.name ? [artist.name] : []))
            .join(", ") || "Spotify",
        album: track.album?.name ?? null,
        artworkUrl: track.album?.images?.find((image) => image.url)?.url ?? null,
        durationMs: typeof track.duration_ms === "number" ? track.duration_ms : null,
        explicit: Boolean(track.explicit),
      },
    ];
  });
}

export async function getSpotifyPlaylistArtwork(
  playlistIds: readonly string[],
): Promise<SpotifyPlaylistArtwork[]> {
  return Promise.all(
    playlistIds.map(async (playlistId) => {
      try {
        const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
        const response = await fetch(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(playlistUrl)}`,
        );
        if (!response.ok) return { id: playlistId, artworkUrl: null };
        const result = (await response.json()) as SpotifyOEmbedResponse;
        return { id: playlistId, artworkUrl: result.thumbnail_url ?? null };
      } catch {
        return { id: playlistId, artworkUrl: null };
      }
    }),
  );
}

export async function playSpotifyTrack(accessToken: string, uri: string) {
  const response = await spotifyFetch(`${SPOTIFY_API}/me/player/play`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [uri] }),
  });
  if (response.ok || response.status === 204) return;

  const result = (await response.json().catch(() => ({}))) as SpotifyPlaybackResponse;
  throw new Error(result.error?.message || "Spotify could not start the selected track.");
}

async function spotifyFetch(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Spotify did not respond in time.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
