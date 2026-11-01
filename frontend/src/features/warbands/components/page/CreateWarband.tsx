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
import type { Warband, WarbandTypeBrief } from "../../types/warband-types";
import WarbandTypePicker from "../type-picker/WarbandTypePicker";
import { linkAfterPick } from "../type-picker/warband-type-picker";

/**
 * No warband in this campaign yet (design E): name one, pick its warband type (which fills the
 * warband link, the player's to replace), then raise it.
 */
export default function CreateWarband({
  campaignId,
  onCreated,
}: {
  campaignId: number;
  onCreated: (warband: Warband) => Promise<void>;
}) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [name, setName] = useState("");
  const [warbandType, setWarbandType] = useState<WarbandTypeBrief | null>(null);
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col",
        isMobile ? "gap-4 pb-6 pt-3" : "mx-auto w-full max-w-[640px] gap-6 pb-14"
      )}
    >
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
      <Card className="p-5 max-[960px]:p-4">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            try {
              if (!warbandType) return;
              await onCreated(
                await createWarband(campaignId, {
                  name: name.trim(),
                  warband_type_id: warbandType.id,
                  warband_link: link.trim() || null,
                })
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
              placeholder="Warband name"
              maxLength={120}
              required
              className="h-11 text-base md:h-11"
            />
          </Field>
          <Field
            label="Warband type"
            htmlFor="new-warband-type"
            hint="Types outside this campaign's settings are greyed out; you can still pick one."
          >
            <WarbandTypePicker
              id="new-warband-type"
              campaignId={campaignId}
              value={warbandType}
              onPick={(picked) => {
                setLink((current) => linkAfterPick(current, warbandType, picked));
                setWarbandType(picked);
              }}
            />
          </Field>
          <Field
            label="Warband link"
            htmlFor="new-warband-link"
            hint={
              warbandType?.link_url && link === warbandType.link_url
                ? `Filled from ${warbandType.name}. Replace it with your own if you like.`
                : "Its warband list or your own sheet (optional)."
            }
          >
            <Input
              id="new-warband-link"
              type="url"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://"
              maxLength={500}
              className="h-11 text-base md:h-11"
            />
          </Field>
          <Button
            type="submit"
            className={cn("min-h-12", isMobile ? "w-full" : "self-start")}
            disabled={saving || !name.trim() || !warbandType}
          >
            {saving ? "Raising..." : "Raise the warband"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
