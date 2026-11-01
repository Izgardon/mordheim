import { useOutletContext } from "react-router-dom";
import { Tent } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { campaignCapabilities } from "../capabilities";
import { Field, FormError, TEXTAREA } from "../components/settings/settings-ui";
import { NOBODY_OWNER, useEncampments } from "../hooks/useEncampments";
import type { CampaignEncampment, CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

/** The owner's name, "(left)" once they've left the campaign, or Nobody (CAMP-TWEAK-08). */
function ownerName(encampment: CampaignEncampment) {
  const name = encampment.owner_name?.trim();
  if (!name) return "Nobody";
  return encampment.owner_left ? `${name} (left)` : name;
}

/** Add or edit an encampment: its name, owner (any member, nobody, or one who left) and text. */
function EncampmentForm({ page }: { page: ReturnType<typeof useEncampments> }) {
  return (
    <ModalSheet
      open={page.isFormOpen}
      onOpenChange={(open) => !open && page.closeForm()}
      kicker="Encampment"
      title={page.editing ? `Edit ${page.editing.name}` : "Add an encampment"}
      className="max-w-[560px]"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button
            variant="secondary"
            className="min-h-12"
            onClick={page.closeForm}
            disabled={page.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="min-h-12"
            disabled={page.isSubmitting}
            onClick={() => void page.submit()}
          >
            {page.isSubmitting ? "Saving…" : page.editing ? "Save changes" : "Add encampment"}
          </Button>
        </div>
      }
    >
      <Field label="Name" htmlFor="encampment-name">
        <Input
          id="encampment-name"
          value={page.form.name ?? ""}
          placeholder="Encampment name"
          onChange={(event) => page.setForm((form) => ({ ...form, name: event.target.value }))}
        />
      </Field>
      <Field label="Owner" htmlFor="encampment-owner">
        <select
          id="encampment-owner"
          value={page.ownerValue}
          onChange={(event) => page.chooseOwner(event.target.value)}
          className="min-h-11 border border-strong bg-page px-3 text-sm text-ink"
        >
          <option value={NOBODY_OWNER}>Nobody</option>
          {page.departedOwner ? (
            <option value={page.departedOwner.value}>{page.departedOwner.label}</option>
          ) : null}
          {page.players.map((player) => (
            <option key={player.id} value={String(player.id)}>
              {player.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="What it is" htmlFor="encampment-description">
        <textarea
          id="encampment-description"
          className={TEXTAREA}
          value={page.form.description ?? ""}
          onChange={(event) =>
            page.setForm((form) => ({ ...form, description: event.target.value }))
          }
        />
      </Field>
      <FormError message={page.formError} />
    </ModalSheet>
  );
}

function EncampmentsPage({ campaign }: { campaign: CampaignSummary }) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const { user } = useAuth();
  const page = useEncampments(campaign);
  const yours = page.encampments.filter((encampment) => encampment.owner_id === user?.id);
  // Yours first, then the rest by name (the server's order).
  const listed = [...yours, ...page.encampments.filter((entry) => !yours.includes(entry))];
  const addButton = page.canAdd ? (
    <Button className={isMobile ? "min-h-12 w-full" : undefined} onClick={page.openCreateForm}>
      Add encampment
    </Button>
  ) : null;

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-3 pb-6 pt-3" : "gap-6 pb-14")}>
      {isMobile ? null : (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
              My warband
            </span>
            <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head">
              Encampment
            </h1>
          </div>
          {addButton}
        </header>
      )}
      <p className="m-0 text-sm text-text2">
        Camps the players hold in the city: who owns each and what it is. They have no effect on the
        game.
      </p>
      {isMobile ? addButton : null}
      {!page.isEnabled ? (
        <p className="m-0 border border-border bg-surface px-4 py-5 text-sm text-text2">
          Encampments are switched off for this campaign.
          {campaignCapabilities(campaign).edit_settings
            ? " Switch them on in Settings, Campaign."
            : " The campaign's owner can switch them on in Settings."}
        </p>
      ) : page.isLoading ? (
        <p className="m-0 text-sm text-muted-foreground">Pitching the tents…</p>
      ) : page.error ? (
        <FormError message={page.error} />
      ) : listed.length === 0 ? (
        <div className="flex flex-col items-start gap-2 border border-border bg-surface px-4 py-5">
          <Tent className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="m-0 text-sm text-text2">No encampments yet.</p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {listed.map((encampment) => {
            const mine = encampment.owner_id === user?.id;
            const canEdit = Boolean(encampment.capabilities?.edit) && page.canAdd;
            return (
              <li
                key={encampment.id}
                className={cn(
                  "flex flex-wrap items-start gap-3 border bg-surface px-4 py-3.5",
                  mine ? "border-accent-line" : "border-border"
                )}
              >
                <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display text-[19px] font-semibold text-head">
                      {encampment.name}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-bold uppercase tracking-[0.1em]",
                        mine ? "text-accent-text" : "text-muted-foreground"
                      )}
                    >
                      {mine ? "Yours" : ownerName(encampment)}
                    </span>
                  </span>
                  <p className="m-0 whitespace-pre-line text-[13px] text-text2">
                    {encampment.description?.trim() || "No description yet."}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => page.openEditForm(encampment)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => page.requestDelete(encampment)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <EncampmentForm page={page} />
      <ConfirmDialog
        open={Boolean(page.deleting)}
        onOpenChange={(open) => !open && page.cancelDelete()}
        title="Remove the encampment"
        description={
          <p className="m-0 text-ink">{`Remove ${page.deleting?.name ?? "this encampment"}? It leaves the list for everyone in the campaign.`}</p>
        }
        error={page.deleteError}
        confirmText={page.isDeleting ? "Removing…" : "Remove"}
        isConfirming={page.isDeleting}
        onConfirm={() => void page.confirmDelete()}
      />
    </div>
  );
}

/**
 * The Encampment page (design E, on today's API): every encampment with its owner and what it is,
 * yours first and picked out; any member adds one (owned by himself unless he picks another), and
 * its owner or `manage_encampments` edits, reassigns and removes it. Shown while the campaign has
 * encampments switched on; the rail's and the phone's Encampment links come here.
 */
export default function Encampments() {
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  if (!campaign)
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  return <EncampmentsPage campaign={campaign} />;
}
