# Passenger — Utes Game Weekend (local review)

## Approved scope and publication gate

Owner approved a new manual seasonal edition, following Halloween's reversible structure, with **two separate games**: Touchdown Drive and Rivalry Trivia. Implementation lives on `feat/passenger-utes-game-weekend`, based on production/main `9e09deb3d5129252b173fd2db4c76f1bb38a0954`. Local screenshots precede publication; no push, merge, remote preview, deployment, production settings or data writes are included in this checkpoint.

This is another explicitly approved seasonal exception. The master roadmap pointer is unchanged; B01 remains standby after UX04/UX05. No general theme registry, scheduling or backend project was introduced.

## Visual edition

An original lightweight SVG stadium scene (not a photograph of Rice-Eccles) combines mountains, seating, field perspective and floodlights. Scoped CSS adds crimson/black surfaces, warm white highlights, gentle light sweeps and six decorative particles. Home, Music and Idle use the same setting, while album artwork and its ambient palette remain the music focal point. No added audio or automatic Spotify actions.

Games has an independent two-card selection screen. Original/Accent still show the three existing games. Halloween still shows Midnight Hunt with its existing records and five-minute inactivity exception.

The idle screen keeps Music, the fixed phone QR and its existing hourly/daily/STREEX rail entries. Utes adds a fourth rotating matchup card at the existing rotation frequency. The QR's position is independent of that rotation. A Utes-only definite rail height prevents intrinsic card content from moving/resizing it. All four real card states were advanced through the original timer callbacks in the local lifecycle fixture: QR x/y/width/height were identical (907.08 / 504.20 / 339.91 / 142 CSS pixels at 1280×800). The highlighted Utes games access uses short copy to fit the landscape lower row and opens the two-game chooser; Home’s named quick access can open its highlighted game directly. The existing yellow Explore and Dim actions remain.

Music receives a Utes-only `overflow: clip` guard on its decorative stage in landscape, avoiding focus-induced internal scrolling that otherwise cropped the top of the player/search cards. It does not change Music polling, playback, search or controls, nor the other themes' CSS.

## Manual selection and reversal

Admin → Config → Passenger Console → **Tema visual** → **Utes Game Weekend** → **Save config**, then reload Passenger. This uses the existing `visualTheme` field in the existing JSON config contract; no database table or schema change. Lite/Complete stays independent.

Select **Original** or **Accent**, save and reload to remove the stadium, particles, theme copy and seasonal games. **Halloween** remains available independently. Missing/unknown values use the existing legacy fallback. No date-based activation, expiration, live scoreboard or new polling is present.

Utes uses the normal configured inactivity/rotation values (currently 90/30 seconds); test mode remains 15/10. Halloween alone retains its existing five-minute exception. Clock and weather code/intervals are unchanged.

## Touchdown Drive

- 60 seconds of active play. Tap the receiver marked OPEN; the visible defender separates during an open window.
- Three gently moving receivers; opening phase varies per round and the window narrows as touchdowns accumulate.
- Each completion advances 20 yards from the arcade starting position of 20. Four completions score a touchdown and start the next drive. A completion resets downs; four misses start a new drive.
- Throws have a 900 ms cooldown (1,400 ms for touchdown celebration); double input cannot farm score. A 120 ms boundary grace accommodates the 100 ms display tick.
- Top 10: touchdowns descending, then complete passes descending, then misses ascending. The UI labels these as simplified arcade rules, not a full football simulation.

## Rivalry Trivia

- 60 seconds, eight unique questions drawn from a bilingual pool of sixteen. Both questions and answer options are shuffled anew.
- Mix of Utah, BYU, stadium/Olympics history and NCAA scoring. Correct/wrong feedback includes a short explanation and source name. Next advances after answering; answers lock to prevent duplicate scoring.
- The round ends on the eighth answer or the deadline. The last answered question counts immediately.
- Top 10: correct answers descending, then active elapsed milliseconds ascending. The clock includes time reading feedback; explicit pause/background time is excluded.

## Records, privacy and lifecycle

Each game uses a separate versioned localStorage key under `streex.game-weekend`. Optional nickname is trimmed, stripped of controls/bidi overrides and capped at 20 characters; React renders it as text. Blank names use Guest/Invitado. Only ten entries persist per game. Storage corruption/quota/security failures do not block play or replay. One save is permitted per finish screen. Records survive reload on the same origin/browser but are removed if that browser data is cleared; there is no daily reset, account or sync.

Names, answers, touch coordinates and score details are **not** sent to analytics. The two game IDs extend the existing semantic allowlist for opened/started/completed events, without altering event ingestion, retries, tables or queries.

