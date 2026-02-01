import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// components
import { Button } from "@components/button";
import { NumberInput } from "@components/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";

// utils
import { cn } from "@/lib/utils";

// vendor
import DiceBox from "@3d-dice/dice-box";

const DEFAULT_FIXED_NOTATION = "2d6";
const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
const MAX_DICE = 20;
const DEFAULT_DICE_COLOR = "#2e8555";

export type DiceRollerMode = "fixed" | "custom";

export type DiceRollerProps = {
  mode?: DiceRollerMode;
  fixedNotation?: string;
  assetPath?: string;
  fullScreen?: boolean;
  showResultBox?: boolean;
  showRollButton?: boolean;
  className?: string;
  themeColor?: string;
  resultMode?: "total" | "dice";
  rollSignal?: number;
  onRollComplete?: (results: unknown) => void;
};

let activeDiceOverlayId: string | null = null;
const activeDiceOverlayListeners = new Set<(id: string | null) => void>();

const setActiveDiceOverlayId = (id: string | null) => {
  activeDiceOverlayId = id;
  activeDiceOverlayListeners.forEach((listener) => listener(activeDiceOverlayId));
};

const parseDiceValues = (results: unknown): number[] => {
  const extractValues = (entry: unknown): number[] => {
    if (!entry) {
      return [];
    }
    if (typeof entry === "number") {
      return Number.isFinite(entry) ? [entry] : [];
    }
    if (entry && typeof entry === "object" && "rolls" in entry) {
      const rolls = (entry as { rolls?: unknown }).rolls;
      if (Array.isArray(rolls)) {
        return rolls
          .map((roll) => {
            if (typeof roll === "number") {
              return roll;
            }
            if (roll && typeof roll === "object" && "value" in roll) {
              const value = Number((roll as { value?: unknown }).value);
              return Number.isFinite(value) ? value : null;
            }
            return null;
          })
          .filter((value): value is number => Number.isFinite(value));
      }
    }
    if (entry && typeof entry === "object" && "value" in entry) {
      const value = Number((entry as { value?: unknown }).value);
      return Number.isFinite(value) ? [value] : [];
    }
    return [];
  };

  if (Array.isArray(results)) {
    return results.flatMap(extractValues);
  }

  return extractValues(results);
};

