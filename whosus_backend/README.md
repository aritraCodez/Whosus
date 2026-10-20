# Backend architecture

FastAPI 0.115.12, Pydantic 2.11.4, pydantic-settings 2.9.1, Uvicorn 0.34.2, and pip requirements. The refactor was verified on Python 3.13.14; source and tooling target Python 3.11+. The application has no database, ORM, storage service, account system, external HTTP API, or file-backed game persistence.

## Structure and ownership

```text
app/
  main.py                       Application factory, middleware, lifespan, router composition
  app.py                        Existing local runner
  dependencies.py               Typed access to the owning application's runtime
  runtime.py                    Temporary matches, typed sessions, takeover locks, shutdown
  core/
    config.py                   Validated environment settings, without runtime singletons
    limits.py                   Existing transport, capacity and retention limits
    security.py                 Connection rate bucket and printable-text policy
  features/
    appearance/catalog.py       Existing cosmetic choices and request literals
    game/
      service.py                Room lifecycle and authoritative simulation rules
      entities.py               Mutable player state
      world.py                  Collision, movement, station catalog and seat data
      lobby.py                  Host rules, seating, appearance, ready/start/rematch
      actions.py                Match actions, tasks, sabotage and eliminations
      communication.py          Chat eligibility and voice gains
      snapshot.py               Recipient-specific projections and role secrecy
      types.py                  Typed runtime records and shared wire shapes
      validation.py             Reusable exact-type numeric guards
      exceptions.py             Expected game-rule violations
    health/router.py            Health endpoint and its response schema
    lobby/                      Public-room router, response schema and discovery service
    realtime/                   WebSocket transport, Pydantic protocol, queue and session service
    voice/                      WebRTC signaling eligibility, activity and wire types
  services/simulation.py        Fixed-step scheduling, expiry and snapshot broadcast
tests/
  api/                          HTTP, CORS, OpenAPI and transport boundaries
  integration/                  Real ASGI sessions, chat, signaling and appearance
  unit/                         Rules, configuration, queues, lifecycle and import boundaries
  conftest.py                    Isolated application factory fixture
  helpers.py                    Shared WebSocket polling
```

The domain package `features/game` has no FastAPI, WebSocket, application-state, or transport dependency. Routers handle transport and validation; services enforce session ownership and game rules. `Runtime` belongs to one `create_app()` instance. Type-only imports resolve the domain's annotation references without creating runtime cycles. Architecture tests check the runtime graph and prohibit storage dependencies.

Request validation retains the existing combined `Message` model, bounds, defaults, smart-union values and rejection of unknown fields. Pydantic response models describe REST results and WebSocket events. Snapshot TypedDicts are shared between the domain and response validation; optional role, task-error, SDP and ICE fields keep their existing presence rules. Serialization retains camelCase keys and the `from` signaling alias.

## File migration

| Previous file                        | Current owner                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `app/main.py`                        | Factory/lifespan in `main.py`; health and discovery routers; shared simulation service |
| `app/config.py`                      | `core/config.py`; application-owned `runtime.py`                                       |
| `app/game.py`                        | Focused domain modules under `features/game/`                                          |
| `app/routes/websocket.py`            | `features/realtime/router.py` and `service.py`                                         |
| `app/models.py`, `app/connection.py` | `features/realtime/schemas.py`, `connection.py`                                        |
| `app/voice.py`, `app/cosmetics.py`   | `features/voice/service.py`, `features/appearance/catalog.py`                          |
| Flat test modules                    | `tests/unit/`, `tests/integration/`, shared test helpers                               |

The old modules are removed rather than retained as compatibility copies. The deployment entry point remains `app.main:app` and the local runner remains `python -m app.app`.

## Contracts and security

| Endpoint          | Contract                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `GET /api/health` | HTTP 200: `ok`, `game`, `rooms`; HTTP 503 with the same fields if the simulation stops unexpectedly |
| `GET /api/rooms`  | HTTP 200: eligible public lobbies, with `code`, `players`, `capacity`, `host`                       |
| `/ws`             | Existing JSON text game/session/chat/WebRTC signaling protocol                                      |

There is no `/api/v1` prefix or new authentication scheme. Temporary resume tokens continue to authenticate game sessions; roles, host privileges, input bounds, task proofs, chat recipients and signaling eligibility remain server-owned. Tokens are omitted from object representations and raw client messages are not logged. HTTP discovery is public. CORS and the WebSocket Origin check restrict browser origins; they do not authenticate non-browser clients.

Existing limits are centralized: 1,000 sessions, 20,000-character application messages, a 100-message burst refilled at 45/second per connection, a 64-event output queue, a five-second send deadline, and a 45-second receive timeout. Invalid binary frames close with 1003; origin/size/rate violations use 1008; slow consumers use 1013; superseded sessions use 4001. The runner/container also retain Uvicorn's 20,000-byte WebSocket limit.

Resume takeovers are serialized and recheck revocation after closing the previous connection. Disconnection clears voice presence and pending input. Lifespan cleanup runs even when shutdown follows an exception. A stopped simulation is logged and marks health unavailable with HTTP 503 and `ok: false`; healthy responses retain the original shape and status. HTTP handlers read state on the simulation's event loop, avoiding concurrent dictionary iteration from a worker thread. Invalid create names are rejected before allocating a room. Shared task completion removes the duplicated progress/visual-event/win transition.

