# Passenger — Midnight Hunt local enhancement

Date: October 31, 2026. Owner-approved local implementation, **awaiting visual review and publication authorization**. Branch: `feat/passenger-midnight-hunt-local`; base/main: `f735685411dbf244ef4c40b8cbf339c4321e0ecb`. No push, merge or deployment is authorized by this checkpoint.

This is a continuation of [Haunted Night](PASSENGER_HAUNTED_NIGHT_PILOT.md), not a new theme or a competing roadmap. The owner explicitly expanded the previous Games exclusion: selecting Halloween now replaces the Games content with a seasonal game. Original/Accent restore the three existing games. B01 remains in standby; the master next task is unchanged.

## Experience and selection

Use the existing Admin → Config → Passenger Console → Tema visual → Halloween → Save config, then reload Passenger. This single selection enables the atmosphere, Home game promotion, Idle Games invitation and Midnight Hunt. There is no additional switch, date schedule or new backend. Select Original or Accent, save and reload to restore the normal experience.

The shared Halloween atmosphere still mounts only on Home, Music and Idle. Games uses its own isolated scene/component when the resolved manual selection is Halloween. Every existing game entry (navigation, Home quick access, Idle Games) reaches Midnight Hunt. Other views retain their existing presentation. Existing games remain intact in source; no game mechanics or content were edited.

Midnight Hunt is a one-minute lantern exploration game: find and tap five spirits to illuminate the gate. English/Spanish intro, instructions, pause, win/time-expired result, replay and Music exit. Five distinct targets are shuffled among eight separated positions; hit areas are 82 × 88 CSS pixels, 72 × 76 at short landscape heights. Touch movement updates two CSS variables directly; no per-frame React updates or server calls. Keyboard users can reach and activate the same native buttons.

The timer uses monotonic elapsed time and a 200 ms interval while playing. Pause preserves remaining time; document hiding pauses the game and atmospheric motion, and requires deliberate resume. The interval and visibility listener clean up on unmount. Delayed timer callbacks cannot extend the deadline; taps at/after the deadline cannot add score. Replay starts a new round. Leaving the game discards only its local round. Global idle cadence is unchanged, including test mode.

Spotify playback/API/device/pairing/repeat/polling logic is unchanged. The game adds no audio. Existing semantic game_opened/game_started/game_completed events use `midnight-hunt`, allowlisted by the existing ingestion schema through PASSENGER_GAME_IDS. Admin reporting uses that same list. No touch coordinates, names, leaderboard, schema migration or production write is added by this local work.

A pointer-transparent one-second fog opening plays when the active atmosphere mounts (initial Home/Music and return from Idle), not on every poll or Home→Music transition. Idle keeps Music first, Glance and its fixed QR; its existing Games access receives a restrained copper invitation. No games were added to Glance rotation.

## Main files

- `src/features/passenger/MidnightHunt.tsx`: actual game component and lifecycle.
- `src/features/passenger/midnight-hunt.ts`: pure round state, timing and target placement.
- `src/features/passenger/midnight-hunt.css`: scoped scene, lantern, HUD, targets, results and reduced motion.
- `src/features/passenger/PassengerConsole.tsx`: seasonal selection and existing entrypoints.
- `src/lib/passenger-visual-theme.ts`: narrow seasonal game resolution; legacy fallback retained.
- `src/features/passenger/HauntedNightAtmosphere.tsx`, `haunted-night.css`: one-time fog opening and invitation treatment.
- `src/lib/passenger-analytics.ts`, `src/lib/admin.functions.ts`: allowlisted ID and reporting counts.
- `tests/midnight-hunt.test.mjs`, `tests/passenger-visual-theme.test.mjs`: timing, deadline, shuffle, replay, analytics identifier, selection and restoration contracts.
- Existing local QA harness: reduced-motion declarations include the new game; fixture-only semantic event evidence is exposed as a DOM attribute for inspection.

## Assets and provenance

Generated with the built-in image-generation tool, inspected, then converted to WebP with existing Sharp in the temporary validation install. No runtime image-generation service or dependency added.

- `public/passenger-haunted-night/midnight-gate.webp`: 338,914 bytes, 1672 × 941, cinematic scene.
- `public/passenger-haunted-night/midnight-spirit.webp`: 10,008 bytes, 87 × 200, true alpha, one reused sprite.
- Original files: `exec-1dd95b60-30ae-41d4-ae6a-8c786ec0a134.png` and `exec-a5bd57ad-8aee-46c8-8edf-236d75a5a835.png` under the task's generated_images folder. Project references use only the copied assets above.

Final scene prompt: “Use case: stylized-concept. Actual playable game background artwork for STREEX Passenger Midnight Hunt, a premium Halloween tablet game. Ultrawide cinematic environment, no UI/text. Moonlit abandoned forest clearing, old stone arch portal slightly right of center, pale large moon, twisted bare trees, low ground fog and cobbled path. Black violet and petrol shadows, restrained amber lanterns and small pumpkin lights at ground edges. Photographic film still quality, atmospheric perspective and rich natural materials. Dim amber arch seam; distinct quiet pockets for coded interactive spirits. Upper-left dark for headings; no people/ghosts baked into the scene, lettering, watermark, gore or mockup.”

Final sprite prompt: “Use case: stylized-concept. Single transparent game sprite for a premium cinematic Halloween hunt. Elegant spirit made of luminous silver-lilac mist and liquid moonlight; elongated teardrop flame, curled wispy tail, warm ivory core, violet edges. Sculptural dimensional apparition readable at 60 pixels. Two subtle amber sparks, no drawn face, smile, mouth, bedsheet ghost, cartoon or mascot. Single centered object, genuine transparency; no environment, ground, text, UI or border.”

