import { describe, expect, test } from "bun:test";
import { CONFIG } from "../src/config.ts";
import {
  getPassengerThemePresentation,
  getPassengerSeasonalGame,
  getPassengerVisualTheme,
} from "../src/lib/passenger-visual-theme.ts";
import {
  mergeSiteConfig,
  parseSiteConfigOverride,
  SiteConfigOverrideSchema,
} from "../src/lib/site-config.ts";

describe("Passenger manual Halloween pilot", () => {
  test("keeps the pre-pilot palette when selection is absent or invalid", () => {
    for (const experienceMode of ["lite", "complete"]) {
      for (const visualTheme of [undefined, null, "unknown", "", 42, {}]) {
        const config = { ...CONFIG.passengerConsole, experienceMode, visualTheme };
        expect(getPassengerVisualTheme(config)).toBe(
          experienceMode === "lite" ? "accent" : "original",
        );
      }
    }
  });

  test("persists the manual theme independently of mode through the existing JSON contract", () => {
    for (const experienceMode of ["lite", "complete"]) {
      for (const visualTheme of ["original", "accent", "halloween"]) {
        const saved = SiteConfigOverrideSchema.parse({
          passengerConsole: { experienceMode, visualTheme },
        });
        const restored = mergeSiteConfig(CONFIG, parseSiteConfigOverride(JSON.stringify(saved)));
        expect(restored.passengerConsole.experienceMode).toBe(experienceMode);
        expect(getPassengerVisualTheme(restored.passengerConsole)).toBe(visualTheme);
        expect(restored.passengerConsole.music).toEqual(CONFIG.passengerConsole.music);
        expect(restored.passengerConsole.idleReset).toEqual(CONFIG.passengerConsole.idleReset);
      }
    }
  });

  test("a damaged theme value does not discard unrelated saved settings", () => {
    const saved = parseSiteConfigOverride(
      JSON.stringify({
        tagline: "Keep this saved tagline",
        passengerConsole: { experienceMode: "complete", visualTheme: "bad-theme" },
      }),
    );
    const config = mergeSiteConfig(CONFIG, saved);
    expect(config.tagline).toBe("Keep this saved tagline");
    expect(config.passengerConsole.experienceMode).toBe("complete");
    expect(getPassengerVisualTheme(config.passengerConsole)).toBe("original");
  });

  test("keeps the shared atmosphere on Home, Music and Idle in both modes", () => {
    for (const experienceMode of ["lite", "complete"]) {
      const config = { ...CONFIG.passengerConsole, experienceMode, visualTheme: "halloween" };
      expect(getPassengerThemePresentation(config, "home", false).hauntedSurface).toBe("home");
      expect(getPassengerThemePresentation(config, "music", false).hauntedSurface).toBe("music");
      expect(getPassengerThemePresentation(config, "home", true).hauntedSurface).toBe("idle");
      for (const view of ["games", "streex", "around-you", "tip", "services", "reviews"]) {
        expect(getPassengerThemePresentation(config, view, false)).toEqual({
          baseTheme: experienceMode === "lite" ? "accent" : "original",
          hauntedSurface: null,
        });
      }
    }
  });

  test("replaces Games only for explicit Halloween selection and restores normal games in both modes", () => {
    for (const experienceMode of ["lite", "complete"]) {
      for (const visualTheme of ["original", "accent", null, undefined, "unknown"]) {
        expect(
          getPassengerSeasonalGame({ ...CONFIG.passengerConsole, experienceMode, visualTheme }),
        ).toBeNull();
      }
      expect(
        getPassengerSeasonalGame({
          ...CONFIG.passengerConsole,
          experienceMode,
          visualTheme: "halloween",
        }),
      ).toBe("midnight-hunt");
    }
  });

  test("restores the selected existing palette without any Halloween presentation", () => {
    for (const visualTheme of ["original", "accent"]) {
      const config = { ...CONFIG.passengerConsole, visualTheme };
      for (const view of ["home", "music"]) {
        expect(getPassengerThemePresentation(config, view, false)).toEqual({
          baseTheme: visualTheme,
          hauntedSurface: null,
        });
      }
      expect(getPassengerThemePresentation(config, "home", true)).toEqual({
        baseTheme: visualTheme,
        hauntedSurface: null,
      });
    }
  });
});
