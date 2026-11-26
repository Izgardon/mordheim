"""A player's postbattle: the draft he saves, the aftermath step he leaves, and Ready, which applies what is left of
it to his warband (decision 3: wins and losses wait for the battle's end).

Each aftermath step applies its own results when the player presses Next (`apply_aftermath_step`, William,
18 Nov 2026; which step hands over what, and what may be changed afterwards, is services/postbattle/steps.py). The
steps already applied are kept with the draft and are never applied twice, so Ready applies only what is left of
them, and always the camp's tail: upkeep and the games this battle counts off the units missing them.

Ready runs in two transactions (PERF-36), so the battle row is locked only for the last step:

1. `apply_player_postbattle`, under the player's own participant lock: the draft is checked once against the rows
   it touches (read and locked once: services/postbattle/context.py), then the aftermath steps he hasn't applied,
   upkeep, the missing games and the logs are written, and his status becomes confirmed_postbattle. That status is
   the idempotency guard: a repeat waits for the lock, then finds it.
2. `confirm_postbattle`, under the battle lock: his confirmation event, and the battle's end when everyone still in
   it has finished and its results are confirmed (the last player to confirm always sees everyone else's committed
   status). A player can finalise while the others still fight (decision 4): then only his event is added.

Neither waits for the battle row while it holds a player's rows, so nothing can deadlock with writes that lock the
battle first (services/locks.py). A step's apply holds the player's rows only.
"""

from dataclasses import dataclass, replace

from django.utils import timezone

from apps.exploration.chart import Chart
from apps.exploration.selectors import chart_for, chart_for_campaign

from ...models import Battle, BattleEvent, BattleParticipant
from ...serializers import snapshot_participants
from ...validation.config import normalize_unit_information
from ...validation.postbattle import normalize_postbattle
from ..broadcast import bump_state_version
from ..events import append_event
from ..exploration import keep_exploration
from ..lifecycle import all_finished, end_battle
from ..locks import lock_battle
from ..unusual import unusual_value_warnings
from ..warnings import Warning
from . import steps as aftermath
from .advances import apply_advances
from .context import FinaliseContext, campaign_settings, load_context
from .logs import write_battle_logs
from .missing import apply_missing_games
from .mounts import lose_mounts
from .rewards import Finds, apply_exploration, apply_upkeep_and_finds
from .steps import EXPLORE, INJURIES, XP, AftermathLocked, injury_results, xp_results
from .units import UnitOutcome, UnitResults
from .validate import check_draft, validate_postbattle


def _chart(battle: Battle) -> Chart:
    """The campaign's exploration chart (apps/exploration), by the settings finalise reads with the battle."""
    settings = campaign_settings(battle)
    return chart_for(battle.campaign_id, settings.exploration_chart_id if settings else None)


def _keep_exploration(participant: BattleParticipant, draft: dict, chart: Chart) -> list[Warning]:
    """The draft keeps the exploration roll with the chart's amount and places (decision 9, BUG-71); a re-roll
    warns."""
    stored_exploration = (participant.postbattle_json or {}).get("exploration")
    draft["exploration"], warnings = keep_exploration(stored_exploration, draft["exploration"], chart)
    return warnings


def save_draft(battle: Battle, participant: BattleParticipant, raw_draft: object) -> list[Warning]:
    """Save the player's draft: it logs nothing (Ready logs each unit's injury once, decision 7, BUG-47), answers
    the unusual values it will log (decision 9) and warns about a change to a step already applied. A change to what
    has left the aftermath is refused with where to make it instead (ValueError, steps.py)."""
    chart = chart_for_campaign(battle.campaign_id)  # a draft save holds no settings: it reads the picked chart
    draft = validate_postbattle(battle, participant, raw_draft, chart)
    if (locked := aftermath.locked_change(participant, draft)) is not None:
        raise AftermathLocked(locked)
    warnings = _keep_exploration(participant, draft, chart)
    warnings += aftermath.change_warnings(participant, draft)
    warnings += unusual_value_warnings(draft, chart)
    aftermath.keep(draft, participant)
    participant.postbattle_json = draft
    participant.save(update_fields=["postbattle_json", "updated_at"])
    return warnings


