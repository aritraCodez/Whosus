export function makeDefaultName() {
  return `Explorer-${Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0")
    .toUpperCase()}`;
}
