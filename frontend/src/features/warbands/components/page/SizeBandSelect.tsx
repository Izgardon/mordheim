import { cn } from "@/lib/utils";

import { SIZE_BANDS } from "../../utils/wyrdstone-prices";

/**
 * The size band a sale of the default resource is priced at: the warband's own at first, another
 * when a rule counts it smaller when selling (the Halflings' Master Chef and the like). The player
 * picks; nothing applies those rules (guide, not gatekeeper).
 */
export default function SizeBandSelect({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (band: number) => void;
  className?: string;
}) {
  return (
    <select
      aria-label="Warband size"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={cn("border border-strong bg-page px-2.5 text-sm text-ink", className)}
    >
      {SIZE_BANDS.map((label, band) => (
        <option key={label} value={band}>
          {label} warriors
        </option>
      ))}
    </select>
  );
}
