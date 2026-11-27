"""Making in a player's workshop, importing by code and copying into it (the workshop plan, docs/plans/workshop.md,
version 2), each all or nothing. The workshop is made on his first use (`making.workshop_for`).

- A warband is raised through the campaign path (`raising.raise_warband`), naming the list it reads there: one of his
  lists (`list_id`), a shared list's code (copied in as a list of his own first, unless it is his already), else the
  book's list for its type, never one of his (William, 26 Nov 2026); or no list at all (`no_list`: most warriors of
  his own, every unit made by hand). Everything in a workshop carries a code. A workshop's warband has a running cost
  and no budget (William, 27 Nov 2026): it starts on no gold, and what it spends there is never shown or warned of.
- A list is one template of his own, blank or a copy of one he can see there (the book's or one of his).
- A code copies into his workshop: a warband (its list with it) or a list.
- A warband's code imports it into a campaign for a member with no warband there: the copy starts on the gold raising
  gives (its Starting Gold row), then **one** ledger row pays its roster's cost, as if just raised. A list's code
  imports it into a campaign as the campaign's own template (`edit_catalogue`). His own warbands and lists are picked
  there by id instead, needing no code (William, 27 Nov 2026: "a user didn't have to import any of their own warbands
  or lists as they were there already"): the same copy, of his own alone.
- His own campaign warband, and a campaign's own list he can see, copy into his workshop.
"""

from dataclasses import dataclass, field
from typing import Any

from django.db import IntegrityError, transaction

from apps.campaigns.errors import CampaignError
from apps.campaigns.models import Campaign
from apps.core.catalogue import names
from apps.core.catalogue.cache import bump
from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.warband_templates.models import WarbandTemplate
from apps.warband_templates.services.making import make_template
from apps.warband_templates.services.raising import raise_warband
from apps.warband_templates.services.resolve import templates_for_type
from apps.warbands.models import LedgerAction, Warband
from apps.warbands.services import ledger
from apps.warbands.services.purchases import gold_warnings
from apps.warbands.services.roster_cost import roster_cost
from apps.warbands.services.types import picked_types

from .codes import unique_share_code
from .content import Target
from .copy_list import copy_list
from .copy_warband import copy_warband
from .making import workshop_for
from .reads import own_list, own_warband, shared
from .relink import Warning

HAS_WARBAND = "You already have a warband in this campaign: a warband is imported only by a player without one."
NOT_A_WARBAND = "That code is a warband list's, not a warband's: import it from the Warbands page."
NOT_A_LIST = "That code is a warband's, not a warband list's."
NOT_SERVED = "This list doesn't serve that warband type."
SERVES_HERE = "Its list {name} came too, and now serves its warband type for every warband in this campaign."
SERVES_NONE = "This list serves no warband type yet: pick one in its Basics."
NO_SUCH_LIST = "That isn't one of your lists."
NO_SUCH_WARBAND = "That isn't one of your warbands."
PICK_TYPE = "Pick a warband type."


@dataclass
class Made:
    warband: Warband | None = None
    template: WarbandTemplate | None = None
    warnings: list[Warning] = field(default_factory=list)


def _shared_warband(code: Any) -> Warband:
    found = shared(code)
    if found.warband is None:
        raise CampaignError(NOT_A_WARBAND, code="not_a_warband")
    return found.warband


def _shared_list(code: Any) -> WarbandTemplate:
    found = shared(code)
    if found.template is None:
        raise CampaignError(NOT_A_LIST, code="not_a_list")
    return found.template


def _list_to_raise_from(
    workshop: Campaign, user: Any, data: dict[str, Any]
) -> tuple[WarbandTemplate | None, list[Warning]]:
    """The list a new warband reads: one of his (`list_id`), a shared one (`list_code`: copied in, unless his own),
    else none (its type's); a 400 for a list id not his."""
    if data.get("list_id"):
        template = own_list(user, data["list_id"])
        if template is None:
            raise CampaignError(NO_SUCH_LIST, code="invalid", fields={"list_id": [NO_SUCH_LIST]})
        return template, []
    if not data.get("list_code"):
        return None, []
    source = _shared_list(data["list_code"])
    if source.campaign_id == workshop.pk:
        return source, []
    listed = copy_list(source, Target(workshop, user, live=True), share_code=unique_share_code())
    return listed.template, listed.warnings


