import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getRefusalMessage } from "@/lib/get-error-message";

/** One of my own workshop warbands or lists, as the menu offers it: its name and type. */
export type ImportPick = { id: number; name: string; sub: string };

/** Importing a pick: pending while it runs, a refusal toasted in the server's words. */
export function useImportPick(run: (id: number) => Promise<void>) {
  const [pending, setPending] = useState(false);
  const pick = async (id: number) => {
    setPending(true);
    try {
      await run(id);
    } catch (refused) {
      toast.error(getRefusalMessage(refused, "Couldn't import it."));
    } finally {
      setPending(false);
    }
  };
  return { pending, pick: (id: number) => void pick(id) };
}

const MENU_ITEM =
  "flex min-h-11 cursor-pointer flex-col justify-center gap-0.5 px-3 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-raised data-[highlighted]:text-head";

/**
 * Import a warband or a list into a campaign: my own from my workshop, picked straight from the
 * menu (William, 27 Nov 2026: "as they were there already"), then By code for anyone else's. With
 * nothing of my own it is one button, straight to the code.
 */
export default function ImportMenu({
  label,
  picks,
  pending,
  onPick,
  onCode,
  className,
}: {
  label: string;
  picks: ImportPick[];
  /** An import is under way: the button waits. */
  pending: boolean;
  onPick: (id: number) => void;
  onCode: () => void;
  className?: string;
}) {
  const shown = pending ? "Importing…" : label;
  if (!picks.length) {
    return (
      <Button variant="secondary" className={className} disabled={pending} onClick={onCode}>
        {shown}
      </Button>
    );
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" className={className} disabled={pending}>
          {shown}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[70] max-h-[60vh] min-w-[240px] max-w-[calc(100vw-32px)] overflow-y-auto border border-accent-line bg-panel p-1 shadow-[0_16px_40px_var(--color-shadow)]"
        >
          {picks.map((pick) => (
            <DropdownMenu.Item key={pick.id} onSelect={() => onPick(pick.id)} className={MENU_ITEM}>
              <span className="font-semibold text-head">{pick.name}</span>
              {pick.sub ? <span className="text-xs text-text2">{pick.sub}</span> : null}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item onSelect={onCode} className={MENU_ITEM}>
            By code
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
