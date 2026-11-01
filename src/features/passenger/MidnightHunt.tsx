import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type MouseEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Flashlight,
  Moon,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
} from "lucide-react";
import {
  createHuntSpirits,
  createHuntState,
  huntReducer,
  MIDNIGHT_HUNT_SPIRITS,
} from "./midnight-hunt";
import {
  createHuntLanternTracker,
  HUNT_LANTERN_RADIUS,
  type LanternPoint,
} from "./midnight-lantern";
import "./midnight-hunt.css";

const words = {
  en: {
    edition: "A Haunted Night exclusive",
    title: "Midnight Hunt",
    subtitle: "Five lost spirits. One minute before midnight.",
    story: "The gate opens for those who bring back the light.",
    instructions: "Drag to search. Tap the illuminated spirits to open the gate.",
    start: "Enter the hunt",
    duration: "60 seconds",
    touch: "Touch to discover",
    sound: "Your music keeps playing",
    playing: "Find the lost spirits",
    hint: "Drag to search · Tap illuminated spirits",
    found: "spirits found",
    pause: "Pause hunt",
    paused: "The night can wait.",
    pauseHint: "Your hunt is paused. Return when you’re ready.",
    resume: "Continue hunting",
    won: "You brought back the light.",
    lost: "Some mysteries remain.",
    wonDetail: "The gate is open. The night is yours.",
    lostDetail: "The forest keeps its secrets. Try another path.",
    again: "Hunt again",
    music: "Back to Music",
    spirit: "Collect spirit",
    time: "Time remaining",
    left: "seconds left",
    leave: "Leave hunt",
  },
  es: {
    edition: "Exclusivo de Haunted Night",
    title: "Caza de Medianoche",
    subtitle: "Cinco espíritus perdidos. Un minuto antes de medianoche.",
    story: "La puerta se abre para quienes devuelven la luz.",
    instructions: "Desliza para buscar. Toca los espíritus iluminados para abrir la puerta.",
    start: "Comenzar la caza",
    duration: "60 segundos",
    touch: "Toca para descubrir",
    sound: "Tu música sigue sonando",
    playing: "Encuentra los espíritus",
    hint: "Desliza para buscar · Toca los espíritus iluminados",
    found: "espíritus encontrados",
    pause: "Pausar partida",
    paused: "La noche puede esperar.",
    pauseHint: "Tu partida está en pausa. Continúa cuando quieras.",
    resume: "Continuar la caza",
    won: "Has devuelto la luz.",
    lost: "Aún quedan misterios.",
    wonDetail: "La puerta está abierta. La noche es tuya.",
    lostDetail: "El bosque guarda sus secretos. Prueba otro camino.",
    again: "Volver a jugar",
    music: "Volver a Música",
    spirit: "Recoger espíritu",
    time: "Tiempo restante",
    left: "segundos restantes",
    leave: "Salir del juego",
  },
};

import {
  readHuntRecords,
  saveHuntRecord,
  formatHuntTime,
  type HuntRecord,
} from "./midnight-records";
let previousHuntLayout: ReturnType<typeof createHuntSpirits> = [];

