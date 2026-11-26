"""The aftermath's three steps and what each one hands over (William, 18 Nov 2026).

"When they are navigated through via the next button it should lock in and confirm any result on a previous page
immediately, as soon as the next button is clicked on the exploration page that aftermath stage is complete for that
player and they shouldn't be prompted anymore."

So each step applies its own results to the warband when the player leaves it, and the steps already applied are kept
with his draft, under `postbattle_json["aftermath"]`:

    {"applied": ["injuries", "xp", "explore"], "done_at": "<iso>" | None,
     "received": {"shards": 5, "resource": "Wyrdstone", "gold": 20, "items": 2}}

The block is the server's alone: `normalize_postbattle` drops it from anything a client sends, and only this module
writes it, in the same transaction as the writes it records. It is the idempotency guard: a step in `applied` is
never applied again, so pressing Next twice pays once (services/postbattle/finalise.py).

What each step hands over:

- `injuries`: each unit's serious injury (its stat change, special and death), the items a dead unit took with him
  and the mounts lost (the single-use items used in battle went when his battle finished: finishing.py);
- `xp`: the battle XP, the level-ups it crosses, the advances rolled and the kept stat changes;
- `explore`: the shards found and the gold and items found with them.

Upkeep and the missing games this battle counts stay at Ready: they are the camp's, and upkeep reads who was missing
for *this* battle, so counting the games down before it would charge a hired sword who missed it.

What may change afterwards (William: "maybe we can lock the item and gold section, the number of wyrdstone received
but still allow the other things to be edited and dice numbers to change for exploration purposes"):

- the gold and items found are **locked** once handed over: a draft that changes them is refused, because a change
  now is a sale, a stash move or a ledger row, never a rollback through the aftermath;
- everything else stays editable and warns: the unit results and the exploration dice change the battle's *record*,
  not the warband, because what reached a unit is changed on the unit.
"""

from typing import Any

from django.utils import timezone

from ...models import BattleParticipant
from ..warnings import Warning

INJURIES, XP, EXPLORE = "injuries", "xp", "explore"
STEPS: tuple[str, ...] = (INJURIES, XP, EXPLORE)

LOCKED = "aftermath_locked"
ALREADY_APPLIED = "aftermath_already_applied"
FINDS_LOCKED = (
    "The gold and items found are already in your warband. Sell or move an item from the stash, and change gold"
    " in the warband's ledger."
)

# What each step writes, and so what the one before it may no longer change in the warband.
INJURY_FIELDS = ("serious_injury_rolls", "dead", "special_ids", "out_of_action", "missing_games")
XP_FIELDS = ("xp_earned", "keep_stats", "advances")


class AftermathLocked(ValueError):
    """A change to what the aftermath has already handed over: refused, with where to make it instead."""

    code = LOCKED


def block(participant: BattleParticipant) -> dict[str, Any]:
    """The stored aftermath block, `{}` for a player who has applied nothing."""
    stored = participant.postbattle_json if isinstance(participant.postbattle_json, dict) else {}
    found = stored.get("aftermath")
    return found if isinstance(found, dict) else {}


def applied(participant: BattleParticipant) -> list[str]:
    """The steps already written to his warband, in step order."""
    done = block(participant).get("applied")
    names = {name for name in done if isinstance(name, str)} if isinstance(done, list) else set()
    return [step for step in STEPS if step in names]


def remaining(participant: BattleParticipant) -> frozenset[str]:
    """The steps Ready still has to apply."""
    return frozenset(STEPS) - frozenset(applied(participant))


def is_done(participant: BattleParticipant) -> bool:
    """His aftermath is finished: he is never prompted for it again."""
    return block(participant).get("done_at") is not None


def record(
    draft: dict,
    participant: BattleParticipant,
    *,
    add: str | frozenset[str] | None,
    done: bool,
    received: dict | None,
) -> None:
    """Keep the aftermath block on the draft about to be saved: the steps just applied added to those before them,
    when the aftermath was finished, and what the explore step handed over. Written in the same transaction as the
    writes it records, so it can never say a step was applied that wasn't."""
    before = block(participant)
    now = {*applied(participant), *({add} if isinstance(add, str) else add or set())}
    draft["aftermath"] = {
        "applied": [name for name in STEPS if name in now],
        "done_at": before.get("done_at") or (timezone.now().isoformat() if done else None),
        "received": {**(before.get("received") or {}), **(received or {})},
    }


