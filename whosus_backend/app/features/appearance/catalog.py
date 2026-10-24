from typing import Literal, get_args

Hat = Literal[
    "none",
    "sprout",
    "antenna",
    "beanie",
    "cap",
    "cowboy",
    "crown",
    "wizard",
    "headphones",
    "cat",
    "halo",
]
Outfit = Literal["none", "flight", "overalls", "dress", "captain", "hoodie", "lab", "tuxedo"]
Visor = Literal["none", "glasses", "shades", "goggles", "monocle"]
Accessory = Literal["none", "pack", "jetpack", "wings", "cape", "scarf"]
Boots = Literal["original", "ivory", "mint", "coral", "gold"]
Character = Literal[
    "pip",
    "mosslight",
    "eevee",
    "pikachu",
    "rowlet",
    "sprigatito",
    "piplup",
    "jigglypuff",
    "togepi",
    "squirtle",
    "charizard",
]
COSMETICS = {
    name: get_args(kind)
    for name, kind in {
        "character": Character,
        "hat": Hat,
        "outfit": Outfit,
        "visor": Visor,
        "accessory": Accessory,
        "boots": Boots,
    }.items()
}
