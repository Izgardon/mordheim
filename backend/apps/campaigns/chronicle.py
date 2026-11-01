"""The campaign's chronicle (the overview, next step 5): what happened lately, newest first, in plain words.

Six kinds, each from the record it already has, in a fixed number of queries whatever the campaign's size:

- `kill`: the live kills of ended battles (battle_kill: undone kills don't count, decision 5);
- `death`: the units the post-games of ended battles left dead;
- `level`: heroes' level-ups and the lad's got talent (the warband log's "advance" entries; henchmen's and hired
  swords' other advances are left out);
- `buy`: items bought (the log's "loadout" entries with a price; gifts are left out);
- `trade`: completed trades (the log writes one entry per side; the chronicle shows one);
- `bounty`: bounties posted (`bounty_posted`) and paid (`bounty_claimed`), from the bounty table.
"""

from datetime import datetime
from typing import Any

from django.db.models import Q
from django.db.models.functions import Coalesce, Greatest
from django.utils import timezone

from apps.battles.models import Battle, BattleKill, BattleParticipant
from apps.battles.services.kills import live_kills_in
from apps.bounties.models import PAID, WITHDRAWN, Bounty
from apps.users.names import display_name
from apps.warbands.models import WarbandLog

KINDS = ("kill", "death", "level", "buy", "trade", "bounty")
LIMIT = 40
PURCHASES = ("hero_item", "henchmen_item", "hireling_item", "stash_item")
LOG_KINDS = {
    "level": Q(feature="advance", entry_type="hero") | Q(feature="advance", payload__lads_got_talent=True),
    "buy": Q(feature="loadout", entry_type__in=PURCHASES, payload__has_key="price"),
    "trade": Q(feature="trade", entry_type="completed"),
}


def _entry(kind: str, text: str, meta: str, at: datetime | None) -> dict[str, Any]:
    return {"kind": kind, "text": text, "meta": meta, "at": at or timezone.now()}


def kill_text(kill: BattleKill) -> str:
    return f"{kill.killer_called(start=True)} took {kill.victim_called()} out of action"


def unit_results(postbattle_json: Any) -> dict[str, dict]:
    """A participant's stored unit results by unit key ({} when there are none)."""
    raw = postbattle_json.get("unit_results", {}) if isinstance(postbattle_json, dict) else {}
    if not isinstance(raw, dict):
        return {}
    return {key: result for key, result in raw.items() if isinstance(key, str) and isinstance(result, dict)}


def death_text(name: str, result: dict[str, Any]) -> str:
    """ "Ulla Vorn is dead (Dead)" reads badly: the injury's label only when it says more than "dead"."""
    rolls = result.get("serious_injury_rolls")
    last = rolls[-1] if isinstance(rolls, list) and rolls and isinstance(rolls[-1], dict) else {}
    label = str(last.get("result_label") or "").strip()
    return f"{name} is dead ({label})" if label and label.lower() != "dead" else f"{name} is dead"


def _kills(campaign_id: int) -> list[dict[str, Any]]:
    kills = live_kills_in(campaign_id).select_related("battle", "killer_warband").order_by("-created_at", "-id")[:LIMIT]
    rows = []
    for kill in kills:
        meta = " · ".join(part for part in (kill.killer_warband.name, kill.battle.scenario) if part)
        rows.append(_entry("kill", kill_text(kill), meta, kill.created_at))
    return rows


def _deaths(campaign_id: int) -> list[dict[str, Any]]:
    participants = (
        BattleParticipant.objects.filter(battle__campaign_id=campaign_id, battle__status=Battle.STATUS_ENDED)
        .filter(removed_from_record=False)
        .select_related("battle", "warband")
        .only("postbattle_json", "warband__name", "battle__scenario", "battle__ended_at", "battle__created_at")
    )
    rows = []
    for participant in participants:
        battle = participant.battle
        for result in unit_results(participant.postbattle_json).values():
            if result.get("dead"):
                name = str(result.get("unit_name") or "").strip() or "A unit"
                meta = f"{participant.warband.name} · {battle.scenario}"
                rows.append(_entry("death", death_text(name, result), meta, battle.ended_at or battle.created_at))
    return rows


def _label(advance: Any) -> str:
    if isinstance(advance, dict):
        return str(advance.get("label") or advance.get("id") or "an advance")
    return str(advance or "an advance")


