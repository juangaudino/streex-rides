# Passenger 2.0 — Home and Idle navigation checkpoint

November 6, 2026. Owner approved continuing the Passenger 2.0 Home/Idle navigation and accessibility block. This is a local, scoped UX05 improvement on top of the locally committed Music continuity slice. UX05 remains partial until real-device and assistive-technology verification. PA01/PA02 and formal theme system B01 remain open; the master S05.1-R pointer is unchanged.

## Changes

- While Idle is open, the underlying console is inert. It cannot receive clicks or keyboard focus and is removed from the browser's accessibility tree. The Idle surface is a labelled modal dialog with a focused, descriptive entry point.
- Tab/Shift+Tab remain within visible, enabled Idle controls and dynamically account for the rotating rail. Focus cannot escape into the background. Focus and listeners are cleaned up when the layer closes or changes.
- While the dim overlay is active, its wake button is the only active Idle control. The first click, Enter or Space wakes the display without leaving Idle. A later ordinary touch or Escape enters Home. The physical brightness mechanism is unchanged.
- Escape and Enter/Space on the Idle dialog itself provide keyboard access to the normal wake/resume action. Existing Music, Games, Services, Your Ride and More actions retain their destinations. After leaving Idle or navigating between views, the named main region receives focus without scrolling; the selected navigation button exposes `aria-current`.
- Tab, navigation and modifier keys inside Idle are not treated as passenger engagements by the existing global first-interaction handler; actions, pointer interactions, event IDs, and existing session/idle/engagement semantics otherwise remain as before. This specifically prevents a standalone Shift keydown from a Shift+Tab from inventing an engagement.
- Home/Idle and navigation buttons receive visible keyboard focus indicators, the weather trigger identifies its existing dialog, and Idle Music/dim/navigation labels support EN/ES.
- For landscape screens of 900px or wider and at most 700px high, the existing pre-change 1024×640 clipping is corrected: compact metadata/visualizer, 44px or taller dim control, phone QR and two-column weather area. The primary 1280×800 tablet composition and other screen styles remain outside this media query. Visualizer bars are bounded to their compact lane.

## Verification

- 143 tests, zero failures, 128,898 assertions; includes six focused tests for wrap, disabled/hidden/inert controls, rotating controls, escaped focus, modifier-key Analytics isolation and 100 mount/dim/unmount cycles.
- TypeScript, focused ESLint and production build passed with local dummy integration settings. Existing deprecation and chunk warnings remain. `git diff --check` passed. Validation copy overlays the changed files on the already validated `03407c8` baseline; external application functions are local fixtures. No production requests, database writes, schema or credential changes.
- Browser UI at 1280×800: direct Idle access to Music, Utes Games, Services, Your Ride, More and Home all led to their existing destination with focus in its main region. A generic touch/press and Escape returned Home. Tab/Shift+Tab wrapped within Idle and created no new fixture engagement. On dim, focus and accessibility tree contained only the wake action; first activation stayed in Idle. Home accessibility tree was absent until resume. Tested Spanish and English, Original Complete and Accent/Utes Lite, plus Halloween Lite with reduced-motion declarations.
- With the weather dialog open, the configured 15-second test inactivity timer closed it and placed focus on Idle; no user interaction was required.
- At 1024×640 the before image documents the existing clipping in `03407c8`; after adjustment, dim is 44px high, QR fits within Glance, and four Utes rail contents leave the phone panel at the same x/y/width/height. No horizontal document overflow in the inspected fixture. The QA advance controls are fixture-only and not part of the product.
- These checks are mocked browser evidence, not physical Fully/Android, real screen-reader certification, actual offline/internet transitions, or live Analytics validation. Playback/source and weather services were not contacted. Prior Music end-of-track and in-vehicle stationary QA remain required before production acceptance.

Evidence lives in [navigation screenshots and fixture results](evidence/passenger-2-navigation/), including the [before](evidence/passenger-2-navigation/baseline-halloween-1024.jpg) / [after](evidence/passenger-2-navigation/halloween-idle-es-1024-final.jpg) 1024×640 comparison, [Utes at 1280×800](evidence/passenger-2-navigation/utes-idle-1280-final.jpg), and keyboard/dim states.

## Release and next work

This checkpoint continues on `feat/passenger-2-music-continuity`; it builds on commit `03407c8`. No push, merge, Vercel deployment or production data change. Restore the previously recorded stable deployment or revert this bounded commit after an authorized release if required. Before release, repeat a stationary tablet smoke test for waking/dim, Home and direct destinations, Spotify search/play/next/end-of-track, Idle timing, QR scan and Analytics.

Next Passenger block: measure rendering and request behavior on the actual tablet before making performance changes, then review remaining Music/offline states and full theme consistency. No FPS or CPU savings are claimed without device/production measurements.
