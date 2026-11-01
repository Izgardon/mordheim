import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { SWORDS_FADE_MS, swordClashMinMs } from "@/components/ui/sword-clash";

/** Tells the battle's entrance that the page under it is ready (or failed); `BattleLayout` sets it. */
export const BattleEntranceReady = createContext<() => void>(() => undefined);

export type BattleEntrance = {
  /** The swords are up. */
  showing: boolean;
  /** They are fading out onto the battle screen. */
  leaving: boolean;
  /** The page under them is ready. */
  ready: () => void;
};

/**
 * The swords as a player enters the battle screen (William, 1 Nov 2026), from the overview,
 * Rejoin, Start or an invitation turning into the fight: they come up the moment `entering` turns
 * true, already on its first frame, and stay for one full strike (`swordClashMinMs`) even when
 * everything is loaded, and until the page under them is ready if that takes longer. Then they
 * fade out onto the page, which is already drawn underneath.
 */
export function useBattleEntrance(entering: boolean): BattleEntrance {
  // Each time `entering` turns true is a new entrance. Set during render, so the frame that first
  // shows the battle's page already has the swords over it.
  const [was, setWas] = useState(entering);
  const [entrance, setEntrance] = useState(entering ? 1 : 0);
  if (entering !== was) {
    setWas(entering);
    if (entering) setEntrance((current) => current + 1);
  }
  const [struck, setStruck] = useState(0);
  const [readyFor, setReadyFor] = useState(0);
  const [gone, setGone] = useState(0);

  useEffect(() => {
    if (!entrance) return;
    const timer = window.setTimeout(() => setStruck(entrance), swordClashMinMs());
    return () => window.clearTimeout(timer);
  }, [entrance]);

  const leaving = entering && entrance > 0 && struck === entrance && readyFor === entrance;
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setGone(entrance), SWORDS_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [entrance, leaving]);

  const ready = useCallback(() => setReadyFor(entrance), [entrance]);
  return { showing: entering && entrance > 0 && gone !== entrance, leaving, ready };
}

/** The battle's page says, once it is drawn (or has failed), that the swords may go. */
export function useBattleEntranceReady(isReady: boolean) {
  const ready = useContext(BattleEntranceReady);
  useEffect(() => {
    if (isReady) ready();
  }, [isReady, ready]);
}
