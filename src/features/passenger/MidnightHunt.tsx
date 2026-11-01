import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
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
import "./midnight-hunt.css";

const words = {
  en: {
    edition: "A Haunted Night exclusive",
    title: "Midnight Hunt",
    subtitle: "Five lost spirits. One minute before midnight.",
    story: "The gate opens for those who bring back the light.",
    instructions: "Move your lantern. Tap the five hidden spirits to open the gate.",
    start: "Enter the hunt",
    duration: "60 seconds",
    touch: "Touch to discover",
    sound: "Your music keeps playing",
    playing: "Find the lost spirits",
    hint: "Explore with your lantern · Tap a spirit to collect it",
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
    instructions: "Mueve tu linterna. Toca los cinco espíritus ocultos para abrir la puerta.",
    start: "Comenzar la caza",
    duration: "60 segundos",
    touch: "Toca para descubrir",
    sound: "Tu música sigue sonando",
    playing: "Encuentra los espíritus",
    hint: "Explora con tu linterna · Toca un espíritu para recogerlo",
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
  const [state, dispatch] = useReducer(huntReducer, undefined, createHuntState);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const scene = useRef<HTMLElement>(null);
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
    dispatch({ type: "start", spirits: createHuntSpirits(), now: performance.now() });
    onStart();
  };
  const moveLantern = (event: PointerEvent<HTMLElement>) => {
    if (state.phase !== "playing" || !scene.current) return;
    const rect = scene.current.getBoundingClientRect();
    scene.current.style.setProperty("--lantern-x", `${event.clientX - rect.left}px`);
    scene.current.style.setProperty("--lantern-y", `${event.clientY - rect.top}px`);
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
      onPointerDown={moveLantern}
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
          <div className="midnight-spirits">
            {state.spirits.map((spirit) => (
              <button
                key={spirit.id}
                className="midnight-spirit"
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
                onClick={() => dispatch({ type: "collect", id: spirit.id, now: performance.now() })}
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
                    {seconds} {t.left}
                  </small>
                )}
              </span>
            </div>
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
        </div>
      )}
    </section>
  );
}