def check_draft_against(context: FinaliseContext, draft: dict) -> None:
    """The draft save's checks, made against the rows finalise holds (the specials still read their own): the gap
    between finalise's reads and its writes."""
    settings = context.settings
    check_draft(
        draft,
        context.participant,
        context.battle.campaign_id,
        (settings.hero_death_roll if settings else None) or "d66",
        resource_found=lambda resource_id: context.resource_found,
        hireling_ids=lambda ids: {sword_id for sword_id in ids if sword_id in context.hirelings},
    )


def _upkeep_and_finds(context: FinaliseContext, draft: dict, parts: frozenset[str], *, final: bool) -> Finds:
    """The gold the explore step hands over and, at Ready, the upkeep charged: one ledger write for both, in that
    order, and no query at all when neither applies."""
    nothing: dict = {"gold_crowns": 0, "items": []}
    upkeep = draft.get("upkeep", {}) if final else {"pay_upkeep": False}
    finds = draft.get("finds", nothing) if EXPLORE in parts else nothing
    return apply_upkeep_and_finds(context, upkeep, finds)


def _units(context: FinaliseContext, draft: dict, parts: frozenset[str], information: dict) -> UnitOutcome:
    """The unit results of the steps in `parts`, written in one pass over the rows: both steps' as they always were
    (the kills, injuries, XP and level-ups of the whole result) when neither has been applied yet, else the one
    step's part of each result, with the other's fields blanked so the shared path writes nothing of it
    (services/postbattle/steps.py)."""
    results = draft["unit_results"]
    if XP not in parts:
        return UnitResults(context, information).apply(injury_results(results))
    if INJURIES not in parts:  # the kills went with the injuries: this pass adds the XP, level-ups and kept stats
        return UnitResults(replace(context, kills={}), information).apply(xp_results(results))
    return UnitResults(context, information).apply(results)


def _apply(context: FinaliseContext, draft: dict, parts: frozenset[str], *, final: bool) -> tuple[list[Warning], dict]:
    """Write the aftermath steps in `parts` and, when `final`, the camp's tail: upkeep and the missing games (in that
    order, because upkeep reads who was missing for this battle). Returns the warnings and what was handed over."""
    information = normalize_unit_information(context.participant.unit_information_json)
    units, explored = UnitOutcome(), None
    if parts & {INJURIES, XP}:
        units = _units(context, draft, parts, information)
        if XP in parts:
            units.warnings += apply_advances(context, draft["unit_results"])  # the advances, on the new level-ups
        if INJURIES in parts:
            units.mounts_lost = lose_mounts(context, draft, information)  # after the dead took their items
    if EXPLORE in parts:
        explored = apply_exploration(context, draft["exploration"])
    finds = _upkeep_and_finds(context, draft, parts, final=final)
    units.warnings += finds.warnings  # an upkeep resource paid short, or by no counter
    if final:  # after upkeep, which reads who was missing for this battle; then the injuries' new counts
        units.missing_logs = apply_missing_games(context, draft["unit_results"])
    unusual = unusual_value_warnings(draft, context.chart) if final else []
    write_battle_logs(context.battle, context.participant, draft["exploration"], explored, finds, units, unusual)
    received = (
        {
            "shards": explored.amount,
            "resource": explored.resource_name,
            "gold": finds.gold_crowns,
            "items": len(finds.items),
        }  # fmt: skip
        if explored is not None
        else {}
    )
    return units.warnings + unusual, received


