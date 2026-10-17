import { createContext, useContext } from "react";

export type DiceRollOptions = {
  themeColor?: string;
};

export type DiceContextValue = {
  /** Rolls in the shared 3D overlay and resolves with the die values. */
  roll: (notation: string, options?: DiceRollOptions) => Promise<number[]>;
  /** Starts loading the engine in the background (e.g. when a dialog with a roller opens). */
  preload: () => void;
};

export const DiceContext = createContext<DiceContextValue | null>(null);

export function useDice() {
  const context = useContext(DiceContext);
  if (!context) {
    throw new Error("useDice must be used within DiceProvider");
  }
  return context;
}
