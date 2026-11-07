import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { EllipsisVertical, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { GameIcon } from "@/components/ui/game-icons";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/get-error-message";

import {
  useResourceChange,
  useResourceCreate,
  useResourceDelete,
  useResourceRename,
  useResourceSale,
} from "../../api/economy-queries";
import type { WarbandResource } from "../../types/warband-types";

type Editing = { kind: "add" } | { kind: "rename" | "sell"; resource: WarbandResource } | null;

const MENU_ITEM =
  "flex min-h-10 cursor-pointer items-center px-3 text-sm text-ink outline-none data-[highlighted]:bg-raised";

/** The campaign's own (fixed): its default resource and its campaign points. */
const isFixed = (resource: WarbandResource) =>
  resource.is_default || Boolean(resource.is_campaign_points);

/** The campaign's default resource first, then its campaign points, the rest as they come. */
const defaultFirst = (resources: WarbandResource[]) => [
  ...resources.filter((resource) => resource.is_default),
  ...resources.filter((resource) => !resource.is_default && resource.is_campaign_points),
  ...resources.filter((resource) => !isFixed(resource)),
];

/**
 * The warband's resources (design E): the default resource first, with no icon, then campaign
 * points, then the rest; − and + inline, Add resource (its name and amount open in the button's
 * place), and Rename, Delete, Sell (the default and campaign points only sell).
 */
export default function WarbandResources({
  warbandId,
  resources,
  canEdit,
}: {
  warbandId: number;
  resources: WarbandResource[];
  canEdit: boolean;
}) {
  const change = useResourceChange(warbandId);
  const create = useResourceCreate(warbandId);
  const remove = useResourceDelete(warbandId);
  const rename = useResourceRename(warbandId);
  const sell = useResourceSale(warbandId);
  const [editing, setEditing] = useState<Editing>(null);
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  const done = { onSuccess: () => setEditing(null), onError };

  const submit = () => {
    if (!editing) return;
    if (editing.kind === "add")
      create.mutate({ name: text.trim(), amount: Math.max(0, Number(amount) || 0) }, done);
    else if (editing.kind === "rename")
      rename.mutate({ resourceId: editing.resource.id, name: text.trim() }, done);
    else
      sell.mutate(
        { resourceId: editing.resource.id, quantity: Number(text) || 1, price: Number(price) || 0 },
        done
      );
  };

  return (
    <section
      aria-label="Resources"
      className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-y border-line py-3"
    >
      {defaultFirst(resources).map((resource) => (
        <div key={resource.id} className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            {!resource.is_default && /wyrd/i.test(resource.name) ? (
              <GameIcon name="wyrdstone" className="h-3.5 w-3.5 text-good" />
            ) : null}
            {resource.name}
          </span>
          {canEdit ? (
            <IconButton
              aria-label={`One ${resource.name} less`}
              className="h-8 w-8"
              onClick={() => change.mutate({ resourceId: resource.id, delta: -1 }, { onError })}
            >
              <Minus aria-hidden="true" />
            </IconButton>
          ) : null}
          <span className="min-w-[26px] text-center font-display text-2xl font-semibold text-head">
            {resource.amount}
          </span>
          {canEdit ? (
            <>
              <IconButton
                aria-label={`One ${resource.name} more`}
                className="h-8 w-8"
                onClick={() => change.mutate({ resourceId: resource.id, delta: 1 }, { onError })}
              >
                <Plus aria-hidden="true" />
              </IconButton>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <IconButton
                    aria-label={`${resource.name} actions`}
                    look="plain"
                    className="h-8 w-8"
                  >
                    <EllipsisVertical aria-hidden="true" />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    className="z-[70] min-w-[160px] border border-border bg-panel p-1"
                  >
                    {isFixed(resource) ? null : (
                      <DropdownMenu.Item
                        className={MENU_ITEM}
                        onSelect={() => {
                          setText(resource.name);
                          setEditing({ kind: "rename", resource });
                        }}
                      >
                        Rename
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item
                      className={MENU_ITEM}
                      onSelect={() => {
                        setText("1");
                        setPrice("");
                        setEditing({ kind: "sell", resource });
                      }}
                    >
                      Sell
                    </DropdownMenu.Item>
                    {isFixed(resource) ? null : (
                      <DropdownMenu.Item
                        className={`${MENU_ITEM} text-danger`}
                        onSelect={() => remove.mutate(resource.id, { onError })}
                      >
                        Delete
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </>
          ) : null}
        </div>
      ))}
      {canEdit && !editing ? (
        <button
          type="button"
          onClick={() => {
            setText("");
            setAmount("");
            setEditing({ kind: "add" });
          }}
          className="ml-auto min-h-8 border border-dashed border-strong px-2.5 text-xs font-bold text-accent-text"
        >
          Add resource
        </button>
      ) : null}
      {editing ? (
        <form
          aria-label={editing.kind === "add" ? "Add resource" : undefined}
          className={
            editing.kind === "add"
              ? "ml-auto flex flex-wrap items-center gap-1.5"
              : "flex w-full flex-wrap items-center gap-2"
          }
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {editing.kind === "sell" ? (
            <NumberInput
              compact
              autoFocus
              inputSize="sm"
              min={1}
              max={editing.resource.amount}
              aria-label="How many"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          ) : (
            <Input
              autoFocus
              inputSize="sm"
              aria-label="Resource name"
              placeholder={editing.kind === "add" ? "Name" : undefined}
              className="h-9 w-36 md:h-9"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          )}
          {editing.kind === "add" ? (
            <NumberInput
              compact
              inputSize="sm"
              min={0}
              aria-label="Amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          ) : null}
          {editing.kind === "sell" ? (
            <NumberInput
              compact
              aria-label="Price in gold"
              inputSize="sm"
              placeholder="gc"
              className="w-24"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          ) : null}
          <Button size="sm" type="submit">
            {editing.kind === "add" ? "Add" : editing.kind === "rename" ? "Rename" : "Sell"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </form>
      ) : null}
    </section>
  );
}
