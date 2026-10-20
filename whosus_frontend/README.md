# Frontend architecture

React 19, TypeScript 5.7, Vite 6, React Three Fiber/Three.js, Zustand, and plain CSS. The application changes screens from authoritative room state; it has no URL router, account authentication, or token-refresh service. Reconnect authentication uses the existing `whosus-session` token in `sessionStorage`.

## Structure

```text
src/
  app/                    Entry point, composition, and session startup
    hooks/                Profile persistence and application lifecycle
  components/
    ui/                   Reusable Modal and typed GameSelect controls
    feedback/             WebGL error boundary
  config/                 Public environment validation and backend URL helpers
  features/
    appearance/           Appearance store, wardrobe, clothing, character model, CSS
    chat/                 Chat panel and mobile keyboard behavior
    game/
      actions/            Player actions and station/seat interactions
      audio/              Interaction sounds
      components/         HUD, meetings, joystick, hold controls
      hooks/              Keyboard, focus, and touch input lifecycle
      model/              Shared game types, Zustand state, world and movement
      network/            Session client and typed server-message boundary
    lobby/                Home/menu, room forms, room rules, discovery API, bot controls
    scene/                Station, waiting room, actors, camera, effects, diagnostics
    settings/             Mission, sound, graphics, and microphone settings
    tasks/                Task lifecycle, practice, individual minigames and sounds
    voice/                Peer-to-peer WebRTC lifecycle and voice controls
  lib/                    Small feature-independent validation helpers
  services/               HTTP JSON requests and shared socket send access
  styles/                 Existing global CSS and responsive overrides
test/                     Playwright scripts, lightweight model checks and helpers
scripts/                  Import-cycle and shared-boundary validation
public/                   Existing model URLs and static assets
assets/                   Existing Blender/Python asset-generation tools
```

The original flat modules were moved or split as follows:

| Previous location                                       | Current owner                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `main.tsx`, `App.tsx`                                   | `app/` composition; session hook; feature UI and controls                                         |
| `Scene.tsx`                                             | `features/scene/` actors, camera, station and diagnostics; `features/appearance/` character model |
| `TaskMinigames.tsx`                                     | `features/tasks/` lifecycle, practice, sounds and twelve minigames                                |
| `network.ts`, `store.ts`, `types.ts`, `world.ts`        | `features/game/` network and model; shared socket send service                                    |
| `voice.ts`                                              | `features/voice/voice-client.ts`                                                                  |
| `Wardrobe.tsx`, `CharacterClothes.tsx`, `appearance.ts` | `features/appearance/`                                                                            |
| `RoomRules.tsx`, `devPlayers.ts`                        | `features/lobby/`                                                                                 |
| `EliminationEffect.tsx`, `interactions.ts`, `audio.ts`  | Scene effects; game actions; game audio                                                           |
| `backend.ts`, `components/*`                            | `config/backend.ts`; reusable `components/ui/`                                                    |
| `styles.css`, `experience.css`, `wardrobe.css`          | `styles/`; appearance-specific stylesheet                                                         |

## Boundaries and conventions

- Application composition can import features. Shared UI, configuration, services, and library utilities cannot import feature implementations at runtime.
- Import feature implementations directly. No blanket barrel files or compatibility copies of the old flat source layout are retained. `@/` resolves to `src/` in both TypeScript and Vite.
- React component files use PascalCase; hooks and other modules use kebab-case. Put new logic with the feature that owns it. Create a shared module only when it has an actual shared responsibility.
- Game domain types live in `features/game/model/types.ts`; wire envelopes live in `features/game/network/protocol.ts`. Voice-specific types live with voice, and room-discovery response types live with the room API.
- `game-client.ts` owns session recovery and dispatch. `services/game-socket.ts` owns send access so voice does not import the game client. Movement state has a separate model. The client's explicit movement/send exports remain the integration/diagnostic interface.
- Preserve existing endpoint names, payloads, session keys, game timing, collision data, DOM classes, and model URLs. The backend is unchanged by this refactor.
- Voice remains browser-to-browser WebRTC locally and in deployment, using the configured `STUN_URL`. There is no WSS audio transport or transport-selection setting.
- The host's **Fill to N with bots** control sends `fill_bots` over the existing game socket. Bots are server-controlled, named `bot-1`, `bot-2`, etc., marked **BOT** in the crew list and auto-ready. Crew bots complete tasks; impostor bots pursue and eliminate crewmates. The old browser test-player sockets have been removed.
- Tap headphones to join and listen with the microphone muted. Tap the mic to unmute, or hold the talk button / V to speak temporarily. Joining still requests browser microphone permission. Game controls suppress mobile text selection and long-press menus; chat inputs retain normal editing.
- Keep global CSS import order: base styles, then responsive/experience overrides. The stylesheet cascade remains global to preserve existing UI; wardrobe styles stay with appearance.

## Configuration and commands

Use Node.js 22.13+ and the existing backend. See the [project guide](../README.md) for backend setup, deployment, and game rules.

