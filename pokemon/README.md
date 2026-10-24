# Pokémon roster for WhoSus

Nine locally authored, stylized 3D recreations: Eevee, Pikachu, Rowlet, Sprigatito, Piplup, Jigglypuff, Togepi, Squirtle, and Charizard. The designs follow the official reference artwork; proportions and surfaces are simplified for this game prototype.

- `pokemon-roster.blend`: final editable scenes, one per character. Select a character using Blender's Scene dropdown.
- `characters/<name>.blend`: individual editable character and its studio.
- `pokemon-roster-preview.png`: the full rendered roster.
- `previews/<name>.png`: full-body, 900 × 900 studio renders.
- `roster.json`: file paths, triangle counts, reference links, and game heights.
- `../whosus_frontend/public/models/pokemon/`: self-contained GLB game assets and wardrobe thumbnails.

Each scene has an editable character collection with separate facial features, limbs, markings, and details. The hidden optimized collection combines meshes by animated part and retains material slots. Studio cameras, lights, and floors are excluded from the GLBs. Characters have approximately 8,600–29,700 triangles and each GLB is below 660 KB.

In the game, open **Customize character → Characters** and choose a Pokémon. Create a room and select the **Mosslight** map. Character choice is shared with other players and restored after reconnecting. The models support procedural walking, idle motion, and ghost appearance. The ring beneath the character displays the player's signature color.

The authoring scripts are in `../whosus_frontend/assets/pokemon_builder.py`, `pokemon_models_a.py`, `pokemon_models_b.py`, and `pokemon_models_c.py`; `build_pokemon_roster.py` builds, exports, renders, and saves them. They execute in Blender through its MCP add-on using the local `../mosslight/blender_bridge.py` bridge. `package_pokemon_roster.py` writes the clean combined project and individual files. Runtime motion uses the exported named part pivots; these assets do not contain skeletal animation clips.

Official visual references, downloaded into `references/`:

- [Eevee](https://www.pokemon.com/us/pokedex/eevee)
- [Pikachu](https://www.pokemon.com/us/pokedex/pikachu)
- [Rowlet](https://www.pokemon.com/us/pokedex/rowlet)
- [Sprigatito](https://www.pokemon.com/us/pokedex/sprigatito)
- [Piplup](https://www.pokemon.com/us/pokedex/piplup)
- [Jigglypuff](https://www.pokemon.com/us/pokedex/jigglypuff)
- [Togepi](https://www.pokemon.com/us/pokedex/togepi)
- [Squirtle](https://www.pokemon.com/us/pokedex/squirtle)
- [Charizard](https://www.pokemon.com/us/pokedex/charizard)
