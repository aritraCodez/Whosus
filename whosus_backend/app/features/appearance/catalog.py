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
COSMETICS = {
    name: get_args(kind)
    for name, kind in {
        "hat": Hat,
        "outfit": Outfit,
        "visor": Visor,
        "accessory": Accessory,
        "boots": Boots,
    }.items()
}