`VITE_BACKEND_ORIGIN` is a public HTTP(S) origin. It is validated during Vite configuration and at the browser boundary; credentials, paths, query strings, and fragments are rejected. Do not put secrets in Vite environment variables. An unset origin uses the development proxy. `WHOSUS_DEV_BACKEND` overrides that proxy for isolated testing.

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run check:architecture
npm.cmd run format:check
npm.cmd run build
```

ESLint checks recommended JavaScript/TypeScript rules, hook ordering, complete effect dependencies, and type-only imports. TypeScript retains strict checking and additionally rejects unused locals/parameters. Prettier provides formatting independently of ESLint. New dependencies are development tools/types only; the runtime stack is unchanged.

For browser checks, start Vite and the backend first. Set `WHOSUS_BROWSER` if Playwright Chromium is not installed in its default location, and `WHOSUS_TEST_URL` for a frontend on another port. Node-run test scripts correctly use `process.env`; browser source uses `import.meta.env`.

```powershell
npm.cmd run test:models
npm.cmd run test:session
npm.cmd run test:voice
npm.cmd run test:voice-errors
npm.cmd run test:mobile-chat
npm.cmd run test:movement
npm.cmd run test:room
npm.cmd run test:bots
npm.cmd run test:scene
npm.cmd run test:wardrobe
npm.cmd run test:seating
npm.cmd run test:browser
```

The model checks cover environment validation, message decoding, appearance normalization, collision/movement, socket serialization, and room API success/error validation. Session checks cover room creation/joining, discovery, chat, authenticated resume, and leave. The bot test uses the real lobby, HUD and backend with the scene stubbed out; it checks labels, names, independent movement, kick/refill, readiness, launch and actual task progress (and observes impostor kills when the human is crew). Existing voice tests still measure decoded audio between real browser peers. The mobile test emulates keyboard viewport changes; it does not replace a physical-device check.

Restart Vite after source edits before running browser scripts. Their direct development-module imports must resolve to the same module instances as the app. Browser screenshots and test artifacts stay in the ignored `artifacts/` directory.

Run render-heavy suites sequentially when using software WebGL; concurrent rendered suites caused resource-related action timeouts during validation.

## Audit baseline and remaining scope

Before refactoring:

| Check                                              | Observed result                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| Existing production build                          | Passed, with the existing large-bundle warning                   |
| Existing voice, voice-error and mobile-chat suites | Passed                                                           |
| TypeScript unused-code checks                      | Three unused imports                                             |
| Formatting                                         | Differences in 17 source/configuration files                     |
| Import graph                                       | Runtime cycle between networking and voice                       |
| Room browser suite                                 | Failed because it treated the custom combobox as a native select |
| Scene browser suite                                | Failed its four-nameplate size/count check                       |
| ESLint                                             | Not configured                                                   |

The room and combined browser tests now operate the actual combobox without changing its visible UI. The room test walks from the arrival seats to the practice console and checks actual rectangle intersection for mobile label overlap. Failed layout assertions remain enabled.

## Refactor validation

Executed against the local FastAPI backend on port 8001 and Vite on port 5174 with Playwright Chromium:

| Command                                                   | Observed result                                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck`, `lint`, `check:architecture`, `format:check` | Passed; no runtime import cycles or shared-to-feature dependencies                                                                                                  |
| `build`                                                   | Passed; existing large-chunk warning remains                                                                                                                        |
| `test:models`                                             | Passed; validation, normalization, movement, socket serialization and room API error handling                                                                       |
| `test:session`                                            | Passed; create/join, real room discovery, chat, authenticated reload/resume and leave                                                                               |
| `test:voice`                                              | Passed; actual decoded WebRTC audio, mute/PTT/deafen, reconnect and channel policy                                                                                  |
| `test:voice-errors`                                       | Passed; setup failures and bounded retry deadline                                                                                                                   |
| `test:mobile-chat`                                        | Passed; 16px input, focus scale, keyboard clearance, text delivery and viewport bounds                                                                              |
| `test:movement`                                           | Passed; prediction, held input, heartbeats, authoritative movement and release                                                                                      |
| `test:scene`                                              | Failed the same post-launch four-nameplate check seen before the refactor; waiting-room movement and viewport checks passed first                                   |
| `test:room`                                               | Capacity, colors, kick/refill, privacy, host rules, practice completion and cancellation passed before the mobile practice-label/nameplate overlap assertion failed |
| `test:seating`                                            | Arrival, click/E interactions, movement standing and peer seat updates passed; timed out waiting for the rendered Sit down control after reload                     |

The combined `test:browser` suite passed four rendered players, text chat, decoded WebRTC audio, movement, meetings, voting, crew victory, rematch, authenticated reconnect and mobile layouts. Its mobile wait now follows the visible Crew & room button used by the responsive layout.

The `test:wardrobe` suite passed category selection, station proximity, console interaction, appearance persistence, room creation/joining, live peer updates, authenticated resume and mobile bounds, with no browser errors.

The session and voice tests grant Chromium's `local-network-access` permission in their temporary contexts for direct requests between local development ports. This is a test-harness permission; production networking is unchanged. The generated production CSS retains its baseline content hash (`index-DHppf5BM.css`).

Static-asset generators and editable Blender sources are retained. Global style scoping, deeper splitting of the cohesive WebRTC state machine, production bundle splitting, physical mobile/WebGL performance, internet NAT traversal, and load testing remain separate work. This refactor does not add routing or an account system.
