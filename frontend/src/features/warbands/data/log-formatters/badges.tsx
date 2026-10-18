import type { ReactNode } from "react";

import needIcon from "@/assets/icons/need.webp";
import greedIcon from "@/assets/icons/greed.webp";

import type { WarbandLog } from "../../types/warband-types";

/**
 * Renders one kind of log entry (`"feature:entry_type"`). Log payloads are free-form JSON stored
 * per entry (written by both the client and the backend), so every field is optional and the
 * formatters keep their defensive reads; their payload types describe what producers write today.
 */
export type LogFormatter = (log: WarbandLog) => ReactNode;

/** The payload of a log entry, typed as `T` (every field optional). */
export const payloadOf = <T,>(log: WarbandLog) => (log.payload ?? {}) as T;

export const renderDiceBadge = (dice?: string) => (
  <span className="inline-flex items-center gap-1 align-middle leading-none">
    <img src={needIcon} alt="" className="relative top-[1px] h-4 w-4" />
    {dice ? <span>{dice}</span> : null}
  </span>
);

export const renderGoldBadge = (value: number) => (
  <span className="inline-flex items-center gap-1 align-middle leading-none">
    <img src={greedIcon} alt="" className="relative top-[1px] h-4 w-4" />
    <span>{value} gc</span>
  </span>
);
