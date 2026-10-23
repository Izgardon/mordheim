"""Each catalogue kind's list row and detail serializers with the badge fields (payloads.py, CAT-NEW-03): the
apps' own serializers, which unit payloads and bestiary equipment nest without badges, plus `BADGES` after their
fields."""

from apps.bestiary.serializers import (
    BestiaryEntryBriefSerializer,
    BestiaryEntrySerializer,
    BestiaryEntrySummarySerializer,
    HiredSwordProfileDetailSerializer,
    HiredSwordProfileSummarySerializer,
)
from apps.items.serializers import ItemSerializer
from apps.races.serializers import RaceSerializer
from apps.skills.serializers import SkillSerializer
from apps.special.serializers import SpecialSerializer
from apps.spells.serializers import SpellSerializer

from .payloads import STAT_FIELDS, with_badges

ITEM_FIELDS = ("name", "type", "subtype", "grade", "single_use", "description", "strength", "range", "save_value")
ENTRY_FIELDS = ("name", "type", "description", *STAT_FIELDS, "armour_save", "large", "caster")
PROFILE_FIELDS = (
    "hire_cost",
    "hire_cost_expression",
    "upkeep_cost",
    "upkeep_cost_expression",
    "rating",
    "grade",
    "race",
    "available_skill_types",
)

ItemRowSerializer = with_badges(ItemSerializer, book_fields=(*ITEM_FIELDS, "statblock"), book_price=True)
SkillRowSerializer = with_badges(SkillSerializer)
SpellRowSerializer = with_badges(SpellSerializer, book_fields=("name", "type", "description", "dc", "roll"))
SpecialRowSerializer = with_badges(SpecialSerializer)
RaceRowSerializer = with_badges(RaceSerializer, book_fields=("name", *STAT_FIELDS))
BestiaryEntryRowSerializer = with_badges(BestiaryEntrySummarySerializer, book_fields=ENTRY_FIELDS)
BestiaryEntryBriefRowSerializer = with_badges(BestiaryEntryBriefSerializer, book_fields=ENTRY_FIELDS)
BestiaryEntryDetailRowSerializer = with_badges(BestiaryEntrySerializer, book_fields=ENTRY_FIELDS)
HIRED_SWORD_BADGES = {"via": "bestiary_entry", "book_fields": ENTRY_FIELDS, "book_profile_fields": PROFILE_FIELDS}
HiredSwordRowSerializer = with_badges(HiredSwordProfileSummarySerializer, **HIRED_SWORD_BADGES)
HiredSwordDetailRowSerializer = with_badges(HiredSwordProfileDetailSerializer, **HIRED_SWORD_BADGES)
