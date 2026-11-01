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

## Follow-up — idle exit and discovery (local review candidate)

The owner reported that the generic Idle exit landed in STREEX. Inspection confirmed that the large “Tap to explore” button called `onExploreStreex`. A separate `onExploreHome` callback now resumes Idle and opens Home; normal bright background taps also explicitly select Home. Dedicated Music, Games, Services and STREEX links retain their destinations. The first dimmed tap still only restores brightness.

While Halloween is selected, the existing Idle Games tile is wider, uses the already-shipped scene as its background, and shows “Midnight Hunt / Tap to play · 60 sec” (Spanish copy included) with a copper border and moon icon. Its position and surrounding Music/Glance/phone QR structure remain intact. Original/Accent keep their normal Games tile. No animation, request interval, backend or game logic was changed.

Branch: `fix/passenger-idle-home-hunt-entry`, based on published `04013f6`. Local review only; no push, merge or deployment for this follow-up.

Validation: existing 107 tests/4,534 assertions passed; TypeScript/build, focused ESLint and diff check passed in the existing credential-free validation copy. Actual local browser checks confirmed the generic exit and bright background tap open Home, the highlighted tile opens Midnight Hunt directly, dim/wake semantics are retained, and generic exit also opens Home under Original/Accent with no seasonal tile. No browser console errors/warnings. At 1280 × 800 the full composition was inspected; at 1024 × 640 the new tile fits (175.7 × 57.6) with no horizontal document overflow. Existing compact-height clipping in the upper Music/phone areas was observed and was not changed by this narrowly scoped patch. Physical Fully Kiosk testing remains pending.

- [Idle — 1280 × 800](evidence/passenger-idle-home-entry/idle-halloween-1280x800.jpg)
- [Compact — 1024 × 640](evidence/passenger-idle-home-entry/idle-halloween-1024x640.jpg)
- [Browser QA](evidence/passenger-idle-home-entry/qa-results.json)

## Approved publication follow-up — five-minute seasonal inactivity

The owner approved publishing the idle-to-Home correction and highlighted game entry, together with a longer wait for tonight. While Halloween is manually selected, normal Passenger enters Idle after **300 seconds of inactivity**. Every real interaction still resets the timer; returning to Original/Accent restores the configured normal duration (currently 90 seconds). Explicit test mode retains 15 seconds; Glance rotation and the one-minute game round are unchanged. The application does not remain permanently in Games, and no date scheduler/configuration/database update is introduced. This is an explicit owner-approved seasonal timing exception; B01 remains deferred.

Release scope includes local `1ce71bd` plus this timing adjustment. The owner authorized commit, push and Production deployment after reviewing the screenshot. Previous stable production is `04013f6`, Vercel reference `8vfsH3QR5oWARrLLzh7gAtp9SFKY`, immutable URL `streex-riders-o7tkygrs5-juangaudinos-projects.vercel.app`. Existing Git integration deploys main to `streex-riders`; no credentials or schema changes are part of the release.

## Lantern discovery correction — approved for production

The owner approved implementing and publishing true flashlight discovery. Spirits previously remained visible through the translucent dark overlay and their buttons collected on any click. The entire spirit layer now has a radial CSS mask (including glow, ring and focus outline): alpha is zero outside the 155 px beam, with a soft spatial reveal toward the bright center. The scene, HUD and music are unaffected. An opacity fallback uses per-target illumination for browsers without standard/prefixed CSS masks.

`midnight-lantern.ts` tracks continuous illumination in the 110 px inner discovery area. A 200 ms discovery period prevents instantaneous hover/click collection. Pointer-down snapshots eligibility **before** repositioning the beam, so even a long blind first press can only reveal. Collection requires a previously discovered, currently illuminated target and a new deliberate tap; dragging/cancellation blocks collection on release. Moving the beam away removes discovery. Replay resets the beam off-scene and clears eligibility. Keyboard focus moves the beam to its target and Enter can collect after discovery. The beam stays in place on lift. Instructions are updated in English/Spanish.

