import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";

import type { useResourceSaleNumbers } from "../../hooks/warband/useResourceSaleNumbers";
import type { WarbandResource } from "../../types/warband-types";
import SizeBandSelect from "./SizeBandSelect";

/** What the resources section is doing: adding one, renaming one, or selling some of one. */
export type Editing =
  | { kind: "add" }
  | { kind: "rename" | "sell"; resource: WarbandResource }
  | null;

/**
 * The resources section's one form: a name (Add resource, Rename) or a sale (the resource's name,
 * how many, the size band for the default resource, and the gold). It opens under the section's title and closes on
 * its own Cancel.
 */
export default function ResourceForm({
  editing,
  sale,
  priced,
  text,
  onText,
  onSubmit,
  onCancel,
}: {
  /** Never null here: the section leaves the form out when it is doing nothing. */
  editing: NonNullable<Editing>;
  sale: ReturnType<typeof useResourceSaleNumbers>;
  /** The default resource's sale, priced from the campaign's table at a size band. */
  priced: boolean;
  text: string;
  onText: (next: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const selling = editing.kind === "sell";
  return (
    <form
      aria-label={
        editing.kind === "add"
          ? "Add resource"
          : selling
            ? `Sell ${editing.resource.name}`
            : undefined
      }
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {selling ? (
        // which resource is being sold (William, 24 Nov 2026): the form opens under the title
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink">
          Sell {editing.resource.name}
        </span>
      ) : null}
      {selling ? (
        <NumberInput
          compact
          autoFocus
          inputSize="sm"
          min={1}
          max={editing.resource.amount}
          aria-label="How many"
          value={sale.quantity}
          onChange={(event) => sale.setQuantity(event.target.value)}
        />
      ) : (
        <Input
          autoFocus
          inputSize="sm"
          aria-label="Resource name"
          placeholder={editing.kind === "add" ? "Name" : undefined}
          className="h-9 w-36 md:h-9"
          value={text}
          onChange={(event) => onText(event.target.value)}
        />
      )}
      {priced ? <SizeBandSelect className="h-9" value={sale.band} onChange={sale.setBand} /> : null}
      {selling ? (
        <NumberInput
          compact
          aria-label="Price in gold"
          inputSize="sm"
          placeholder="gc"
          className="w-24"
          value={sale.price}
          onChange={(event) => sale.setPrice(event.target.value)}
        />
      ) : null}
      <Button size="sm" type="submit">
        {editing.kind === "add" ? "Add" : editing.kind === "rename" ? "Rename" : "Sell"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
