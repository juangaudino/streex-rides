import { describe, expect, test } from "bun:test";
import { resolveIdleScreenTap } from "../src/features/passenger/idle-screen-dim.ts";

describe("Passenger idle screen dimming", () => {
  test("consumes the first tap only to wake the dimmed screen", () => {
    expect(resolveIdleScreenTap(true)).toEqual({ dimmed: false, resume: false });
  });

  test("preserves normal tap-to-resume behavior while the screen is bright", () => {
    expect(resolveIdleScreenTap(false)).toEqual({ dimmed: false, resume: true });
  });
});
