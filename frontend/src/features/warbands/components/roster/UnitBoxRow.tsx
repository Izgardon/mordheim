import { Fragment, type ReactNode } from "react";

import { BoxTile } from "@/components/ui/box-tile";

import UnitSectionLabel from "./UnitSectionLabel";
import { panelAfter, type Box, type Row } from "./unit-boxes";

/**
 * On a phone a row's boxes are two abreast, each half the row less half the gap, their text
 * ending in "…" (William, 22 Nov 2026: "so 2 always fit on mobile"); the web keeps their own size.
 */
export const PILL = "max-[960px]:w-[calc(50%-3px)] max-[960px]:min-w-0 max-[960px]:max-w-none";

type UnitBoxRowProps = {
  line: Row;
  selected?: Box;
  /** Which of its boxes is open, and its panel when it shows in this row (a phone's). */
  openIndex?: number;
  panel?: ReactNode;
  /** A last cell after the boxes (Add item). */
  extra?: ReactNode;
  onToggle: (index: number) => void;
};

/** One of an open card's rows: its heading and its boxes, an opened box's panel under its line on a phone. */
export default function UnitBoxRow({
  line,
  selected,
  openIndex,
  panel,
  extra,
  onToggle,
}: UnitBoxRowProps) {
  const cells = line.boxes.length + (extra ? 1 : 0);
  const after = panel && openIndex !== undefined ? panelAfter(openIndex, cells) : -1;
  const placed = panel ? (
    <div data-testid="box-panel" className="w-full basis-full">
      {panel}
    </div>
  ) : null;
  return (
    <div className="flex flex-col gap-2">
      <UnitSectionLabel icon={line.icon}>{line.label}</UnitSectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {line.boxes.map((box, index) => (
          <Fragment key={`${box.name}-${index}`}>
            <BoxTile
              name={box.name}
              type={box.subtitle}
              kind={box.boxKind}
              icon={box.icon}
              className={PILL}
              pressed={selected === box}
              onClick={() => onToggle(index)}
            />
            {index === after ? placed : null}
          </Fragment>
        ))}
        {extra}
        {extra && after === cells - 1 ? placed : null}
      </div>
    </div>
  );
}
