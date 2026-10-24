import { timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildPassengerConsoleCookie,
  createPassengerConsoleSession,
  getPassengerConsoleCookieName,
  verifyPassengerConsoleSession,
} from "./passenger-console-session.server";
import {
  assertSpotifyPersonalIntegrationEnabled,
  buildSpotifyAuthorizationUrl,
  controlSpotifyPlayback,
  exchangeSpotifyCode,
  getSpotifyCatalogAccessToken,
  getSpotifyPlaylistArtwork,
  getSpotifyPlayback,
  isSpotifyPersonalIntegrationEnabled,
  playSpotifyTrack,
  refreshSpotifyAccessToken,
  searchSpotifyTracks,
  setSpotifyRepeatMode,
} from "./spotify.server";

const CONNECTION_ID = "spotify-personal-primary";
const EmptySchema = z.object({});
const PairSchema = z.object({ code: z.string().trim().min(1).max(128) });
const CallbackSchema = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(1).max(4096),
});
const ControlSchema = z.object({ command: z.enum(["play", "pause", "next"]) });
const RepeatModeSchema = z.object({ mode: z.enum(["off", "context", "track"]) });
const SearchSchema = z.object({
  query: z.string().trim().min(2).max(100),
  limit: z.number().int().min(1).max(10),
  market: z.string().regex(/^[A-Z]{2}$/),
});
const PlayTrackSchema = z.object({
  uri: z.string().regex(/^spotify:track:[A-Za-z0-9]{22}$/),
  albumUri: z.string().regex(/^spotify:album:[A-Za-z0-9]{22}$/),
});

function readCookie(name: string) {
  const header = getRequestHeader("cookie");
  if (!header) return undefined;
  const value = header.split(";").find((part) => part.trim().startsWith(`${name}=`));
  return value?.trim().slice(name.length + 1);
}

function assertPassengerConsoleSession() {
  const value = readCookie(getPassengerConsoleCookieName());
  if (!verifyPassengerConsoleSession(value)) {
    throw new Error("Driver setup is required before controlling Spotify.");
  }
}

function assertPairingCode(candidate: string) {
  const expected = process.env.PASSENGER_CONSOLE_PAIRING_CODE?.trim();
  if (!expected) throw new Error("Passenger Console pairing is not configured.");

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (
    candidateBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(candidateBuffer, expectedBuffer)
  ) {
    throw new Error("The driver pairing code is not valid.");
  }
}

async function getConnection() {
  const { data, error } = await supabaseAdmin
    .from("spotify_connections")
    .select("encrypted_refresh_token")
    .eq("id", CONNECTION_ID)
    .maybeSingle();
  if (error) throw new Error("Unable to read the Spotify connection.");
  return data;
}

async function getAccessToken() {
  const connection = await getConnection();
  if (!connection) throw new Error("Spotify has not been connected by the driver.");
  return refreshSpotifyAccessToken(connection.encrypted_refresh_token);
}

export const pairPassengerConsole = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PairSchema.parse(input))
  .handler(async ({ data }) => {
    assertPairingCode(data.code);
    setResponseHeader("set-cookie", buildPassengerConsoleCookie(createPassengerConsoleSession()));
    return { paired: true };
  });

export const startPersonalSpotifyConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmptySchema.parse(input))
  .handler(async () => {
    assertSpotifyPersonalIntegrationEnabled();
    assertPassengerConsoleSession();
    return { authorizationUrl: buildSpotifyAuthorizationUrl() };
  });

export const completePersonalSpotifyConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CallbackSchema.parse(input))
  .handler(async ({ data }) => {
    const tokens = await exchangeSpotifyCode(data.code, data.state);
    const { error } = await supabaseAdmin.from("spotify_connections").upsert({
      id: CONNECTION_ID,
      encrypted_refresh_token: tokens.encryptedRefreshToken,
      scopes: tokens.scopes,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    });
    if (error) {
      console.error("[Spotify] connection save failed", error);
      throw new Error("Spotify connected, but its secure connection could not be saved.");
    }
    return { ok: true };
  });

export const getPersonalSpotifyPlayback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmptySchema.parse(input))
  .handler(async () => {
    if (!isSpotifyPersonalIntegrationEnabled()) return { state: "disabled" as const };
    const paired = verifyPassengerConsoleSession(readCookie(getPassengerConsoleCookieName()));
    if (!paired) return { state: "driver-setup-required" as const };

    const connection = await getConnection();
    if (!connection) return { state: "not-connected" as const };
    const accessToken = await refreshSpotifyAccessToken(connection.encrypted_refresh_token);
    return { state: "ready" as const, playback: await getSpotifyPlayback(accessToken) };
  });

export const controlPersonalSpotifyPlayback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ControlSchema.parse(input))
  .handler(async ({ data }) => {
    assertSpotifyPersonalIntegrationEnabled();
    assertPassengerConsoleSession();
    await controlSpotifyPlayback(await getAccessToken(), data.command);
    return { ok: true };
  });

export const setPersonalSpotifyRepeatMode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RepeatModeSchema.parse(input))
  .handler(async ({ data }) => {
    assertSpotifyPersonalIntegrationEnabled();
    assertPassengerConsoleSession();
    await setSpotifyRepeatMode(await getAccessToken(), data.mode);
    return { ok: true };
  });

export const searchPersonalSpotifyTracks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchSchema.parse(input))
  .handler(async ({ data }) => {
    assertSpotifyPersonalIntegrationEnabled();
    assertPassengerConsoleSession();
    return {
      tracks: await searchSpotifyTracks(
        await getSpotifyCatalogAccessToken(),
        data.query,
        data.limit,
        data.market,
      ),
    };
  });

export const getPersonalSpotifyPlaylistArtwork = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmptySchema.parse(input))
  .handler(async () => {
    assertSpotifyPersonalIntegrationEnabled();
    assertPassengerConsoleSession();
    return {
      playlists: await getSpotifyPlaylistArtwork([
        "37i9dQZEVXbLRQDuF5jeBp",
        "37i9dQZEVXbMDoHDwVN2tF",
        "37i9dQZF1DXcBWIGoYBM5M",
      ]),
    };
  });

export const playPersonalSpotifyTrack = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PlayTrackSchema.parse(input))
  .handler(async ({ data }) => {
    assertSpotifyPersonalIntegrationEnabled();
    assertPassengerConsoleSession();
    await playSpotifyTrack(await getAccessToken(), data.uri, data.albumUri);
    return { ok: true };
  });
