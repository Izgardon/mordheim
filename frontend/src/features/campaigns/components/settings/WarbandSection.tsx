import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { deleteWarband, updateWarband } from "@/features/warbands/api/warbands-core";
import { useMyWarbandWriter } from "@/features/warbands/hooks/warband/useMyWarbandStore";
import type { Warband } from "@/features/warbands/types/warband-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { normalizeWebUrl } from "@/lib/url-utils";
import { useAppStore } from "@/stores/app-store";

import { isArchived } from "../../capabilities";
import { leaveMode, useLeaveCampaign } from "../../hooks/settings/useLeaveCampaign";
import type { CampaignSummary } from "../../types/campaign-types";
import RemovalPreview, { ownVoice } from "./RemovalPreview";
import { Field, FormError, SettingsCard } from "./settings-ui";

type WarbandProps = {
  warband: Warband;
  canEdit: boolean;
  onSaved: (patch: Partial<Warband>) => void;
};

/** Your warband's name and the most units it keeps, edited together. */
function WarbandDetails({ warband, canEdit, onSaved }: WarbandProps) {
  const maxUnits = warband.max_units ?? 15;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(warband.name);
  const [limit, setLimit] = useState(String(maxUnits));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setName(warband.name), [warband.name]);
  useEffect(() => setLimit(String(maxUnits)), [maxUnits]);

  const cancel = () => {
    setEditing(false);
    setName(warband.name);
    setLimit(String(maxUnits));
    setError("");
  };
  const save = async () => {
    const trimmed = name.trim();
    const parsed = Number(limit);
    if (!trimmed) return setError("Name your warband.");
    if (!Number.isInteger(parsed) || parsed < 1) {
      return setError("The most units is a whole number, at least 1.");
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateWarband(warband.id, { name: trimmed, max_units: parsed });
      onSaved({ name: updated.name, max_units: updated.max_units });
      setEditing(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't save your warband."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard
      title={warband.name}
      description={`${warband.faction}. Its name and the most units it keeps (going past it warns, never blocks).`}
      action={
        canEdit && !editing ? (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null
      }
    >
      {editing ? (
        <>
          <div className="grid gap-3 min-[961px]:grid-cols-[1fr_160px]">
            <Field label="Name" htmlFor="settings-warband-name">
              <Input
                id="settings-warband-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Most units" htmlFor="settings-warband-max">
              <Input
                id="settings-warband-max"
                type="number"
                min={1}
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                className="font-mono"
              />
            </Field>
          </div>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      ) : (
        <dl className="m-0 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Name</dt>
            <dd className="m-0 text-[15px] text-ink">{warband.name}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              Most units
            </dt>
            <dd className="m-0 font-mono text-[15px] text-ink">{maxUnits}</dd>
          </div>
        </dl>
      )}
    </SettingsCard>
  );
}

/** A link to the warband's sheet anywhere on the web; the warband page's ⋯ menu opens it. */
function WarbandSheetLink({ warband, canEdit, onSaved }: WarbandProps) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(warband.warband_link ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setUrl(warband.warband_link ?? ""), [warband.warband_link]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateWarband(warband.id, {
        warband_link: normalizeWebUrl(url) || null,
      });
      onSaved({ warband_link: updated.warband_link });
      setEditing(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't save the link."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard
      title="Warband sheet"
      description="A link to your roster or sheet anywhere on the web; the warband page's ⋯ menu opens it."
      action={
        canEdit && !editing ? (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {warband.warband_link ? "Edit" : "Add a link"}
          </Button>
        ) : null
      }
    >
      {editing ? (
        <>
          <Input
            type="url"
            aria-label="Warband sheet link"
            value={url}
            placeholder="https://…"
            onChange={(event) => setUrl(event.target.value)}
          />
          <p className="m-0 text-xs text-muted-foreground">
            A Google Drive link needs &ldquo;Anyone with the link can view&rdquo;. Google Docs links
            don&apos;t read well on a phone.
          </p>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setUrl(warband.warband_link ?? "");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      ) : warband.warband_link ? (
        <a
          href={warband.warband_link}
          target="_blank"
          rel="noopener noreferrer"
          className="block min-w-0 truncate text-sm font-semibold text-accent-text underline underline-offset-2"
        >
          {warband.warband_link}
        </a>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">No link yet.</p>
      )}
    </SettingsCard>
  );
}

/** Delete your warband and all its units, typed "delete" to confirm. */
function DeleteWarband({ warband, onDeleted }: { warband: Warband; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = typed.trim().toLowerCase() === "delete";
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteWarband(warband.id);
      setOpen(false);
      onDeleted();
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't delete the warband."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SettingsCard
      title="Delete warband"
      tone="danger"
      description={`${warband.name} and every unit in it go for good. You can raise a new warband afterwards.`}
      action={
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete warband
        </Button>
      }
    >
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setTyped("");
            setError("");
          }
        }}
        title="Delete warband"
        description={
          <div className="flex flex-col gap-3">
            <p className="m-0 text-ink">
              Delete <span className="font-bold">{warband.name}</span> and all its units? This
              can&apos;t be undone.
            </p>
            <Field label="Type delete to confirm" htmlFor="delete-warband-typed">
              <Input
                id="delete-warband-typed"
                value={typed}
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
              />
            </Field>
          </div>
        }
        error={error}
        confirmText={busy ? "Deleting…" : "Delete warband"}
        confirmDisabled={!ready}
        isConfirming={busy}
        onConfirm={() => void remove()}
      />
    </SettingsCard>
  );
}