def keep(draft: dict, participant: BattleParticipant) -> None:
    """Carry the stored block onto a draft the player saved (he never sends it)."""
    record(draft, participant, add=None, done=False, received=None)


def _results_part(unit_results: dict[str, dict], *, keep_fields: tuple[str, ...]) -> dict[str, dict]:
    """Each unit's result with only one step's fields left set, so the shared apply path (services/postbattle/
    units.py) writes that step's part of it and nothing else."""
    blanks: dict[str, Any] = {
        "serious_injury_rolls": [],
        "dead": False,
        "special_ids": [],
        "xp_earned": 0,
        "keep_stats": False,
        "advances": [],
    }
    part = {}
    for unit_key, result in unit_results.items():
        kept = {field: result[field] for field in keep_fields if field in result}
        part[unit_key] = {**result, **{name: value for name, value in blanks.items() if name not in kept}, **kept}
    return part


def injury_results(unit_results: dict[str, dict]) -> dict[str, dict]:
    return _results_part(unit_results, keep_fields=INJURY_FIELDS)


def xp_results(unit_results: dict[str, dict]) -> dict[str, dict]:
    return _results_part(unit_results, keep_fields=XP_FIELDS)


def _finds_changed(stored: dict, draft: dict) -> bool:
    before, now = stored.get("finds") or {}, draft.get("finds") or {}
    if before.get("gold_crowns", 0) != now.get("gold_crowns", 0):
        return True
    ids = [entry.get("item_id") for entry in before.get("items") or []]
    return ids != [entry.get("item_id") for entry in now.get("items") or []]


def keep_locked(participant: BattleParticipant, draft: dict) -> None:
    """Once the explore step is applied, the gold and items found are the warband's, so the record of them stands
    whatever a later write sends: Ready sends the whole draft back, and the page can no longer change them."""
    stored = participant.postbattle_json if isinstance(participant.postbattle_json, dict) else {}
    if EXPLORE in applied(participant) and stored.get("finds") is not None:
        draft["finds"] = stored["finds"]


def locked_change(participant: BattleParticipant, draft: dict) -> str | None:
    """Why this draft can't be saved: what it changes has already left the aftermath. None when it may go ahead."""
    stored = participant.postbattle_json if isinstance(participant.postbattle_json, dict) else {}
    if EXPLORE in applied(participant) and _finds_changed(stored, draft):
        return FINDS_LOCKED
    return None


def _unit_results_changed(stored: dict, draft: dict, fields: tuple[str, ...]) -> bool:
    before, now = stored.get("unit_results") or {}, draft.get("unit_results") or {}
    keys = {*before, *now}
    return any(
        (before.get(key) or {}).get(field) != (now.get(key) or {}).get(field) for key in keys for field in fields
    )


def change_warnings(participant: BattleParticipant, draft: dict) -> list[Warning]:
    """What a change to an applied step warns: it goes ahead, and changes the battle's record only (a guide, not a
    gatekeeper); the warband itself is changed on the unit."""
    stored = participant.postbattle_json if isinstance(participant.postbattle_json, dict) else {}
    done = applied(participant)
    warnings: list[Warning] = []
    if INJURIES in done and _unit_results_changed(stored, draft, INJURY_FIELDS):
        warnings.append(_already("The injuries are already in your warband", "Change a unit on their card."))
    if XP in done and _unit_results_changed(stored, draft, XP_FIELDS):
        warnings.append(_already("The experience is already in your warband", "Change a unit on their card."))
    if EXPLORE in done and _exploration_changed(stored, draft):
        shards = block(participant).get("received", {}).get("shards")
        found = f"The {shards} found stay as they are." if shards else "What was found stays as it is."
        warnings.append(_already("Your exploration is already confirmed", found))
    return warnings


def _exploration_changed(stored: dict, draft: dict) -> bool:
    """The roll as the player entered it: the dice and the amount he typed over the chart's (the shards, places and
    re-roll history the server keeps are not his to send)."""
    before, now = stored.get("exploration") or {}, draft.get("exploration") or {}
    return (before.get("dice_values") or [], before.get("amount_override")) != (
        now.get("dice_values") or [],
        now.get("amount_override"),
    )


def _already(what: str, where: str) -> Warning:
    return {"code": ALREADY_APPLIED, "message": f"{what}: this only changes the battle's record. {where}"}
