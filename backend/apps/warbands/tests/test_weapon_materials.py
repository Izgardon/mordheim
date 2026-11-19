"""Weapon materials (William, 19 Nov 2026): a material is a modifier on a weapon, not an item.

The four were catalogue items, so buying one gave the warband a "Gromril Weapon" row that was not a weapon. Now the
copy the warband owns carries one: the store offers it when a weapon is bought, the server derives the price (four
times the weapon's, three times it, or 60 gc on top), the copy reads "Gromril Sword" everywhere, and silver can be
put on a weapon the warband already owns, which is the only one the book lets a warband add later.
"""

from typing import Any

from apps.campaigns.models import CampaignType
from apps.items.materials import GROMRIL, ITHILMAR, MATERIALS, OBSIDIAN, SILVER
from apps.items.models import Item, ItemAvailability
from apps.warbands.models import LedgerAction, WarbandGroup, WarbandItem, WarbandTrade, WarbandType

from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit


class MaterialRegistryTests(RosterTestCase):
    def test_each_material_prices_the_weapon_it_is_made_of(self) -> None:
        # the book: gromril and obsidian cost four times the weapon, ithilmar three times, silver 60 gc on top
        self.assertEqual(
            [GROMRIL.price(25), ITHILMAR.price(25), OBSIDIAN.price(25), SILVER.price(25)], [100, 75, 100, 85]
        )
        self.assertEqual([material.rarity for material in MATERIALS.values()], [11, 9, 12, 11])
        # only silver can be put on a weapon the warband already owns, at the book's 80 gc in all
        self.assertEqual([slug for slug, row in MATERIALS.items() if row.on_owned], ["silver"])
        self.assertEqual(SILVER.on_owned, 80)

    def test_every_material_carries_the_books_rule_text(self) -> None:
        self.assertIn("an extra -1 save modifier", GROMRIL.rules[0].text)
        self.assertIn("+1 Initiative in hand-to-hand combat", ITHILMAR.rules[0].text)
        self.assertIn("always strikes last, even when charging", OBSIDIAN.rules[1].text)
        self.assertIn(
            "may never be used by Dwarfs, Elves, Sisters of Sigmar, Witch Hunters or Priests", OBSIDIAN.rules[0].text
        )
        self.assertIn("each wound causes D3 wounds", SILVER.rules[0].text)


class MaterialBuyingTests(RosterTestCase):
    """The store buys a weapon made of a material: the server prices it and the copy keeps it."""

    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.player)
        self.weapon = Item.objects.create(name="Great Sword", type="Weapon", strength="As user", range="Close combat")
        row = ItemAvailability.objects.create(item=self.weapon, cost=25)
        row.for_everyone = True
        row.save(update_fields=["for_everyone"])
        self.row = row

    def _buy(self, **body: Any) -> Any:
        return self.client.post(f"/api/warbands/{self.warband.id}/purchases/", body, format="json")

    def test_the_server_charges_four_times_the_weapons_price_for_gromril(self) -> None:
        hero = make_unit(HERO, self.warband)
        gold = self.warband.gold

        response = self._buy(
            target_type="hero",
            target_id=hero.id,
            item_id=self.weapon.id,
            availability_id=self.row.id,
            material="gromril",
        )

        self.assertEqual(response.status_code, 201)
        self.warband.refresh_from_db()
        self.assertEqual(gold - self.warband.gold, 100)  # 4 x 25, never the client's arithmetic
        copy = hero.hero_items.get()
        self.assertEqual((copy.material, copy.cost), ("gromril", 100))
        self.assertEqual(response.json()["items"][0]["material_name"], "Gromril Great Sword")
        self.assertEqual(WarbandTrade.objects.get(action=LedgerAction.BUY).description, "Gromril Great Sword")

    def test_silver_adds_sixty_gold_to_the_weapons_price(self) -> None:
        hero = make_unit(HERO, self.warband)
        gold = self.warband.gold

        self._buy(
            target_type="hero",
            target_id=hero.id,
            item_id=self.weapon.id,
            availability_id=self.row.id,
            material="silver",
        )

        self.warband.refresh_from_db()
        self.assertEqual(gold - self.warband.gold, 85)

    def test_a_price_typed_in_is_what_it_is(self) -> None:
        # every roll and every price can be typed in: a material never multiplies what the player wrote
        hero = make_unit(HERO, self.warband)
        gold = self.warband.gold

        self._buy(target_type="hero", target_id=hero.id, item_id=self.weapon.id, price=40, material="gromril")

        self.warband.refresh_from_db()
        self.assertEqual(gold - self.warband.gold, 40)
        self.assertEqual(hero.hero_items.get().material, "gromril")

    def test_the_catalogue_sends_each_rows_price_for_every_material(self) -> None:
        response = self.client.get(f"/api/items/{self.weapon.id}/?campaign_id={self.campaign.id}")

        prices = response.json()["material_prices"]
        self.assertEqual(prices[str(self.row.id)], {"gromril": 100, "ithilmar": 75, "obsidian": 100, "silver": 85})

    def test_a_weapon_bought_for_the_stash_is_its_own_row_and_its_own_name(self) -> None:
        self._buy(target_type="stash", item_id=self.weapon.id, availability_id=self.row.id, material="gromril")
        self._buy(target_type="stash", item_id=self.weapon.id, availability_id=self.row.id)

        rows = self.client.get(f"/api/warbands/{self.warband.id}/items/").json()
        self.assertEqual(
            [(row["material"], row["material_name"], row["cost"]) for row in rows],
            [("", "Great Sword", 25), ("gromril", "Gromril Great Sword", 100)],
        )

    def test_a_henchmen_group_buys_one_for_each_member_as_one_row(self) -> None:
        group = make_unit(HENCHMEN, self.warband)
        group.henchmen.create(name="One")
        group.henchmen.create(name="Two")

        self._buy(
            target_type="henchmen_group",
            target_id=group.id,
            item_id=self.weapon.id,
            availability_id=self.row.id,
            material="ithilmar",
        )

        self.assertEqual([(row.material, row.cost) for row in group.henchmen_group_items.all()], [("ithilmar", 75)])

    def test_a_hired_swords_copy_keeps_its_material(self) -> None:
        hireling = make_unit(HIRELING, self.warband)

        self._buy(
            target_type="hireling",
            target_id=hireling.id,
            item_id=self.weapon.id,
            availability_id=self.row.id,
            material="obsidian",
        )

        self.assertEqual(hireling.hireling_items.get().material, "obsidian")

    def test_an_unknown_material_is_refused(self) -> None:
        hero = make_unit(HERO, self.warband)

        response = self._buy(target_type="hero", target_id=hero.id, item_id=self.weapon.id, material="mithril")

        self.assertEqual(response.status_code, 400)
        self.assertIn("material", response.json()["fields"])


