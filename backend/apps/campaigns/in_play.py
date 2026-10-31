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
"""

from collections.abc import Iterable
from typing import Any

from django.db.models import BooleanField, Exists, ExpressionWrapper, OuterRef, Q, QuerySet, Value

from .models import GRADE_LABELS, GRADES, Campaign, CampaignCampaignType, CampaignType

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


def in_play(campaign_id: int, setting: str = "campaign_type") -> Q:
    """The visibility rule as a filter on rows whose setting is the `setting` foreign key: no setting (custom, or
    Mordheim's by default), an always-on setting, or one the campaign ticked."""
    ticked = CampaignCampaignType.objects.filter(campaign_id=campaign_id, campaign_type_id=OuterRef(f"{setting}_id"))
    return Q(**{f"{setting}__isnull": True}) | Q(**{f"{setting}__always_on": True}) | Q(Exists(ticked))


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


def set_settings(campaign: Campaign, ids: Iterable[int]) -> None:
    """The campaign's settings in play become `ids` (known setting ids), with the always-on ones added."""
    always = CampaignType.objects.filter(always_on=True).values_list("id", flat=True)
    wanted = set(ids) | set(always)
    CampaignCampaignType.objects.filter(campaign=campaign).exclude(campaign_type_id__in=wanted).delete()
    held = set(
        CampaignCampaignType.objects.filter(campaign=campaign, campaign_type_id__in=wanted).values_list(
            "campaign_type_id", flat=True
        )
    )
    CampaignCampaignType.objects.bulk_create(
        [CampaignCampaignType(campaign=campaign, campaign_type_id=pk) for pk in sorted(wanted - held)]
    )
