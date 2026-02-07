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
const BASE_URL = import.meta.env.BASE_URL || "/";
const NORMALIZED_BASE_URL = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
const DEFAULT_ASSET_PATH = `${NORMALIZED_BASE_URL}assets/dice-box/`;

export type DiceRollerMode = "fixed" | "custom";

export type DiceRollerProps = {
  mode?: DiceRollerMode;
  fixedNotation?: string;
  assetPath?: string;
  fullScreen?: boolean;
  variant?: "default" | "button-only";
  showResultBox?: boolean;
  showRollButton?: boolean;
  showRollLabel?: boolean;
  className?: string;
  resultBoxClassName?: string;
  themeColor?: string;
  resultMode?: "total" | "dice" | "both";
  rollSignal?: number;
  onRollComplete?: (results: unknown) => void;
  onTotalChange?: (total: number) => void;
};

let activeDiceOverlayId: string | null = null;
const activeDiceOverlayListeners = new Set<(id: string | null) => void>();

const setActiveDiceOverlayId = (id: string | null) => {
  activeDiceOverlayId = id;
  activeDiceOverlayListeners.forEach((listener) => listener(activeDiceOverlayId));
};

const parseDiceNotation = (notation: string): { count: number; sides: number } | null => {
  const match = notation.match(/^(\d+)d(\d+)$/i);
  if (!match) {
    return null;
  }
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  if (count > 0 && sides > 0) {
    return { count, sides };
  }
  return null;
};

