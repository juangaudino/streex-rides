/** Manual, reversible seasonal pilot. B01 scheduling and theme registry remain deferred. */
export const PASSENGER_VISUAL_THEMES = ["original", "accent", "halloween", "utes-weekend"] as const;
export type PassengerVisualTheme = (typeof PASSENGER_VISUAL_THEMES)[number];

type ThemeConfig = {
  experienceMode: "lite" | "complete";
  liteTheme: "original" | "accent";
  visualTheme?: unknown;
};

export function isPassengerVisualTheme(value: unknown): value is PassengerVisualTheme {
  return PASSENGER_VISUAL_THEMES.some((theme) => theme === value);
}

export function getLegacyPassengerTheme(config: ThemeConfig): "original" | "accent" {
  return config.experienceMode === "lite" ? config.liteTheme : "original";
}

export function getPassengerVisualTheme(config: ThemeConfig): PassengerVisualTheme {
  return isPassengerVisualTheme(config.visualTheme)
    ? config.visualTheme
    : getLegacyPassengerTheme(config);
}

export function getPassengerThemePresentation(config: ThemeConfig, view: string, idle: boolean) {
  const selected = getPassengerVisualTheme(config);
  const baseline = getLegacyPassengerTheme(config);
  const surface = idle ? "idle" : view === "home" || view === "music" ? view : null;
  return {
    // Games and every other excluded surface retain their pre-pilot palette.
    baseTheme:
      !surface || selected === "halloween" || selected === "utes-weekend" ? baseline : selected,
    hauntedSurface: selected === "halloween" ? surface : null,
    ...(selected === "utes-weekend" ? { gameWeekendSurface: surface } : {}),
  };
}

/** Explicit seasonal exceptions; other selections preserve the regular Games experience. */
export function getPassengerSeasonalGame(
  config: ThemeConfig,
): "midnight-hunt" | "game-weekend" | null {
  const theme = getPassengerVisualTheme(config);
  return theme === "halloween" ? "midnight-hunt" : theme === "utes-weekend" ? "game-weekend" : null;
}
