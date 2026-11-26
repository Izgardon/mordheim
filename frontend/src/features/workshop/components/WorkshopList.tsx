import { useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { CopyCode } from "@/components/ui/copy-code";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { useWarbandTemplate } from "@/features/warband-templates/api/template-queries";
import TemplateDetail from "@/features/warband-templates/components/TemplateDetail";
import TemplateEditor from "@/features/warband-templates/editor/TemplateEditor";
import { queryKeys } from "@/lib/query-keys";
import { useMediaQuery } from "@/lib/use-media-query";

import { useWorkshop } from "../api/workshop-queries";

/**
 * A warband list in my workshop (`/workshop/:id/lists/:templateId`): its name and the types it
 * serves, its share code with Copy, then the list as Reference → Warbands shows it, and Edit
 * list, the template editor on it.
 */
export default function WorkshopList() {
  const { campaign: workshop } = useOutletContext<CampaignLayoutContext>();
  const workshopId = workshop?.id ?? 0;
  const isMobile = useMediaQuery("(max-width: 960px)");
  const queryClient = useQueryClient();
  const listed = useWorkshop();
  const [editing, setEditing] = useState<number | null>(null);
  const templateId = Number(useParams().templateId);
  const row = listed.data?.lists.find((entry) => entry.id === templateId);
  const template = useWarbandTemplate(workshopId, row ? templateId : 0);
  const canEdit = campaignCapabilities(workshop).edit_catalogue;
  const type = template.data?.types[0];

  if (!row) {
    return (
      <p className="m-0 text-sm text-text2">
        {listed.isPending ? "Loading…" : "No record of that list."}
      </p>
    );
  }
  const types = (template.data?.types ?? row.warband_types).map((entry) => entry.name);
  const close = () => {
    setEditing(null);
    // its name and the types it serves are my workshop's rows too
    void queryClient.invalidateQueries({ queryKey: queryKeys.workshop() });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            {["Warband list", types.join(", ")].filter(Boolean).join(" · ")}
          </span>
          <h1 className="m-0 break-words font-display text-[32px] font-semibold leading-tight text-head min-[960px]:text-[40px]">
            {template.data?.name ?? row.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CopyCode code={row.share_code} label="share code" />
          {canEdit ? (
            <Button
              variant="secondary"
              size="lg"
              className="max-[960px]:flex-1"
              onClick={() => setEditing(templateId)}
            >
              Edit list
            </Button>
          ) : null}
        </div>
      </header>
      <div className={isMobile ? undefined : "border border-line"}>
        <TemplateDetail
          campaignId={workshopId}
          templateId={templateId}
          preset={type?.variant ?? ""}
          typeId={type?.id ?? null}
          isMobile={isMobile}
          untitled
        />
      </div>
      <TemplateEditor
        campaignId={workshopId}
        templateId={editing}
        onTemplateChange={setEditing}
        onClose={close}
      />
    </div>
  );
}
