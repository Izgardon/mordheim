import { useCallback, useState } from "react";

/**
 * The pre-battle rolls made on this page (William, 5 Nov 2026), the faces by unit and roll: kept
 * while the page is open, whichever warband is shown, and never sent. Nothing applies them: the
 * player leaves a unit out or edits its stats himself.
 */
export function usePrebattleRolls() {
  const [faces, setFaces] = useState<Record<string, number[]>>({});
  const setRoll = useCallback((key: string, rolled: number[] | null) => {
    setFaces((before) => {
      const next = { ...before };
      if (rolled) next[key] = rolled;
      else delete next[key];
      return next;
    });
  }, []);
  return { faces, setRoll };
}

export type PrebattleRolls = ReturnType<typeof usePrebattleRolls>;
