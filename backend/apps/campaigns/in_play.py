"""What is in play in a campaign (grading phase 1): the settings it ticked, the visibility rule and the grade presets.

Only settings carry a grade (`CampaignType`). A campaign stores the settings it ticked (`Campaign.campaign_types`),
always-on ones (Mordheim) included; an always-on setting is in play whether or not a campaign lists it.

An entry (a warband type, a skill, a hired sword …) is in play when its setting is, or when it has none: a campaign's
own entries (custom ones are never given a setting) and the rows not given one yet (items until the items rebuild;
races, specials, spells and the bestiary) count as Mordheim's. A campaign's version of a book entry keeps the book
entry's setting, so editing a Khemri skill doesn't bring Khemri into play. Anything else stays listed in pickers,
greyed out with a warning ("Khemri isn't in this campaign"), and can still be picked: restrictions warn, they never
block.

Picking a grade is a preset: "Up to 1c" ticks every setting at or below 1c, then the owner adjusts by hand. The
campaign stores no grade, so there is nothing to reset. A new campaign starts on `DEFAULT_PRESET`.

A workshop (apps/workshop) ticks nothing and has **every setting in play**, computed here and never stored, so a
setting seeded later is in play in every workshop without a backfill: each rule below reads "or the campaign is a
workshop" in the same query.
"""

import re
from collections.abc import Iterable
from typing import Any

from django.db.models import BooleanField, Exists, ExpressionWrapper, OuterRef, Q, QuerySet, Value

from .models import GRADE_LABELS, GRADES, WORKSHOP, Campaign, CampaignCampaignType, CampaignType

DEFAULT_PRESET = "1c"  # the plan's suggestion for a new campaign


def grades_up_to(grade: str) -> tuple[str, ...]:
    """The grades at or below `grade`, lowest first ("1c": 1a, 1b, 1c)."""
    return GRADES[: GRADES.index(grade) + 1]


def preset_ids(grade: str) -> list[int]:
    """The settings an "Up to `grade`" preset ticks: every setting at or below it (always-on ones are 1a)."""
    rows = CampaignType.objects.filter(Q(grade__in=grades_up_to(grade)) | Q(always_on=True))
    return list(rows.order_by("sort_order", "id").values_list("id", flat=True))


def presets(settings: Iterable[CampaignType]) -> list[dict[str, Any]]:
    """Each grade's preset from the loaded settings: `{grade, label, setting_ids}`, lowest first."""
    rows = list(settings)
    return [
        {
            "grade": grade,
            "label": f"Up to {grade}",
            "description": GRADE_LABELS[grade],
            "setting_ids": [row.pk for row in rows if row.always_on or row.grade in grades_up_to(grade)],
        }
        for grade in GRADES
    ]


def is_workshop(campaign_id: int) -> Exists:
    """The campaign is a workshop, which has every setting in play (a subquery of the caller's query)."""
    return Exists(Campaign.objects.filter(pk=campaign_id, kind=WORKSHOP))


def ticked(campaign_id: int, setting_id: str = "campaign_type_id") -> Q:
    """The setting (the outer row's `setting_id` column) is one the campaign ticked, or the campaign is a workshop."""
    chosen = CampaignCampaignType.objects.filter(campaign_id=campaign_id, campaign_type_id=OuterRef(setting_id))
    return Q(Exists(chosen)) | Q(is_workshop(campaign_id))


def in_play(campaign_id: int, setting: str = "campaign_type") -> Q:
    """The visibility rule as a filter on rows whose setting is the `setting` foreign key: no setting (custom, or
    Mordheim's by default), an always-on setting, or one the campaign ticked (every one in a workshop)."""
    return (
        Q(**{f"{setting}__isnull": True}) | Q(**{f"{setting}__always_on": True}) | ticked(campaign_id, f"{setting}_id")
    )


def settings_in_play(campaign_id: int) -> set[int]:
    """The ids of the settings in play in the campaign: the always-on ones and those it ticked, every one in a
    workshop (one query)."""
    rows = CampaignType.objects.filter(Q(always_on=True) | ticked(campaign_id, "pk"))
    return set(rows.values_list("pk", flat=True))


def with_in_play[RowsT: QuerySet[Any]](rows: RowsT, campaign_id: int, setting: str = "campaign_type") -> RowsT:
    """`rows` with `in_play` annotated (same query): whether each is in play in the campaign."""
    annotated: RowsT = rows.annotate(in_play=ExpressionWrapper(in_play(campaign_id, setting), BooleanField()))
    return annotated


def has_setting(model: type[Any]) -> bool:
    """The model's rows belong to a setting (the bestiary's don't yet: Mordheim's)."""
    return any(field.name == "campaign_type" for field in model._meta.get_fields())


def in_play_rows[RowsT: QuerySet[Any]](model: type[Any], rows: RowsT, campaign_id: int) -> RowsT:
    """A catalogue list's rows with `in_play`: by the rule where they have a setting, else always (Mordheim's)."""
    if has_setting(model):
        return with_in_play(rows, campaign_id)
    annotated: RowsT = rows.annotate(in_play=Value(True, output_field=BooleanField()))
    return annotated


def set_settings(campaign: Campaign, ids: Iterable[int]) -> list[int]:
    """The campaign's settings in play become `ids` (known setting ids), with the always-on ones added; the ids
    ticked just now (what adds a setting's scenarios: apps/scenarios)."""
    always = CampaignType.objects.filter(always_on=True).values_list("id", flat=True)
    wanted = set(ids) | set(always)
    CampaignCampaignType.objects.filter(campaign=campaign).exclude(campaign_type_id__in=wanted).delete()
    held = set(
        CampaignCampaignType.objects.filter(campaign=campaign, campaign_type_id__in=wanted).values_list(
            "campaign_type_id", flat=True
        )
    )
    ticked = sorted(wanted - held)
    CampaignCampaignType.objects.bulk_create(
        [CampaignCampaignType(campaign=campaign, campaign_type_id=pk) for pk in ticked]
    )
    return ticked


# The grade a part of a split setting carries at the end of its slug and of its name ("khemri-3", "Khemri 1b").
GRADE_SUFFIX = re.compile(r"[ -](?:1a|1b|1c|2a|2b|3)$")


def setting_display_names() -> dict[int, str]:
    """What the pages call each setting: the family's name for a part of a split one, else the setting's own.

    One book split by grade is shown as one setting -- Mordheim 1a to 2a as "Mordheim", Khemri 1b and Khemri 3 as
    "Khemri" -- which `features/reference/in-play.ts` has always done for the reference pages' Setting filter. The
    same rule lives here so the **server** can word a line naming a setting (William, 20 Nov 2026: the exploration
    chart should read "Mutiny in Marienburg", not "Wasteland Exploration"). It is read from the settings
    themselves, so the next split needs no code: a part carries its grade at the end of its slug, and the base part
    keeps the family's bare slug. One query.
    """
    rows = list(CampaignType.objects.values("id", "slug", "name"))
    by_slug = {row["slug"]: row for row in rows}
    names = {}
    for row in rows:
        base = GRADE_SUFFIX.sub("", row["slug"])
        head = by_slug.get(base) if base != row["slug"] else row
        # a part only belongs to a family while the base part is there to head it
        in_family = head is not None and (
            base != row["slug"]
            or any(other["slug"] != row["slug"] and GRADE_SUFFIX.sub("", other["slug"]) == base for other in rows)
        )
        names[row["id"]] = GRADE_SUFFIX.sub("", head["name"]) if in_family and head else row["name"]
    return names
