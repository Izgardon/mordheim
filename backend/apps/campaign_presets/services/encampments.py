"""The preset's encampments as the campaign's own: copied in its order, held by nobody, and never twice.

An encampment whose name the campaign already lists is left alone, as a location is (`locations.py`), so changing
preset, or taking one up again after editing an encampment, copies only what is missing. A missing encampment goes
last into the campaign's group of its group's name, which is made (after the campaign's others, with the preset's
description) when the campaign lists none.

On a preset change (`swap.py`) an encampment still another published campaign's word for word goes, as a location
does, unless a warband holds it or it was razed: what happened to it in this campaign makes it the campaign's own.
"""

from collections.abc import Iterable

from django.db.models import Max

from apps.campaigns.models import Campaign, CampaignEncampment, CampaignEncampmentGroup

from ..models import CampaignPreset, CampaignPresetEncampment, CampaignPresetEncampmentGroup


def preset_encampments(preset_ids: Iterable[int] | None = None) -> list[CampaignPresetEncampment]:
    """Presets' encampments with their group (one query); every preset's when None."""
    rows = CampaignPresetEncampment.objects.select_related("group")
    if preset_ids is not None:
        rows = rows.filter(group__preset_id__in=list(preset_ids))
    return list(rows.order_by("group__order", "group_id", "order", "id"))


def _listed(campaign_id: int) -> "Iterable[CampaignEncampment]":
    return CampaignEncampment.objects.filter(
        campaign_id=campaign_id, removed_at__isnull=True, group__removed_at__isnull=True
    ).select_related("group")


def missing_encampments(campaign_id: int, preset: CampaignPreset | None) -> list[CampaignPresetEncampment]:
    """The preset's encampments the campaign lists none of by name, in the preset's order."""
    if preset is None:
        return []
    held = {place.name.strip().casefold() for place in _listed(campaign_id)}
    return [place for place in preset_encampments([preset.pk]) if place.name.strip().casefold() not in held]


def _groups_for(campaign: Campaign, sources: list[CampaignPresetEncampmentGroup]) -> dict[int, CampaignEncampmentGroup]:
    """The campaign's group for each preset group, by name: its listed one, else one made last (one INSERT)."""
    listed = CampaignEncampmentGroup.objects.filter(campaign=campaign, removed_at__isnull=True)
    by_name = {group.name.strip().casefold(): group for group in listed}
    wanted = [group for group in sources if group.name.strip().casefold() not in by_name]
    last = CampaignEncampmentGroup.objects.filter(campaign=campaign).aggregate(last=Max("order"))["last"]
    start = 0 if last is None else last + 1
    made = CampaignEncampmentGroup.objects.bulk_create(
        CampaignEncampmentGroup(campaign=campaign, name=group.name, description=group.description, order=start + at)
        for at, group in enumerate(wanted)
    )
    by_name |= {group.name.strip().casefold(): group for group in made}
    return {group.pk: by_name[group.name.strip().casefold()] for group in sources}


def copy_encampments(campaign: Campaign, preset: CampaignPreset | None) -> int:
    """Copy the preset's missing encampments into the campaign's groups, held by nobody; how many."""
    places = missing_encampments(campaign.pk, preset)
    if not places:
        return 0
    groups = _groups_for(campaign, list({place.group_id: place.group for place in places}.values()))
    lasts = dict(
        CampaignEncampment.objects.filter(group__in=list(groups.values()))
        .values("group")
        .annotate(last=Max("order"))
        .values_list("group", "last")
    )
    next_order = {group.pk: lasts.get(group.pk, -1) + 1 for group in groups.values()}
    written = []
    for place in places:
        group = groups[place.group_id]
        written.append(
            CampaignEncampment(
                campaign=campaign,
                group=group,
                name=place.name,
                gained_by=place.gained_by,
                fortified=place.fortified,
                text=place.text,
                order=next_order[group.pk],
            )
        )
        next_order[group.pk] += 1
    CampaignEncampment.objects.bulk_create(written)
    return len(written)


def _words(text: str) -> str:
    return str(text or "").strip()


def _print(group: str, place: CampaignEncampment | CampaignPresetEncampment) -> tuple:
    """An encampment word for word: its group's name, its name, how it is gained, fortified and its text."""
    return (_words(group), _words(place.name), _words(place.gained_by), place.fortified, _words(place.text))


def _group_print(group: CampaignEncampmentGroup | CampaignPresetEncampmentGroup) -> tuple:
    return (_words(group.name), _words(group.description))


def encampment_removable(campaign: Campaign, preset: CampaignPreset | None) -> tuple[list[int], list[int]]:
    """The ids of the campaign's listed encampments, and of its groups, still another published campaign's word for
    word and never one this campaign's own preset holds too; an encampment a warband holds, or one razed, stays."""
    mine_id = preset.pk if preset is not None else None
    every = preset_encampments()
    mine = {_print(p.group.name, p) for p in every if p.group.preset_id == mine_id}
    theirs = {_print(p.group.name, p) for p in every if p.group.preset_id != mine_id}
    places = list(_listed(campaign.pk))
    out = {
        p.pk
        for p in places
        if p.holder_id is None and not p.razed and (mark := _print(p.group.name, p)) in theirs and mark not in mine
    }
    every_group = list(CampaignPresetEncampmentGroup.objects.all())
    my_groups = {_group_print(g) for g in every_group if g.preset_id == mine_id}
    their_groups = {_group_print(g) for g in every_group if g.preset_id != mine_id}
    kept = {p.group_id for p in places if p.pk not in out}
    groups = [
        group.pk
        for group in CampaignEncampmentGroup.objects.filter(campaign=campaign, removed_at__isnull=True)
        if group.pk not in kept and (mark := _group_print(group)) in their_groups and mark not in my_groups
    ]
    return sorted(out), groups