const HAND_OVER_FIRST =
  "Hand ownership to an admin first: in Players, tick Admin on someone's row, then Make owner.";

/**
 * Leave the campaign (decision 4, CAMP-NEW-03): players and admins leave with removal's clean-up;
 * the owner alone archives the campaign by leaving; the owner with company is told to hand it over
 * first, the button greyed but there (guide, not gatekeeper).
 */
function LeaveCampaign({ campaign }: { campaign: CampaignSummary }) {
  const mode = leaveMode(campaign);
  const leaving = useLeaveCampaign(campaign);
  if (!mode) return null;
  const label = mode === "archive" ? "Leave (archives the campaign)" : "Leave campaign";
  const blocked = mode === "hand_over_first";
  return (
    <SettingsCard
      title="Leave campaign"
      tone="danger"
      description={
        blocked
          ? HAND_OVER_FIRST
          : mode === "archive"
            ? "You're the only member, so leaving archives the campaign. You stay its owner and can restore it."
            : "Your open battles and trades close. Your warband is kept and comes back if you rejoin with the join code."
      }
      action={
        <Button
          variant="danger"
          className={blocked ? "opacity-50" : undefined}
          aria-disabled={blocked || undefined}
          title={blocked ? "Hand ownership to an admin first" : undefined}
          onClick={blocked ? undefined : leaving.openLeave}
        >
          {label}
        </Button>
      }
    >
      <ConfirmDialog
        open={leaving.open}
        onOpenChange={(open) => !open && leaving.closeLeave()}
        title="Leave campaign"
        description={
          <div className="flex flex-col gap-3">
            <p className="m-0 text-ink">{`Leave ${campaign.name}?`}</p>
            {mode === "archive" ? (
              <p className="m-0">
                You&apos;re the only member, so leaving archives it: it becomes read-only, and you
                stay its owner, so you can restore it from its settings.
              </p>
            ) : null}
            {leaving.preview.isPending ? (
              <p className="m-0">Checking what this closes…</p>
            ) : leaving.preview.isError ? (
              <p className="m-0 text-danger">
                {getErrorMessage(leaving.preview.error, "Couldn't check what this closes.")}
              </p>
            ) : (
              <RemovalPreview preview={leaving.preview.data} voice={ownVoice} />
            )}
          </div>
        }
        error={leaving.error}
        confirmText={leaving.isLeaving ? "Leaving…" : label}
        confirmDisabled={leaving.preview.isPending}
        isConfirming={leaving.isLeaving}
        onConfirm={() => void leaving.leave()}
      />
    </SettingsCard>
  );
}

/**
 * Settings → Your warband (every member): its name and size, the warband sheet link, Delete
 * warband, and Leave campaign. An archived campaign reads only, and keeps Leave.
 */
export default function WarbandSection({ campaign }: { campaign: CampaignSummary }) {
  const navigate = useNavigate();
  const { warband, warbandLoading } = useAppStore();
  const writer = useMyWarbandWriter(campaign.id);
  const archived = isArchived(campaign);
  const mine = warband && warband.campaign_id === campaign.id ? warband : null;
  const onSaved = (patch: Partial<Warband>) => mine && writer.merge(mine.id, patch);

  return (
    <>
      {warbandLoading && !mine ? (
        <p className="m-0 text-sm text-muted-foreground">Mustering your warband…</p>
      ) : mine ? (
        <>
          <WarbandDetails warband={mine} canEdit={!archived} onSaved={onSaved} />
          <WarbandSheetLink warband={mine} canEdit={!archived} onSaved={onSaved} />
          {archived ? null : (
            <DeleteWarband
              warband={mine}
              onDeleted={() => {
                writer.remove(mine.id);
                navigate(`/campaigns/${campaign.id}`);
              }}
            />
          )}
        </>
      ) : (
        <SettingsCard
          title="Your warband"
          description="You haven't raised a warband in this campaign yet."
          action={
            archived ? null : (
              <Button asChild>
                <Link to={`/campaigns/${campaign.id}/warband`}>Raise a warband</Link>
              </Button>
            )
          }
        />
      )}
      <LeaveCampaign campaign={campaign} />
    </>
  );
}
