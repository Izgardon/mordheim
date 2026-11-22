"""An Animal item's rules on a unit's card: its beast's profile and specials ride with the copy (William, 22 Nov 2026:
"Polecat doesn't show details on unit card when clicked").

Most beasts keep their rules on the bestiary entry, not as item rules, so a unit payload's copy carries its beast as
the catalogue's item does (`bestiary_entry`), switched on or not. It is read with the item rows (`with_beasts`), so a
roster with more beasts costs no more queries.
"""

from typing import Any

from apps.core.testing import count_get_queries
from apps.items.models import Item
from apps.special.models import Special
from apps.warbands.models import HenchmenGroupItem, HeroItem, HirelingItem

from .beast_support import raven, teach, warhorse
from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit, unit_url


class ItemBeastRulesTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.polecat = raven()  # a pet without a profile
        self.cat_friend = Special.objects.create(name="Cat Friend", type="Animal", description="Hates cats.")
        teach(self.polecat, specials=(self.cat_friend,))
        self.horse = warhorse()
        self.hero = make_unit(HERO, self.warband, name="Aldric")

    def item_of(self, url: str, name: str) -> dict[str, Any]:
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        heroes = response.data["heroes"] if "heroes" in response.data else response.data
        unit = next(unit for unit in heroes if unit["id"] == self.hero.id)
        return next(item for item in unit["items"] if item["name"] == name)

    def test_a_carried_pet_lists_its_beasts_specials_switched_on_or_not(self):
        HeroItem.objects.create(hero=self.hero, item=self.polecat)

        for url in (f"/api/warbands/{self.warband.id}/sheet/", unit_url(HERO, self.warband.id, suffix="detail/")):
            with self.subTest(url=url):
                beast = self.item_of(url, "Raven")["bestiary_entry"]
                self.assertEqual(beast["kind"], "pet")
                self.assertFalse(beast["has_profile"])
                self.assertEqual(
                    beast["specials"], [{"id": self.cat_friend.id, "name": "Cat Friend", "description": "Hates cats."}]
                )

    def test_a_mount_carries_its_profile_and_any_other_item_none(self):
        HeroItem.objects.create(hero=self.hero, item=self.horse)
        sword = Item.objects.create(name="Plain Test Blade", type="Weapon")
        HeroItem.objects.create(hero=self.hero, item=sword)
        url = f"/api/warbands/{self.warband.id}/sheet/"

        beast = self.item_of(url, "Warhorse")["bestiary_entry"]

        self.assertEqual((beast["has_profile"], beast["movement"], beast["leadership"]), (True, 8, 5))
        self.assertIsNone(self.item_of(url, "Plain Test Blade")["bestiary_entry"])

    def carry(self, count: int) -> None:
        for _ in range(count):
            HeroItem.objects.create(hero=make_unit(HERO, self.warband), item=self.polecat)
            HenchmenGroupItem.objects.create(
                henchmen_group=make_unit(HENCHMEN, self.warband, members=("A",)), item=self.horse
            )
            HirelingItem.objects.create(hireling=make_unit(HIRELING, self.warband), item=self.polecat)

    def test_the_sheet_and_the_detail_lists_read_them_in_a_fixed_number_of_queries(self):
        urls = [f"/api/warbands/{self.warband.id}/sheet/"]
        urls += [unit_url(kind, self.warband.id, suffix="detail/") for kind in (HERO, HENCHMEN, HIRELING)]
        self.carry(1)
        few = {url: count_get_queries(self.client, url) for url in urls}

        self.carry(3)

        self.assertEqual({url: count_get_queries(self.client, url) for url in urls}, few)
