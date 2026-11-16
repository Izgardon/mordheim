"""Blood pacts and upkeep (Mutiny in Marienburg, a campaign setting since William called the rule generic):
"A Hired Sword in a pact ... pays no upkeep", so the post-game suggests him no upkeep row.

The pact is rolled after the upkeep is paid, and the battle roster is the snapshot `start/` kept, so a pact sworn
during this post-game still pays this battle's upkeep and none after it."""

from typing import Any

from apps.hirelings.fees import make_fee
from apps.warbands.models import Hireling

from .battle_support import BattleTestCase, build_fixture_warband, catalogue_item


class BloodPactUpkeepTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.fixture = build_fixture_warband(self.warband, catalogue_item("Rope", 5))
        self.ogre, self.rat_ogre = self.fixture.hirelings
        self.rat = f"hero:{self.rival.heroes.create(name='Rat', unit_type='Assassin').id}"
        Hireling.objects.filter(id__in=[self.ogre.id, self.rat_ogre.id]).update(upkeep_fee=make_fee(gold=15))

    def suggested_upkeep(self) -> dict[str, Any]:
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.rat]})
        self.finish(battle_id, [self.warband])
        state = self.ok(self.get_as(self.player, self.url(battle_id, "state") + "?view=postbattle")).data
        entries: dict[str, Any] = state["suggested_postbattle"]["upkeep"]["entries"]
        return entries

    def test_a_pact_sworn_hired_sword_is_asked_for_no_upkeep(self):
        Hireling.objects.filter(id=self.ogre.id).update(blood_pacted=True)

        entries = self.suggested_upkeep()

        self.assertNotIn(f"hireling:{self.ogre.id}", entries)
        self.assertEqual(entries[f"hireling:{self.rat_ogre.id}"]["cost"], 15)

    def test_the_others_are_still_asked_for_theirs(self):
        entries = self.suggested_upkeep()

        self.assertEqual(
            {key: entry["cost"] for key, entry in entries.items()},
            {f"hireling:{self.ogre.id}": 15, f"hireling:{self.rat_ogre.id}": 15},
        )

    def test_the_battle_roster_says_who_is_pact_sworn(self):
        Hireling.objects.filter(id=self.ogre.id).update(blood_pacted=True)
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.rat]})

        rosters = self.ok(self.get_as(self.player, self.url(battle_id, "rosters"))).data

        swords = rosters[str(self.player.id)]["hirelings"]
        self.assertEqual({sword["id"]: sword["bloodPacted"] for sword in swords}, {self.ogre.id: True, self.rat_ogre.id: False})  # fmt: skip