def _type_served(template: WarbandTemplate, type_id: int | None) -> int:
    """The type a warband from the list is raised as: the one sent, which it must serve, else its first."""
    served = list(template.type_links.order_by("id").values_list("warband_type_id", flat=True))
    if not served:
        raise CampaignError(SERVES_NONE, code="list_serves_no_type", fields={"list_id": [SERVES_NONE]})
    if type_id is not None and type_id not in served:
        raise CampaignError(NOT_SERVED, code="type_not_served", fields={"warband_type_id": [NOT_SERVED]})
    return type_id or served[0]


def make_warband(user: Any, data: dict[str, Any]) -> Made:
    """A warband in the player's workshop, raised from the list it names (`_list_to_raise_from`), else the book's
    list for its type (a workshop's type template: resolve.py), or from none (`no_list`): its type picked all the
    same, its most warriors its player's, and recruiting by hand."""
    no_list = data["no_list"]
    with transaction.atomic():
        workshop = workshop_for(user)
        template, warnings = (None, []) if no_list else _list_to_raise_from(workshop, user, data)
        type_id = data.get("warband_type_id")
        if template is not None:
            type_id = _type_served(template, type_id)
        if type_id is None:
            raise CampaignError(PICK_TYPE, code="invalid", fields={"warband_type_id": [PICK_TYPE]})
        fields: dict[str, Any] = {
            "name": data["name"],
            "warband_type_id": type_id,
            "template_variant": data.get("template_variant", ""),
        }
        picked_types(workshop.pk, fields)  # its type as a Warband type row (a 400 for an unknown one)
        if no_list:  # it reads no list (Warband.no_list), so it names none
            fields.update(no_list=True, max_units=data["max_units"], template_variant="", template=None)
        else:
            fields["template"] = template or templates_for_type(workshop.pk, type_id).first()
        fields.update(in_workshop=True, share_code=unique_share_code())
        warband = raise_warband(workshop.pk, user, fields, [])
    return Made(warband=warband, template=template, warnings=warnings)


def make_list(user: Any, data: dict[str, Any]) -> Made:
    """A list in the player's workshop, blank or a copy of one he can see there (the book's or his own), serving the
    types sent (a copy: its source's when none are, each with the variant its source presets: a copied Reiklanders
    list stays Reikland); a name his lists or the book's use is a 400 `name_taken`."""
    source: WarbandTemplate | None = data.get("copy_of")
    with transaction.atomic():
        workshop = workshop_for(user)
        if source is not None and source.campaign_id not in (None, workshop.pk):  # another's reads as unknown
            unknown = f'Invalid pk "{source.pk}" - object does not exist.'
            raise CampaignError(unknown, code="invalid", fields={"copy_of_template_id": [unknown]})
        names.check_create(WARBAND_TEMPLATES, workshop.pk, data["name"])
        type_ids = data.get("warband_type_ids")
        if type_ids is None:
            type_ids = list(source.type_links.values_list("warband_type_id", flat=True)) if source else []
        template = make_template(workshop.pk, data["name"], type_ids, source, user, unique_share_code())
        if source is not None:  # each type the source serves too keeps the variant the source presets for it
            for link in source.type_links.exclude(variant=""):
                template.type_links.filter(warband_type_id=link.warband_type_id).update(variant=link.variant)
        bump(workshop.pk, *WARBAND_TEMPLATES.changed_lists)
    return Made(template=template)


def _pay(copied: Warband, name: str) -> list[Warning]:
    """One Buy row paying the copy's roster cost; the gold warnings it leaves (below 0 in a campaign; none in a
    workshop)."""
    cost = roster_cost(copied)
    if cost:
        ledger.record(copied, LedgerAction.BUY, -cost, f"Imported {name}")
    return gold_warnings(copied)


