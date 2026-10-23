"""Each catalogue kind's list row and detail serializers with the badge fields (payloads.py, CAT-NEW-03): the
apps' own serializers, which unit payloads and bestiary equipment nest without badges, plus `BADGES` after their
fields."""

from apps.bestiary.serializers import (
    BEAST_FIELDS,
    BestiaryEntryBriefSerializer,
    BestiaryEntrySerializer,
    BestiaryEntrySummarySerializer,
)
from apps.hirelings.serializers import (
    DramatisPersonaDetailSerializer,
    DramatisPersonaSerializer,
    HiredSwordDetailSerializer,
    HiredSwordSerializer,
)
from apps.items.serializers import ItemSerializer
from apps.races.serializers import RaceSerializer
from apps.skills.serializers import SkillSerializer
from apps.special.serializers import SpecialSerializer
from apps.spells.serializers import SpellSerializer

from .payloads import STAT_FIELDS, with_badges

ITEM_FIELDS = (
    "name",
    "type",
    "subtype",
    "grade",
    "single_use",
    "description",
    "strength",
    "range",
    "save_value",
    "listed",
)
ENTRY_FIELDS = ("name", "kind", "description", *STAT_FIELDS, "armour_save", "large", "caster", *BEAST_FIELDS)
HIRELING_FIELDS = (
    "name",
    "description",
    *STAT_FIELDS,
    "armour_save",
    "large",
    "caster",
    "race_id",
    "race_label",
    "hire_cost",
    "hire_cost_expression",
    "upkeep_cost",
    "upkeep_cost_expression",
    "rating",
    "available_skill_types",
    "grade",
)
PERSONA_FIELDS = (*HIRELING_FIELDS, "stays", "payment_note")

ItemRowSerializer = with_badges(ItemSerializer, book_fields=(*ITEM_FIELDS, "statblock"), book_price=True)
SkillRowSerializer = with_badges(SkillSerializer)
SpellRowSerializer = with_badges(SpellSerializer, book_fields=("name", "type", "description", "dc", "roll"))
SpecialRowSerializer = with_badges(SpecialSerializer)
RaceRowSerializer = with_badges(RaceSerializer, book_fields=("name", *STAT_FIELDS))
BestiaryEntryRowSerializer = with_badges(BestiaryEntrySummarySerializer, book_fields=ENTRY_FIELDS)
BestiaryEntryBriefRowSerializer = with_badges(BestiaryEntryBriefSerializer, book_fields=ENTRY_FIELDS)
BestiaryEntryDetailRowSerializer = with_badges(BestiaryEntrySerializer, book_fields=ENTRY_FIELDS)
HiredSwordRowSerializer = with_badges(HiredSwordSerializer, book_fields=HIRELING_FIELDS)
HiredSwordDetailRowSerializer = with_badges(HiredSwordDetailSerializer, book_fields=HIRELING_FIELDS)
DramatisPersonaRowSerializer = with_badges(DramatisPersonaSerializer, book_fields=PERSONA_FIELDS)
DramatisPersonaDetailRowSerializer = with_badges(DramatisPersonaDetailSerializer, book_fields=PERSONA_FIELDS)