class MaterialOnAnOwnedWeaponTests(RosterTestCase):
    """`POST item-materials/`: the book lets a warband silver a weapon it already owns, and nothing else."""

    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.player)

    def _apply(self, **body: Any) -> Any:
        return self.client.post(f"/api/warbands/{self.warband.id}/item-materials/", body, format="json")

    def test_silvering_a_heros_weapon_charges_the_books_eighty_gold(self) -> None:
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.sword, cost=10)
        gold = self.warband.gold

        response = self._apply(source_type="hero", source_id=hero.id, item_id=self.sword.id, material="silver")

        self.assertEqual(response.status_code, 200)
        self.warband.refresh_from_db()
        self.assertEqual(gold - self.warband.gold, 80)
        self.assertEqual(hero.hero_items.get().material, "silver")
        self.assertEqual(WarbandTrade.objects.get(action=LedgerAction.BUY).description, "Silver Sword")

    def test_silvering_a_weapon_in_the_stash_moves_one_copy_to_its_own_row(self) -> None:
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=10)

        body = self._apply(source_type="stash", item_id=self.sword.id, material="silver").json()

        held = WarbandItem.objects.filter(warband=self.warband).order_by("material")
        self.assertEqual([(row.material, row.quantity, row.cost) for row in held], [("", 1, 10), ("silver", 1, 10)])
        self.assertEqual(body["stash_item"]["material_name"], "Silver Sword")

    def test_a_price_typed_in_wins_over_the_books(self) -> None:
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.sword, cost=10)
        gold = self.warband.gold

        self._apply(source_type="hero", source_id=hero.id, item_id=self.sword.id, material="silver", price=50)

        self.warband.refresh_from_db()
        self.assertEqual(gold - self.warband.gold, 50)

    def test_a_material_the_book_only_gives_at_the_forge_is_refused(self) -> None:
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.sword, cost=10)

        response = self._apply(source_type="hero", source_id=hero.id, item_id=self.sword.id, material="gromril")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.warband.gold, self.warband.__class__.objects.get(pk=self.warband.pk).gold)

    def test_a_weapon_the_warband_does_not_hold_is_refused_and_charges_nothing(self) -> None:
        hero = make_unit(HERO, self.warband)
        gold = self.warband.gold

        response = self._apply(source_type="hero", source_id=hero.id, item_id=self.sword.id, material="silver")

        self.assertEqual(response.status_code, 400)
        self.warband.refresh_from_db()
        self.assertEqual(self.warband.gold, gold)  # the whole request rolled back


