import { create } from "zustand";
import { COLORS } from "./types";

export const WARDROBE = {
  hat: {
    label: "Hats",
    items: [
      ["none", "No hat"],
      ["sprout", "Little sprout"],
      ["antenna", "Antenna"],
      ["beanie", "Cozy beanie"],
      ["cap", "Flight cap"],
      ["cowboy", "Space cowboy"],
      ["crown", "Crew royalty"],
      ["wizard", "Star wizard"],
      ["headphones", "Headphones"],
      ["cat", "Cat ears"],
      ["halo", "Halo"],
    ],
  },
  outfit: {
    label: "Outfits",
    items: [
      ["none", "Original shell"],
      ["flight", "Flight suit"],
      ["overalls", "Garden overalls"],
      ["dress", "Starlight dress"],
      ["captain", "Captain's coat"],
      ["hoodie", "Cozy hoodie"],
      ["lab", "Lab coat"],
      ["tuxedo", "Secret agent"],
    ],
  },
  visor: {
    label: "Facewear",
    items: [
      ["none", "Original face"],
      ["glasses", "Round glasses"],
      ["shades", "Sunglasses"],
      ["goggles", "Flight goggles"],
      ["monocle", "Monocle"],
    ],
  },
  accessory: {
    label: "Backpacks",
    items: [
      ["none", "No extra gear"],
      ["pack", "Trail pack"],
      ["jetpack", "Jetpack"],
      ["wings", "Little wings"],
      ["cape", "Hero cape"],
      ["scarf", "Cozy scarf"],
    ],
  },
  boots: {
    label: "Boots",
    items: [
      ["original", "Original boots"],
      ["ivory", "Moon boots"],
      ["mint", "Mint sneakers"],
      ["coral", "Coral sneakers"],
      ["gold", "Golden boots"],
    ],
  },
} as const;
export type CosmeticSlot = keyof typeof WARDROBE;
export type Cosmetics = Record<CosmeticSlot, string>;
export type Appearance = Cosmetics & { color: number };
export const DEFAULT_APPEARANCE: Appearance = {
  color: 0,
  hat: "sprout",
  outfit: "none",
  visor: "none",
  accessory: "none",
  boots: "original",
};
export function normalizeAppearance(value: Partial<Appearance>): Appearance {
  const result = { ...DEFAULT_APPEARANCE };
  if (
    Number.isInteger(value.color) &&
    value.color! >= 0 &&
    value.color! < COLORS.length
  )
    result.color = value.color!;
  for (const slot of Object.keys(WARDROBE) as CosmeticSlot[]) {
    if (WARDROBE[slot].items.some(([id]) => id === value[slot]))
      result[slot] = value[slot]!;
  }
  return result;
}
function savedAppearance() {
  try {
    return normalizeAppearance(
      JSON.parse(localStorage.getItem("whosus-appearance") || "{}") || {},
    );
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}
export const useAppearance = create<{
  appearance: Appearance;
  update: (patch: Partial<Appearance>) => void;
}>((set) => ({
  appearance: savedAppearance(),
  update: (patch) =>
    set((state) => {
      const appearance = normalizeAppearance({ ...state.appearance, ...patch });
      try {
        localStorage.setItem("whosus-appearance", JSON.stringify(appearance));
      } catch {
        /* Storage may be unavailable. */
      }
      return { appearance };
    }),
}));
