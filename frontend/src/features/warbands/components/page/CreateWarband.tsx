import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/get-error-message";

import { createWarband } from "../../api/warbands-api";
import type { Warband } from "../../types/warband-types";

/** No warband in this campaign yet: name one and pick its faction. */
export default function CreateWarband({
  campaignId,
  onCreated,
}: {
  campaignId: number;
  onCreated: (warband: Warband) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [faction, setFaction] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Card className="flex max-w-xl flex-col gap-4 p-5">
      <h1 className="font-display text-3xl font-semibold text-head">Raise a warband</h1>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await onCreated(
              await createWarband(campaignId, { name: name.trim(), faction: faction.trim() })
            );
          } catch (error) {
            toast.error("Couldn't raise the warband.", { description: getErrorMessage(error) });
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          Name
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          Faction
          <Input
            value={faction}
            onChange={(event) => setFaction(event.target.value)}
            placeholder="Reikland mercenaries"
            required
          />
        </label>
        <Button
          type="submit"
          className="self-start"
          disabled={saving || !name.trim() || !faction.trim()}
        >
          Raise it
        </Button>
      </form>
    </Card>
  );
}
