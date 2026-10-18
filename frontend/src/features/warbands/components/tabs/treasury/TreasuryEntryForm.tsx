import { Button } from "@/components/ui/button";
import { Input } from "@components/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { formatRowDate, formatSignedAmount, rowTotal } from "./treasury-format";

import type { TreasuryEntryForm as EntryForm } from "../../../hooks/warband/useTreasuryEntryForm";

/** The actions a manual entry can take, in the server's vocabulary (decision 4). */
const ENTRY_ACTIONS = [
  "Buy",
  "Sell",
  "Upkeep",
  "Exploration",
  "Reward",
  "Recruit",
  "Hire",
  "Adjustment",
] as const;

// Looked up by the free-form action string, so a miss is possible (falls back below).
const DESCRIPTION_PLACEHOLDERS: Partial<Record<string, string>> = {
  Buy: "What was bought?",
  Sell: "What was sold?",
  Upkeep: "What upkeep was paid?",
  Exploration: "What was found or claimed?",
  Reward: "What reward was gained?",
  Recruit: "Who was recruited?",
  Hire: "Who was hired?",
  Adjustment: "Why is the gold changing?",
} satisfies Record<(typeof ENTRY_ACTIONS)[number], string>;

type TreasuryEntryFormProps = {
  form: EntryForm;
  isMobile: boolean;
};

/**
 * A manual ledger entry: action, gold, description and notes. An Adjustment's gold is signed as
 * typed and its description is the reason; it can name the row it corrects (decision 5).
 */
export default function TreasuryEntryForm({ form, isMobile }: TreasuryEntryFormProps) {
  const descriptionPlaceholder =
    DESCRIPTION_PLACEHOLDERS[form.formAction] ?? "Describe this ledger entry";
  const { correcting } = form;

  return (
    <div className="space-y-3 border border-border/60 bg-background/80 p-4">
      <div
        className={
          isMobile
            ? "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3"
            : "grid gap-3 sm:grid-cols-2"
        }
      >
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Action</label>
          <Select value={form.formAction} onValueChange={form.setFormAction}>
            <SelectTrigger>
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              {ENTRY_ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Gold coins</label>
          <NumberInput
            min={form.isAdjustment ? undefined : 0}
            value={form.formPrice}
            onChange={(e) => form.setFormPrice(e.target.value)}
            placeholder="0"
            compact={isMobile}
            mobileButtonVariant={isMobile ? "solid" : "image"}
            containerClassName={isMobile ? "w-[7.5rem]" : undefined}
            className={isMobile ? "w-12" : undefined}
          />
        </div>
      </div>
      {form.isAdjustment ? (
        <p className="text-xs text-muted-foreground">A negative amount takes gold away.</p>
      ) : null}
      {correcting ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Corrects: {formatRowDate(correcting.created_at)} {correcting.description} (
            {formatSignedAmount(rowTotal(correcting))})
          </span>
          <Button variant="secondary" size="sm" onClick={form.clearCorrection}>
            Unlink
          </Button>
        </p>
      ) : null}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          {form.isAdjustment ? "Reason" : "Description"}
        </label>
        <Input
          type="text"
          value={form.formDescription}
          onChange={(e) => form.setFormDescription(e.target.value)}
          placeholder={descriptionPlaceholder}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Notes (optional)</label>
        <textarea
          value={form.formNotes}
          onChange={(e) => form.setFormNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={2}
          className="min-h-[80px] w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
        />
      </div>
      {form.submitError ? <p className="text-sm text-red-600">{form.submitError}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          onClick={form.handleCloseForm}
          disabled={form.isSubmitting}
          size="sm"
        >
          Cancel
        </Button>
        <Button onClick={form.handleSubmit} disabled={form.isSubmitting} size="sm">
          {form.isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
