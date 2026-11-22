import { Button } from "@/components/ui/button";
import { SectionedSelect, type SelectSection } from "@/components/ui/sectioned-select";
import { cn } from "@/lib/utils";

import type { Recipient } from "./useStoreBasket";
import { useRecipientChoice } from "./recipient-choice";

type AddToBasketProps = {
  recipients: Recipient[];
  /** The unit the store was opened for: everything goes to it, with no choice to make. */
  firstKey: string | null;
  each: number;
  free: boolean;
  isMobile: boolean;
  /** Off: a rare item not yet found (nor No search ticked), or a dice price not yet rolled. */
  enabled: boolean;
  onAdd: (recipient: Recipient) => void;
};

const total = (recipient: Recipient, each: number, free: boolean) =>
  free ? "free" : `${each * recipient.count} gc`;

/** The dropdown's sections: the stash, then the heroes by name, then the henchmen groups. */
function sectionsFor(recipients: Recipient[], each: number, free: boolean): SelectSection[] {
  const of = (kind: Recipient["target"]["kind"]) =>
    recipients.filter((recipient) => recipient.target.kind === kind);
  return [
    { label: "", options: of("stash").map((entry) => ({ value: entry.key, label: entry.label })) },
    {
      label: "Heroes",
      options: of("heroes").map((entry) => ({ value: entry.key, label: entry.label })),
    },
    {
      label: "Henchmen",
      options: of("henchmen").map((entry) => ({
        value: entry.key,
        label: (
          <span className="flex flex-col">
            <span>{entry.label}</span>
            <span className="text-xs text-muted-foreground">
              ×{entry.count} {entry.count === 1 ? "model" : "models"} · {total(entry, each, free)}
            </span>
          </span>
        ),
      })),
    },
  ];
}

/**
 * Add to basket (William, 22 Nov 2026): opened for a unit, one full-width button that puts the
 * item on that unit; in the warband's store, a dropdown of who gets it (the stash first, then the
 * heroes and the henchmen groups, each group with what its members' copies come to) and the button.
 */
export default function AddToBasket(props: AddToBasketProps) {
  const unit = props.recipients.find((recipient) => recipient.key === props.firstKey) ?? null;
  const { key, set: setKey } = useRecipientChoice();
  const picked =
    unit ?? props.recipients.find((recipient) => recipient.key === key) ?? props.recipients[0];
  if (!picked) return null;
  const button = (
    <Button
      disabled={!props.enabled}
      onClick={() => props.onAdd(picked)}
      className={cn("w-full", props.isMobile && "h-12")}
    >
      Add to basket · {total(picked, props.each, props.free)}
    </Button>
  );
  if (unit) return button;
  return (
    <div
      className={cn(
        "flex gap-2",
        props.isMobile ? "flex-col" : "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end"
      )}
    >
      <SectionedSelect
        aria-label="Who gets it"
        sections={sectionsFor(props.recipients, props.each, props.free)}
        value={picked.key}
        onValueChange={setKey}
        className={cn(
          "h-auto min-h-10 py-1.5 text-left md:h-auto [&>span]:line-clamp-none",
          props.isMobile && "min-h-12"
        )}
      />
      {button}
    </div>
  );
}
