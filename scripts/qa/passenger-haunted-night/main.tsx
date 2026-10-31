import { createRoot } from "react-dom/client";
import { prepareLocalFixture, readLocalConfig } from "./fixtures";
import "@/styles.css";
import hauntedStyles from "@/features/passenger/haunted-night.css?raw";

const root = createRoot(document.getElementById("root")!);
const params = new URLSearchParams(window.location.search);
if (params.get("clock") !== "live") {
  const NativeDate = window.Date;
  const fixed = new NativeDate("2026-10-31T01:07:00Z").getTime();
  function QaDate(this: unknown, ...args: unknown[]) {
    if (!new.target) return new NativeDate(fixed).toString();
    return Reflect.construct(NativeDate, args.length ? args : [fixed], new.target);
  }
  Object.setPrototypeOf(QaDate, NativeDate);
  QaDate.prototype = NativeDate.prototype;
  Object.assign(QaDate, { now: () => fixed });
  window.Date = QaDate as unknown as DateConstructor;
}
prepareLocalFixture(params);
if (params.get("motion") === "reduce") {
  // Execute the exact media-rule declarations as a local preference fixture.
  // This is not an emulation of the OS preference; the report keeps that distinction.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(hauntedStyles);
  const reduced = [...sheet.cssRules].filter(
    (rule): rule is CSSMediaRule =>
      rule instanceof CSSMediaRule && rule.conditionText.includes("prefers-reduced-motion: reduce"),
  );
  const style = document.createElement("style");
  style.textContent = reduced
    .flatMap((rule) => [...rule.cssRules].map((child) => child.cssText))
    .join("\n");
  document.head.append(style);
  document.documentElement.dataset.qaMotion = "reduced-motion-rules-fixture";
}
if (params.get("still") === "1") {
  const still = document.createElement("style");
  still.textContent =
    "*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}";
  document.head.append(still);
}
const screen = params.get("screen");
if (screen === "admin") {
  const { AdminPanel } = await import("@/components/streex/AdminPanel");
  root.render(<AdminPanel initialTab="config" />);
} else {
  const { PassengerConsole } = await import("@/features/passenger/PassengerConsole");
  root.render(<PassengerConsole config={readLocalConfig()} />);
}
if (params.get("sample") === "1") {
  window.setTimeout(() => {
    const intervals: number[] = [];
    let start = 0;
    let previous = 0;
    const frame = (time: number) => {
      if (!start) start = time;
      if (previous) intervals.push(time - previous);
      previous = time;
      if (time - start < 5000) return requestAnimationFrame(frame);
      const sorted = [...intervals].sort((a, b) => a - b);
      document.documentElement.dataset.qaFrameSample = JSON.stringify({
        frames: intervals.length,
        meanMs: intervals.reduce((sum, n) => sum + n, 0) / intervals.length,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        longFrames: intervals.filter((n) => n > 50).length,
      });
    };
    requestAnimationFrame(frame);
  }, 1500);
}
