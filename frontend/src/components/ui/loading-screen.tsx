import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { BOOT_SWORDS_DELAY_MS, SWORDS_FADE_MS } from "./sword-clash";
import { SwordClashSpinner } from "./sword-clash-spinner";

type SwordsScreenProps = {
  /** What a screen reader hears; nothing is written on the screen. */
  label: string;
  /** Fading out onto the page under it. */
  leaving?: boolean;
};

/**
 * The full-screen swords on the page colour (design E): entering a battle, and a slow boot. The
 * swords strike once and rest crossed.
 */
export function SwordsScreen({ label, leaving = false }: SwordsScreenProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-page transition-opacity ease-out",
        leaving && "pointer-events-none opacity-0"
      )}
      style={{ transitionDuration: `${SWORDS_FADE_MS}ms` }}
    >
      <SwordClashSpinner className="h-auto w-[200px]" />
    </div>
  );
}

/**
 * The app's boot (auth, the first chunks): the plain page colour, and the swords only once boot
 * has taken longer than `BOOT_SWORDS_DELAY_MS`, so a fast boot never flashes them. Pages inside
 * the app load as skeletons in their own frame instead.
 */
export function BootScreen() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLate(true), BOOT_SWORDS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return late ? (
    <SwordsScreen label="Loading" />
  ) : (
    <div role="status" aria-label="Loading" className="fixed inset-0 z-50 bg-page" />
  );
}
