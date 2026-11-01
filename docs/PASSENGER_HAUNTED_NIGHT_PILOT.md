# Passenger — Haunted Night Edition: local pilot

Date: October 30, 2026. Local validation was completed and the owner subsequently authorized publication. Physical-tablet validation remains pending. This technical record is not a replacement roadmap. B01 remains in standby after UX04/UX05; this work is the owner's explicitly authorized seasonal exception.

**October 31 follow-up:** the owner subsequently approved a local enhancement that explicitly extends the Games exclusion described in this historical release record. See [Midnight Hunt](PASSENGER_MIDNIGHT_HUNT.md) for the un-published candidate, screenshots, restoration and checks. The original release evidence below remains unchanged.

## Concept and scope

A moonlit forest road, restrained copper lighting, dark violet glass, low drifting mist, eight slow embers and an occasional three-bat silhouette passage. Home welcomes passengers with “Your ride. After dark.” Music keeps its artwork, track hierarchy and controls. Idle keeps Music first, the rotating Glance rail, fixed phone QR and Explore controls. No thematic audio, flashes, third-party animation library or production JavaScript animation loop was added.

Only Home, Music and Idle receive the edition attribute and decorations. Games, its Home promotion, menus, covers, components, game mechanics and all other Passenger surfaces retain their previous palette. Climate graphics retain their existing semantics. No bookings, pricing, calendar, payment, landing or Spotify server implementation was changed.

## Activation and complete restoration

After an approved future publication:

1. Open Admin → Config → Passenger Console → **Tema visual**.
2. Choose **Halloween**, then **Save config**.
3. Reload Passenger on the tablet. Lite/Complete is a separate setting.
4. To end the edition, select **Accent** or **Original**, save, and reload Passenger again.

There is no scheduled activation or expiration. The November 1 shutdown is manual. No second deployment or commit revert is needed to turn it off.

The selected value is optional `passengerConsole.visualTheme` inside the existing `site_config_v2` JSON contract, saved by the existing tenant-authenticated Admin server function in `app_settings`. No new endpoint, table, migration, schema change, environment variable or backend is required. This task did **not** save that value in a production database.

Absent, invalid and unknown values fall back to the previous behavior: Lite uses existing `liteTheme`; Complete uses Original. An absent value is not silently persisted when someone saves only the mode. Original/Accent CSS has not been rewritten. Halloween rules require the edition attribute; artwork, particles, mist, badge and bats unmount when the edition is not active. Styles/code can remain bundled, but there are no active Halloween nodes or artwork requests after restoration. A browser may retain a previously downloaded image in its ordinary cache.

## Files and implementation

