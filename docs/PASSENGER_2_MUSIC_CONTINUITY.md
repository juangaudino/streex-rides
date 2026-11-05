# Passenger 2.0 — Music continuity, local checkpoint

Date: November 5, 2026. Owner approved the proposed Passenger improvements and incremental execution. This is the first bounded client-side slice associated with UX04, not completion of Passenger 2.0, PA02 or the formal B01 theme system. Master priorities and external security gates remain unchanged.

## Scope and behavior

- A per-Console in-memory Spotify session now supplies Home, Music and Idle through Context and `useSyncExternalStore`. Each consumer retains its existing polling lifecycle: Home 30 seconds only when active, Music 5 seconds, Idle 10 seconds. The store itself owns no interval. Existing shared single-flight request/repeat integration remains intact; the session also joins concurrent refreshes.
- Screen transitions read the latest snapshot immediately while their existing immediate refresh runs. Playing progress is projected from receipt time and clamped to duration. No persistent playback cache, OAuth/token changes or new storage is introduced.
- Failed refreshes retain the last metadata, explicitly labelled unconfirmed in EN/ES. Progress and visualizers stop. Failure does not extend the receipt timestamp. Metadata older than 30 seconds is likewise labelled unconfirmed on the next snapshot/read at mount. A successful response clears that label. Explicit disabled, unpaired/not-connected and no-device responses replace cached values normally; failures never pretend a command succeeded.
- Search request versions discard stale results/errors/loading updates. Editing the query invalidates an outstanding search without sending a request. Successful search/control semantic Analytics events remain recorded even if navigation occurred; no query content is added to Analytics.
- Music commands acquire a synchronous guard against double activation. Cancellable 300/500/800/1200ms post-command waits stop on unmount. An already-sent command cannot be recalled; successful command Analytics and necessary repeat-session error recovery remain allowed, but stale UI writes/further polling retries do not.
- No change to source of playback, pairing, backend, credentials, schema, production records, weather intervals, seasonal gameplay, themes, idle cadence, payments or bookings.

## Implementation

- `src/features/passenger/spotify-session.ts`: observable session, freshness classification and disposable request scope, independent of React for deterministic testing.
- `src/features/passenger/PassengerConsole.tsx`: session provider/subscribers, playback presentation, scoped Music commands/search.
- `tests/passenger-music-session.test.mjs`: nine regression tests, including simultaneous consumers, failure/recovery, stale metadata age, explicit unavailable states, independent sessions, 200 unsubscribe/remount cycles, superseded searches, cancelled waits and Next sequences.
- `scripts/qa/passenger-haunted-night/fixtures.ts`: opt-in `music-validation=1` only in the existing credential-free harness. Adds 1500ms playback response delay, slow/fast searches, 800ms control response and a local failure/recovery toggle. Not imported by production.

## Validation and evidence

Final suite: **137 tests, zero failures, 128,671 assertions**, across 25 files. Includes existing Analytics, Spotify polling/retry/repeat, games and theme tests. Test preload blocks external fetch; no real Spotify/Supabase calls.

TypeScript, focused ESLint (Console/session/fixture), production build and `git diff --check` pass. Build has existing chunk-size/module-directive/deprecation warnings; no claimed measured speed or CPU improvement.

The root checkout's dependency reads stalled. The earlier temporary validation directory was incomplete (missing source/dependency files), so its initial missing-module/typecheck results were environmental failures, not passed checks. Final verification used a complete `git archive` of baseline `3da529d`, overlaid byte-identical changed implementation/test files, with exact frozen-lockfile dependencies restored in `/tmp/streex-passenger2-validation`. Dummy local service URLs and disabled Spotify were used for build; no env files copied or remote deployment created. The browser fixture used a separate local config key to avoid old serialized development asset paths.

Actual local browser verification:

- Utes Lite, 1280×800: Home → Music → Home → Music retains song; old `slow` search cannot replace later `fast`; editing re-enables submit; navigation immediately after Pause and song selection works.
- Failure toggle + Refresh: retained artwork/title, unconfirmed label, stopped visualizer/progress. Restore + Refresh returns to normal without reload.
- Accent Lite Music and Idle at 1280×800: song visible; Idle → Music retains it. Music document has no horizontal overflow and no broken image assets.
- Original Complete Music at 1280×800; Halloween Lite Music in Spanish at 1024×640.
- Inspected final-page browser warning/error log: empty. This is local mocked integration, not production runtime observability.

Actual screenshots:

- [Utes temporary refresh failure](evidence/passenger-2-music/utes-refresh-failure.jpg)
- [Utes recovery](evidence/passenger-2-music/utes-recovered.jpg)
- [Latest search wins](evidence/passenger-2-music/latest-search.jpg)
- [Accent Music](evidence/passenger-2-music/accent-music.jpg)
- [Original Complete Music](evidence/passenger-2-music/original-complete-music.jpg)
- [Halloween Spanish, compact landscape](evidence/passenger-2-music/halloween-music-es-1024.jpg)
- [Accent Idle](evidence/passenger-2-music/accent-idle.jpg)

Limitations: no physical Fully/Android, real Spotify session/device, end-of-track/repeat, live Analytics delivery or eight-hour vehicle soak test. Existing automated mocks provide regression evidence, not proof of those integrations. No measured FPS, memory or Vercel CPU savings. This slice does not finish all UX04 unavailable states or UX05 focus/navigation work.

## Release and reversibility

Branch: `feat/passenger-2-music-continuity`, based on `3da529d` (approved Utes release already published in the prior turn). No push, merge, preview or deploy for this checkpoint. `main` remains at that baseline. No production configuration changed.

Before release: approve this bounded candidate and record the then-current stable Production deployment. Physical stationary tablet smoke test must cover search/select, Pause/Play/Next, rapid navigation, Idle resume, dim, themes, and eventual end-of-track/repeat behavior. If a regression occurs after an authorized release, restore the recorded stable Vercel deployment or revert this isolated commit and deploy through the existing integration. No data/schema rollback or re-pairing is required by this change.

Next Passenger slice: assess UX05 Home/Idle focus and navigation, with physical-device limitations preserved. Broad Music error-state design and measured rendering/loading work remain subsequent bounded changes; no automatic theme-system or roadmap expansion.
