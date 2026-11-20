import { useState } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";

import {
  useResourceChange,
  useResourceCreate,
  useResourceDelete,
  useResourceRename,
  useResourceSale,
} from "../../api/economy-queries";
import {
  useResourceSaleNumbers,
  type SalePricing,
} from "../../hooks/warband/useResourceSaleNumbers";
import type { WarbandResource } from "../../types/warband-types";
import ResourceForm, { type Editing } from "./ResourceForm";
import ResourceRow from "./ResourceRow";
import { SECTION_TITLE } from "./warband-layout";

/** The campaign's default resource first, the rest as they come. */
const defaultFirst = (resources: WarbandResource[]) => [
  ...resources.filter((resource) => resource.is_default),
  ...resources.filter((resource) => !resource.is_default),
];

/**
 * The warband's resources (William, 20 Nov 2026): the section's title with Add resource spaced
 * apart from it, then a column per resource, a hairline between them, each with its name on the
 * left and its number and − / + on the right. The default resource comes first, with no icon; its
 * ⋮ offers Sell alone, the others Rename, Sell and Delete. Selling the default resource prices it
 * from the campaign's table at the warband's size band, which the player may change.
 */
export default function WarbandResources({
  warbandId,
  resources,
  canEdit,
  pricing,
}: {
  warbandId: number;
  resources: WarbandResource[];
  canEdit: boolean;
  pricing: SalePricing;
}) {
  const change = useResourceChange(warbandId);
  const create = useResourceCreate(warbandId);
  const remove = useResourceDelete(warbandId);
  const rename = useResourceRename(warbandId);
  const sell = useResourceSale(warbandId);
  const [editing, setEditing] = useState<Editing>(null);
  const [text, setText] = useState("");
  const priced = editing?.kind === "sell" && editing.resource.is_default;
  const sale = useResourceSaleNumbers(pricing, priced);
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  const done = { onSuccess: () => setEditing(null), onError };

  const submit = () => {
    if (!editing) return;
    if (editing.kind === "add") create.mutate(text.trim(), done);
    else if (editing.kind === "rename")
      rename.mutate({ resourceId: editing.resource.id, name: text.trim() }, done);
    else
      sell.mutate(
        { resourceId: editing.resource.id, quantity: sale.count, price: sale.gold },
        done
      );
  };

  return (
    <section aria-label="Resources" className="flex flex-col gap-2 border-y border-line py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className={SECTION_TITLE}>Resources</h2>
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              setEditing({ kind: "add" });
            }}
            className="min-h-8 border border-dashed border-strong px-2.5 text-xs font-bold text-accent-text"
          >
            Add resource
          </button>
        ) : null}
      </div>
      {editing ? (
        <ResourceForm
          editing={editing}
          sale={sale}
          priced={priced}
          text={text}
          onText={setText}
          onSubmit={submit}
          onCancel={() => setEditing(null)}
        />
      ) : null}
      <div className="flex flex-wrap gap-x-4">
        {defaultFirst(resources).map((resource) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            canEdit={canEdit}
            onChange={(delta) => change.mutate({ resourceId: resource.id, delta }, { onError })}
            onRename={() => {
              setText(resource.name);
              setEditing({ kind: "rename", resource });
            }}
            onSell={() => {
              sale.reset();
              setEditing({ kind: "sell", resource });
            }}
            onDelete={() => remove.mutate(resource.id, { onError })}
          />
        ))}
      </div>
    </section>
  );
}
