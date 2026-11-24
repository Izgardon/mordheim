"""Who holds an encampment (William, 24 Nov 2026): taken by a warband, razed, or given up.

Nothing is refused for game reasons. Anyone takes one, whoever holds it now: when another warband held it, the
answer warns which scenario the book has you play for it first (The Sting for an unfortified encampment, Stockade
for a fortified one) and it changes hands all the same. A razed encampment is held by nobody; rebuilding it is its
rules' to say, and taking it once it is rebuilt marks it standing again (the taker only takes it once it is). Each
change writes a line in the log of every warband it touches, in the server's words, in one transaction with the
change; nothing else is applied.
"""

from dataclasses import dataclass, field
from typing import Any

from django.db import transaction

from apps.warbands.models import Warband
from apps.warbands.services import economy_log

from ..models import CampaignEncampment

FEATURE = "encampment"
UNFORTIFIED_SCENARIO = "The Sting"
FORTIFIED_SCENARIO = "Stockade"


def _locked(encampment: CampaignEncampment) -> CampaignEncampment:
    """The encampment as it now stands, locked for the change, with its holder."""
    return CampaignEncampment.objects.select_for_update(of=("self",)).select_related("holder").get(pk=encampment.pk)


def _log(warband: Warband, entry_type: str, encampment: CampaignEncampment, message: str, **more: Any) -> None:
    economy_log.write(warband, FEATURE, entry_type, {"encampment": encampment.name, "message": message, **more})


@dataclass
class Change:
    """What a change answers: its warnings, and the warbands whose pages it touched (the holder before and after)."""

    warnings: list[dict[str, str]] = field(default_factory=list)
    warband_ids: list[int] = field(default_factory=list)


def _warning(code: str, message: str) -> dict[str, str]:
    return {"code": code, "message": message}


def take(encampment: CampaignEncampment, warband: Warband) -> Change:
    """The warband holds it now: logged on the taker and on the warband it was taken from."""
    with transaction.atomic():
        held = _locked(encampment)
        before = held.holder
        if before is not None and before.pk == warband.pk:
            return Change([_warning("encampment_held_already", f"{warband.name} holds {held.name} already.")])
        warnings = []
        if held.razed:
            warnings.append(
                _warning(
                    "encampment_razed",
                    f"{held.name} was razed. Taking it marks it rebuilt, so rebuild it first as its rules say.",
                )
            )
        if before is not None:
            scenario = FORTIFIED_SCENARIO if held.fortified else UNFORTIFIED_SCENARIO
            warnings.append(
                _warning(
                    "encampment_taken_from",
                    f"{before.name} held {held.name}: the book has you play {scenario} for it first.",
                )
            )
            _log(before, "lost", held, f"Lost {held.name} to {warband.name}", to=warband.name)
        held.holder, held.razed = warband, False
        held.save(update_fields=["holder", "razed", "updated_at"])
        taken = f"Took {held.name} from {before.name}" if before is not None else f"Took {held.name}"
        _log(warband, "taken", held, taken, **{"from": before.name if before is not None else None})
    return Change(warnings, _ids(before, warband))


def raze(encampment: CampaignEncampment) -> Change:
    """Burnt down: nobody holds it, and its former holder's log says so."""
    with transaction.atomic():
        held = _locked(encampment)
        if held.razed:
            return Change([_warning("encampment_razed_already", f"{held.name} is razed already.")])
        before = held.holder
        if before is not None:
            _log(before, "razed", held, f"{held.name} was razed")
        held.holder, held.razed = None, True
        held.save(update_fields=["holder", "razed", "updated_at"])
    return Change([], _ids(before))


def give_up(encampment: CampaignEncampment) -> Change:
    """Its holder lets it go: nobody holds it, and the holder's log says so."""
    with transaction.atomic():
        held = _locked(encampment)
        before = held.holder
        if before is None:
            return Change([_warning("encampment_not_held", f"Nobody holds {held.name}.")])
        _log(before, "given_up", held, f"Gave up {held.name}")
        held.holder = None
        held.save(update_fields=["holder", "updated_at"])
    return Change([], _ids(before))


def _ids(*warbands: Warband | None) -> list[int]:
    return sorted({warband.pk for warband in warbands if warband is not None})
