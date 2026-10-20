"""What `PATCH record/` accepts (BATL-NEW-04): any of the scenario name and link, the date, the participants and the
winners and losers. Only the fields sent change; errors use the standard shape `{detail, code, fields}`.

- `scenario`: as when the battle was created (1 to 120 characters);
- `scenario_link`: text up to 500 characters, or empty / null to clear it;
- `date`: "YYYY-MM-DD", today or earlier (stored as the battle's end, as a reported result's date is);
- `participants`: `[{"warband_id": int, "declared_rating"?: int | null}]`, at least two different warbands; one left
  out is kept, marked removed; a rating left out stays as it was;
- `winners` and `losers`: as in `results/` (an empty `winners` is "No winner").
"""

from dataclasses import dataclass, field
from datetime import date

from ..services.errors import BattleError, Refused, field_error
from ..services.reported import parse_battle_date
from ..services.setup import scenario_name
from .results import Results, parse_results

KEEP = object()  # a participant entry without declared_rating keeps the one on record


@dataclass
class RecordEdit:
    sent: set[str] = field(default_factory=set)
    scenario: str = ""
    scenario_link: str | None = None
    battle_date: date | None = None
    participants: dict[int, object] = field(default_factory=dict)  # warband id -> rating, None or KEEP
    results: Results | None = None


def _as_field_error(name: str, refused: Refused) -> BattleError:
    return field_error(name, refused.detail, refused.detail)


def _scenario_link(raw) -> str | None:
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise field_error("scenario_link", "scenario_link must be text", "Enter a link, or leave it empty.")
    link = raw.strip()
    if len(link) > 500:
        raise field_error("scenario_link", "scenario_link is too long", "Keep the link under 500 characters.")
    return link or None


def _rating(raw) -> int | None:
    if raw in (None, ""):
        return None
    if isinstance(raw, bool) or not isinstance(raw, int | str) or not str(raw).strip().isdigit():
        raise field_error("participants", "declared_rating must be a whole number", "Enter a rating of 0 or more.")
    return int(raw)


def _participants(raw) -> dict[int, object]:
    message = "Send a list of {warband_id, declared_rating} entries."
    if not isinstance(raw, list):
        raise field_error("participants", "participants must be a list", message)
    entries: dict[int, object] = {}
    for entry in raw:
        warband_id = entry.get("warband_id") if isinstance(entry, dict) else None
        if isinstance(warband_id, bool) or not isinstance(warband_id, int) or warband_id <= 0:
            raise field_error("participants", "participants must name their warband_id", message)
        if warband_id in entries:
            raise field_error("participants", "A warband is listed twice", "List each warband once.")
        entries[warband_id] = _rating(entry["declared_rating"]) if "declared_rating" in entry else KEEP
    if len(entries) < 2:
        raise field_error("participants", "A battle needs at least two warbands", "Keep at least two warbands.")
    return entries


def parse_record_edit(data) -> RecordEdit:
    edit = RecordEdit()
    if "scenario" in data:
        try:
            edit.scenario = scenario_name(data["scenario"])
        except Refused as refused:
            raise _as_field_error("scenario", refused) from None
        edit.sent.add("scenario")
    if "scenario_link" in data:
        edit.scenario_link = _scenario_link(data["scenario_link"])
        edit.sent.add("scenario_link")
    if "date" in data:
        try:
            edit.battle_date = parse_battle_date(data["date"], field="date")
        except Refused as refused:
            raise _as_field_error("date", refused) from None
        edit.sent.add("date")
    if "participants" in data:
        edit.participants = _participants(data["participants"])
        edit.sent.add("participants")
    if "winners" in data or "losers" in data:
        edit.results = parse_results(data)
        edit.sent.add("results")
    return edit