const generateFallbackRoll = (notation: string): number[] => {
  const parsed = parseDiceNotation(notation);
  if (!parsed) {
    return [Math.floor(Math.random() * 6) + 1];
  }
  const values: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    values.push(Math.floor(Math.random() * parsed.sides) + 1);
  }
  return values;
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
  assetPath = DEFAULT_ASSET_PATH,
  fullScreen = false,
  variant = "default",
  showResultBox = true,
  showRollButton = true,
  showRollLabel = true,
  className,
  resultBoxClassName,
  themeColor,
  resultMode = "total",
  rollSignal,
  onRollComplete,
  onTotalChange,
}: DiceRollerProps) {
  const containerId = useMemo(
    () => `dice-box-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const diceBoxRef = useRef<any>(null);
  const clearTimerRef = useRef<number | null>(null);
  const onRollCompleteRef = useRef<DiceRollerProps["onRollComplete"]>(onRollComplete);
  const onTotalChangeRef = useRef<DiceRollerProps["onTotalChange"]>(onTotalChange);
  const [isReady, setIsReady] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
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
    onRollCompleteRef.current = onRollComplete;
  }, [onRollComplete]);

  useEffect(() => {
    onTotalChangeRef.current = onTotalChange;
  }, [onTotalChange]);

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
    setIsReady(false);

    const triggerResize = () => {
      if (typeof window === "undefined") {
        return;
      }
      window.dispatchEvent(new Event("resize"));
    };

    const diceBox = new DiceBox({
      container: `#${containerId}`,
      assetPath,
      themeColor: resolvedThemeColor,
      offscreen: false,
      onRollComplete: (results: unknown) => {
        const values = parseDiceValues(results);
        const total = values.reduce((sum, value) => sum + value, 0);
        setLastRollValues(values);
        onRollCompleteRef.current?.(results);
        onTotalChangeRef.current?.(total);
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
            triggerResize();
          });
          resizeObserver.observe(observedElement);
        }
        requestAnimationFrame(() => {
          triggerResize();
        });
      })
      .catch((initError: unknown) => {
        console.error("Failed to initialize DiceBox, using fallback mode", initError);
        if (mounted) {
          setFallbackMode(true);
          setIsReady(true);
        }
      });

    return () => {
      mounted = false;
      const observedElement = containerRef.current;
      if (resizeObserver && observedElement) {
        resizeObserver.unobserve(observedElement);
      }
      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
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
  }, [assetPath, containerId, fullScreen]);

  useEffect(() => {
    if (!diceBoxRef.current || !isReady || fallbackMode) {
      return;
    }
    try {
      diceBoxRef.current.updateConfig?.({ themeColor: resolvedThemeColor });
    } catch {
      // Ignore updateConfig errors - theme will be applied on next roll
    }
  }, [resolvedThemeColor, isReady, fallbackMode]);

  const rollNotation = mode === "custom" ? `${diceCount}d${diceSides}` : fixedNotation;

  const handleRoll = useCallback(async () => {
    if (!isReady) {
      return;
    }

    setError("");
    setIsRolling(true);
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
    }

    if (fallbackMode || !diceBoxRef.current) {
      const fallbackValues = generateFallbackRoll(rollNotation);
      const fallbackTotal = fallbackValues.reduce((sum, value) => sum + value, 0);
      setLastRollValues(fallbackValues);
      onRollCompleteRef.current?.(fallbackValues);
      onTotalChangeRef.current?.(fallbackTotal);
      setIsRolling(false);
      return;
    }

    if (fullScreen) {
      setActiveDiceOverlayId(containerId);
    }

    const attemptRoll = async (retries = 3): Promise<void> => {
      try {
        await diceBoxRef.current.roll(rollNotation, { themeColor: resolvedThemeColor });
      } catch (rollError) {
        if (retries > 0 && rollError instanceof TypeError && String(rollError).includes("null")) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return attemptRoll(retries - 1);
        }
        throw rollError;
      }
    };

    try {
      await attemptRoll();
      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = window.setTimeout(() => {
        diceBoxRef.current?.clear?.();
        if (fullScreen && activeDiceOverlayId === containerId) {
          setActiveDiceOverlayId(null);
        }
        clearTimerRef.current = null;
      }, 2000);
    } catch (rollError) {
      console.error("Dice roll failed, using fallback", rollError);
      const fallbackValues = generateFallbackRoll(rollNotation);
      const fallbackTotal = fallbackValues.reduce((sum, value) => sum + value, 0);
      setLastRollValues(fallbackValues);
      onRollCompleteRef.current?.(fallbackValues);
      onTotalChangeRef.current?.(fallbackTotal);
      if (fullScreen && activeDiceOverlayId === containerId) {
        setActiveDiceOverlayId(null);
      }
    } finally {
      setIsRolling(false);
    }
  }, [containerId, fallbackMode, fullScreen, isReady, resolvedThemeColor, rollNotation]);

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

  if (variant === "button-only") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-end gap-3">
          {showRollButton ? (
            <Button className="h-10" onClick={handleRoll} disabled={!isReady || isRolling}>
              {isRolling ? "Rolling..." : `Roll ${rollNotation}`}
            </Button>
          ) : null}
          {!isReady && !error ? (
            <span className="text-xs text-muted-foreground">Loading dice...</span>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {diceSurface}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
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
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {showRollButton ? (
            <div className="flex flex-col gap-2">
              {showRollLabel ? (
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Roll
                </span>
              ) : null}
              <Button className="h-10" onClick={handleRoll} disabled={!isReady || isRolling}>
                {isRolling ? "Rolling..." : `Roll ${rollNotation}`}
              </Button>
            </div>
          ) : null}
          {showResultBox ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Result
              </span>
              <div className={cn("h-8 min-w-[60px] flex items-center rounded-2xl border border-border/60 bg-background/70 px-3 shadow-[0_12px_24px_rgba(5,20,24,0.25)]", resultBoxClassName)}>
                {lastRollValues.length ? (
                  <div className="flex items-center gap-2">
                    {resultMode === "dice" || resultMode === "both" ? (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {lastRollValues.map((value, index) => (
                          <span
                            key={`${value}-${index}`}
                            className="rounded-full border border-border/70 bg-muted/30 py-0.5"
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {resultMode === "total" || resultMode === "both" ? (
                      <p className="text-lg font-semibold text-foreground">{lastRollTotal}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-foreground">-</p>
                )}
              </div>
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