def _read_and_check(battle: Battle, participant: BattleParticipant, draft: dict, chart: Chart) -> FinaliseContext:
    """Lock and read what applying this draft touches, then check it against those rows."""
    context = load_context(battle, participant, draft, chart)
    if draft["exploration"].get("resource_id") is None:  # none picked: the shards go to the default resource
        draft["exploration"]["resource_id"] = context.resource_id
    check_draft_against(context, draft)
    return context


def apply_aftermath_step(battle: Battle, participant: BattleParticipant, raw_draft: object, step: str) -> list[Warning]:
    """Apply the aftermath step the player has just left and record it, holding only his rows (William, 18 Nov 2026:
    "I still want results on a page to be applied as soon as next is clicked"). Idempotent: a step already applied
    writes nothing to the warband, only the draft. ValueError for a draft that can't be applied or a change to what
    has already left the aftermath (raised inside the transaction, so nothing it wrote is kept: BUG-124)."""
    chart = _chart(battle)
    first_time = step not in aftermath.applied(participant)
    # he came back and left the step again: the draft is checked as a save is, and nothing is written to the warband
    draft = (
        normalize_postbattle(raw_draft, chart.max_dice)
        if first_time
        else validate_postbattle(battle, participant, raw_draft, chart)
    )
    if (locked := aftermath.locked_change(participant, draft)) is not None:
        raise AftermathLocked(locked)
    warnings = aftermath.change_warnings(participant, draft)
    received: dict = {}
    if first_time:
        context = _read_and_check(battle, participant, draft, chart)
        warnings += _keep_exploration(participant, draft, chart)
        applied, received = _apply(context, draft, frozenset({step}), final=False)
        warnings += applied
    else:
        warnings += _keep_exploration(participant, draft, chart)
    warnings += unusual_value_warnings(draft, chart)
    aftermath.record(draft, participant, add=step if first_time else None, done=step == EXPLORE, received=received)
    participant.postbattle_json = draft
    participant.save(update_fields=["postbattle_json", "updated_at"])
    return warnings


def apply_player_postbattle(battle: Battle, participant: BattleParticipant, raw_draft: object) -> list[Warning]:
    """Ready: apply what is left of the player's postbattle and mark it finished, holding only his rows (ValueError
    for a draft that can't be applied, raised inside the transaction so nothing it wrote is kept: BUG-124). The
    aftermath steps he already applied are not applied again. Returns the warnings."""
    chart = _chart(battle)
    draft = normalize_postbattle(raw_draft, chart.max_dice)
    aftermath.keep_locked(participant, draft)  # Ready finishes the aftermath; it never changes what it handed over
    context = _read_and_check(battle, participant, draft, chart)
    warnings = _keep_exploration(participant, draft, chart)
    warnings += aftermath.change_warnings(participant, draft)
    left = aftermath.remaining(participant)
    applied, received = _apply(context, draft, left, final=True)
    warnings += applied
    aftermath.record(draft, participant, add=left, done=True, received=received)
    participant.postbattle_json = draft
    participant.status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
    participant.confirmed_at = timezone.now()
    participant.save(update_fields=["postbattle_json", "status", "confirmed_at", "updated_at"])
    return warnings


@dataclass
class Confirmed:
    battle: Battle
    participants: list[BattleParticipant]  # read under the battle lock, as the answer's snapshot shows them
    events: list[dict]
    version: int


def confirm_postbattle(battle_id: int, participant: BattleParticipant, actor_user) -> Confirmed:
    """Under the battle lock: the player's confirmation, and the battle's end if he was the last one in it."""
    battle = lock_battle(battle_id)
    participants = list(snapshot_participants().filter(battle_id=battle_id))
    payload = {"participant_user_id": actor_user.id}
    event_type = BattleEvent.TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE
    events = [append_event(battle, event_type, actor_user=actor_user, payload=payload)]
    if battle.status != Battle.STATUS_ENDED and not battle.results_pending and all_finished(participants):
        end_battle(battle, actor_user, events, participants)  # pending results end it when confirmed (decision 4)
    return Confirmed(battle, participants, events, bump_state_version(battle))