def _sent(offer: Any) -> str:
    offer = offer if isinstance(offer, dict) else {}
    items = [entry for entry in offer.get("items") or [] if isinstance(entry, dict)]
    parts = [
        f"{entry.get('item')}" + (f" ×{entry['quantity']}" if (entry.get("quantity") or 1) > 1 else "")
        for entry in items
    ]
    if offer.get("gold"):
        parts.append(f"{offer['gold']} gc")
    return ", ".join(parts) or "nothing"


def _log_text(log: WarbandLog) -> tuple[str, str] | None:
    """A log entry's kind and text, or None for one the chronicle leaves out."""
    payload = log.payload if isinstance(log.payload, dict) else {}
    if log.feature == "advance" and payload.get("lads_got_talent"):
        name = payload.get("henchman_name") or "A henchman"
        return "level", f"{name} of {payload.get('group') or 'the henchmen'} has got talent and joins the heroes"
    if log.feature == "advance":
        return "level", f"{payload.get('hero') or 'A hero'} gained {_label(payload.get('advance'))}"
    if log.feature == "loadout":
        quantity = f" ×{payload['quantity']}" if (payload.get("quantity") or 1) > 1 else ""
        target = f"for {payload['hero']}" if payload.get("hero") else "for the stash"
        return "buy", f"{payload.get('item') or 'An item'}{quantity} {target}, {payload.get('price', 0)} gc"
    partner = payload.get("partner") or "another warband"
    sent, received = _sent(payload.get("sent")), _sent(payload.get("received"))
    return "trade", f"{log.warband.name} traded with {partner}: sent {sent}, received {received}"


def _logs(campaign_id: int, kinds: list[str]) -> list[dict[str, Any]]:
    wanted = Q()
    for kind in kinds:
        wanted |= LOG_KINDS[kind]
    logs = (
        WarbandLog.objects.filter(warband__campaign_id=campaign_id)
        .filter(wanted)
        .select_related("warband")
        .only("feature", "entry_type", "payload", "created_at", "warband__name")
        .order_by("-created_at", "-id")[: LIMIT * 2]  # a trade is two entries
    )
    rows, trades = [], set()
    for log in logs:
        found = _log_text(log)
        if found is None:
            continue
        if found[0] == "trade":  # one entry per trade: its two sides are written together
            pair = (
                frozenset((log.warband.name, str(log.payload.get("partner")))),
                log.created_at.replace(microsecond=0),
            )
            if pair in trades:
                continue
            trades.add(pair)
        rows.append(_entry(found[0], found[1], log.warband.name, log.created_at))
    return rows


def _bounties(campaign_id: int) -> list[dict[str, Any]]:
    """Each bounty's posting, and its payment once paid: the newest by either, in one query."""
    latest = Greatest("created_at", Coalesce("closed_at", "created_at"))
    bounties = (
        Bounty.objects.filter(campaign_id=campaign_id)
        .select_related("posted_by_warband", "posted_by_user", "paid_claim__claimant_warband", "paid_claim__battle")
        .order_by(latest.desc(), "-id")[:LIMIT]
    )
    rows = []
    for bounty in bounties:
        poster = bounty.posted_by_warband.name
        on = f"{bounty.target_name} ({bounty.target_warband_name})"
        posted = f"{poster} put a {bounty.amount} gc bounty on {on}"
        withdrawn = " · withdrawn" if bounty.status == WITHDRAWN else ""
        meta = f"Posted by {display_name(bounty.posted_by_user)}{withdrawn}"
        rows.append(_entry("bounty_posted", posted, meta, bounty.created_at))
        claim = bounty.paid_claim
        if bounty.status == PAID and claim is not None:
            claimant = claim.claimant_warband.name
            text = f"{claim.unit_name} of {claimant} collected the {bounty.amount} gc bounty on {bounty.target_name}"
            where = " · ".join(part for part in (claimant, claim.battle.scenario if claim.battle else "") if part)
            rows.append(_entry("bounty_claimed", text, where, bounty.closed_at))
    return rows


def chronicle(campaign_id: int, kind: str | None = None) -> list[dict[str, Any]]:
    """The newest LIMIT entries of one kind (or of every kind), each `{kind, text, meta, at}`."""
    kinds = [kind] if kind in KINDS else list(KINDS)
    entries = []
    if "kill" in kinds:
        entries += _kills(campaign_id)
    if "death" in kinds:
        entries += _deaths(campaign_id)
    if log_kinds := [entry for entry in kinds if entry in LOG_KINDS]:
        entries += _logs(campaign_id, log_kinds)
    if "bounty" in kinds:
        entries += _bounties(campaign_id)
    entries.sort(key=lambda entry: entry["at"], reverse=True)
    return entries[:LIMIT]
