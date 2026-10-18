import type { PropsWithChildren } from "react";

import { DiceContext, type DiceContextValue } from "@/components/dice/dice-context";

/** Dice for screens with a roller (the buy dialog's price dice): every roll is 3 and 4. */
const testDice: DiceContextValue = {
  roll: async () => [3, 4],
  preload: () => undefined,
};

export function TestDiceProvider({ children }: PropsWithChildren) {
  return <DiceContext.Provider value={testDice}>{children}</DiceContext.Provider>;
}