def _warband_into_workshop(user: Any, source: Warband) -> Made:
    """A copy of the warband in the player's workshop, its list with it."""
    with transaction.atomic():
        workshop = workshop_for(user)
        copied = copy_warband(source, workshop, user)
        warnings = [*copied.warnings, *_pay(copied.warband, source.name)]
    return Made(warband=copied.warband, template=copied.template, warnings=warnings)


def _list_into_workshop(user: Any, source: WarbandTemplate) -> Made:
    """A copy of the list in the player's workshop, with its own code."""
    with transaction.atomic():
        workshop = workshop_for(user)
        copied = copy_list(source, Target(workshop, user, live=True), share_code=unique_share_code())
    return Made(template=copied.template, warnings=copied.warnings)


def import_into_workshop(user: Any, code: Any) -> Made:
    """What `code` shares, copied into the player's workshop: a warband or a list."""
    found = shared(code)
    if found.template is not None:
        return _list_into_workshop(user, found.template)
    assert found.warband is not None
    return _warband_into_workshop(user, found.warband)


def warband_to_workshop(user: Any, source: Warband) -> Made:
    """His campaign warband (Copy to my workshop), copied into his workshop."""
    return _warband_into_workshop(user, source)


def list_to_workshop(user: Any, source: WarbandTemplate) -> Made:
    """A campaign's own list he can see (Copy to my lists), copied into his workshop."""
    return _list_into_workshop(user, source)


def warband_to_import(user: Any, data: dict[str, Any]) -> Warband:
    """The warband a campaign import copies: one of his own (`warband_id`; anyone else's, a deleted one or a
    campaign's: 400 `not_yours`), else the one its `code` shares."""
    if data.get("warband_id") is None:
        return _shared_warband(data["code"])
    found = own_warband(user, data["warband_id"])
    if found is None:
        raise CampaignError(NO_SUCH_WARBAND, code="not_yours", fields={"warband_id": [NO_SUCH_WARBAND]})
    return found


def list_to_import(user: Any, data: dict[str, Any]) -> WarbandTemplate:
    """The list a campaign import copies: one of his own (`list_id`; anyone else's, a deleted one or a campaign's:
    400 `not_yours`), else the one its `code` shares."""
    if data.get("list_id") is None:
        return _shared_list(data["code"])
    found = own_list(user, data["list_id"])
    if found is None:
        raise CampaignError(NO_SUCH_LIST, code="not_yours", fields={"list_id": [NO_SUCH_LIST]})
    return found


def import_warband(campaign: Campaign, user: Any, source: Warband, editor: bool) -> Made:
    """The warband copied into the campaign as the user's and paid for (`editor`: the importer may edit the
    catalogue here, so a list that comes with it serves its types and its custom content is live)."""
    if Warband.objects.filter(campaign=campaign, user=user).exists():
        raise CampaignError(HAS_WARBAND, code="has_warband", status=409)
    try:
        with transaction.atomic():
            copied = copy_warband(source, campaign, user, editor)
            warnings = [*copied.warnings, *_pay(copied.warband, source.name)]
            if editor and copied.template is not None:
                name = copied.template.name
                message = SERVES_HERE.format(name=name)
                warnings.append({"code": "list_serves_type", "message": message, "names": [name]})
    except IntegrityError as error:  # two imports at once: the unique warband per player has the last word
        if "unique_campaign_warband" not in str(error):
            raise
        raise CampaignError(HAS_WARBAND, code="has_warband", status=409) from error
    return Made(warband=copied.warband, template=copied.template, warnings=warnings)


def import_list(campaign: Campaign, user: Any, source: WarbandTemplate) -> Made:
    """The list copied into the campaign as its own template."""
    with transaction.atomic():
        copied = copy_list(source, Target(campaign, user, live=True))  # an editor imports a list
    return Made(template=copied.template, warnings=copied.warnings)
