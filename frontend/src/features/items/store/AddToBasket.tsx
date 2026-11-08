import { CheckboxField } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { Recipient } from "./useStoreBasket";

type AddToBasketProps = {
  recipients: Recipient[];
  /** The unit the store was opened for: its button is highlighted. */
  firstKey: string | null;
  each: number;
  free: boolean;
  isMobile: boolean;
  /**
   * A rare item's No search tick (William, 7 Nov 2026: "add to basket is blocked unless someone
   * has found it OR there is a checkbox next to button that says No Search"): the row sits at the
   * right, and the buttons wait while `enabled` is false.
   */
  noSearch?: { checked: boolean; onChange: (checked: boolean) => void } | null;
  enabled: boolean;
  onAdd: (recipient: Recipient) => void;
};

/** One button per recipient with its total (a henchmen group ×members), which puts it in the basket. */
export default function AddToBasket(props: AddToBasketProps) {
  const buttons = props.recipients.map((recipient) => {
    const mine = recipient.key === props.firstKey;
    const total = props.free ? "free" : `${props.each * recipient.count} gc`;
    const count = recipient.count > 1 ? ` ×${recipient.count}` : "";
    return (
      <button
        key={recipient.key}
        type="button"
        disabled={!props.enabled}
        onClick={() => props.onAdd(recipient)}
        className={cn(
          "border px-3 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-50",
          props.isMobile ? "min-h-11" : "min-h-[38px]",
          mine
            ? "border-primary bg-primary text-on-accent"
            : "border-accent-line bg-page text-accent-hi enabled:hover:bg-accent-soft"
        )}
      >
        {recipient.label}
        {count} · {total}
      </button>
    );
  });
  if (!props.noSearch) return <div className="flex flex-wrap gap-1.5">{buttons}</div>;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-2.5",
        !props.isMobile && "justify-end"
      )}
    >
      <CheckboxField
        checked={props.noSearch.checked}
        onChange={(event) => props.noSearch?.onChange(event.target.checked)}
        labelClassName="text-[13px]"
      >
        No search
      </CheckboxField>
      <div
        role="group"
        aria-label="Add to basket"
        className={cn("flex flex-wrap items-center gap-1.5", !props.isMobile && "justify-end")}
      >
        <span className="text-xs font-bold text-muted-foreground">Add to basket</span>
        {buttons}
      </div>
    </div>
  );
}
