"""Decision 4: each player finishes his own battle, the fight ends when the last one does, and he confirms the results.

- `finish_player` (`finish-mine/`): the player declares won, lost or undecided and goes straight to his own
  postbattle while the others play on (he can finalise it straight away); his heroes get their trading actions back,
  once, at his finish (BUG-122).
- When nobody is left fighting, the fight ends (`end_fight`): the battle enters postbattle for 72 hours (decision 2)
  with the declared winners, and the last player to finish is asked to confirm the results (`results_pending`).
- `confirm_results` (`results/`): the winners from the Confirm results modal; every other warband still in the
  battle lost (no winners: "No winner", decision 8). Wins and losses still count once, when the battle ends
  (decision 3): the end waits for the results, unless postbattle is closed or runs out first, when the declared
  winners count. A player who finalised before the results keeps what he applied; only the record changes.
- A battle manager ends a stuck fight with its results in one step (`end_fight` with `results_pending=False`,
  BATL-NEW-03).
"""

from collections.abc import Iterable
from dataclasses import dataclass

from django.utils import timezone

from ..models import Battle, BattleEvent, BattleParticipant
from ..serializers import snapshot_participants
from ..validation.results import Results
from .errors import field_error
from .events import append_event
from .lifecycle import all_finished, end_battle, reset_trading_for, still_in
from .locks import locked
from .timing import postbattle_deadline


@dataclass
class Finished:
    events: list[dict]
    participants: list[BattleParticipant]  # still in the battle: status, warband and declared result
    fight_over: bool  # his finish ended the fight: he is asked to confirm the results


def finish_player(battle: Battle, participant: BattleParticipant, declared: str, actor) -> Finished:
    """The player finishes his battle (`finish-mine/`); the fight ends when nobody is left fighting."""
    participant.status = BattleParticipant.STATUS_FINISHED_BATTLE
    participant.finished_at = participant.finished_at or timezone.now()
    participant.declared_result = declared
    participant.save(update_fields=["status", "finished_at", "declared_result", "updated_at"])
    reset_trading_for([participant.warband_id])
    payload = {
        "participant_user_id": participant.user_id,
        "warband_id": participant.warband_id,
        "declared_result": declared,
    }
    events = [append_event(battle, BattleEvent.TYPE_PARTICIPANT_FINISHED_BATTLE, actor_user=actor, payload=payload)]
    playing = list(
        BattleParticipant.objects.filter(battle_id=battle.id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .only("status", "warband_id", "declared_result")
        .order_by("id")
    )
    if any(entry.status == BattleParticipant.STATUS_IN_BATTLE for entry in playing):
        return Finished(events, playing, fight_over=False)
    winners = [entry.warband_id for entry in playing if entry.declared_result == BattleParticipant.DECLARED_WON]
    events += end_fight(battle, winners, actor, results_pending=True, mode="all_finished", fighting=[])
    return Finished(events, playing, fight_over=True)


def end_fight(
    battle: Battle,
    winner_ids: list[int],
    actor,
    *,
    results_pending: bool,
    mode: str,
    fighting: list[BattleParticipant] | None = None,
) -> list[dict]:
    """The fight is over: anyone still `fighting` (read here when not given) goes to postbattle (a manager's end),
    and the battle enters postbattle for 72 hours with these winners; while `results_pending`, `actor` is asked to
    confirm them."""
    now = timezone.now()
    if fighting is None:
        in_battle = BattleParticipant.objects.filter(battle_id=battle.id, status=BattleParticipant.STATUS_IN_BATTLE)
        fighting = list(locked(in_battle))
    for entry in fighting:
        entry.status = BattleParticipant.STATUS_FINISHED_BATTLE
        entry.finished_at = entry.finished_at or now
        entry.save(update_fields=["status", "finished_at", "updated_at"])
    reset_trading_for([entry.warband_id for entry in fighting])
    battle.status = Battle.STATUS_POSTBATTLE
    battle.winner_warband_ids_json = winner_ids
    battle.closes_at = postbattle_deadline(now)  # 72 hours of postbattle (decision 2)
    battle.results_pending = results_pending
    battle.results_confirmer = actor if results_pending else None
    fields = ["status", "winner_warband_ids_json", "closes_at", "results_pending", "results_confirmer", "updated_at"]
    battle.save(update_fields=fields)
    payload: dict = {"winner_warband_ids": winner_ids, "mode": mode, "results_pending": results_pending}
    if results_pending:
        payload["results_confirmer_user_id"] = actor.id
    return [append_event(battle, BattleEvent.TYPE_BATTLE_ENTERED_POSTBATTLE, actor_user=actor, payload=payload)]


def check_sides(participants: Iterable[BattleParticipant], results: Results) -> list[BattleParticipant]:
    """The participants still in the battle; refused when a winner or loser isn't one of their warbands."""
    playing = still_in(participants)
    warband_ids = {entry.warband_id for entry in playing}
    for field, ids in (("winners", results.winners), ("losers", results.losers)):
        if any(warband_id not in warband_ids for warband_id in ids):
            raise field_error(field, f"{field} must be warbands in this battle", "Pick warbands that fought in it.")
    return playing


def confirm_results(battle: Battle, results: Results, actor) -> list[dict]:
    """The winners (and so the losers) from the Confirm results modal; the battle ends if everyone has finished
    postbattle. Returns the events (none when the same results were already confirmed)."""
    participants = list(snapshot_participants().filter(battle_id=battle.id))  # under the battle lock
    playing = check_sides(participants, results)
    if not battle.results_pending and battle.winner_warband_ids_json == results.winners:
        return []
    battle.winner_warband_ids_json = results.winners
    battle.results_pending = False
    battle.save(update_fields=["winner_warband_ids_json", "results_pending", "updated_at"])
    losers = [entry.warband_id for entry in playing if entry.warband_id not in results.winners]
    payload = {
        "winner_warband_ids": results.winners,
        "loser_warband_ids": losers if results.winners else [],  # "No winner": nobody lost either
        "confirmed_by_user_id": actor.id,
    }
    events = [append_event(battle, BattleEvent.TYPE_BATTLE_RESULTS_CONFIRMED, actor_user=actor, payload=payload)]
    if all_finished(participants):
        end_battle(battle, actor, events, participants)
    return events


def results_sides(battle: Battle, participants: Iterable[BattleParticipant]) -> dict[str, list[int]]:
    """Where each warband starts in the Confirm results modal: on the side its player declared while the results
    are pending (undecided ones unplaced), else on the side the battle has them."""
    playing = still_in(participants)
    if not battle.results_pending:
        winners = set(battle.winner_warband_ids_json or [])
        return {
            "winners": [entry.warband_id for entry in playing if entry.warband_id in winners],
            "losers": [entry.warband_id for entry in playing if entry.warband_id not in winners],
            "undecided": [],
        }
    sides: dict[str, list[int]] = {"winners": [], "losers": [], "undecided": []}
    side = {BattleParticipant.DECLARED_WON: "winners", BattleParticipant.DECLARED_LOST: "losers"}
    for entry in playing:
        sides[side.get(entry.declared_result, "undecided")].append(entry.warband_id)
    return sides
