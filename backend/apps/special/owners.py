"""Beasts' own rules (William, 7 Nov 2026: "keep bestiary rules from displaying on the boons and banes page, show on
beast for sure"): a book special that only bestiary entries hold ("Attacks (Giant)", "Aura of Slaanesh (Daemonette)")
is a beast's rule, owner kind `beast`, which the Boons & Banes page and Search everything leave out as they leave out
the other owners' own rules; it still shows on its beast. One a hired sword, a dramatis persona or a warband template
(a fighter's rule or an upgrade) holds too stays general, and so does every shared special (shared.py: a rule many
owners hold, Fear among the beasts' too). The beasts' rules are the book's general specials (`data/special.json`,
linked by name), so who holds one is only known once the seeders have linked them: every seeder that links book
specials ends with `mark_beast_rules`, the way the others' owner kinds are set at seeding.
"""

from django.db.models import Q

from .kinds import BEAST, GENERAL
from .models import Special
from .shared import read_shared

HELD_BY_OTHERS = (
    Q(hired_sword_specials__isnull=False)
    | Q(dramatis_persona_specials__isnull=False)
    | Q(template_fighter_links__isnull=False)
    | Q(template_upgrades__isnull=False)
)


def mark_beast_rules() -> int:
    """Set each book special's owner kind from who holds it: beast for one only beasts hold, general again for one
    marked beast that another owner holds now (or nobody does); how many changed. Three queries."""
    shared = {(entry["name"], entry["type"]) for entry in read_shared()["specials"]}
    book = Special.objects.filter(campaign__isnull=True, owner_kind__in=(GENERAL, BEAST))
    held = book.filter(bestiary_entry_specials__isnull=False).values_list("pk", "name", "type")
    beasts = {pk for pk, name, special_type in held if (name, special_type) not in shared}
    only = beasts - set(book.filter(HELD_BY_OTHERS).values_list("pk", flat=True))
    changed = book.filter(owner_kind=GENERAL, pk__in=only).update(owner_kind=BEAST)
    return changed + book.filter(owner_kind=BEAST).exclude(pk__in=only).update(owner_kind=GENERAL)
