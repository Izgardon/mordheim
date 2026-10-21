"""An item edited or reverted in the campaign while a battle is open (pass 5 PR C; CAT-TWEAK-03, CAT-TEST-23, -26).

Item-use events store an item id and finds name item ids, for hours. An edit moves the campaign's copies onto the
new version and a Revert moves them back (deleting the version), so recording a use and finalising map each id
through the campaign's current version: a book id the campaign has a version of is the version, and a version
reverted since is its book item. Nothing is orphaned: the used copy is used up, and the find lands where the
catalogue says.
"""

from typing import Any

from apps.warbands.models import Hero, HeroItem, WarbandItem

from .battle_support import BattleTestCase, catalogue_item, draft, unit_result


class OpenBattleVersionTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.potion = catalogue_item("Healing Draught", 10, single_use=True)
        self.hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        for _ in range(2):
            HeroItem.objects.create(hero=self.hero, item=self.potion, cost=10)
        self.key = f"hero:{self.hero.id}"

    def edit(self, item_id: int, cost: int) -> int:
        body = {"campaign_id": self.campaign.id, "availabilities": [{"cost": cost}]}
        self.client.force_authenticate(user=self.campaign_owner)
        return int(self.ok(self.client.patch(f"/api/items/{item_id}/", body, format="json")).data["id"])

    def revert(self, item_id: int) -> None:
        self.ok(self.post_as(self.campaign_owner, f"/api/items/{item_id}/revert/"))

    def use(self, battle_id: int, item_id: int) -> Any:
        stored = self.ok(self.use_item(self.player, battle_id, {"unit_key": self.key, "item_id": item_id}), 201)
        return stored.data["events"][0]["payload_json"]["item_id"]

    def finalise_with_find(self, battle_id: int, item_id: int) -> None:
        self.finish(battle_id, [self.warband])
        finds = {"gold_crowns": 0, "items": [{"item_id": item_id, "name": "Healing Draught"}]}
        self.ok(self.finalize(self.player, battle_id, draft({self.key: unit_result(self.key)}, finds=finds)))

    def stash(self) -> list[tuple[int, int | None, int]]:
        return list(WarbandItem.objects.filter(warband=self.warband).values_list("item_id", "cost", "quantity"))

    def test_an_edit_mid_battle_lands_uses_and_finds_on_the_version(self):
        battle_id = self.to_active({self.player: [self.key], self.viewer: []})
        before = self.use(battle_id, self.potion.id)  # stored as the book item, which the hero carried then
        version = self.edit(self.potion.id, cost=14)  # the hero's copies move onto the version
        stale = self.use(battle_id, self.potion.id)  # a sheet read before the edit names the book id

        self.finalise_with_find(battle_id, self.potion.id)  # a find picked from a list read before the edit

        self.assertEqual((before, stale), (self.potion.id, version))
        self.assertEqual(HeroItem.objects.filter(hero=self.hero).count(), 0)  # both uses used a copy up
        self.assertEqual(self.stash(), [(version, 14, 1)])  # at the version's cost

    def test_a_revert_mid_battle_lands_uses_and_finds_on_the_book_item(self):
        version = self.edit(self.potion.id, cost=14)
        battle_id = self.to_active({self.player: [self.key], self.viewer: []})
        used = self.use(battle_id, version)
        self.revert(version)  # the version goes; the hero's copies are the book item's again

        self.finalise_with_find(battle_id, version)

        self.assertEqual(used, version)
        self.assertEqual(
            list(HeroItem.objects.filter(hero=self.hero).values_list("item_id", flat=True)), [self.potion.id]
        )
        self.assertEqual(self.stash(), [(self.potion.id, 10, 1)])

    def test_a_use_named_by_a_reverted_version_finds_the_book_copy(self):
        version = self.edit(self.potion.id, cost=14)
        self.revert(version)
        battle_id = self.to_active({self.player: [self.key], self.viewer: []})

        self.assertEqual(self.use(battle_id, version), self.potion.id)
