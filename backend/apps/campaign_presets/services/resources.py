"""A preset's resources (William, 23 Nov 2026: "settings to own default resources that get added and can't be
deleted ... treasure and wyrdstone for MiM where treasure is the default").

The main one is dictated like any structural setting: it names the campaign's default resource
(`CampaignSettings.default_resource_name`), so the rename that already renames every warband's default does the work.
The others are counters every warband of the campaign holds and may not delete or rename (`WarbandResource.fixed`):
given to each warband as it is raised, and to every warband already raised when the campaign takes the preset up.
Changing to another preset frees the old preset's counters (they stay, with their amounts, as ordinary counters)
and fixes the new one's.
"""

from collections.abc import Iterable

from apps.warbands.models import Warband, WarbandResource

from ..models import CampaignPreset


def other_resources(preset: CampaignPreset | None) -> list[str]:
    """The preset's resources besides the main one, in its order; [] for no preset or one that names none."""
    if preset is None:
        return []
    main = preset.main_resource.strip().casefold()
    names: dict[str, str] = {}
    for name in preset.resources or []:
        cleaned = str(name).strip()
        if cleaned and cleaned.casefold() != main:
            names.setdefault(cleaned.casefold(), cleaned)
    return list(names.values())


def give_fixed(warbands: Iterable[Warband], names: list[str]) -> None:
    """Each warband holds a fixed counter of every name: one it already has by that name (any case) becomes fixed,
    else one is added at 0. Its default resource is left alone. Two queries a call."""
    warband_ids = [warband.pk for warband in warbands]
    if not warband_ids or not names:
        return
    wanted = {name.casefold(): name for name in names}
    held = WarbandResource.objects.filter(warband_id__in=warband_ids, is_default=False)
    found: set[tuple[int, str]] = set()
    fix: list[int] = []
    for row in held.only("id", "warband_id", "name", "fixed"):
        key = row.name.strip().casefold()
        if key in wanted:
            found.add((row.warband_id, key))
            if not row.fixed:
                fix.append(row.pk)
    if fix:
        WarbandResource.objects.filter(pk__in=fix).update(fixed=True)
    WarbandResource.objects.bulk_create(
        WarbandResource(warband_id=warband_id, name=name, amount=0, fixed=True)
        for warband_id in warband_ids
        for key, name in wanted.items()
        if (warband_id, key) not in found
    )


def apply_resources(campaign_id: int, preset: CampaignPreset | None) -> None:
    """The campaign now plays `preset`: its warbands' fixed counters become the preset's others (the old preset's
    are freed, keeping their amounts), each warband given any it lacks."""
    names = other_resources(preset)
    keep = {name.casefold() for name in names}
    rows = WarbandResource.objects.filter(warband__campaign_id=campaign_id, fixed=True)
    freed = [row.pk for row in rows.only("id", "name") if row.name.strip().casefold() not in keep]
    if freed:
        WarbandResource.objects.filter(pk__in=freed).update(fixed=False)
    give_fixed(Warband.objects.filter(campaign_id=campaign_id).only("id"), names)