| File                                                          | Purpose                                                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/passenger-visual-theme.ts`                           | Narrow manual selection, legacy fallback and allowed-surface resolution. Excluded surfaces always use their previous mode palette. |
| `src/config.ts`                                               | Optional manual selection defaults to null, preserving legacy defaults.                                                            |
| `src/lib/site-config.ts`                                      | Optional enum and safe parsing/merge in the existing JSON contract. A malformed theme does not discard other saved settings.       |
| `src/components/streex/admin/PassengerVisualThemeControl.tsx` | Independent Original / Accent / Halloween selector, accessible pressed states and manual restoration instructions.                 |
| `src/components/streex/AdminPanel.tsx`                        | Load/save the optional value through the existing Config operation.                                                                |
| `src/features/passenger/HauntedNightAtmosphere.tsx`           | Conditional memoized scene, decorative SVG silhouettes, embers, badge and cleaned-up visibility listener.                          |
| `src/features/passenger/haunted-night.css`                    | Isolated visual rules, responsive horizontal composition, transform/opacity motion and reduced-motion variant.                     |
| `src/features/passenger/PassengerConsole.tsx`                 | Mount edition only on approved surfaces; conditional Home imagery/copy; Idle decoration pauses with dim/logical rest.              |
| `public/passenger-haunted-night/haunted-road.webp`            | Single approximately 151 KB cinematic scene, shared/cached across authorized screens.                                              |
| `tests/passenger-visual-theme.test.mjs`                       | Five tests covering fallback, roundtrip, invalid values, mode independence, scope and restoration.                                 |
| `scripts/qa/passenger-haunted-night/`                         | Separate local harness rendering the actual components with local external-service fixtures. Not a production route.               |

Two small existing defects surfaced during verification: the local `SpotifySearchTrack` type lacked the already-used `albumUri` field (type declaration corrected); the idle discoverable state nested native buttons inside another native button (outer presentation wrapper changed to a div, keeping explicit native Open Music/Dim buttons and the existing click handler). No Spotify API request, playback, repeat, polling interval or Analytics implementation was changed.

## Animation and device considerations

- Artwork is a static WebP, not a video. Native CSS animates opacity/transforms for two fog layers, a moon halo, eight embers and one group of three bat silhouettes.
- New decoration is pointer-transparent and hidden from accessibility APIs. Existing passenger controls remain interactive.
- New animation pauses when the document is hidden and when Idle is dimmed or in logical rest. The visibility listener is removed on unmount.
- `prefers-reduced-motion: reduce` removes new animation/transition, hides bat flight and leaves static low-opacity atmosphere.
- The centered badge uses automatic margins rather than horizontal translation, avoiding a clipping artifact found in the local browser's compositing.
- No tablet FPS or CPU savings are claimed. Two five-second samples on the local desktop browser recorded 300 frames, mean 16.67 ms, p95 approximately 17.7–18.2 ms and zero intervals above 50 ms. These samples establish only that this local render was smooth.

## Validation and evidence

Primary browser viewport: **1280 × 800 landscape CSS pixels**. Home was also visually inspected at 1024 × 640 without horizontal document overflow. At 1280 × 800, Idle content occupies x=32–1248 and y=32–784; controls, artwork, QR and Explore remain inside the viewport. Real tablet hardware was unavailable.

### Automated / static

- Full existing Bun suite plus new tests: **99 passing, 0 failing, 2,298 assertions**, 20 test files, with the existing no-network preload.
- TypeScript and production build: passed (`bun run check`), using dummy localhost backend settings and disabled personal Spotify integration for the build.
- Focused ESLint: passed for all changed production TS/TSX files and local QA TS/TSX files.
- Formatting for new files and `git diff --check`: checked separately at finalization.
- Source review: unchanged Games implementation; no new per-frame React state, polling, retry loop or production network call. Original and Accent retain their pre-existing CSS.

The repository's installed dependency files stalled on reads. Validation therefore ran in `/tmp/streex-haunted-validation.L2Xw2U`, a temporary source copy with the exact existing lockfile and a clean pinned install (`bun install --frozen-lockfile --ignore-scripts`). No new dependency was added. Changed production source files and the new test were byte-compared with the real working tree. No `.env`, Git metadata or Vercel link was copied. Build output exists only in that temporary copy. The build reports existing library deprecation notices; successful compilation is not a real integration test.

### Real rendered local browser checks

- Actual AdminPanel: select/save/reload Accent, Halloween and Original using local fixtures. Complete + Halloween also saved independently and reloaded correctly.
- Actual PassengerConsole: Home, Music and Idle show Halloween in Lite and Complete. English and Spanish Home inspected; Complete navigation retains Around You.
- Actual Music handlers: pause/resume and search/select Nightcall work against local fixtures, retaining title/artist and player layout. No audio was produced.
- Idle: Tap to dim pauses new animation; first touch wakes; Open Music transitions to Music.
- Restoration: saving Accent in Admin and reloading Passenger matches the recorded pre-Halloween computed-style fingerprint, with zero decoration nodes, no edition attribute and no Halloween custom token.
- Games: identical markup/main styles and **byte-identical screenshots** under Accent versus Halloween in the frozen local scenario. Zero Halloween nodes/attributes remain on Games.
- Reduced motion: executed the exact CSS media-rule declarations via a local preference fixture; all new animations computed to `none`, bat flight to `display:none`. The tool could not emulate the operating system preference, so native OS media-query activation was not tested.
- Final local browser console: no errors or warnings during the inspected flow.

### Evidence files

All images below are actual browser screenshots of the implemented application, not design mockups. Fixture artwork/track/weather and local Admin authentication are explicitly artificial **data**, while the rendered UI is the real component implementation.

- [Idle](evidence/passenger-haunted-night-local/idle-halloween.jpg)
- [Home](evidence/passenger-haunted-night-local/home-halloween.jpg)
- [Music](evidence/passenger-haunted-night-local/music-halloween.jpg)
- [Admin selector](evidence/passenger-haunted-night-local/admin-theme-selector.jpg)
- [Same Home scenario — Halloween](evidence/passenger-haunted-night-local/comparison-home-halloween.jpg) / [Accent](evidence/passenger-haunted-night-local/comparison-home-accent.jpg)
- [Restored Accent](evidence/passenger-haunted-night-local/home-accent-restored.jpg) / [Original](evidence/passenger-haunted-night-local/home-original.jpg)
- [Games — Accent](evidence/passenger-haunted-night-local/games-accent.jpg) / [Halloween](evidence/passenger-haunted-night-local/games-halloween.jpg)
- [Complete, Spanish](evidence/passenger-haunted-night-local/home-halloween-complete-es.jpg)
- Actual consecutive motion frames: [01](evidence/passenger-haunted-night-local/motion/home-01.jpg), [02](evidence/passenger-haunted-night-local/motion/home-02.jpg), [03](evidence/passenger-haunted-night-local/motion/home-03.jpg), [04](evidence/passenger-haunted-night-local/motion/home-04.jpg), [05](evidence/passenger-haunted-night-local/motion/home-05.jpg), [06](evidence/passenger-haunted-night-local/motion/home-06.jpg), [07](evidence/passenger-haunted-night-local/motion/home-07.jpg), [08](evidence/passenger-haunted-night-local/motion/home-08.jpg). This is a short sequence, not a calibrated video recording; slow fog/bat timing is better assessed in the live local view.
- [Structured browser QA results](evidence/passenger-haunted-night-local/browser-qa-results.json)

### Local reproduction without production writes

```sh
bun --bun node_modules/vite/bin/vite.js --configLoader runner --config scripts/qa/passenger-haunted-night/vite.config.ts
```

Open `http://127.0.0.1:4317/?theme=halloween&mode=lite`; `?screen=admin` renders the actual Admin Config panel. Only this QA entry understands theme/mode/surface fixture parameters. `&surface=idle` sets an old local last-activity value so real Idle opens. `&still=1` pauses CSS for comparison, `&sample=1` measures local frame intervals, and `&motion=reduce` executes the reduced-motion declarations as a clearly marked fixture. None is added to the product route.

