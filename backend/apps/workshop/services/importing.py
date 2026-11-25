"""Making workshops and importing by code (the workshop plan, docs/plans/workshop.md), each all or nothing.

- A warband workshop raises its warband through the campaign path (`raising.raise_warband`); from a shared list's
  code, the list is first copied in as the workshop's own template, and the warband is raised from it.
- A list workshop holds one template of its own, blank or a copy of a book template (the editor's making path).
- A warband's code imports it into a campaign for a member with no warband there: the copy starts on the gold
  raising gives (its Starting Gold row), then **one** ledger row pays its roster's cost, as if just raised.
- A list's code imports it into a campaign as the campaign's own template (`edit_catalogue`).
- Either code copies into the importer's own new workshop, to tweak someone's build.
"""

from dataclasses import dataclass, field
from typing import Any

from django.db import IntegrityError, transaction

from apps.campaigns.errors import CampaignError
from apps.campaigns.models import HOLDS_LIST, HOLDS_WARBAND, Campaign
from apps.core.catalogue.cache import bump
from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.warband_templates.models import WarbandTemplate
from apps.warband_templates.services.making import make_template
from apps.warband_templates.services.raising import raise_warband
from apps.warbands.models import LedgerAction, Warband
from apps.warbands.services import ledger
from apps.warbands.services.purchases import gold_warnings
from apps.warbands.services.roster_cost import roster_cost
from apps.warbands.services.types import picked_types

from .copy_list import copy_list
from .copy_warband import copy_warband
from .making import make_workshop
from .reads import held, shared
from .relink import Warning

HAS_WARBAND = "You already have a warband in this campaign: a warband is imported only by a player without one."
NOT_A_WARBAND = "That code is a warband list's, not a warband's: import it from the Warbands page."
NOT_A_LIST = "That code is a warband's, not a warband list's."
EMPTY = "That workshop holds nothing to copy."
NOT_SERVED = "This list doesn't serve that warband type."
SERVES_NONE = "This list serves no warband type yet: its maker picks one in its Basics."


@dataclass
class Imported:
    workshop: Campaign | None = None  # a workshop made for it
    warband: Warband | None = None
    template: WarbandTemplate | None = None
    warnings: list[Warning] = field(default_factory=list)


def _shared_warband(code: Any) -> Warband:
    workshop = shared(code)
    if workshop.holds != HOLDS_WARBAND:
        raise CampaignError(NOT_A_WARBAND, code="not_a_warband")
    warband = held([workshop]).warbands.get(workshop.pk)
    if warband is None:
        raise CampaignError(EMPTY, code="empty_workshop")
    return warband


def _shared_list(code: Any) -> WarbandTemplate:
    workshop = shared(code)
    if workshop.holds != HOLDS_LIST:
        raise CampaignError(NOT_A_LIST, code="not_a_list")
    template = held([workshop]).lists.get(workshop.pk)
    if template is None:
        raise CampaignError(EMPTY, code="empty_workshop")
    return template


def make_warband_workshop(user: Any, data: dict[str, Any]) -> Imported:
    """A warband workshop and its warband, raised from its type's book template, or from the list `list_code` shares
    copied in as its own (the type one it serves: the first, unless one is sent)."""
    with transaction.atomic():
        workshop = make_workshop(user, HOLDS_WARBAND, data["name"])
        made = Imported(workshop=workshop)
        type_id = data.get("warband_type_id")
        if data.get("list_code"):
            listed = copy_list(_shared_list(data["list_code"]), workshop.pk, user)
            served = list(listed.template.type_links.order_by("id").values_list("warband_type_id", flat=True))
            if not served:
                raise CampaignError(SERVES_NONE, code="list_serves_no_type", fields={"list_code": [SERVES_NONE]})
            if type_id is not None and type_id not in served:
                raise CampaignError(NOT_SERVED, code="type_not_served", fields={"warband_type_id": [NOT_SERVED]})
            type_id = type_id or served[0]
            made.template, made.warnings = listed.template, listed.warnings
        if type_id is None:
            detail = "Pick a warband type."
            raise CampaignError(detail, code="invalid", fields={"warband_type_id": [detail]})
        fields = {
            "name": data["name"],
            "warband_type_id": type_id,
            "template_variant": data.get("template_variant", ""),
        }
        picked_types(workshop.pk, fields)  # its type as a Warband type row (a 400 for an unknown one)
        made.warband = raise_warband(workshop.pk, user, fields, [])
    return made


