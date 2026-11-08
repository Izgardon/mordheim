import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DiceInput } from "@/components/ui/dice-input";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import type { CampaignResource } from "@/features/campaigns/api/campaign-resources";

import { FEE_KINDS, feeReads, formatFee, matchCounter, type FeeKind } from "../../fees";
import { feeFromDraft, replaceKept, type FeeDraft } from "./fee-draft";

const LABEL = "text-xs font-bold text-muted-foreground";
const MENU_ITEM =
  "flex min-h-9 cursor-pointer items-center px-3 text-sm text-ink outline-none data-[highlighted]:bg-raised data-[highlighted]:text-head";

type FeeEditorProps = {
  /** "Hire fee", "Upkeep". */
  label: string;
  /** The preview line's word: "Hire: 30 + D6 gc and 1 Wyrdstone". */
  reads: string;
  idPrefix: string;
  value: FeeDraft;
  onChange: (next: FeeDraft) => void;
  /** The kinds offered (HIRE_KINDS, UPKEEP_KINDS). */
  kinds: FeeKind[];
  /** The campaign's resources, which the resource is picked from; undefined while they load. */
  resources: CampaignResource[] | undefined;
};

/** A stored fee the form can't hold (several resources): shown as it is, with Replace. */
function KeptFee({ props }: { props: FeeEditorProps }) {
  const { value, kinds } = props;
  if (!value.kept) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border border-line bg-raised px-2.5 py-2 text-[13px]">
      <span className="font-mono font-bold text-ink">{formatFee(value.kept)}</span>
      <span className="text-xs font-semibold text-danger">
        {value.kept.resources.length > 1
          ? "Kept as it is: the form takes one resource. Replace keeps the gold and the first."
          : `Kept as it is: ${props.label.toLowerCase()} can't take a hero's place.`}
      </span>
      <Button
        size="sm"
        variant="secondary"
        className="ml-auto"
        onClick={() => props.onChange(replaceKept(value, kinds))}
      >
        Replace
      </Button>
    </div>
  );
}

/** Add resource (William: "when clicked it opens a resource selector"): the campaign's, not gold. */
function AddResource({ props }: { props: FeeEditorProps }) {
  const { value, resources } = props;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="sm" variant="secondary" className="h-8 md:h-9">
          <Plus aria-hidden="true" />
          Add resource
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          aria-label={`${props.label}: resources`}
          className="z-[70] min-w-[200px] border border-accent-line bg-panel p-1 shadow-[0_16px_40px_var(--color-shadow)]"
        >
          {resources === undefined ? (
            <DropdownMenu.Item disabled className={MENU_ITEM}>
              Reading the resources…
            </DropdownMenu.Item>
          ) : (
            resources.map((resource) => (
              <DropdownMenu.Item
                key={resource.name}
                className={MENU_ITEM}
                onSelect={() =>
                  props.onChange({
                    ...value,
                    resources: [
                      {
                        resource: resource.name,
                        amount: "1",
                        names: [resource.name.trim().toLowerCase()],
                        default_resource: resource.is_default,
                      },
                    ],
                  })
                }
              >
                {resource.name}
              </DropdownMenu.Item>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** The fee's one resource: its amount, its name, and × (which brings Add resource back). */
function ResourceLine({ props }: { props: FeeEditorProps }) {
  const { value, resources } = props;
  const line = value.resources[0];
  const known = resources === undefined || matchCounter(line, resources) !== null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm text-text2">+</span>
      <NumberInput
        compact
        id={`${props.idPrefix}-resource-amount`}
        aria-label={`${line.resource} in the ${props.label.toLowerCase()}`}
        inputSize="sm"
        min={0}
        className="w-14 font-mono"
        value={line.amount}
        onChange={(event) =>
          props.onChange({ ...value, resources: [{ ...line, amount: event.target.value }] })
        }
      />
      <span className="text-sm font-semibold text-ink">{line.resource}</span>
      <IconButton
        aria-label={`Remove ${line.resource}`}
        className="h-8 w-8"
        onClick={() => props.onChange({ ...value, resources: [] })}
      >
        <X aria-hidden="true" />
      </IconButton>
      {known ? null : (
        <span className="basis-full text-xs font-semibold text-danger">
          {`${line.resource} isn't one of this campaign's resources.`}
        </span>
      )}
    </span>
  );
}

/**
 * A hire fee or an upkeep (William, 7 Nov 2026): its kind, then for a fee the gold and the dice
 * unit on one line ("30 + [1] D6"), and at most one of the campaign's resources on top ("the add
 * resource option is only there once and when clicked it opens a resource selector but the add
 * resource button goes so only one can be added on top of gold"), with the line it reads as under
 * it ("Hire: 30 + D6 gc and 1 Wyrdstone"). The note shows for "See his rules" (how he is hired)
 * and where a fee already has one ("15 gc*"). A stored fee with several resources is kept whole.
 */
export default function FeeEditor(props: FeeEditorProps) {
  const { label, idPrefix, value, onChange } = props;
  const set = (change: Partial<FeeDraft>) => onChange({ ...value, ...change });
  const gold = value.kind === "gold";

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      {value.kept ? (
        <KeptFee props={props} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id={`${idPrefix}-kind`}
              aria-label={`${label} kind`}
              value={value.kind}
              onChange={(event) => set({ kind: event.target.value as FeeKind })}
              className="h-8 border border-strong bg-page px-2 text-sm text-ink md:h-9"
            >
              {FEE_KINDS.filter((kind) => props.kinds.includes(kind.value)).map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
            {gold ? (
              <>
                <span className="flex items-center gap-1.5">
                  <NumberInput
                    compact
                    id={`${idPrefix}-gold`}
                    aria-label={`${label} gold`}
                    inputSize="sm"
                    min={0}
                    className="w-16 font-mono"
                    value={value.gold}
                    onChange={(event) => set({ gold: event.target.value })}
                  />
                  <span className="text-sm text-text2">gc +</span>
                  <DiceInput
                    id={`${idPrefix}-dice`}
                    label={`${label} dice`}
                    count={value.dice}
                    multiplier={value.dice_multiplier}
                    onCountChange={(dice) => set({ dice })}
                    onMultiplierChange={(dice_multiplier) => set({ dice_multiplier })}
                  />
                </span>
                {value.resources.length ? (
                  <ResourceLine props={props} />
                ) : (
                  <AddResource props={props} />
                )}
              </>
            ) : null}
          </div>
          {value.kind === "special" || value.hasNote ? (
            <label className={`flex flex-col gap-1 ${LABEL}`}>
              {value.kind === "special" ? "How he is hired" : "Note"}
              <Input
                id={`${idPrefix}-note`}
                inputSize="sm"
                maxLength={500}
                value={value.note}
                onChange={(event) => set({ note: event.target.value })}
              />
            </label>
          ) : null}
        </>
      )}
      {value.kept ? null : (
        <p className="m-0 text-[13px] text-text2">
          {props.reads}:{" "}
          <span className="font-mono font-semibold text-ink">{feeReads(feeFromDraft(value))}</span>
        </p>
      )}
    </fieldset>
  );
}
