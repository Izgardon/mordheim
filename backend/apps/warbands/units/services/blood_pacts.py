"""Blood pacts: Mutiny in Marienburg's rule, which William calls generic, so it rides a campaign setting
(`CampaignSettings.enable_blood_pacts`) rather than the Marienburg setting.

The post-game rolls 2D6 for each hired sword who could still swear one, adding 1 for each skill or characteristic
increase he has gained; on a 12 he forms a pact. The pact itself is the hired sword's `blood_pacted` tick, which
already keeps him outside the hired-sword cap (units/kinds.py) and now stops his upkeep being asked for
(battles/services/postbattle/suggested.py). Who may never form one (the book names Assassins, Thieves, Merchants,
Fences and Slavers) is not a classification our catalogue carries, so it stays rule text the player reads.
"""

from typing import Any

from apps.warbands.models import Hireling

from ..kinds import STAT_FIELD_BY_ADVANCE

PACT_ROLL = 12  # 2D6 plus the bonus: "On a 12 he swears an oath in blood"
# "adding 1 for each skill or characteristic increase he has gained": the advances his history holds. A Spell or a
# boon or bane an advance gave is neither, so neither counts.
COUNTED_ADVANCES = frozenset({*STAT_FIELD_BY_ADVANCE, "Skill"})


def pact_bonus(hireling: Hireling) -> int:
    """What a hired sword adds to his 2D6: one per skill or characteristic increase in his level-up history."""
    history: Any = hireling.level_up_history or []
    if not isinstance(history, list):
        return 0
    return sum(1 for entry in history if isinstance(entry, dict) and entry.get("code") in COUNTED_ADVANCES)


def can_pact(hireling: Hireling) -> bool:
    """Whether he could still swear one: a living hired sword without a pact. A dramatis persona is not a Hired
    Sword, so he never forms one."""
    return (
        hireling.kind == "hired_sword"
        and not hireling.blood_pacted
        and not hireling.dead
        and hireling.dismissed_at is None
    )
