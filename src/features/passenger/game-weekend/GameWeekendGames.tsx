import { useEffect, useReducer, useRef, useState, type CSSProperties, type Dispatch } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Trophy,
  X,
} from "lucide-react";
import {
  createDrive,
  createTrivia,
  driveReducer,
  triviaReducer,
  openReceiver,
  FOOTBALL_ROUND_MS,
  type GamePhase,
} from "./football-engine";
import { createRivalryDeck, type ShuffledQuestion } from "./rivalry-questions";
import {
  readFootballRecords,
  saveFootballRecord,
  type FootballGame,
  type FootballRecord,
} from "./football-records";
import "./game-weekend.css";

type Lang = "en" | "es";
const now = () => performance.now();
function useGameClock(
  phase: GamePhase,
  dispatch: Dispatch<{ type: "tick" | "pause" | "resume"; now: number }>,
  onComplete: () => void,
) {
  const complete = useRef(false),
    callback = useRef(onComplete);
  useEffect(() => {
    callback.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    if (phase === "playing") complete.current = false;
    if (phase === "finished" && !complete.current) {
      complete.current = true;
      callback.current();
    }
    if (phase !== "playing") return;
    const timer = window.setInterval(() => dispatch({ type: "tick", now: now() }), 100);
    const hidden = () => {
      if (document.hidden) dispatch({ type: "pause", now: now() });
    };
    document.addEventListener("visibilitychange", hidden);
    hidden();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [phase, dispatch]);
}
function RivalryMatchupArt() {
  return (
    <div className="gw-rivalry-art" aria-hidden="true">
      <div className="gw-rivalry-team gw-rivalry-team--utah">
        <img className="gw-rivalry-logo" src="/passenger-game-weekend/utah-logo.svg" alt="" />
        <img
          className="gw-rivalry-mascot gw-rivalry-swoop"
          src="/passenger-game-weekend/swoop.png"
          alt=""
          decoding="async"
        />
        <span className="gw-rivalry-name">
          UTAH<small>UTES</small>
        </span>
      </div>
      <span className="gw-rivalry-versus">VS</span>
      <div className="gw-rivalry-team gw-rivalry-team--byu">
        <img className="gw-rivalry-logo" src="/passenger-game-weekend/byu-logo.svg" alt="" />
        <span className="gw-rivalry-cougar-plate">
          <img
            className="gw-rivalry-mascot"
            src="/passenger-game-weekend/cougar-head.svg"
            alt=""
            decoding="async"
          />
        </span>
        <span className="gw-rivalry-name">
          BYU<small>COUGARS</small>
        </span>
      </div>
    </div>
  );
}

function FootballIcon() {
  return (
    <svg viewBox="0 0 100 60" fill="none" aria-hidden="true">
      <path
        d="M5 30C20-5 80-5 95 30 80 65 20 65 5 30Z"
        fill="url(#pigskin)"
        stroke="#ffd9ca"
        strokeWidth="2"
      />
      <path
        d="m20 12 0 36M80 12v36M32 30h36M40 23v14m10-15v16m10-15v14"
        stroke="#fff1e7"
        strokeWidth="3"
      />
      <defs>
        <linearGradient id="pigskin" x2="70" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d07d52" />
          <stop offset="1" stopColor="#542419" />
        </linearGradient>
      </defs>
    </svg>
  );
}
export function GameWeekendGames({
  language,
  initialGame,
  onOpened,
  onStart,
  onComplete,
}: {
  language: Lang;
  initialGame: string | null;
  onOpened: (game: FootballGame) => void;
  onStart: (game: FootballGame) => void;
  onComplete: (game: FootballGame) => void;
}) {
  const [game, setGame] = useState<FootballGame | null>(() =>
    initialGame === "touchdown-drive" || initialGame === "rivalry-trivia" ? initialGame : null,
  );
  const es = language === "es";
  if (game)
    return game === "touchdown-drive" ? (
      <TouchdownDrive
        language={language}
        onExit={() => setGame(null)}
        onStart={() => onStart(game)}
        onComplete={() => onComplete(game)}
      />
    ) : (
      <RivalryTrivia
        language={language}
        onExit={() => setGame(null)}
        onStart={() => onStart(game)}
        onComplete={() => onComplete(game)}
      />
    );
  return (
    <section className="gw-hub gw-surface" aria-label="Game Weekend games">
      <div className="gw-hub-heading">
        <span className="gw-kicker">
          <Flag size={15} /> STREEX · UTES GAME WEEKEND
        </span>
        <h1>{es ? "Tu turno de hacer historia." : "Your turn to make a play."}</h1>
        <p>
          {es
            ? "Dos desafíos. Un gran fin de semana. Tu música sigue sonando."
            : "Two challenges. One big weekend. Your music keeps playing."}
        </p>
      </div>
      <div className="gw-game-cards">
        {(["touchdown-drive", "rivalry-trivia"] as const).map((id, index) => (
          <button
            key={id}
            className={`gw-game-card gw-game-card--${index}`}
            onClick={() => {
              onOpened(id);
              setGame(id);
            }}
          >
            <div className="gw-card-art" aria-hidden="true">
              {index === 0 ? (
                <>
                  <div className="gw-mini-field" />
                  <FootballIcon />
                  <span className="gw-art-word">TOUCHDOWN</span>
                </>
              ) : (
                <RivalryMatchupArt />
              )}
            </div>
            <div className="gw-card-info">
              <span className="gw-kicker">
                {index === 0
                  ? es
                    ? "HABILIDAD · 60 SEGUNDOS"
                    : "SKILL · 60 SECONDS"
                  : es
                    ? "8 PREGUNTAS · 60 SEGUNDOS"
                    : "8 QUESTIONS · 60 SECONDS"}
              </span>
              <h2>{index === 0 ? "Touchdown Drive" : "Rivalry Trivia"}</h2>
              <p>
                {index === 0
                  ? es
                    ? "Encuentra al receptor libre. Lanza. Anota."
                    : "Find the open receiver. Pass. Score."
                  : es
                    ? "Utah, BYU y el juego. ¿Cuánto sabes?"
                    : "Utah, BYU and the game. How much do you know?"}
              </p>
              <span className="gw-card-play">
                {es ? "Toca para jugar" : "Tap to play"}
                <ArrowRight size={20} />
              </span>
            </div>
          </button>
        ))}
      </div>
      <span className="gw-hub-foot">
        {es ? "Top 10 de esta tablet · Sin registro" : "This tablet’s Top 10 · No sign-up"}
      </span>
    </section>
  );
}
function GameTopBar({
  title,
  seconds,
  es,
  onPause,
  onExit,
}: {
  title: string;
  seconds: number;
  es: boolean;
  onPause: () => void;
  onExit: () => void;
}) {
  return (
    <header className={`gw-game-bar${title === "Rivalry Trivia" ? " gw-game-bar--rivalry" : ""}`}>
      <button
        className="gw-icon-button"
        onClick={onExit}
        aria-label={es ? "Volver a los juegos" : "Back to games"}
      >
        <ArrowLeft />
      </button>
      <div>
        <span className="gw-kicker">UTES GAME WEEKEND</span>
        <h2>{title}</h2>
      </div>
      {title === "Rivalry Trivia" ? (
        <span className="gw-rivalry-bug" aria-label="Utah Utes vs BYU Cougars">
          <img src="/passenger-game-weekend/utah-logo.svg" alt="Utah Utes" />
          <span>VS</span>
          <img src="/passenger-game-weekend/byu-logo.svg" alt="BYU Cougars" />
        </span>
      ) : null}
      <span className="gw-clock" data-warning={seconds <= 10}>
        {String(seconds).padStart(2, "0")}
        <small>s</small>
      </span>
      <button
        className="gw-icon-button"
        onClick={onPause}
        aria-label={es ? "Pausar" : "Pause game"}
      >
        <Pause />
      </button>
    </header>
  );
}
function Intro({
  title,
  es,
  description,
  onStart,
  onExit,
  trivia = false,
}: {
  title: string;
  es: boolean;
  description: string;
  onStart: () => void;
  onExit: () => void;
  trivia?: boolean;
}) {
  return (
    <section className="gw-intro gw-surface">
      <button className="gw-back" onClick={onExit}>
        <ArrowLeft size={18} />
        {es ? "Los dos juegos" : "Both games"}
      </button>
      <div className="gw-intro-content">
        <span className="gw-kicker">STREEX · GAME WEEKEND EXCLUSIVE</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="gw-rule-chips">
          <span>60 {es ? "segundos" : "seconds"}</span>
          <span>
            {trivia
              ? es
                ? "8 preguntas"
                : "8 questions"
              : es
                ? "4 pases = touchdown"
                : "4 passes = touchdown"}
          </span>
          <span>Top 10 {es ? "local" : "on this tablet"}</span>
        </div>
        <button className="gw-primary" onClick={onStart}>
          <Play size={20} />
          {es ? "Comenzar" : "Let’s play"}
        </button>
        <small>
          {es
            ? "Tu música sigue sonando. Sin sonidos añadidos."
            : "Your music keeps playing. No added audio."}
        </small>
      </div>
      <div
        className={`gw-intro-emblem${trivia ? " gw-intro-emblem--rivalry" : ""}`}
        aria-hidden="true"
      >
        {trivia ? (
          <RivalryMatchupArt />
        ) : (
          <>
            <FootballIcon />
            <b>
              MAKE
              <br />
              THE
              <br />
              PLAY.
            </b>
          </>
        )}
      </div>
    </section>
  );
}
function PauseOverlay({
  es,
  onResume,
  onExit,
}: {
  es: boolean;
  onResume: () => void;
  onExit: () => void;
}) {
  const resumeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    resumeRef.current?.focus();
  }, []);
  return (
    <div
      className="gw-pause"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gw-pause-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onResume();
        }
        if (event.key === "Tab") {
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
          if (event.shiftKey && document.activeElement === buttons[0]) {
            event.preventDefault();
            buttons[buttons.length - 1]?.focus();
          } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
            event.preventDefault();
            buttons[0]?.focus();
          }
        }
      }}
    >
      <span className="gw-kicker">TIMEOUT</span>
      <h2 id="gw-pause-title">{es ? "El campo puede esperar." : "The field can wait."}</h2>
      <p>{es ? "El reloj está detenido." : "Your clock is paused."}</p>
      <button ref={resumeRef} className="gw-primary" onClick={onResume}>
        <Play size={18} />
        {es ? "Continuar" : "Resume"}
      </button>
      <button className="gw-secondary" onClick={onExit}>
        {es ? "Volver a los juegos" : "Back to games"}
      </button>
    </div>
  );
}
function TouchdownDrive({
  language,
  onExit,
  onStart,
  onComplete,
}: {
  language: Lang;
  onExit: () => void;
  onStart: () => void;
  onComplete: () => void;
}) {
  const es = language === "es",
    [state, dispatch] = useReducer(driveReducer, undefined, createDrive);
  useGameClock(state.phase, dispatch, onComplete);
  const start = () => {
    if (document.hidden) return;
    dispatch({ type: "start", now: now(), seed: Math.floor(Math.random() * 1_000_000) });
    onStart();
  };
  if (state.phase === "intro")
    return (
      <Intro
        title="Touchdown Drive."
        es={es}
        description={
          es
            ? "Toca al receptor con la marca LIBRE. Cada pase completo avanza 20 yardas. Cuatro pases hacen touchdown. Los fallos consumen intentos: al cuarto, empieza otro drive."
            : "Tap the receiver marked OPEN. Each completed pass gains 20 yards. Four passes make a touchdown. Misses cost a down: the fourth starts a new drive."
        }
        onStart={start}
        onExit={onExit}
      />
    );
  if (state.phase === "finished")
    return (
      <FootballFinal
        game="touchdown-drive"
        es={es}
        record={{
          name: "",
          score: state.touchdowns,
          secondary: state.completions,
          misses: state.misses,
        }}
        onReplay={start}
        onExit={onExit}
      />
    );
  const elapsed = FOOTBALL_ROUND_MS - state.remainingMs,
    open = openReceiver(state, state.anchor),
    flying = elapsed < state.nextPassAt;
  const feedback =
    state.lastPlay === "touchdown"
      ? "TOUCHDOWN!"
      : state.lastPlay === "turnover"
        ? es
          ? "NUEVO DRIVE"
          : "NEW DRIVE"
        : state.lastPlay === "complete"
          ? es
            ? "PASE COMPLETO · +20 YD"
            : "COMPLETE · +20 YD"
          : es
            ? "INCOMPLETO"
            : "INCOMPLETE";
  return (
    <section className="gw-drive gw-surface" data-paused={state.phase === "paused"}>
      <GameTopBar
        title="Touchdown Drive"
        seconds={Math.ceil(state.remainingMs / 1000)}
        es={es}
        onPause={() => dispatch({ type: "pause", now: now() })}
        onExit={onExit}
      />
      <div className="gw-drive-layout">
        <div className="gw-field" data-touchdown={flying && state.lastPlay === "touchdown"}>
          <div className="gw-endzone">
            UTAH <span>UTES</span>
          </div>
          <div className="gw-yard-lines" aria-hidden="true">
            {[20, 30, 40, 50].map((n, index) => (
              <div key={n} style={{ top: `${30 + index * 17}%` }}>
                <span>{n}</span>
                <i />
                <span>{n}</span>
              </div>
            ))}
          </div>
          <div className="gw-route-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          {[0, 1, 2].map((lane) => (
            <div
              key={lane}
              className={`gw-receiver-lane gw-lane-${lane}`}
              style={{ "--route-delay": `${-((state.seed % 5) + lane)}s` } as CSSProperties}
            >
              <span className="gw-defender" data-open={open === lane} aria-hidden="true">
                <Shield size={25} />
              </span>
              <button
                className="gw-receiver"
                data-open={open === lane}
                disabled={flying || state.phase !== "playing"}
                onClick={() => dispatch({ type: "pass", now: now(), lane })}
                aria-label={`${es ? "Lanzar al receptor" : "Pass to receiver"} ${lane + 1}, ${open === lane ? (es ? "libre" : "open") : es ? "cubierto" : "covered"}`}
              >
                <span className="gw-jersey">{[11, 7, 3][lane]}</span>
                <span className="gw-open-label">
                  {open === lane ? (es ? "LIBRE" : "OPEN") : es ? "CUBIERTO" : "COVERED"}
                </span>
              </button>
            </div>
          ))}
          <span className="gw-quarterback" aria-hidden="true">
            QB
          </span>
          {flying && state.lastLane !== null ? (
            <div
              key={state.nextPassAt}
              className="gw-flight"
              style={{ "--throw-x": `${(state.lastLane - 1) * 150}px` } as CSSProperties}
              aria-hidden="true"
            >
              <FootballIcon />
            </div>
          ) : null}
          <span className="gw-play-feedback" role="status">
            {flying ? feedback : es ? "Toca al receptor libre" : "Tap the open receiver"}
          </span>
        </div>
        <aside className="gw-drive-stats">
          <span className="gw-kicker">YOUR DRIVE</span>
          <strong>
            {state.touchdowns}
            <small>TOUCHDOWNS</small>
          </strong>
          <div className="gw-drive-progress">
            <span style={{ width: `${state.yards}%` }} />
          </div>
          <p>
            <b>{100 - state.yards}</b> {es ? "yardas para anotar" : "yards to score"}
          </p>
          <div className="gw-stat-pair">
            <span>
              {es ? "Intento" : "Down"}
              <b>{state.down} / 4</b>
            </span>
            <span>
              {es ? "Pases" : "Complete"}
              <b>{state.completions}</b>
            </span>
          </div>
          <p className="gw-coach-tip">
            {es
              ? "Espera a que el defensor se separe. Mira la marca LIBRE y lanza."
              : "Wait for the defender to separate. Look for OPEN and make your pass."}
          </p>
          <span className="gw-small-note">
            {es ? "Juego arcade · Reglas simplificadas" : "Arcade challenge · Simplified rules"}
          </span>
        </aside>
      </div>
      {state.phase === "paused" ? (
        <PauseOverlay
          es={es}
          onResume={() => {
            if (!document.hidden) dispatch({ type: "resume", now: now() });
          }}
          onExit={onExit}
        />
      ) : null}
    </section>
  );
}
function RivalryTrivia({
  language,
  onExit,
  onStart,
  onComplete,
}: {
  language: Lang;
  onExit: () => void;
  onStart: () => void;
  onComplete: () => void;
}) {
  const es = language === "es",
    [state, dispatch] = useReducer(triviaReducer, undefined, createTrivia),
    [deck, setDeck] = useState<ShuffledQuestion[]>([]);
  useGameClock(state.phase, dispatch, onComplete);
  const start = () => {
    if (document.hidden) return;
    const next = createRivalryDeck();
    setDeck(next);
    dispatch({ type: "start", now: now(), deck: next });
    onStart();
  };
  if (state.phase === "intro")
    return (
      <Intro
        title="Rivalry Trivia."
        trivia
        es={es}
        description={
          es
            ? "Ocho preguntas sobre Utah, BYU y fútbol americano. Toca una respuesta, descubre el dato y sigue. Más aciertos gana; en empate, menos tiempo."
            : "Eight questions about Utah, BYU and football. Pick an answer, discover the fact and keep going. Most correct wins; fastest time breaks a tie."
        }
        onStart={start}
        onExit={onExit}
      />
    );
  if (state.phase === "finished")
    return (
      <FootballFinal
        game="rivalry-trivia"
        es={es}
        record={{
          name: "",
          score: state.correct,
          secondary: Math.round(FOOTBALL_ROUND_MS - state.remainingMs),
          misses: state.index + Number(state.selected !== null) - state.correct,
        }}
        onReplay={start}
        onExit={onExit}
      />
    );
  const question = deck[state.index];
  return (
    <section className="gw-trivia gw-surface">
      <GameTopBar
        title="Rivalry Trivia"
        seconds={Math.ceil(state.remainingMs / 1000)}
        es={es}
        onPause={() => dispatch({ type: "pause", now: now() })}
        onExit={onExit}
      />
      <div className="gw-trivia-content">
        <div className="gw-question-meta">
          <span className="gw-kicker">
            {es ? "PREGUNTA" : "QUESTION"} {state.index + 1} / 8
          </span>
          <span>
            <Check size={16} />
            {state.correct} {es ? "aciertos" : "correct"}
          </span>
        </div>
        <div className="gw-question-progress">
          {deck.map((q, i) => (
            <i key={q.id} data-active={i <= state.index} />
          ))}
        </div>
        <h2>{es ? question.es : question.en}</h2>
        <div className="gw-answers">
          {question.optionsOrder.map((original, index) => (
            <button
              key={`${question.id}-${index}`}
              disabled={state.selected !== null || state.phase !== "playing"}
              data-answer={
                state.selected === null
                  ? undefined
                  : index === question.correct
                    ? "correct"
                    : state.selected === index
                      ? "wrong"
                      : "muted"
              }
              onClick={() => dispatch({ type: "answer", option: index, now: now() })}
            >
              <span>{String.fromCharCode(65 + index)}</span>
              {(es ? question.optionsEs : undefined)?.[original] ?? question.options[original]}
              {state.selected !== null && index === question.correct ? (
                <Check size={23} />
              ) : state.selected === index ? (
                <X size={23} />
              ) : null}
            </button>
          ))}
        </div>
        <div className="gw-answer-footer" aria-live="polite">
          {state.selected !== null ? (
            <>
              <div>
                <strong>
                  {state.selected === question.correct
                    ? es
                      ? "¡Correcto!"
                      : "That’s right!"
                    : es
                      ? "Un dato para la próxima."
                      : "One for next time."}
                </strong>
                <p>{es ? question.whyEs : question.why}</p>
                <small>{question.source}</small>
              </div>
              <button className="gw-primary" onClick={() => dispatch({ type: "next", now: now() })}>
                {es ? "Siguiente" : "Next"}
                <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <p>
              {es
                ? "Elige una respuesta. Sin presión: es parte de la diversión."
                : "Pick your answer. No pressure — it’s all part of the game."}
            </p>
          )}
        </div>
      </div>
      {state.phase === "paused" ? (
        <PauseOverlay
          es={es}
          onResume={() => {
            if (!document.hidden) dispatch({ type: "resume", now: now() });
          }}
          onExit={onExit}
        />
      ) : null}
    </section>
  );
}
function FootballFinal({
  game,
  es,
  record,
  onReplay,
  onExit,
}: {
  game: FootballGame;
  es: boolean;
  record: FootballRecord;
  onReplay: () => void;
  onExit: () => void;
}) {
  const [records, setRecords] = useState<FootballRecord[]>([]),
    [name, setName] = useState(""),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(false),
    savedRef = useRef(false);
  useEffect(() => {
    try {
      setRecords(readFootballRecords(game, window.localStorage));
    } catch {
      /* Game stays usable without storage. */
    }
  }, [game]);
  const trivia = game === "rivalry-trivia";
  return (
    <section className="gw-final gw-surface">
      <div className="gw-final-story">
        <span className="gw-kicker">
          <Trophy size={17} /> FINAL WHISTLE
        </span>
        <h1>
          {trivia
            ? es
              ? "¿Conoces la rivalidad?"
              : "Know the rivalry?"
            : es
              ? "Una gran jugada."
              : "That’s a drive."}
        </h1>
        <div className="gw-final-score">
          {record.score}
          <small>{trivia ? "/ 8" : "TD"}</small>
        </div>
        <p>
          {trivia
            ? `${(record.secondary / 1000).toFixed(2)} s · ${es ? "Más aciertos, luego menos tiempo" : "Most correct, then fastest time"}`
            : `${record.secondary} ${es ? "pases completos" : "complete passes"} · ${record.misses} ${es ? "fallos" : "misses"}`}
        </p>
        {!saved ? (
          <form
            className="gw-record-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (savedRef.current) return;
              let next: FootballRecord[] | null = null;
              try {
                next = saveFootballRecord(
                  game,
                  { ...record, name: name.trim() || (es ? "Invitado" : "Guest") },
                  window.localStorage,
                );
              } catch {
                /* blocked storage */
              }
              if (next) {
                savedRef.current = true;
                setRecords(next);
                setSaved(true);
                setError(false);
              } else setError(true);
            }}
          >
            <label htmlFor="gw-name">
              {es ? "Tu apodo (opcional)" : "Your nickname (optional)"}
            </label>
            <div>
              <input
                id="gw-name"
                autoComplete="off"
                maxLength={20}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={es ? "Invitado" : "Guest"}
              />
              <button className="gw-primary">{es ? "Guardar" : "Save score"}</button>
            </div>
          </form>
        ) : null}
        <p className="gw-save-status" role="status">
          {saved
            ? es
              ? "Guardado solo en esta tablet."
              : "Saved only on this tablet."
            : error
              ? es
                ? "No se pudo guardar. Puedes seguir jugando."
                : "Storage unavailable. You can keep playing."
              : ""}
        </p>
        <div className="gw-final-actions">
          <button className="gw-primary" onClick={onReplay}>
            <RotateCcw size={18} />
            {es ? "Otra partida" : "Play again"}
          </button>
          <button className="gw-secondary" onClick={onExit}>
            {es ? "Los dos juegos" : "Both games"}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <aside className="gw-records">
        <span className="gw-kicker">THIS TABLET · TOP 10</span>
        <h2>{trivia ? "Rivalry Trivia" : "Touchdown Drive"}</h2>
        <p>{es ? "Los mejores del fin de semana" : "Weekend playmakers"}</p>
        {records.length ? (
          <ol>
            {records.map((r, index) => (
              <li key={index}>
                <span>{index + 1}</span>
                <b>{r.name}</b>
                <strong>
                  {r.score}
                  {trivia ? "/8" : " TD"}
                  <small>
                    {trivia
                      ? `${(r.secondary / 1000).toFixed(2)} s`
                      : `${r.secondary} CMP · ${r.misses} MISS`}
                  </small>
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <p>{es ? "El primer récord puede ser tuyo." : "The first record could be yours."}</p>
        )}
      </aside>
    </section>
  );
}
