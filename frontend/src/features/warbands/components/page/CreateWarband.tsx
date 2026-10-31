import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/features/campaigns/components/settings/settings-ui";
import { getErrorMessage } from "@/lib/get-error-message";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { createWarband } from "../../api/warbands-api";
import type { Warband } from "../../types/warband-types";

/** No warband in this campaign yet (design E): name one and say what it is, then raise it. */
export default function CreateWarband({
  campaignId,
  onCreated,
}: {
  campaignId: number;
  onCreated: (warband: Warband) => Promise<void>;
}) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [name, setName] = useState("");
  const [faction, setFaction] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-4 pb-6 pt-3" : "gap-6 pb-14")}>
      <header className="flex flex-col gap-1.5">
        {/* The phone's top bar already says where this is. */}
        {isMobile ? null : (
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            My warband
          </span>
        )}
        <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head max-[960px]:text-[30px]">
          Raise a warband
        </h1>
        <p className="m-0 max-w-[560px] text-sm text-text2">
          You have no warband in this campaign yet. Name it and say what it is; you hire its heroes
          and henchmen on the warband page once it stands.
        </p>
      </header>
      <Card className="max-w-[560px] p-5 max-[960px]:p-4">
        <form
          className="flex flex-col gap-4"
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
          <Field label="Name" htmlFor="new-warband-name">
            <Input
              id="new-warband-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ashen Crows"
              maxLength={120}
              required
              className="h-11 text-base md:h-11"
            />
          </Field>
          <Field
            label="Warband type"
            htmlFor="new-warband-faction"
            hint="As its warband list names it: Reiklanders, Skaven of Clan Eshin, Sisters of Sigmar."
          >
            <Input
              id="new-warband-faction"
              value={faction}
              onChange={(event) => setFaction(event.target.value)}
              placeholder="Reikland mercenaries"
              maxLength={80}
              required
              className="h-11 text-base md:h-11"
            />
          </Field>
          <Button
            type="submit"
            className={cn("min-h-12", isMobile ? "w-full" : "self-start")}
            disabled={saving || !name.trim() || !faction.trim()}
          >
            {saving ? "Raising..." : "Raise the warband"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
