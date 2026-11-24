import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ReferenceList } from "@/features/reference/ReferenceList";
import { getErrorMessage } from "@/lib/get-error-message";

import { useEncampmentWrites, useEncampments } from "../api/encampment-queries";
import { useEncampmentTree } from "../hooks/useEncampmentTree";
import type { CampaignEncampment, EncampmentGroup } from "../types";
import EncampmentDialog, { type EncampmentEditing } from "./EncampmentDialog";
import EncampmentGroupDialog from "./EncampmentGroupDialog";
import EncampmentGroupRow, { type GroupManage } from "./EncampmentGroupRow";
import EncampmentRules from "./EncampmentRules";

type Removing = { group: EncampmentGroup } | { encampment: CampaignEncampment } | null;

/**
 * The campaign's encampments: its encampment rules, then a row per group opening to its
 * encampments, each opening to how it is gained, what it gives and Take it, Raze it and Give it
 * up. Those who manage encampments (`canManage`) add, edit and remove groups and encampments.
 */
export default function EncampmentTree({
  campaignId,
  canManage,
  canManageRules,
  openId,
  isMobile,
}: {
  campaignId: number;
  canManage: boolean;
  canManageRules: boolean;
  /** Opened at first: the encampment a link names (the warband sheet's). */
  openId: number | null;
  isMobile: boolean;
}) {
  const page = useEncampments(campaignId);
  const groups = page.data?.groups ?? [];
  const tree = useEncampmentTree(groups, openId);
  const writes = useEncampmentWrites(campaignId);
  const [editingGroup, setEditingGroup] = useState<EncampmentGroup | null | undefined>(undefined);
  const [editing, setEditing] = useState<EncampmentEditing>(undefined);
  const [removing, setRemoving] = useState<Removing>(null);
  const [removeError, setRemoveError] = useState("");
  const manage: GroupManage | null = canManage
    ? {
        editGroup: setEditingGroup,
        removeGroup: (group) => setRemoving({ group }),
        addEncampment: (group) => setEditing({ groupId: group.id }),
        editEncampment: (encampment) => setEditing({ encampment }),
        removeEncampment: (encampment) => setRemoving({ encampment }),
      }
    : null;
  const isGroup = Boolean(removing && "group" in removing);
  const removingName =
    removing && ("group" in removing ? removing.group.name : removing.encampment.name);
  const confirmRemove = () => {
    if (!removing) return;
    const done = {
      onSuccess: () => setRemoving(null),
      onError: (failure: unknown) =>
        setRemoveError(getErrorMessage(failure, "Couldn't remove it.")),
    };
    setRemoveError("");
    if ("group" in removing) writes.removeGroup.mutate(removing.group.id, done);
    else writes.removeEncampment.mutate(removing.encampment.id, done);
  };

  return (
    <div className="flex flex-col gap-8">
      <EncampmentRules
        campaignId={campaignId}
        rules={page.data?.rules ?? []}
        loading={page.isPending}
        canManage={canManageRules}
        isMobile={isMobile}
      />
      <section aria-label="Encampments" className="flex flex-col gap-3">
        {canManage ? (
          <Button variant="secondary" className="self-start" onClick={() => setEditingGroup(null)}>
            Add group
          </Button>
        ) : null}
        <Input
          type="search"
          aria-label="Search encampments"
          placeholder="Search encampments"
          value={tree.search}
          onChange={(event) => tree.setSearch(event.target.value)}
        />
        {page.error ? (
          <p className="m-0 text-sm text-danger">{getErrorMessage(page.error)}</p>
        ) : null}
        {page.isPending ? (
          <p className="m-0 text-sm text-muted-foreground">Finding the encampments…</p>
        ) : (
          <ReferenceList
            isEmpty={!tree.shown.length}
            empty={groups.length ? "No encampment matches." : "No encampments yet."}
          >
            {tree.shown.map((group) => (
              <EncampmentGroupRow
                key={group.id}
                campaignId={campaignId}
                group={group}
                takers={page.data?.takers ?? []}
                open={tree.groupOpen(group.id)}
                onToggle={() => tree.toggleGroup(group.id)}
                isOpen={tree.campOpen}
                onToggleCamp={tree.toggleCamp}
                manage={manage}
              />
            ))}
          </ReferenceList>
        )}
      </section>
      <EncampmentGroupDialog
        group={editingGroup}
        onClose={() => setEditingGroup(undefined)}
        writes={writes}
      />
      <EncampmentDialog
        editing={editing}
        groups={groups}
        writes={writes}
        onClose={() => setEditing(undefined)}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={isGroup ? "Remove the group" : "Remove the encampment"}
        description={
          <p className="m-0 text-ink">
            {isGroup
              ? `Remove ${removingName} and its encampments? They leave the list for everyone in the campaign.`
              : `Remove ${removingName}? It leaves the list for everyone in the campaign.`}
          </p>
        }
        error={removeError}
        confirmText="Remove"
        isConfirming={writes.removeGroup.isPending || writes.removeEncampment.isPending}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