def make_list_workshop(user: Any, data: dict[str, Any]) -> Imported:
    """A list workshop and its template, blank or a copy of a book template, serving the types sent (a copy: its
    source's, when none are, each with the variant its source presets: a copied Reiklanders list stays Reikland)."""
    source: WarbandTemplate | None = data.get("copy_of")
    type_ids = data.get("warband_type_ids")
    if type_ids is None:
        type_ids = list(source.type_links.values_list("warband_type_id", flat=True)) if source else []
    with transaction.atomic():
        workshop = make_workshop(user, HOLDS_LIST, data["name"])
        template = make_template(workshop.pk, data["name"], type_ids, source, user)
        if source is not None:  # each type the source serves too keeps the variant the source presets for it
            for link in source.type_links.exclude(variant=""):
                template.type_links.filter(warband_type_id=link.warband_type_id).update(variant=link.variant)
        bump(workshop.pk, *WARBAND_TEMPLATES.changed_lists)
    return Imported(workshop=workshop, template=template)


def _pay(copied: Warband, name: str) -> list[Warning]:
    """One Buy row paying the copy's roster cost; the gold warnings it leaves (below 0, or over a workshop's budget)."""
    cost = roster_cost(copied)
    if cost:
        ledger.record(copied, LedgerAction.BUY, -cost, f"Imported {name}")
    return gold_warnings(copied)


def import_warband(campaign: Campaign, user: Any, code: Any) -> Imported:
    """The warband `code` shares, copied into the campaign as the user's and paid for."""
    source = _shared_warband(code)
    if Warband.objects.filter(campaign=campaign, user=user).exists():
        raise CampaignError(HAS_WARBAND, code="has_warband", status=409)
    try:
        with transaction.atomic():
            copied = copy_warband(source, campaign.pk, user)
            copied.warband.campaign = campaign
            warnings = [*copied.warnings, *_pay(copied.warband, source.name)]
    except IntegrityError as error:  # two imports at once: the unique warband per player has the last word
        if "unique_campaign_warband" not in str(error):
            raise
        raise CampaignError(HAS_WARBAND, code="has_warband", status=409) from error
    return Imported(warband=copied.warband, template=copied.template, warnings=warnings)


def import_list(campaign: Campaign, user: Any, code: Any) -> Imported:
    """The list `code` shares, copied into the campaign as its own template."""
    source = _shared_list(code)
    with transaction.atomic():
        copied = copy_list(source, campaign.pk, user)
    return Imported(template=copied.template, warnings=copied.warnings)


def import_into_workshop(user: Any, code: Any) -> Imported:
    """What `code` shares, copied into a new workshop of the user's own: a warband (paid for against its budget) or a
    list."""
    workshop = shared(code)
    if workshop.holds == HOLDS_LIST:
        source_list = _shared_list(code)
        with transaction.atomic():
            mine = make_workshop(user, HOLDS_LIST, source_list.name)
            copied_list = copy_list(source_list, mine.pk, user)
        return Imported(workshop=mine, template=copied_list.template, warnings=copied_list.warnings)
    source = _shared_warband(code)
    with transaction.atomic():
        mine = make_workshop(user, HOLDS_WARBAND, source.name)
        copied = copy_warband(source, mine.pk, user)
        copied.warband.campaign = mine
        warnings = [*copied.warnings, *_pay(copied.warband, source.name)]
    return Imported(workshop=mine, warband=copied.warband, template=copied.template, warnings=warnings)
