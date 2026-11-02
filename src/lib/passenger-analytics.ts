export const PASSENGER_ANALYTICS_EVENT_NAMES = [
  "session_started",
  "engagement_started",
  "engagement_ended",
  "first_interaction",
  "screen_viewed",
  "music_opened",
  "music_action",
  "game_opened",
  "game_started",
  "game_completed",
  "idle_entered",
  "idle_resumed",
  "logical_rest_entered",
  "logical_rest_resumed",
  "phone_continuation_opened",
] as const;

export const PASSENGER_ANALYTICS_SCREENS = [
  "home",
  "music",
  "games",
  "streex",
  "meet_juan",
  "services",
  "contact",
  "reviews",
  "tip",
  "where_we_ride",
  "around_you",
  "idle",
] as const;

export const PASSENGER_ANALYTICS_ELEMENTS = [
  "console",
  "navigation",
  "music",
  "music_playback",
  "game",
  "idle",
  "logical_rest",
  "phone_qr",
  "streex_action",
] as const;

export const PASSENGER_GAME_IDS = [
  "trivia",
  "choice",
  "higher-lower",
  "midnight-hunt",
  "touchdown-drive",
  "rivalry-trivia",
] as const;
export const PASSENGER_ANALYTICS_ENGAGEMENT_SOURCES = [
  "initial_interaction",
  "idle_resume",
  "test_control",
] as const;
export const PASSENGER_ANALYTICS_ENGAGEMENT_END_REASONS = [
  "idle",
  "logical_rest",
  "pagehide",
] as const;

export type PassengerAnalyticsEventName = (typeof PASSENGER_ANALYTICS_EVENT_NAMES)[number];
export type PassengerAnalyticsScreen = (typeof PASSENGER_ANALYTICS_SCREENS)[number];
export type PassengerAnalyticsElement = (typeof PASSENGER_ANALYTICS_ELEMENTS)[number];
export type PassengerGameId = (typeof PASSENGER_GAME_IDS)[number];
export type PassengerAnalyticsEngagementSource =
  (typeof PASSENGER_ANALYTICS_ENGAGEMENT_SOURCES)[number];
export type PassengerAnalyticsEngagementEndReason =
  (typeof PASSENGER_ANALYTICS_ENGAGEMENT_END_REASONS)[number];

export type PassengerAnalyticsMetadata = {
  game?: PassengerGameId;
  source?: "idle" | "navigation" | "home" | "test_control";
  action?: "play" | "pause" | "next" | "search" | "top_50" | "vibes";
};

export type PassengerAnalyticsEvent = {
  id: string;
  name: PassengerAnalyticsEventName;
  screen: PassengerAnalyticsScreen;
  element: PassengerAnalyticsElement;
  occurredAt: string;
  durationMs?: number;
  metadata?: PassengerAnalyticsMetadata;
  engagementId?: string;
};

export type PassengerAnalyticsSession = {
  id: string;
  deviceInstallationId: string;
  startedAt: string;
  lastActiveAt: string;
  activeDurationMs: number;
  interactionCount: number;
};

export type PassengerAnalyticsEngagement = {
  id: string;
  deviceInstallationId: string;
  entryScreen: PassengerAnalyticsScreen;
  entrySource: PassengerAnalyticsEngagementSource;
  startedAt: string;
  lastActiveAt: string;
  endedAt?: string;
  endedBy?: PassengerAnalyticsEngagementEndReason;
  activeDurationMs: number;
  interactionCount: number;
};

export const PASSENGER_ANALYTICS_QUEUE_LIMIT = 100;
export const PASSENGER_ANALYTICS_QUEUE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const PASSENGER_ANALYTICS_ENGAGEMENT_QUEUE_LIMIT = 25;