export default function DiceRoller({
  mode = "fixed",
  fixedNotation = DEFAULT_FIXED_NOTATION,
  assetPath = "/assets/dice-box/",
  fullScreen = false,
  showResultBox = true,
  showRollButton = true,
  className,
  themeColor,
  resultMode = "total",
  rollSignal,
  onRollComplete,
}: DiceRollerProps) {
  const containerId = useMemo(
    () => `dice-box-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const diceBoxRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [diceCount, setDiceCount] = useState(2);
  const [diceSides, setDiceSides] = useState<(typeof DICE_SIDES)[number]>(6);
  const [error, setError] = useState("");
  const [lastRollValues, setLastRollValues] = useState<number[]>([]);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(
    activeDiceOverlayId
  );
  const lastHandledRollSignal = useRef<number | null>(null);
  const resolvedThemeColor = themeColor ?? DEFAULT_DICE_COLOR;
  const lastRollTotal = useMemo(
    () => lastRollValues.reduce((sum, value) => sum + value, 0),
    [lastRollValues]
  );

  useEffect(() => {
    const listener = (id: string | null) => setActiveOverlayId(id);
    activeDiceOverlayListeners.add(listener);
    return () => {
      activeDiceOverlayListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;

    const diceBox = new DiceBox({
      container: `#${containerId}`,
      assetPath,
      themeColor: resolvedThemeColor,
      offscreen: false,
      onRollComplete: (results: unknown) => {
        setLastRollValues(parseDiceValues(results));
        onRollComplete?.(results);
      },
    });

    diceBoxRef.current = diceBox;

    diceBox
      .init()
      .then(() => {
        if (mounted) {
          setIsReady(true);
        }
        const observedElement = containerRef.current;
        if (observedElement && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            diceBoxRef.current?.resizeWorld?.();
          });
          resizeObserver.observe(observedElement);
        }
        requestAnimationFrame(() => {
          diceBoxRef.current?.resizeWorld?.();
        });
      })
      .catch((initError: unknown) => {
        console.error("Failed to initialize DiceBox", initError);
        if (mounted) {
          setError("Unable to load dice renderer.");
        }
      });

    return () => {
      mounted = false;
      const observedElement = containerRef.current;
      if (resizeObserver && observedElement) {
        resizeObserver.unobserve(observedElement);
      }
      try {
        diceBoxRef.current?.clear?.();
      } catch {
        // best-effort cleanup
      }
      if (activeDiceOverlayId === containerId) {
        setActiveDiceOverlayId(null);
      }
    };
  }, [assetPath, containerId, fullScreen, onRollComplete]);

  useEffect(() => {
    if (!diceBoxRef.current) {
      return;
    }
    diceBoxRef.current.updateConfig?.({ themeColor: resolvedThemeColor });
  }, [resolvedThemeColor]);

  const rollNotation = mode === "custom" ? `${diceCount}d${diceSides}` : fixedNotation;

  const handleRoll = useCallback(async () => {
    if (!diceBoxRef.current || !isReady) {
      return;
    }

    setError("");
    setIsRolling(true);
    if (fullScreen) {
      setActiveDiceOverlayId(containerId);
    }
    try {
      await diceBoxRef.current.roll(rollNotation, { themeColor: resolvedThemeColor });
    } catch (rollError) {
      console.error("Dice roll failed", rollError);
      setError("Dice roll failed. Try again.");
    } finally {
      setIsRolling(false);
    }
  }, [containerId, fullScreen, isReady, resolvedThemeColor, rollNotation]);

  useEffect(() => {
    if (rollSignal === undefined || rollSignal <= 0) {
      return;
    }
    if (rollSignal === lastHandledRollSignal.current) {
      return;
    }
    if (isRolling || !isReady) {
      return;
    }
    lastHandledRollSignal.current = rollSignal;
    handleRoll();
  }, [rollSignal, isReady, isRolling, handleRoll]);

  const shouldShowOverlay = !fullScreen || activeOverlayId === containerId;
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const diceSurface = fullScreen ? (
    portalTarget
      ? createPortal(
          <div
            id={containerId}
            ref={containerRef}
            aria-hidden={shouldShowOverlay ? "false" : "true"}
            className={cn(
              "dice-box-surface fixed inset-0 z-[60] pointer-events-none transition-opacity duration-200",
              shouldShowOverlay ? "opacity-100" : "opacity-0",
              className
            )}
          />,
          portalTarget
        )
      : null
  ) : (
    <div
      id={containerId}
      ref={containerRef}
      className={cn(
        "dice-box-surface relative h-[320px] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/30",
        className
      )}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {mode === "custom" ? (
          <>
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Dice
              </span>
              <div className="flex items-center gap-2">
                <NumberInput
                  min={1}
                  max={MAX_DICE}
                  value={diceCount}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) {
                      return;
                    }
                    const clamped = Math.max(1, Math.min(MAX_DICE, value));
                    setDiceCount(clamped);
                  }}
                  className="w-20"
                />
                <Select
                  value={String(diceSides)}
                  onValueChange={(value) => {
                    const next = Number(value) as (typeof DICE_SIDES)[number];
                    setDiceSides(next);
                  }}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DICE_SIDES.map((side) => (
                      <SelectItem key={side} value={String(side)}>
                        d{side}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        ) : null}
        <div className="flex flex-1 flex-wrap items-end gap-3">
          {showRollButton ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Roll
              </span>
              <Button onClick={handleRoll} disabled={!isReady || isRolling}>
                {isRolling ? "Rolling..." : `Roll ${rollNotation}`}
              </Button>
            </div>
          ) : null}
          {showResultBox ? (
            <div className="min-w-[180px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 shadow-[0_12px_24px_rgba(5,20,24,0.25)]">
              {lastRollValues.length ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {lastRollValues.map((value, index) => (
                      <span
                        key={`${value}-${index}`}
                        className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                  {resultMode === "total" ? (
                    <p className="text-xl font-semibold text-foreground">{lastRollTotal}</p>
                  ) : null}
                </div>
              ) : (
                resultMode === "total" ? (
                  <p className="text-xl font-semibold text-foreground">-</p>
                ) : null
              )}
            </div>
          ) : null}
        </div>
        {!isReady && !error ? (
          <span className="text-xs text-muted-foreground">Loading dice...</span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {diceSurface}
    </div>
  );
}
