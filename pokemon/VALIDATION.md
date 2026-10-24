# Validation — 24 October 2026

- Opened `pokemon-roster.blend` through Blender MCP and verified all nine final scenes, editable character collections, cameras, and worlds. Verified all nine individual Blender files.
- Inspected the full-body renders and corrected ear boundaries, face directions, face markings, eye colors, Togepi's crown proportions, and Charizard's flame visibility.
- Validated all nine GLBs: one scene each, no studio objects, animation pivots present, finite bounds, fewer than 40,000 triangles and less than 1 MB each.
- Backend: **264 tests passed**, including character changes shared with a second player and retained after reconnect. Ruff and strict mypy checks passed.
- Frontend: TypeScript/production build, ESLint, architecture, and formatting checks passed.
- `npm run test:pokemon`: **passed** against `http://localhost:5173`. Verified all nine loaded 3D previews, local selection persistence, Charizard on the Mosslight map, server-confirmed movement, reconnect, and a 390 × 844 mobile preview. No JavaScript errors were recorded.

Browser screenshots are in `../whosus_frontend/artifacts/pokemon-*.png`. The local backend accepts the `localhost` origin; the equivalent `127.0.0.1` origin was rejected by its existing origin allowlist.

Models use simplified stylized proportions. Walking and idle motion are procedural part animations, not skeletal animation clips. Existing non-failing checks reported the large frontend bundle warning and a Starlette/AnyIO deprecation warning.
