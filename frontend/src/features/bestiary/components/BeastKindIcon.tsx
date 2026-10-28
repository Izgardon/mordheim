import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { beastKindLabel, type BeastKind } from "../bestiary-kinds";

/** The plan's marks: a horseshoe for a mount, a feather for a pet, a paw for a creature. */
const MARKS: Record<BeastKind, ReactNode> = {
  mount: (
    <>
      <path d="M6 3v8a6 6 0 0 0 12 0V3" />
      <path d="M4 3h4M16 3h4" />
      <circle cx="6.2" cy="8" r=".6" />
      <circle cx="17.8" cy="8" r=".6" />
    </>
  ),
  pet: (
    <>
      <path d="M20 4C11 4 6 9.5 6 17v3h3c7.5 0 11-5.5 11-16z" />
      <path d="M6 20l8-8" />
    </>
  ),
  creature: (
    <>
      <ellipse cx="12" cy="15.5" rx="4.6" ry="3.8" />
      <circle cx="5.5" cy="10" r="1.8" />
      <circle cx="9.5" cy="6.2" r="1.8" />
      <circle cx="14.5" cy="6.2" r="1.8" />
      <circle cx="18.5" cy="10" r="1.8" />
    </>
  ),
};

/** Each kind's colour, as the plan draws them: gold mounts, blue pets, rust creatures. */
export const BEAST_KIND_TEXT: Record<BeastKind, string> = {
  mount: "text-amber-300",
  pet: "text-sky-300",
  creature: "text-orange-300",
};

/** The kind's mark, drawn in the text colour around it; decorative (its label says the kind). */
export function BeastKindIcon({ kind, className }: { kind: BeastKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {MARKS[kind]}
    </svg>
  );
}

/** The kind as a small label with its mark: "Mount", "Pet", "Creature". */
export function BeastKindLabel({ kind, className }: { kind: BeastKind; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", BEAST_KIND_TEXT[kind], className)}>
      <BeastKindIcon kind={kind} />
      {beastKindLabel(kind)}
    </span>
  );
}