## Local validation

Validation uses the existing credential-free source copy `/tmp/streex-haunted-validation.L2Xw2U`, exact locked dependencies and actual components. Modified/new source is synchronized and byte-compared with the repository. No .env or production credentials are copied. Existing QA module interception replaces server functions and Supabase before bundling; connect-src CSP permits only localhost/WebSocket. Music, weather and Admin persistence use explicit fixtures. Test preload blocks fetch. Build uses dummy localhost backend settings. Fonts remain the application's read-only Google Fonts resources.

Reproduce:

```sh
bun --bun node_modules/vite/bin/vite.js --configLoader runner --config scripts/qa/passenger-haunted-night/vite.config.ts
```

Open localhost port 4317 with `?theme=halloween&mode=lite`. Use actual UI navigation to Games. `&mode=complete`, `&theme=accent`, `&theme=original`, `&surface=idle`, `&screen=admin`, `&motion=reduce` remain local-harness-only fixtures, not public product parameters. `motion=reduce` applies the exact CSS media declarations; it does not emulate the native OS preference.

Automated and browser results, evidence and remaining limitations are recorded below at finalization. Real tablet performance, native Fully Kiosk touch behavior, live Spotify audio and authenticated production persistence require owner QA after a separately authorized publication. Browser rendering and a build do not prove these integrations.

## Final results and real rendered evidence

- Automated suite: **107 passed, 0 failed, 4,534 assertions**, 21 files, fetch blocked by the existing preload.
- TypeScript + Vite/Nitro production build: passed with dummy localhost backend values. Existing library deprecation notices remain; no new dependency was installed.
- Focused ESLint and formatting: passed after correcting one line wrap in the updated Admin explanation. `git diff --check`: passed.
- Real local browser: Home and navigation entry, Idle Games entry, collect, pause/resume, win, actual 60-second expiration, replay, Music return and pause/play against fixtures.
- Fixture Analytics evidence: Home entry produced exactly one game_opened; two rounds produced two game_started and two game_completed, without duplicate IDs. No event was sent to production.
- Actual Admin component: Accent save/reload restored the three games; Original save/reload did the same; Halloween save/reload restored the seasonal game. Restoration had zero Halloween decorations and no Midnight Hunt node. Mode remains independent.
- Landscape: 1280 × 800 and 1024 × 640 inspected. Compact viewport: 960 × 434 game at x=32/y=94, no horizontal document overflow; 72 × 76 targets. Complete mode Spanish intro/game/Music inspected, including Around You navigation.
- Reduced-motion fixture: applying the exact new CSS media declarations produced zero animated descendants and zero nonzero transition durations. Native OS preference switching was not available.
- Lifecycle fixture: real React effects under simulated document visibility produced playing/1 timer → hidden paused/0 timers → visible still paused → deliberate resume/1 timer. Music/Home navigation unmounted the game and returned to 0 timers; remount/start returned to exactly 1. Native browser backgrounding could not be verified: the in-app tool keeps its pages marked visible, so this was explicitly a local platform fixture.
- Idle dim/wake: dim layer mounted, edition animation paused; first wake preserved Idle, then Games opened the seasonal intro.
- Final inspected local browser console: no errors/warnings.
- One five-second **desktop** frame sample during gameplay: 300 frames, mean 16.67 ms, p95 18.1 ms, zero frame intervals above 50 ms. This does not establish physical tablet FPS, temperature, battery impact or Vercel CPU savings.

Actual screenshots of the implemented components with artificial local music/weather/auth data, not mockups:

- [Game intro](evidence/passenger-midnight-hunt-local/midnight-intro.jpg)
- [Playing](evidence/passenger-midnight-hunt-local/midnight-playing.jpg)
- [Gate/result](evidence/passenger-midnight-hunt-local/midnight-result.jpg)
- [Time expired](evidence/passenger-midnight-hunt-local/midnight-time-expired.jpg)
- [Home invitation](evidence/passenger-midnight-hunt-local/home-halloween.jpg)
- [Idle invitation](evidence/passenger-midnight-hunt-local/idle-halloween.jpg)
- [Music](evidence/passenger-midnight-hunt-local/music-halloween.jpg)
- [Admin selector](evidence/passenger-midnight-hunt-local/admin-theme-selector.jpg)
- [Accent games restored](evidence/passenger-midnight-hunt-local/games-accent-restored.jpg)
- [Original Home restored](evidence/passenger-midnight-hunt-local/home-original-restored.jpg)
- [Complete / Spanish](evidence/passenger-midnight-hunt-local/midnight-complete-es.jpg)
- [Compact landscape](evidence/passenger-midnight-hunt-local/midnight-1024x640.jpg)
- Real gate transition sequence: [01](evidence/passenger-midnight-hunt-local/motion/gate-01.jpg), [02](evidence/passenger-midnight-hunt-local/motion/gate-02.jpg), [03](evidence/passenger-midnight-hunt-local/motion/gate-03.jpg), [04](evidence/passenger-midnight-hunt-local/motion/gate-04.jpg). This is a sequence of actual captures, not a calibrated video.
- [Structured browser QA](evidence/passenger-midnight-hunt-local/browser-qa-results.json)

Ready for the owner's visual review. Publication is **not performed**. If later authorized, use the existing production Git/Vercel project and preserve this feature's theme-only reversal. After publication, owner QA on the stationary tablet must verify touch/drag, readability, a full round, music continuity, dim/wake and Original/Accent restoration. No new infrastructure is required.
