"""What a player declares when he finishes his battle, and the results the Confirm results modal sends (decision 4).

Results are `{"winners": [warband ids], "losers": [warband ids]}`: `winners` is required (an empty list is "No
winner", decision 8), `losers` is optional and every warband still in the battle that didn't win lost anyway. A
warband in both lists is refused; whether each one fought in the battle is checked against the battle
(services/finishing.py).
"""

from dataclasses import dataclass, field

from ..models import BattleParticipant
from ..services.errors import field_error

DECLARED_RESULTS = (
    BattleParticipant.DECLARED_WON,
    BattleParticipant.DECLARED_LOST,
    BattleParticipant.DECLARED_UNDECIDED,
)


@dataclass(frozen=True)
class Results:
    winners: list[int]
    losers: list[int] = field(default_factory=list)


def parse_declared_result(data) -> str:
    result = data.get("result")
    if result not in DECLARED_RESULTS:
        raise field_error("result", "result must be won, lost or undecided", "Choose won, lost or undecided.")
    return str(result)


def _warband_ids(data, name: str, *, source: str | None = None) -> list[int]:
    raw = data.get(source or name, [])
    if raw is None:
        raw = []
    if not isinstance(raw, list):
        raise field_error(name, f"{name} must be a list", "Send a list of warband ids.")
    ids: list[int] = []
    for entry in raw:
        value = entry if isinstance(entry, int) and not isinstance(entry, bool) else None
        if value is None and isinstance(entry, str) and entry.strip().isdigit():
            value = int(entry)
        if value is None or value <= 0:
            raise field_error(name, f"{name} must contain warband ids", "Send a list of warband ids.")
        if value not in ids:
            ids.append(value)
    return ids


def parse_results(data, *, legacy_winners: bool = False) -> Results:
    """The winners and losers a request sends (`legacy_winners`: older clients' `winner_warband_ids`)."""
    source = "winner_warband_ids" if legacy_winners and "winners" not in data else None
    if not isinstance(data.get(source or "winners"), list):
        raise field_error("winners", "winners must be a list", "Send the winners: an empty list is 'No winner'.")
    winners = _warband_ids(data, "winners", source=source)
    losers = _warband_ids(data, "losers")
    if set(winners) & set(losers):
        raise field_error("losers", "A warband can't both win and lose", "Put each warband on one side.")
    return Results(winners=winners, losers=losers)
