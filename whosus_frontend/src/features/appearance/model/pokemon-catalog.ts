export const POKEMON = [
  ["eevee", "Eevee"],
  ["pikachu", "Pikachu"],
  ["rowlet", "Rowlet"],
  ["sprigatito", "Sprigatito"],
  ["piplup", "Piplup"],
  ["jigglypuff", "Jigglypuff"],
  ["togepi", "Togepi"],
  ["squirtle", "Squirtle"],
  ["charizard", "Charizard"],
] as const;

export type PokemonId = (typeof POKEMON)[number][0];

export function isPokemon(value?: string): value is PokemonId {
  return POKEMON.some(([id]) => id === value);
}