No new animation loop, timer, external request, analytics event or dependency was added. Pointer movement updates CSS variables and at most five local discovery entries; coordinates stay transient inside the game and never enter analytics/storage. Existing five-minute Halloween inactivity, one-minute round, Home exit, themes, Spotify and queue semantics are unchanged.

Validation:

- **115 passing tests / 4,556 assertions**, 22 files, with network-blocking preload. Eight new tests cover beam geometry, blind/long presses, dwell, moving away/re-entry, drag, cancellation, replay/removal and resize.
- TypeScript, production build, focused ESLint and diff checks passed in the existing clean local validation copy; production source matches the repository byte-for-byte.
- Actual browser at 1280 × 800: all spirits initially hidden; blind first tap revealed with score 0; subsequent tap collected; another blind tap did not collect; moving away removed illumination. Native pointer drag revealed without collecting. A full five-spirit win and replay were completed; replay restored zero lit targets/score and one timer.
- Keyboard focus illuminated its target and Enter collected. Simulated document hiding paused the game with zero timers; leaving for Music unmounted it with zero timers.
- At 1024 × 640, the same mask and blind-tap rule worked with no horizontal document overflow. Applying exact reduced-motion CSS declarations left no animated descendants while preserving the mask/gameplay. Native OS preference and physical Fully Kiosk touch remain owner checks.
- Actual 60-second expiry occurred during a slow local verification and rejected a late final action, preserving the existing deadline.
- External services remained local fixtures. Physical tablet FPS, real Bluetooth audio and production runtime logs were not measured by this test.

Evidence: [before light](evidence/passenger-lantern-discovery/before-beam.jpg), [revealed, score still zero](evidence/passenger-lantern-discovery/revealed-not-collected.jpg), [light moved away](evidence/passenger-lantern-discovery/beam-moved-away.jpg), [structured QA](evidence/passenger-lantern-discovery/qa-results.json). Static comparison captures freeze only CSS animation through the existing QA harness; game time and actual controls still execute.

Release baseline/rollback reference: production `0f8fdc1`, Vercel reference `9H7cxoCdMBb41y19gX9qmyBLQGLc`, immutable deployment `streex-riders-n1hk910sw-juangaudinos-projects.vercel.app`, verified through GitHub's successful Production deployment. The owner explicitly authorized commit, push and deploy of this correction. No production setting, credential or database migration is required.

Desktop-only five-second gameplay frame sample (including native pointer drags): 301 frames, mean 16.67 ms, p95 18.1 ms, no intervals over 50 ms. This is not physical tablet performance evidence. Final inspected local console had no errors/warnings.

## October 31 — approved local leaderboard

Added a device-only Top 10 of successful finish times, ranked by actual elapsed milliseconds (pauses excluded). Optional nickname, 20 characters; empty names become Guest/Invitado. React renders names as text. No names or record times are sent to analytics, server functions or Supabase. Storage failures leave replay usable and show a recoverable message. Only one save per round. Records persist in localStorage on the same origin/browser; clearing browser data removes them. No automatic date reset or admin maintenance.

New layout generation avoids immediately repeating the same five hiding places while the page remains loaded, including leaving/re-entering Games. Reload starts a fresh random sequence. Positions remain safe predefined hiding places; IDs do not determine layout equality.

Validation: 119 tests, 4,573 assertions; TypeScript, production build, focused ESLint, diff check. Automated coverage includes repeated-layout fallback with identical random input, top-ten ranking/cap, persistence, malformed/unavailable storage, name limits and paused-time accounting. Real local browser QA with external services mocked: two successful rounds, named and anonymous saves, record restored after reload, no console warnings/errors. Landscape 1280×720 screenshot: [local Top 10](evidence/passenger-local-records/top-ten.jpg). Physical Fully keyboard/touch remains owner QA after release. Spotify logic and existing five-minute Halloween idle unchanged.

Publication authorized by owner. Previous stable rollback reference is commit `dcafddebb6a483a1afbeefa61905f0bfeca0be5b` (Production deployment reference `3e4XVsTSwreUhSSmmyiMZLkEnik5`). Use existing Git main integration/project streex-riders; no backend or configuration changes.
