"""The random mutation table (William, 5 Nov 2026): the D100 serious injury result 100, Mutation, rolls a D66 on it.

The table is the catalogue import's `out/random-mutations.json` (mordheimer's Power in the Stones table, first printed
in Town Cryer #15): each result's roll, its name as printed and the special it gives (a shared special, by name and
type). The server describes a draft's follow-up roll (`describe_mutation`) and grants the special at finalise
(`mutation_special`), as a rule-granting injury grants its own; a result the hero has already warns on the page and is
never refused.
"""

from functools import cache
from typing import Any

from django.db.models import F, Q

from apps.core.catalogue import cache as catalogue_cache
from apps.core.seeding import IMPORT_OUT, read_json_list
from apps.special.categories import MUTATION
from apps.special.kinds import GENERAL, book_kind
from apps.special.models import Special
from apps.special.shared import read_shared

RANDOM_MUTATIONS = IMPORT_OUT / "random-mutations.json"


@cache
def random_mutation_table() -> tuple[dict[str, Any], ...]:
    """The table as postbattle shows it, by roll: the result's name, the special it gives and its type, and the
    special's text (the import's out/shared-specials.json)."""
    texts = {(row["name"], row["type"]): row["description"] for row in read_shared()["specials"]}
    return tuple(
        {
            "roll": row["roll"],
            "name": row["name"],
            "special": row["special"]["name"],
            "special_type": row["special"]["type"],
            "text": texts.get((row["special"]["name"], row["special"]["type"]), ""),
        }
        for row in read_json_list(RANDOM_MUTATIONS)
    )


def describe_mutation(rolls: list[int]) -> dict[str, Any]:
    """The table's result for a D66 (two D6, already validated): the dice, the code, the name and the special it
    gives; a code the table lacks gives no special."""
    code = rolls[0] * 10 + rolls[1]
    row = next((row for row in random_mutation_table() if row["roll"] == code), None)
    found = {key: row[key] for key in ("name", "special", "special_type")} if row else {}
    return {"rolls": rolls, "result_code": str(code), **found}


def mutation_special(name: str, special_type: str, campaign_id: int) -> Special:
    """The special a mutation gives: the book's general special of that name and type (or the campaign's version of
    it), else the campaign's own, made the first time (a mutation; its kind the book's classification). One query to
    find it."""
    book = Q(campaign__isnull=True, name__iexact=name, type=special_type)
    versions = Q(campaign_id=campaign_id, replaces__campaign__isnull=True, replaces__name__iexact=name)
    own = Q(campaign_id=campaign_id, name__iexact=name)
    rows = list(
        Special.objects.filter(owner_kind=GENERAL)
        .filter(book | versions | own)
        .order_by(F("campaign_id").asc(nulls_first=True), "id")
    )
    found = next((row for row in rows if row.campaign_id is None), None)
    if found is not None:
        return next((row for row in rows if row.replaces_id == found.id), found)
    mine = next((row for row in rows if row.campaign_id is not None and row.name.lower() == name.lower()), None)
    if mine is not None:
        return mine
    special = Special.objects.create(
        campaign_id=campaign_id, name=name, type=special_type, kind=book_kind(name), category=MUTATION
    )
    catalogue_cache.bump(campaign_id, "specials")
    return special
