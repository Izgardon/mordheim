import type { PresetLocks } from "../../api/preset-queries";

/** A control the campaign's preset sets: greyed, and still operable (restrictions warn, never block). */
export const PRESET_DIM = "opacity-60";

/** The dimming class for a control the preset sets, or undefined for one it says nothing about. */
export function presetDim(locks: PresetLocks, field: string) {
  return locks.sets.has(field) ? PRESET_DIM : undefined;
}

/**
 * Under a preset-set control: which published campaign set it, or, once the owner has departed
 * from it, the server's warning saying what that campaign sets. Nothing for a control no preset
 * sets.
 */
export default function PresetNote({ locks, field }: { locks: PresetLocks; field: string }) {
  const departure = locks.departures.get(field);
  if (departure) {
    return <span className="text-[13px] text-accent-text">{departure}</span>;
  }
  return locks.sets.has(field) ? (
    <span className="text-[13px] text-faint">{`Set by ${locks.name}`}</span>
  ) : null;
}
