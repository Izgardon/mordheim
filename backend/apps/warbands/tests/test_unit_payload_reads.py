"""Skills, specials and spells read with the unit's row (JSON arrays) serialize exactly as the join rows did."""

import json
from typing import Any, cast

from rest_framework.renderers import JSONRenderer

from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.serializers import UNIT_SERIALIZERS
from apps.warbands.units.kinds import KINDS, UnitKindKey

from .roster_support import KINDS as TEST_KINDS
from .roster_support import RosterTestCase, make_unit


def _rendered(data: Any) -> str:
    """The response bytes, so key order and value types count, not just equality."""
    rendered: bytes = JSONRenderer().render(data)
    return rendered.decode()


class FoldedLoadoutReadTests(RosterTestCase):
    def test_folded_entries_render_like_the_join_rows(self):
        odd_skill = Skill.objects.create(name='Ünïcode "quoted" skill', type="", description="Line\nbreak")
        odd_special = Special.objects.create(name="Blank", type="", description="")
        odd_spell = Spell.objects.create(name="Spell ✦", type="Lesser", dc="", description="")
        for test_kind in TEST_KINDS:
            kind = KINDS[cast(UnitKindKey, test_kind.key)]
            with self.subTest(kind=kind.key):
                unit = make_unit(test_kind, self.warband, race=self.race)
                unit_links = getattr(unit, test_kind.items)
                unit_links.create(item=self.sword, cost=10)
                for entry in (self.skills[1], odd_skill, self.skills[0]):  # id order is the player's order
                    getattr(unit, test_kind.skills).create(skill=entry)
                for special in (odd_special, self.specials[0]):
                    getattr(unit, test_kind.specials).create(special=special)
                if test_kind.spells:
                    for spell in (odd_spell, self.spells[1]):
                        getattr(unit, test_kind.spells).create(spell=spell)

                folded = kind.detail_queryset().get(id=unit.id)
                plain = kind.objects.select_related("race").get(id=unit.id)  # serialized row by row
                serializers = UNIT_SERIALIZERS[kind.key]
                for serializer in (serializers.summary, serializers.detail):
                    with self.subTest(shape=serializer.__name__):
                        expected = serializer(plain).data
                        self.assertEqual(_rendered(serializer(folded).data), _rendered(expected))
                        self.assertEqual(len(json.loads(_rendered(expected))["skills"]), 3)

    def test_units_without_entries_get_empty_lists(self):
        for test_kind in TEST_KINDS:
            kind = KINDS[cast(UnitKindKey, test_kind.key)]
            with self.subTest(kind=kind.key):
                unit = make_unit(test_kind, self.warband)
                body = UNIT_SERIALIZERS[kind.key].detail(kind.detail_queryset().get(id=unit.id)).data
                self.assertEqual((body["skills"], body["specials"], body.get("spells", [])), ([], [], []))
