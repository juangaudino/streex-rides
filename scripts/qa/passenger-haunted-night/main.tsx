import { createRoot } from "react-dom/client";
import { prepareLocalFixture, readLocalConfig } from "./fixtures";
import "@/styles.css";
import hauntedStyles from "@/features/passenger/haunted-night.css?raw";
import huntStyles from "@/features/passenger/midnight-hunt.css?raw";

const root = createRoot(document.getElementById("root")!);
const params = new URLSearchParams(window.location.search);
if (params.get("clock") !== "live") {
  const NativeDate = window.Date;
  const fixed = new NativeDate("2026-11-01T01:07:00Z").getTime();
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
if (params.get("lifecycle") === "1") {
  // Local-only platform fixtures exercise the real game's effects without native OS control.
  const intervals = new Set<number>();
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const report = () => {
    document.documentElement.dataset.qaHuntTimers = String(intervals.size);
  };
  window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    const id = nativeSetInterval(handler, delay, ...args);
    if (delay === 200) {
      intervals.add(id);
      report();
    }
    return id;
  }) as typeof window.setInterval;
  window.clearInterval = (id?: number) => {
    if (id !== undefined) intervals.delete(id);
    report();
    nativeClearInterval(id);
  };
  report();
  let hidden = false;
  const visibility = document.createElement("button");
  visibility.textContent = "Simulate app hidden";
  visibility.style.cssText =
    "position:fixed;right:14px;bottom:6px;z-index:999;background:#282032;color:white;padding:8px;font-size:10px;border:1px solid #9977bb;border-radius:8px";
  visibility.onclick = () => {
    hidden = !hidden;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    visibility.textContent = hidden ? "Simulate app visible" : "Simulate app hidden";
    document.dispatchEvent(new Event("visibilitychange"));
  };
  document.body.append(visibility);
}

if (params.get("motion") === "reduce") {
  // Execute the exact media-rule declarations as a local preference fixture.
  // This is not an emulation of the OS preference; the report keeps that distinction.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(hauntedStyles + "\n" + huntStyles);
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
