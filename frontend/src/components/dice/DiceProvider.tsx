import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { DiceContext, type DiceContextValue } from "./dice-context";
import { createDiceEngine, type DiceEngine } from "./dice-engine";

const DICE_OVERLAY_ID = "dice-box-overlay";
/** How long the dice stay on the table after they settle. */
export const DICE_LINGER_MS = 2000;

const BASE_URL = import.meta.env.BASE_URL || "/";
const DICE_ASSET_PATH = `${BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`}assets/dice-box/`;

/**
 * Owns the app's single dice-box engine (PERF-39). dice-box is downloaded the first time a
 * roller asks for it, rolls in one fullscreen overlay, and is torn down when the app unmounts,
 * instead of every roller mount creating a WebGL context, physics worker and resize listener.
 */
export function DiceProvider({ children }: PropsWithChildren) {
  const engineRef = useRef<DiceEngine | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const pendingRollsRef = useRef(0);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  const getEngine = useCallback(() => {
    engineRef.current ??= createDiceEngine({
      container: `#${DICE_OVERLAY_ID}`,
      assetPath: DICE_ASSET_PATH,
    });
    return engineRef.current;
  }, []);

  const cancelClearTimer = useCallback(() => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const scheduleClear = useCallback(() => {
    cancelClearTimer();
    if (pendingRollsRef.current > 0) {
      return; // A queued roll is still to come; it clears the table when it settles.
    }
    clearTimerRef.current = window.setTimeout(() => {
      clearTimerRef.current = null;
      engineRef.current?.clear();
      setIsOverlayVisible(false);
    }, DICE_LINGER_MS);
  }, [cancelClearTimer]);

  useEffect(
    () => () => {
      cancelClearTimer();
      engineRef.current?.destroy();
      engineRef.current = null;
    },
    [cancelClearTimer]
  );

  const preload = useCallback(() => {
    getEngine()
      .load()
      .catch(() => undefined); // The first roll retries and falls back to random values.
  }, [getEngine]);

  const roll = useCallback<DiceContextValue["roll"]>(
    async (notation, { themeColor } = {}) => {
      cancelClearTimer();
      pendingRollsRef.current += 1;
      setIsOverlayVisible(true);
      try {
        return await getEngine().roll(notation, themeColor);
      } finally {
        pendingRollsRef.current -= 1;
        scheduleClear();
      }
    },
    [cancelClearTimer, getEngine, scheduleClear]
  );

  const value = useMemo(() => ({ roll, preload }), [preload, roll]);

  return (
    <DiceContext.Provider value={value}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(
            <div
              id={DICE_OVERLAY_ID}
              data-testid="dice-overlay"
              aria-hidden="true"
              className={cn(
                "dice-box-surface pointer-events-none fixed inset-0 z-[80] transition-opacity duration-200",
                isOverlayVisible ? "opacity-100" : "opacity-0"
              )}
            />,
            document.body
          )
        : null}
    </DiceContext.Provider>
  );
}