`ALLOWED_ORIGINS` is required and accepts comma/semicolon-separated exact HTTP(S) origins. Credentials, paths, wildcards, fragments and invalid ports fail configuration. `STUN_URL` retains comma/semicolon parsing, validates address/port syntax and injects no defaults when absent or empty. Voice remains browser-to-browser WebRTC locally and in deployment. See the [project guide](../README.md) for client/network requirements.

## Bot players

The host can send `{"type":"action","action":"fill_bots"}` in the lobby to fill the selected capacity with server-controlled `bot-1`, `bot-2`, etc. Snapshots add `bot: true` only to bot players. Bots use no browser connections, session tokens, microphone, database, or external service. They auto-ready, walk around the lobby, navigate the station's collision map at the configured player speed, and pause during reveals, meetings, and elimination animations.

Crew bots choose unfinished tasks, walk into interaction range, wait at the station and submit the normal task challenge (including timed circuit steps). Ghost crew bots continue their tasks. Impostor bots roam during cooldown and pursue living crewmates when a kill becomes available, using the normal range, cooldown and animation checks. Crew bots also repair an active reactor emergency. Bots vote skip; they do not infer suspects, chat, report bodies, or operate voice chat.

`features/game/bots.py` owns bot decisions and transient per-bot state; `navigation.py` provides bounded A* paths with a 256-route cache over the static collision map. Host permissions, room capacity, role visibility and all action validation remain in the existing game authority. Rule changes and rematches keep bots ready. Hosts can kick bots normally; hosting transfers only to humans. Bot decisions pause when no humans are connected, and bots do not prevent abandoned rooms from expiring after the normal retention period. Restarting still clears all matches.

## Runtime limits without persistence

Run **one Uvicorn worker**. Room and token registries contain temporary match state only. They are private to that application process, are cleared at shutdown, and are neither durable nor shared between workers. Ordinary round-robin replicas cannot discover or resume each other's rooms. This architecture does not support critical durable user records or persistent account credentials.

The existing simulation forfeits disconnected active players after 45 seconds and expires disconnected lobby/post-game entries and empty rooms after 90 seconds. Session tokens die with the process. Do not use environment variables or files to make these registries appear persistent. No Redis, database, ORM, migrations, repositories or account store were added.

## Development and verification

Use the existing virtual environment, or create `.venv` on a new machine. The examples below use this workspace's `venv` path; substitute `.venv` if that is your environment name.

```powershell
venv/Scripts/python.exe -m pip install -r requirements-dev.txt
venv/Scripts/python.exe -m ruff check app tests
venv/Scripts/python.exe -m ruff format --check app tests
venv/Scripts/python.exe -m mypy
venv/Scripts/python.exe -m pytest -q
venv/Scripts/python.exe -m app.app
```

Production installs `requirements.txt`; pytest, pytest-asyncio, HTTPX, Ruff and mypy are development dependencies. Existing application-library versions are retained. `typing_extensions`, already required by Pydantic, is declared directly for TypedDict compatibility on Python 3.11. Strict mypy uses Pydantic's typed-constructor plugin. There are no type-ignore or lint-disable directives.

Before refactoring, pytest reported **118 passed, 1 failed**. The failing task test expected a wrong sequence symbol to raise, whereas the implementation and UI already reset the challenge and expose a retry message. The test now checks the reset, timestamp, retry message and incomplete state, while retaining nonce, distance and timing assertions. Gameplay was preserved.

After refactoring, **162 tests passed**, Ruff lint and format checking passed, strict mypy passed for all 39 application modules, `pip check` found no broken requirements, and `compileall` passed. New tests cover HTTP/OpenAPI shapes, application isolation, authentication takeover, capacity, invalid origins and frames, rate refill, bounded queues, stalled writers, exception cleanup, failed-simulation health, safe logging, expiry, import boundaries, and exact snapshot/optional signaling serialization.

Against the refactored backend on port 8001 and Vite on port 5174, the existing React `test:session`, `test:voice`, and `test:voice-errors` suites passed. These verify discovery, create/join, chat, authenticated resume and leave; plus decoded two-way WebRTC audio, PTT, mute/deafen, stale signaling, media reconnect, proximity, living/ghost policy, meetings, post-game audio, bounded setup errors and cleanup. Both direct and proxied health requests returned the expected healthy response. Chromium initially blocked the voice harness's cross-port loopback WebSocket with `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`; the voice test now grants `local-network-access` in its temporary browser contexts, as the session harness already did. Product browser permissions and frontend runtime code were not changed.

The existing Starlette TestClient emits an AnyIO `BlockingPortal` deprecation warning. It is recorded rather than filtered. Docker engine availability was checked with ordinary and elevated execution; the Docker Desktop Linux engine pipe was unavailable, so no container build/run was performed. Physical-device voice, internet NAT traversal and capacity/load testing require separate validation. Browser audio policy still assumes cooperating peers; server signaling policy does not make remote client software trusted. Future concurrency scaling requires an explicit room-coordination design compatible with the no-database requirement.