The Vite harness replaces every imported server-function module and the browser Supabase client before bundling. Local Admin saves only localhost localStorage. It uses no production credentials; CSP additionally restricts connect requests to localhost. Public Google Fonts still load read-only as in the application. Production Supabase/Auth/RLS persistence, real Spotify pairing/audio/device reconnect, extended driving shifts, physical Fully Kiosk rendering and real tablet thermal/battery behavior remain untested. No production data was read or changed by the validation harness.

## Asset provenance

The background was generated with the built-in image-generation tool, inspected and converted to WebP. Original generated file: `exec-9a13fa1d-8348-4607-a6ad-14de21569a96.png` in the task's local generated-image folder. Final application artifact: `public/passenger-haunted-night/haunted-road.webp`. No remote image-generation runtime is used by Passenger.

Prompt:

> Use case: stylized-concept. Asset type: cinematic background artwork for a real premium in-vehicle tablet UI, STREEX Passenger Haunted Night Edition. Generate an ultrawide landscape 16:10 nighttime scene, no interface and no text. A quiet empty road disappearing into deep black-violet fog, sparse elegant silhouettes of leafless trees at the far left and right edges, an enormous realistically textured soft ivory-violet moon high in the upper right. Deep chiaroscuro, photographic film still quality, nuanced volumetric ground fog, a few warm orange glowing embers near the low edges, one small beautifully carved amber-lit pumpkin partially concealed in the extreme lower left foreground. Middle 75 percent remains very dark, restrained low-detail negative space suitable behind legible white UI. Entire upper-left and central area near-black. Atmospheric layered depth, cold violet moonlight and warm copper practical light, luxurious supernatural mood, sophisticated and believable, cinematic realism, detailed texture without noise. Keep the moon visibly at the right edge and the pumpkin small; no giant props, no characters, no houses, no lettering, no logos, no watermark, no cartoon, no gore, no UI mockup, no bright busy center. Deliver one standalone background image.

## Publication recommendation and later B01 considerations

The owner approved publication after the local visual review. Reserve a stationary tablet smoke test of Home/Music/Idle, controls, dim/wake, actual Spotify audio, Games isolation and theme restoration after publication. Normal theme reversal requires only Admin save + Passenger reload.

Pre-release production was verified through the authenticated Vercel dashboard: project `streex-riders`, repository `juangaudino/streex-rides`, production branch `main`, status Ready, domain `rides.getstreex.com`, commit `6497a81619d0e7c3eb9e65b4ae2035c3c8cc923c`, deployment URL `streex-riders-j2kybg2fr-juangaudinos-projects.vercel.app`, dashboard deployment reference `HgxWLnjA4DSK8KdwGZrbBXRWbnVx`. The Vercel connector lacked team access, so release verification uses the existing authenticated dashboard. No rollback was executed or test-restored; opening its production control was rejected by automatic safety review. The existing Git integration publishes pushes to main.

B01 should later decide its formal registry/versioning, migration of the legacy `liteTheme`, scope of each theme on Games/other surfaces, configuration refresh UX and any future scheduling. None is generalized or closed by this pilot. No automatic expiry was added.

Repository: `juangaudino/streex-rides`; local folder remains `streex-riders`. Implementation branch: `feat/passenger-haunted-night-local`. Base: `6497a81619d0e7c3eb9e65b4ae2035c3c8cc923c`. At the local validation checkpoint, no push, merge or deployment had occurred. The subsequent instruction “Publícalo” authorizes committing the reviewed changes, fast-forwarding main and publishing through its existing Git integration. No schema modification, credential change or production configuration save is part of this release; Halloween remains opt-in from Admin.
