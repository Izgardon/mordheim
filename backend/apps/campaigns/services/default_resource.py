"""The campaign's default resource (William, 3 Nov 2026): every warband has one (`WarbandResource.is_default`), named
as the settings name it (`CampaignSettings.default_resource_name`, "Wyrdstone" at first). Renaming the setting renames
every warband's in the PATCH's transaction.

A warband that already has another resource of the new name (in any case) has it merged into the default (a guide,
not a gatekeeper): its amount is added, its row removed, and the post-battle drafts not yet applied that send shards
to it or pay upkeep from it name the default instead, so nothing a player chose points at a row that is gone. The
rename warns, naming those warbands.
"""

from typing import Any

from django.db.models import Q

from apps.battles.models import BattleParticipant
from apps.warbands.models import WarbandResource
from apps.warbands.services.resources import MAX_AMOUNT

from ..models import Campaign

MERGED = "default_resource_merged"


def rename_default_resources(campaign: Campaign, name: str) -> list[dict[str, Any]]:
    """Give every warband's default resource `name`, merging in another resource of that name; the caller holds the
    transaction. Returns the warning naming the warbands merged, or none. The resource rows are locked in id order,
    as paying a fee locks a warband's counters."""
    rows = list(
        WarbandResource.objects.select_for_update(of=("self",))
        .select_related("warband")
        .filter(warband__campaign=campaign)
        .filter(Q(is_default=True) | Q(name__iexact=name))
        .order_by("id")
    )
    defaults = {row.warband_id: row for row in rows if row.is_default}
    merged = [row for row in rows if not row.is_default and row.warband_id in defaults]
    for row in merged:
        default = defaults[row.warband_id]
        default.amount = min(MAX_AMOUNT, default.amount + row.amount)
    WarbandResource.objects.filter(id__in=[row.id for row in merged]).delete()  # before the defaults take the name
    for default in defaults.values():
        default.name = name
    WarbandResource.objects.bulk_update(list(defaults.values()), ["name", "amount"])
    _repoint_drafts({row.id: defaults[row.warband_id].id for row in merged})
    if not merged:
        return []
    warbands = ", ".join(sorted({row.warband.name for row in merged}))
    message = f"{warbands} already had {name}: merged into the default resource."
    return [{"code": MERGED, "message": message, "warbands": sorted({row.warband_id for row in merged})}]


def _repointed(draft: dict[str, Any], moved: dict[int, int]) -> bool:
    """Point the draft's exploration resource and its upkeep lines' counters at the default; whether any moved."""
    upkeep = draft.get("upkeep")
    entries = upkeep.get("entries") if isinstance(upkeep, dict) else None
    lines = [draft.get("exploration")]
    for entry in entries.values() if isinstance(entries, dict) else []:
        resources = entry.get("resources") if isinstance(entry, dict) else None
        lines += resources if isinstance(resources, list) else []
    changed = False
    for line in lines:
        if isinstance(line, dict) and line.get("resource_id") in moved:
            line["resource_id"] = moved[line["resource_id"]]
            changed = True
    return changed


def _repoint_drafts(moved: dict[int, int]) -> None:
    """The drafts of the merged warbands' players not yet applied, each written once when it named a merged row."""
    if not moved:
        return
    owners = WarbandResource.objects.filter(id__in=moved.values()).values("warband_id")
    participants = BattleParticipant.objects.filter(warband_id__in=owners).exclude(
        status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
    )
    changed = [
        participant
        for participant in participants.only("id", "postbattle_json")
        if isinstance(participant.postbattle_json, dict) and _repointed(participant.postbattle_json, moved)
    ]
    BattleParticipant.objects.bulk_update(changed, ["postbattle_json"])
