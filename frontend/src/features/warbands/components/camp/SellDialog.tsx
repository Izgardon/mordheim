import { useState } from "react";
import { toast } from "sonner";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useResourceSale } from "../../api/economy-queries";
import { useResourceSaleNumbers } from "../../hooks/warband/useResourceSaleNumbers";
import SizeBandSelect from "../page/SizeBandSelect";
import type { OpenCamp } from "./camp-types";

const fieldLabel = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/**
 * Camp's Sell (design E): which resource, how many and the gold received; the default resource is
 * priced from the campaign's table at the warband's size band, which the player may change. The
 * sale goes through the warband's resource sale (gold and its ledger row at once) and camp notes
 * it.
 */
export default function SellDialog({
  camp,
  open,
  onClose,
}: {
  camp: OpenCamp;
  open: boolean;
  onClose: () => void;
}) {
  const resources = camp.postgame.resources;
  const sale = useResourceSale(camp.warbandId);
  const [resourceId, setResourceId] = useState<number | null>(null);
  const resource = resources.find((entry) => entry.id === resourceId) ?? resources[0];
  const priced = Boolean(resource?.is_default);
  const pricing = {
    table: camp.campaign?.wyrdstone_prices,
    band: camp.postgame.sheet?.summary.size_band ?? 0,
  };
  const numbers = useResourceSaleNumbers(pricing, priced);
  const { count, gold } = numbers;

  const sell = () => {
    if (!resource) return;
    sale.mutate(
      { resourceId: resource.id, quantity: count, price: gold },
      {
        onSuccess: () => {
          const record = camp.draft.camp ?? {};
          const sold = [...(record.sold ?? []), { name: resource.name, quantity: count, gold }];
          void camp.save({ ...camp.draft, camp: { ...record, sold } });
          numbers.reset();
          onClose();
        },
        onError: (error) => toast.error("Couldn't sell.", { description: getErrorMessage(error) }),
      }
    );
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={(next) => (next ? null : onClose())}
      kicker="Camp"
      title="Sell a resource"
      footer={
        <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={onClose}>
            Cancel
          </Button>
          <Button className="min-h-12" disabled={!resource || sale.isPending} onClick={sell}>
            Sell
          </Button>
        </div>
      }
    >
      {resources.length === 0 ? (
        <p className="m-0 text-sm text-text2">The warband has no resources to sell.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 min-[600px]:grid-cols-3">
          <label className={`${fieldLabel} col-span-full`}>
            Resource
            <select
              value={resource?.id ?? ""}
              onChange={(event) => {
                setResourceId(Number(event.target.value));
                numbers.reset();
              }}
              className="min-h-11 border border-strong bg-page px-2.5 text-sm text-ink"
            >
              {resources.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.amount} held
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            How many
            <NumberInput
              className="font-mono"
              value={numbers.quantity}
              onChange={(event) => numbers.setQuantity(event.target.value)}
            />
          </label>
          {priced ? (
            <label className={fieldLabel}>
              Warband size
              <SizeBandSelect
                className="min-h-11"
                value={numbers.band}
                onChange={numbers.setBand}
              />
            </label>
          ) : null}
          <label className={fieldLabel}>
            For (gc)
            <NumberInput
              className="font-mono"
              value={numbers.price}
              onChange={(event) => numbers.setPrice(event.target.value)}
            />
          </label>
          <span
            className={cn(
              "col-span-full flex items-end pb-2.5 text-[13px] text-text2",
              !priced && "min-[600px]:col-span-1"
            )}
          >
            Gold {camp.gold} →{" "}
            <span className="ml-1 font-mono font-bold text-head">{camp.gold + gold} gc</span>
          </span>
        </div>
      )}
    </ModalSheet>
  );
}
