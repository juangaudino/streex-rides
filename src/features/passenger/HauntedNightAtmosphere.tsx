import { memo, useEffect, useRef, type CSSProperties } from "react";
import "./haunted-night.css";

const embers = [
  [5, 83, 0, 19],
  [14, 91, 4, 23],
  [26, 94, 8, 21],
  [41, 97, 2, 26],
  [58, 93, 12, 22],
  [69, 98, 6, 28],
  [81, 89, 10, 24],
  [91, 95, 3, 20],
] as const;

export const HauntedNightAtmosphere = memo(function HauntedNightAtmosphere({
  surface,
  paused = false,
}: {
  surface: "home" | "music" | "idle";
  paused?: boolean;
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
    <div
      ref={ref}
      className="haunted-night-atmosphere"
      data-haunted-decoration="atmosphere"
      data-surface={surface}
      aria-hidden="true"
    >
      <img
        className="haunted-night-scene"
        src="/passenger-haunted-night/haunted-road.webp"
        alt=""
        decoding="async"
      />
      <div className="haunted-night-vignette" />
      <div className="haunted-night-arrival" />
      <div className="haunted-night-halo" />
      <div className="haunted-night-mist haunted-night-mist--near" />
      <div className="haunted-night-mist haunted-night-mist--far" />
      <div className="haunted-night-embers">
        {embers.map(([left, top, delay, duration], index) => (
          <span
            key={index}
            className="haunted-night-ember"
            style={
              {
                left: `${left}%`,
                top: `${top}%`,
                "--ember-delay": `${-delay}s`,
                "--ember-duration": `${duration}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="haunted-night-flight">
        {[0, 1, 2].map((bat) => (
          <span key={bat} className={`haunted-night-bat haunted-night-bat--${bat}`}>
            <svg viewBox="0 0 80 32" fill="currentColor">
              <path d="M40 14 35 8l-1 8C24 8 12 6 1 5c3 8 5 15 4 23 8-7 14-8 19-2 6-6 10-7 16-2 6-5 10-4 16 2 5-6 11-5 19 2-1-8 1-15 4-23-11 1-23 3-33 11l-1-8-5 6Z" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
});

export function HauntedEditionMark({ language }: { language: "en" | "es" }) {
  return (
    <span className="haunted-night-edition" data-haunted-decoration="edition">
      <span className="haunted-night-edition-moon" aria-hidden="true" />
      <span>
        <strong>Haunted Night</strong>
        <small>{language === "es" ? "Edición de Halloween" : "Halloween Edition"}</small>
      </span>
    </span>
  );
}