class MaterialWhoCanTests(RosterTestCase):
    """Obsidian's rule names who may never use it, so who-can words it: a warning, never a block."""

    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.player)

    def _materials(self) -> dict[str, dict[str, Any]]:
        response = self.client.get(f"/api/warbands/{self.warband.id}/who-can/")
        return {row["slug"]: row for row in response.json()["materials"]}

    def test_a_warband_of_an_excluded_type_is_warned_in_the_servers_words(self) -> None:
        sisters = WarbandType.objects.get(slug="sisters-of-sigmar")
        self.warband.warband_type = sisters
        self.warband.save(update_fields=["warband_type"])

        obsidian = self._materials()["obsidian"]

        self.assertFalse(obsidian["can_take"])
        self.assertIn("Not usually available to Sisters of Sigmar.", obsidian["reason"])

    def test_a_warband_in_an_excluded_group_is_warned_too(self) -> None:
        dwarfs = WarbandType.objects.create(name="Dwarf Treasure Hunters", slug="dwarf-treasure-hunters")
        WarbandGroup.objects.create(slug="dwarfs", name="Dwarfs", kind="race").members.add(dwarfs)
        self.warband.warband_type = dwarfs
        self.warband.save(update_fields=["warband_type"])

        self.assertFalse(self._materials()["obsidian"]["can_take"])

    def test_any_other_warband_may_take_the_materials_its_campaign_has_in_play(self) -> None:
        mercenaries = WarbandType.objects.create(name="Reiklanders", slug="reiklanders")
        self.warband.warband_type = mercenaries
        self.warband.save(update_fields=["warband_type"])

        materials = self._materials()

        # Mordheim is always on, so gromril and ithilmar are in; the campaign has ticked neither Mordheim 1c
        # (obsidian) nor Grade 3 (silver), which reads as any other restriction does
        self.assertEqual([row["can_take"] for row in materials.values()], [True, True, False, False])
        self.assertEqual(materials["gromril"]["price_note"], "4 x Price")
        self.assertEqual(materials["silver"]["on_owned"], 80)
        self.assertEqual(materials["ithilmar"]["rarity"], 9)
        self.assertEqual(materials["silver"]["addition"], 60)

    def test_a_setting_the_campaign_has_not_ticked_is_named(self) -> None:
        setting = CampaignType.objects.create(name="Mordheim 1c", slug="mordheim-1c", grade="1c")

        self.assertEqual(self._materials()["obsidian"]["reason"], "Mordheim 1c isn't in this campaign.")

        self.campaign.campaign_types.add(setting)

        self.assertTrue(self._materials()["obsidian"]["can_take"])


class MaterialMovesTests(RosterTestCase):
    """A copy keeps what it is made of wherever it goes, and is moved and sold as itself."""

    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.player)

    def test_moving_a_gromril_copy_to_the_stash_keeps_it_apart_from_the_plain_one(self) -> None:
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.sword, cost=40, material="gromril")
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=10)

        body = self.client.post(
            f"/api/warbands/{self.warband.id}/item-transfers/",
            {
                "source_type": "hero",
                "source_id": hero.id,
                "target_type": "stash",
                "item_id": self.sword.id,
                "quantity": 1,
                "material": "gromril",
            },
            format="json",
        ).json()

        self.assertEqual(body["stash_item"]["material_name"], "Gromril Sword")
        held = WarbandItem.objects.filter(warband=self.warband).order_by("material")
        self.assertEqual([(row.material, row.quantity) for row in held], [("", 1), ("gromril", 1)])

    def test_a_gromril_copys_suggested_sale_price_is_half_its_materials_price(self) -> None:
        # the Sword lists at 10, so a gromril one is 40 now: half of that, rounded up as all gold is
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.sword, cost=40, material="gromril")

        rows = self.client.get(f"/api/warbands/{self.warband.id}/heroes/{hero.id}/").json()["items"]

        self.assertEqual((rows[0]["current_price"], rows[0]["suggested_sale_price"]), (40, 20))

    def test_a_patch_that_resends_the_items_list_leaves_the_material_alone(self) -> None:
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.sword, cost=40, material="gromril")

        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/heroes/{hero.id}/",
            {"items": [{"id": self.sword.id, "cost": 40}], "updated_at": hero.updated_at.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(hero.hero_items.get().material, "gromril")

    def test_a_patch_may_say_a_copy_is_plain(self) -> None:
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.sword, cost=40, material="gromril")

        self.client.patch(
            f"/api/warbands/{self.warband.id}/heroes/{hero.id}/",
            {"items": [{"id": self.sword.id, "cost": 10, "material": ""}], "updated_at": hero.updated_at.isoformat()},
            format="json",
        )

        self.assertEqual(hero.hero_items.get().material, "")
