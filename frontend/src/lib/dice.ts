/** One die of `sides` sides, from the browser's cryptographic random source. */
export function rollDie(sides: number) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] % sides) + 1;
}

/** `count` dice of `sides` sides. */
export const rollDice = (count: number, sides = 6) =>
  Array.from({ length: count }, () => rollDie(sides));

/** A roll as the rules write it: "D6", "2D6", "D66" (two D6, tens then units), "D100", "D3". */
export type Dice = `${number | ""}D${number}`;

/** The sides of each die a roll throws: [6, 6] for 2D6 and for a D66, [100] for a D100. */
export function diceSides(dice: Dice) {
  if (dice === "D66") return [6, 6];
  const [count, sides] = dice.split("D");
  return Array.from({ length: Number(count || 1) }, () => Number(sides));
}

const DICE_TOKEN = /\b(\d*)d(\d+)\b/gi;

/**
 * Text with its dice as the rules write them (William, 7 Nov 2026: "capitalise"): "2d6" is "2D6",
 * "1d6" and "d6" are "D6", "d66" is "D66". For log lines stored before they were written so.
 */
export const capitalDice = (text: string) =>
  text.replace(DICE_TOKEN, (_, count: string, sides: string) =>
    count === "1" ? `D${sides}` : `${count}D${sides}`
  );
