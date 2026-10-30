/** One die of `sides` sides, from the browser's cryptographic random source. */
export function rollDie(sides: number) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] % sides) + 1;
}

/** `count` dice of `sides` sides. */
export const rollDice = (count: number, sides = 6) =>
  Array.from({ length: count }, () => rollDie(sides));