Only the selected playing game owns a 100 ms clock interval. Pause, document hidden, completion and unmount clean it up. Backgrounding pauses rather than consumes the game; explicit Resume is required. Pause dialog receives initial focus, traps Tab among its actions and supports Escape. All action targets are large; reduced motion removes atmospheric/receiver/ball/celebration animations while leaving all game choices functional.

## Sources verified November 1, 2026

No sports data is fetched during play. These primary sources support the embedded questions/copy:

- [Utah schedule](https://utahutes.com/sports/football/schedule): Utah vs BYU, November 7, Rice-Eccles Stadium; currently 10 AM Mountain. Verify kickoff again before publication if the release is delayed; it is static copy, not a live feed.
- [Rice-Eccles — Utah Athletics](https://static.utahutes.com/custompages/uteathletics_com/facilities/rice-eccles-stadium.html): home stadium, 1998 opening, 2002 Olympic ceremonies.
- [University of Utah Olympics](https://olympics.utah.edu/): 2002 opening/closing ceremonies.
- [About the U](https://about.utah.edu/): February 28, 1850 founding.
- [Utah Spirit](https://utahutes.com/sports/cheerleading): Swoop.
- [BYU quick facts](https://byucougars.com/byu-football-quick-facts): Provo, Cougars, Cosmo, blue/white, 1875 founding, LaVell Edwards Stadium.
- [NCAA Rule 8](https://ncaaorg.s3.amazonaws.com/championships/sports/football/rules/PRMFB_RulesBook.pdf): touchdown 6, field goal 3, safety 2, try kick 1, touchdown on try 2.

## Validation and actual local evidence

Local browser uses the existing QA harness: server functions/Supabase auth are replaced at module resolution, local config is a dedicated fixture storage key, and CSP blocks external connections. Spotify playback/weather/artwork are fixtures. No passenger/device/production service was controlled during QA.

Automated tests cover theme JSON persistence in both modes, older-theme fallback/restoration, arcade scoring, cooldown, expiry, pause/resume, replay, 50 extended round simulations, trivia answer locking/deck uniqueness/correct remapping, ranking tie breakers, capped persistence and blocked/corrupted storage. Existing Passenger/Spotify/Analytics tests also run. Final results: **128 tests passing, 128,628 assertions**, TypeScript, focused ESLint (including the QA harness), production build and `git diff --check` passed. Build/typecheck ran from a credential-free local validation copy using the pinned existing dependency lockfile; production service URLs were replaced with localhost placeholders for the build. No dependencies changed.

Actual browser verification includes: both games selected and started; Drive completion, touchdown, pause, background fixture and natural deadline/result; Trivia eight-answer finish with feedback; independent named records; local Admin Save config/reload for Accent and Utes; original three games restored in Original/Accent, Midnight Hunt restored in Halloween with no Utes decoration; Spotify fixture play/pause; timers 1 playing / 0 paused, hidden, finished and after exit; three repeated Drive/Trivia → Music transitions stayed at one active / zero exited timers with no console errors. Sizes: 1280×800 Lite and 1024×640 Complete. Reduced-motion declarations applied through the local fixture (not OS emulation). Physical tablet/Fully performance, native Android keyboard and actual Spotify audio remain owner QA after an approved release.

Real local screenshots (not mockups):

- [Home](evidence/passenger-utes-weekend/home.jpg)
- [Two-game menu](evidence/passenger-utes-weekend/games-menu.jpg)
- [Touchdown Drive](evidence/passenger-utes-weekend/touchdown-drive.jpg)
- [Rivalry Trivia](evidence/passenger-utes-weekend/rivalry-trivia.jpg)
- [Answer feedback](evidence/passenger-utes-weekend/trivia-feedback.jpg)
- [Drive records](evidence/passenger-utes-weekend/drive-records.jpg)
- [Trivia records](evidence/passenger-utes-weekend/trivia-records.jpg)
- [Music](evidence/passenger-utes-weekend/music.jpg)
- [Idle](evidence/passenger-utes-weekend/idle.jpg)
- [Matchup rail](evidence/passenger-utes-weekend/idle-matchup.jpg)
- [Admin selector](evidence/passenger-utes-weekend/admin-theme-selector.jpg)
- [Accent comparison](evidence/passenger-utes-weekend/accent-home-comparison.jpg)
- [Complete compact menu](evidence/passenger-utes-weekend/complete-1024-games.jpg)
- [Compact Drive / motion reduction fixture](evidence/passenger-utes-weekend/drive-1024-reduced-motion.jpg)
- [Compact Spanish Trivia](evidence/passenger-utes-weekend/trivia-1024-spanish.jpg)
- [Machine-readable local observations](evidence/passenger-utes-weekend/qa-results.json)
