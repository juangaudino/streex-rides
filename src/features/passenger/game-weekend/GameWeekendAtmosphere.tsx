import { memo, useEffect, useRef } from "react";
import { Flag } from "lucide-react";
import "./game-weekend.css";
export const GameWeekendAtmosphere = memo(function GameWeekendAtmosphere({
  paused = false,
  surface,
}: {
  paused?: boolean;
  surface: "home" | "music" | "idle";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      if (ref.current) ref.current.dataset.paused = String(paused || document.hidden);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [paused]);
  return (
    <div className="gw-atmosphere" data-surface={surface} ref={ref} aria-hidden="true">
      <img src="/passenger-game-weekend/stadium.svg" alt="" decoding="async" />
      <div className="gw-atmosphere-shade" />
      <div className="gw-light-sweep" />
      <div className="gw-air-particles">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={{ left: `${12 + i * 16}%`, animationDelay: `${-i * 3}s` }} />
        ))}
      </div>
    </div>
  );
});
export function GameWeekendMark({ language }: { language: "en" | "es" }) {
  return (
    <span className="gw-edition-mark">
      <Flag size={22} />
      <span>
        <strong>Utes Game Weekend</strong>
        <small>
          {language === "es"
            ? "UTAH vs BYU · Dos juegos exclusivos"
            : "UTAH vs BYU · Two exclusive games"}
        </small>
      </span>
    </span>
  );
}
