import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { EllipsisVertical, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

/** The warband's resources (design E): − and + inline, Add resource, and Rename, Delete, Sell. */
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
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  const done = { onSuccess: () => setEditing(null), onError };

  const submit = () => {
    if (!editing) return;
    if (editing.kind === "add") create.mutate(text.trim(), done);
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
      {resources.map((resource) => (
        <div key={resource.id} className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
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
                    <DropdownMenu.Item
                      className={MENU_ITEM}
                      onSelect={() => {
                        setText(resource.name);
                        setEditing({ kind: "rename", resource });
                      }}
                    >
                      Rename
                    </DropdownMenu.Item>
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
                    <DropdownMenu.Item
                      className={`${MENU_ITEM} text-danger`}
                      onSelect={() => remove.mutate(resource.id, { onError })}
                    >
                      Delete
                    </DropdownMenu.Item>
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
            setEditing({ kind: "add" });
          }}
          className="ml-auto min-h-8 border border-dashed border-strong px-2.5 text-xs font-bold text-accent-text"
        >
          Add resource
        </button>
      ) : null}
      {editing ? (
        <form
          className="flex w-full flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            autoFocus
            inputSize="sm"
            aria-label={editing.kind === "sell" ? "How many" : "Resource name"}
            inputMode={editing.kind === "sell" ? "numeric" : undefined}
            className="w-40"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {editing.kind === "sell" ? (
            <Input
              aria-label="Price in gold"
              inputSize="sm"
              inputMode="numeric"
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