function SpiritMark() {
  return (
    <svg viewBox="0 0 32 44" aria-hidden="true" className="midnight-spirit-art">
      <path
        d="M18 2C28 15 8 18 22 26c-1-7 5-8 6-13 7 18-1 28-12 28S-2 28 7 18c-1 8 4 8 4 8C7 14 20 13 18 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MidnightHunt({
  language,
  onOpened,
  onStart,
  onComplete,
  onMusic,
}: {
  language: "en" | "es";
  onOpened: () => void;
  onStart: () => void;
  onComplete: () => void;
  onMusic: () => void;
}) {
  const t = words[language];
  const es = language === "es";
  const [records, setRecords] = useState<HuntRecord[]>([]);
  const [nickname, setNickname] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const savedRound = useRef(0);
  useEffect(() => {
    try {
      setRecords(readHuntRecords(window.localStorage));
    } catch {
      /* Storage unavailable: gameplay remains available. */
    }
  }, []);
  const [state, dispatch] = useReducer(huntReducer, undefined, createHuntState);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const scene = useRef<HTMLElement>(null);
  const spiritLayer = useRef<HTMLDivElement>(null);
  const lantern = useRef<ReturnType<typeof createHuntLanternTracker> | null>(null);
  if (!lantern.current) lantern.current = createHuntLanternTracker();
  const lanternPoint = useRef<LanternPoint | null>(null);
  const pointerOrigin = useRef<LanternPoint | null>(null);
  const callbacks = useRef({ onOpened, onComplete });
  const opened = useRef(false);
  const completedRound = useRef(0);
  useEffect(() => {
    callbacks.current = { onOpened, onComplete };
  }, [onOpened, onComplete]);
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      callbacks.current.onOpened();
    }
    const visibility = () => {
      setHidden(document.hidden);
      if (document.hidden) dispatch({ type: "pause", now: performance.now() });
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    if (state.phase !== "playing") return;
    const timer = window.setInterval(() => dispatch({ type: "tick", now: performance.now() }), 200);
    return () => window.clearInterval(timer);
  }, [state.phase]);
  useEffect(() => {
    if (state.phase === "finished" && completedRound.current !== state.round) {
      completedRound.current = state.round;
      callbacks.current.onComplete();
    }
  }, [state.phase, state.round]);

  const start = () => {
    if (document.hidden) return;
    lantern.current!.reset();
    lanternPoint.current = null;
    pointerOrigin.current = null;
    scene.current?.style.setProperty("--lantern-x", "-1000px");
    scene.current?.style.setProperty("--lantern-y", "-1000px");
    previousHuntLayout = createHuntSpirits(Math.random, previousHuntLayout);
    setNickname("");
    setSaved(false);
    setSaveError(false);
    dispatch({ type: "start", spirits: previousHuntLayout, now: performance.now() });
    onStart();
  };
  const syncDiscovery = (now: number) => {
    if (!scene.current) return;
    lantern.current!.update(
      lanternPoint.current,
      state.spirits.filter((s) => !state.found.includes(s.id)),
      {
        width: scene.current.clientWidth,
        height: scene.current.clientHeight,
      },
      now,
    );
    spiritLayer.current?.querySelectorAll<HTMLElement>("[data-spirit-id]").forEach((button) => {
      button.dataset.illuminated = String(
        lantern.current!.isIlluminated(Number(button.dataset.spiritId)),
      );
    });
  };
  const placeLantern = (point: LanternPoint) => {
    if (!scene.current) return;
    lanternPoint.current = point;
    scene.current.style.setProperty("--lantern-x", `${point.x}px`);
    scene.current.style.setProperty("--lantern-y", `${point.y}px`);
    syncDiscovery(performance.now());
  };
  const pointerPoint = (event: PointerEvent<HTMLElement>) => {
    const board = scene.current!;
    const rect = board.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - board.clientLeft,
      y: event.clientY - rect.top - board.clientTop,
    };
  };
  const beginLantern = (event: PointerEvent<HTMLElement>) => {
    if (state.phase !== "playing" || !scene.current) return;
    if (!event.isPrimary) {
      lantern.current!.cancelPointer();
      return;
    }
    const target = event.target as Element;
    if (target.closest(".midnight-hud")) return;
    syncDiscovery(performance.now());
    const button = target.closest<HTMLElement>("[data-spirit-id]");
    lantern.current!.beginPointer(
      button ? Number(button.dataset.spiritId) : null,
      performance.now(),
    );
    pointerOrigin.current = pointerPoint(event);
    placeLantern(pointerOrigin.current);
  };
  const moveLantern = (event: PointerEvent<HTMLElement>) => {
    if (state.phase !== "playing" || !scene.current || !event.isPrimary) return;
    if ((event.target as Element).closest(".midnight-hud")) return;
    const point = pointerPoint(event);
    if (
      pointerOrigin.current &&
      Math.hypot(point.x - pointerOrigin.current.x, point.y - pointerOrigin.current.y) > 12
    )
      lantern.current!.markDrag();
    placeLantern(point);
  };
  const collectSpirit = (id: number, event: MouseEvent<HTMLButtonElement>) => {
    if (state.phase !== "playing" || document.hidden) return;
    const now = performance.now();
    syncDiscovery(now);
    const allowed =
      event.detail === 0 && event.currentTarget.matches(":focus-visible")
        ? lantern.current!.canCollect(id, now)
        : lantern.current!.canCollectPointer(id, now);
    lantern.current!.cancelPointer();
    pointerOrigin.current = null;
    if (allowed) dispatch({ type: "collect", id, now });
  };
  const seconds = Math.ceil(state.remainingMs / 1000);
  const won = state.found.length === MIDNIGHT_HUNT_SPIRITS;
  return (
    <section
      ref={scene}
      className="midnight-hunt"
      data-phase={state.phase}
      data-won={won}
      data-paused={hidden || state.phase === "paused"}
      aria-label={t.title}
      onPointerMove={moveLantern}
      onPointerDownCapture={beginLantern}
      onPointerCancel={() => {
        lantern.current!.cancelPointer();
        pointerOrigin.current = null;
      }}
      style={{ "--lantern-radius": `${HUNT_LANTERN_RADIUS}px` } as CSSProperties}
    >
      <link rel="preload" as="image" href="/passenger-haunted-night/midnight-spirit.webp" />
      <img
        className="midnight-scene"
        src="/passenger-haunted-night/midnight-gate.webp"
        alt=""
        aria-hidden="true"
      />
      <div className="midnight-scene-shade" aria-hidden="true" />
      <div className="midnight-gate-light" aria-hidden="true" />
      <div className="midnight-ground-mist" aria-hidden="true" />
      <div className="midnight-motes" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={{ "--mote": i } as CSSProperties} />
        ))}
      </div>

      {state.phase === "intro" && (
        <div className="midnight-intro">
          <span className="midnight-eyebrow">
            <Moon size={16} /> {t.edition}
          </span>
          <h1>
            {language === "en" ? (
              <>
                Midnight
                <br />
                <em>Hunt.</em>
              </>
            ) : (
              <>
                Caza de
                <br />
                <em>Medianoche.</em>
              </>
            )}
          </h1>
          <p className="midnight-tagline">{t.subtitle}</p>
          <p className="midnight-story">{t.instructions}</p>
          <button className="midnight-primary" onClick={start}>
            <Flashlight size={21} />
            {t.start}
            <ArrowRight size={20} />
          </button>
          <div className="midnight-facts">
            <span>
              <Timer size={15} />
              {t.duration}
            </span>
            <span>
              <Sparkles size={15} />
              {t.touch}
            </span>
          </div>
          <span className="midnight-music-note">
            <Music2 size={14} />
            {t.sound}
          </span>
        </div>
      )}

      {(state.phase === "playing" || state.phase === "paused") && (
        <>
          <div ref={spiritLayer} className="midnight-spirits">
            {state.spirits.map((spirit) => (
              <button
                key={`${state.round}-${spirit.id}`}
                className="midnight-spirit"
                data-spirit-id={spirit.id}
                data-illuminated="false"
                data-found={state.found.includes(spirit.id)}
                style={
                  {
                    left: `${spirit.x}%`,
                    top: `${spirit.y}%`,
                    "--spirit-delay": `${-spirit.id * 0.7}s`,
                  } as CSSProperties
                }
                aria-label={`${t.spirit} ${spirit.id + 1}`}
                disabled={state.phase !== "playing" || state.found.includes(spirit.id)}
                onFocus={(event) => {
                  if (
                    !event.currentTarget.matches(":focus-visible") ||
                    !scene.current ||
                    state.phase !== "playing"
                  )
                    return;
                  placeLantern({
                    x: (spirit.x * scene.current.clientWidth) / 100,
                    y: (spirit.y * scene.current.clientHeight) / 100,
                  });
                }}
                onClick={(event) => collectSpirit(spirit.id, event)}
              >
                <img
                  className="midnight-spirit-art"
                  src="/passenger-haunted-night/midnight-spirit.webp"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
                <span className="midnight-spirit-ring" />
              </button>
            ))}
          </div>
          <div className="midnight-lantern" aria-hidden="true" />
          <div className="midnight-hud">
            <div className="midnight-hud-title">
              <span className="midnight-eyebrow">Midnight Hunt</span>
              <strong>{t.playing}</strong>
            </div>
            <div className="midnight-progress" aria-label={`${state.found.length} / 5 ${t.found}`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} data-lit={i < state.found.length}>
                  <SpiritMark />
                </span>
              ))}
              <small>{state.found.length} / 5</small>
            </div>
            <div className="midnight-hud-controls">
              <span
                className="midnight-timer"
                data-warning={seconds <= 10}
                aria-label={`${t.time}: ${seconds}`}
              >
                <Timer size={17} />
                {String(seconds).padStart(2, "0")}
                <small>s</small>
              </span>
              <button
                className="midnight-icon-button"
                aria-label={t.pause}
                disabled={state.phase !== "playing"}
                onClick={() => dispatch({ type: "pause", now: performance.now() })}
              >
                <Pause size={20} />
              </button>
            </div>
          </div>
          <p className="midnight-instruction">
            <Flashlight size={17} />
            {t.hint}
          </p>
          <span className="midnight-announcement" role="status" aria-live="polite">
            {state.found.length} / 5 {t.found}
          </span>
        </>
      )}

      {state.phase === "paused" && (
        <div className="midnight-overlay">
          <div className="midnight-result">
            <Moon className="midnight-result-moon" size={36} />
            <h2>{t.paused}</h2>
            <p>{t.pauseHint}</p>
            <button
              className="midnight-primary"
              onClick={() => {
                if (!document.hidden) dispatch({ type: "resume", now: performance.now() });
              }}
            >
              <Play size={19} />
              {t.resume}
            </button>
            <button className="midnight-secondary" onClick={onMusic}>
              <ArrowLeft size={16} />
              {t.leave}
            </button>
          </div>
        </div>
      )}

      {state.phase === "finished" && (
        <div className="midnight-finale">
          <div className="midnight-result">
            <span className="midnight-eyebrow">
              <Sparkles size={16} />
              {won ? "MIDNIGHT KEEPER" : "NIGHT EXPLORER"}
            </span>
            <h2>{won ? t.won : t.lost}</h2>
            <p>{won ? t.wonDetail : t.lostDetail}</p>
            <div className="midnight-result-score">
              <strong>
                {state.found.length}
                <small> / 5</small>
              </strong>
              <span>
                {t.found}
                {won && (
                  <small>
                    {formatHuntTime(60_000 - state.remainingMs)} ·{" "}
                    {es ? "tiempo total" : "finish time"}
                  </small>
                )}
              </span>
            </div>
            {won && !saved && (
              <form
                className="midnight-record-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (savedRound.current === state.round) return;
                  let next: HuntRecord[] | null = null;
                  try {
                    next = saveHuntRecord(window.localStorage, {
                      name: nickname.trim() || (es ? "Invitado" : "Guest"),
                      elapsedMs: Math.round(60_000 - state.remainingMs),
                    });
                  } catch {
                    /* Do not block replay. */
                  }
                  if (next) {
                    savedRound.current = state.round;
                    setRecords(next);
                    setSaved(true);
                    setSaveError(false);
                  } else setSaveError(true);
                }}
              >
                <label htmlFor="midnight-nickname">
                  {es ? "Tu apodo (opcional)" : "Your nickname (optional)"}
                </label>
                <div>
                  <input
                    id="midnight-nickname"
                    value={nickname}
                    maxLength={20}
                    autoComplete="off"
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder={es ? "Invitado" : "Guest"}
                  />
                  <button className="midnight-primary" type="submit">
                    {es ? "Guardar tiempo" : "Save time"}
                  </button>
                </div>
              </form>
            )}
            <p role="status" className="midnight-save-status">
              {saved
                ? es
                  ? "Tiempo guardado en esta tablet."
                  : "Time saved on this tablet."
                : saveError
                  ? es
                    ? "No se pudo guardar aquí. Puedes seguir jugando."
                    : "Storage unavailable. You can keep playing."
                  : ""}
            </p>
            <div className="midnight-result-actions">
              <button className="midnight-primary" onClick={start}>
                <RotateCcw size={18} />
                {t.again}
              </button>
              <button className="midnight-secondary" onClick={onMusic}>
                <Music2 size={18} />
                {t.music}
              </button>
            </div>
          </div>
          <aside
            className="midnight-leaderboard"
            aria-label={es ? "Mejores tiempos" : "Best times"}
          >
            <span className="midnight-eyebrow">MIDNIGHT KEEPERS · TOP 10</span>
            <h3>{es ? "Los más rápidos de la noche" : "Fastest of the night"}</h3>
            <p>
              {es
                ? "Récords de esta tablet · Menos tiempo gana"
                : "This tablet’s records · Fastest time wins"}
            </p>
            {records.length ? (
              <ol>
                {records.map((record, index) => (
                  <li key={`${index}-${record.elapsedMs}`}>
                    <span>{index + 1}</span>
                    <strong>{record.name}</strong>
                    <time>{formatHuntTime(record.elapsedMs)}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                {es ? "Sé el primero en devolver la luz." : "Be the first to bring back the light."}
              </p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
