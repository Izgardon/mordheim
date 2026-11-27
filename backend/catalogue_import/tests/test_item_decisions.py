"""William's answers of 27 Nov 2026 to the items audit's decisions, as the committed `out/` holds them."""

from typing import Any

from catalogue_import.tests.review_support import ReviewCase


class PriceTests(ReviewCase):
    """Question 16 ("Just do B ignore book")."""

    def test_the_double_barrelled_pistols_brace_is_twice_the_single(self) -> None:
        brace = [row for row in self.items["Double-barrelled Pistol"]["availabilities"] if row["label"] == "Brace"]
        self.assertEqual([(row["cost"], row["dice"]) for row in brace], [(50, 2)])

    def test_the_channel_rats_compass_takes_the_pirates_dice(self) -> None:
        self.assertEqual(self.rows("Compass", "channel-rats"), [(45, 2, 9, "")])


class BombTests(ReviewCase):
    """Question 14 (A): every bomb is Miscellaneous, as the Fire and Smoke Bombs are, so none shows a weapon line and
    each says its range and Strength in its rules."""

    BOMBS = ("Acid Bomb", "Bait Bomb", "Stink Bomb", "Fire Bomb", "Smoke Bomb")

    def test_every_bomb_is_miscellaneous_with_no_weapon_line(self) -> None:
        for name in self.BOMBS:
            with self.subTest(item=name):
                item = self.items[name]
                self.assertEqual(
                    (item["type"], item["subtype"], item["range"], item["strength"]), ("Miscellaneous", "", "", "")
                )

    def test_the_innocents_bombs_say_their_range_and_strength_in_their_rules(self) -> None:
        for name in ("Acid Bomb", "Bait Bomb", "Stink Bomb"):
            with self.subTest(item=name):
                text = " ".join(rule["text"] for rule in self.items[name]["rules"])
                self.assertIn("a range of twice the thrower's Strength in inches", text)
        self.assertIn("D3 Strength 5 hits with no armour save", self.items["Acid Bomb"]["rules"][0]["text"])
        self.assertIn('within 1", friend or foe, takes one Strength 4 hit', self.items["Acid Bomb"]["rules"][0]["text"])


class StaffTests(ReviewCase):
    """Question 3: "Quarter staff is its own item with different rules, give it to people that have it, otherwise give
    mace to lists and staff as a nickname to hired swords that just have a mace/hammer named as a staff"."""

    def lines(self, slug: str, shown_as: str) -> list[str]:
        return [
            line["item"]["name"]
            for entry in self.templates[slug]["lists"]
            for line in entry["lines"]
            if line["shown_as"] == shown_as
        ]

    def test_a_lists_plain_staff_is_our_mace(self) -> None:
        for slug in (
            "adventurers",
            "mages",
            "nehekhara-tomb-guards",
            "tomb-guardians",
            "skaven-of-clan-pestilens-lustria",
            "skaven-of-clan-pestilens-mousillon",
        ):
            with self.subTest(template=slug):
                self.assertEqual(self.lines(slug, "Staff"), ["Mace"])

    def test_the_staff_tag_is_the_maces(self) -> None:
        self.assertIn("staff", self.items["Mace"]["tags"])
        self.assertNotIn("staff", self.items["Club"]["tags"])

    def test_the_quarter_staff_stays_with_the_lists_that_sell_it(self) -> None:
        sold = [
            line["item"]["name"]
            for entry in self.templates["battle-monks-of-cathay"]["lists"]
            for line in entry["lines"]
        ]
        self.assertIn("Quarter Staff", sold)

    def test_the_ninja_gnoblars_bo_is_an_item_of_its_own_no_store_sells(self) -> None:
        bo = self.items["Bo"]
        self.assertEqual(bo["availabilities"], [])
        self.assertEqual(
            [rule.get("rule") or rule["name"] for rule in bo["rules"]], ["Extra attack", "parry", "two-handed"]
        )


class MarienburgRowTests(ReviewCase):
    """Question 1 (B): a Mutiny in Marienburg price row counts only where Mutiny in Marienburg is in play."""

    CARRIED = ("Ostlander Double-barrelled Hunting Rifle", "Hunting Rifle", "War Boar", "Fish-Hook Shot")

    def marienburg(self, name: str) -> list[dict[str, object]]:
        return [row for row in self.items[name]["availabilities"] if row["label"] == "Mutiny in Marienburg"]

    def test_each_carried_row_is_in_the_marienburg_setting(self) -> None:
        for name in self.CARRIED:
            with self.subTest(item=name):
                self.assertEqual([row.get("setting") for row in self.marienburg(name)], ["mutiny-in-marienburg"])

    def test_no_book_row_of_ours_has_a_setting_of_its_own(self) -> None:
        rows = [row for item in self.items.values() for row in item["availabilities"] if row.get("setting")]
        self.assertEqual({row["label"] for row in rows}, {"Mutiny in Marienburg"})

    def test_the_wolfcloak_keeps_to_its_purchase_path(self) -> None:
        self.assertEqual(self.marienburg("Wolfcloak"), [])
        self.assertFalse(any(row["for_everyone"] for row in self.items["Wolfcloak"]["availabilities"]))


class SingleUseTests(ReviewCase):
    """Question 4 (A): the five whose text says they are used up and the twelve of a listed item's kind."""

    USED_UP = (
        "Corpse Liquor",
        "Silver Bullets/Arrows",
        "Stickfire Pot",
        "Vial of Pestilens",
        "Warpstone Token",
        "Dark Venom",
        "Mad Cap Mushrooms",
        "Lurking Fear",
        "Moonshine",
        "Manticore Spoor",
        "Spider Spittle",
        "Stardust",
        "Silver Powder",
        "Wolfsbane",
        "Grog",
        "Victuals",
        "Hardtack Biscuits",
    )

    def test_each_is_used_up_in_battle(self) -> None:
        for name in self.USED_UP:
            with self.subTest(item=name):
                self.assertTrue(self.items[name].get("single_use"))


class PerpetualTorchTests(ReviewCase):
    """Question 5 (A): the Roadwardens' Angry Mob torch is its own item, never used up."""

    def test_the_angry_mobs_torch_is_never_used_up(self) -> None:
        lines = [
            line
            for entry in self.templates["ostermark-roadwardens"]["lists"]
            for line in entry["lines"]
            if line["shown_as"] == "Torch (perpetual)"
        ]
        self.assertEqual([(line["item"]["name"], line["cost"]) for line in lines], [("Perpetual Torch", 5)])
        torch = self.items["Perpetual Torch"]
        self.assertFalse(torch.get("single_use"))
        self.assertIn("never used up", torch["rules"][0]["text"])
        self.assertTrue(self.items["Torch"]["single_use"])


class NoPriceTests(ReviewCase):
    """Question 7 (B): a row whose book prints no price says so; the Krakensilver Weapon's says its multiple."""

    def test_a_row_with_no_price_says_to_agree_one(self) -> None:
        for name in ("Bagh Nakh", "Bec de Corbin", "Firepots Miragliano", "Masterwork Heavy Armour", "Warpstone Token"):
            with self.subTest(item=name):
                rows = self.items[name]["availabilities"]
                self.assertEqual(
                    {(row["cost"], row["note"]) for row in rows}, {(None, "No price in the book: agree one.")}
                )

    def test_every_row_without_a_cost_says_what_to_pay(self) -> None:
        for item in self.items.values():
            for row in item["availabilities"]:
                if row["cost"] is None:
                    with self.subTest(item=item["name"]):
                        self.assertTrue(row["cost_note"] or row["note"].startswith("No price in the book"))

    def test_misericordia_keeps_its_ten_gold_crowns(self) -> None:
        self.assertEqual({row["cost"] for row in self.items["Misericordia"]["availabilities"]}, {10})


class CloakTests(ReviewCase):
    """Question 6 (C): the Kislev Ranger's Hunter's Cloak keeps a hidden shooter hidden, no Forest Cloak's effect."""

    def test_the_hunters_cloak_is_an_item_of_its_own_no_store_sells(self) -> None:
        cloak = self.items["Hunter's Cloak"]
        self.assertEqual((cloak["type"], cloak["availabilities"]), ("Miscellaneous", []))
        self.assertIn("does not reveal his position by shooting", cloak["rules"][0]["text"])


class JollyRogerTests(ReviewCase):
    """Question 8 (A): Sartosa's Banner - Jolly Roger is our Jolly Roger."""

    def test_one_jolly_roger_sold_to_the_pirates_and_sartosas_warbands(self) -> None:
        self.assertNotIn("Banner - Jolly Roger", self.items)
        self.assertEqual(self.rows("Jolly Roger", "pirates"), [(40, 2, 9, "")])
        self.assertEqual(
            self.rows("Jolly Roger", "sartosan-pirates"),
            [(40, 2, 9, "A banner in Sartosa, which a Navy warband never carries.")],
        )


class StagecoachTests(ReviewCase):
    """Question 9 (A): Marienburg's Trade Wagon/Stage Coach is our Wagon, Stagecoach."""

    def test_the_trade_wagon_is_the_merchant_caravans_alone(self) -> None:
        rows = self.items["Trade Wagon"]["availabilities"]
        self.assertEqual([(row["cost"], row["for_everyone"]) for row in rows], [(180, False)])
        self.assertNotIn("trade wagon/stage coach", self.items["Trade Wagon"]["tags"])
        self.assertIn("trade wagon/stage coach", self.items["Wagon, Stagecoach"]["tags"])


class NamedItemTests(ReviewCase):
    """Question 11 (A): each list links the item it names, Cleaver or Katar."""

    def sold(self, slug: str, item: str) -> list[tuple[str, str, int]]:
        return [
            (entry["key"], line["shown_as"], line["cost"])
            for entry in self.templates[slug]["lists"]
            for line in entry["lines"]
            if line["item"]["name"] == item
        ]

    def test_the_maneaters_cleaver_is_our_cleaver(self) -> None:
        self.assertEqual(
            self.sold("maneaters", "Cleaver"),
            [("ogre-equipment-list", "", 5), ("mountain-guide-equipment-list", "", 5)],
        )
        self.assertEqual(self.sold("maneaters", "Axe"), [])

    def test_the_araby_smugglers_axe_katar_is_our_katar(self) -> None:
        lists = ["corsair-equipment-list", "janissary-equipment-list", "slave-equipment-list"]
        self.assertEqual(self.sold("araby-smugglers", "Katar"), [(key, "", 5) for key in lists])
        self.assertEqual(self.sold("araby-smugglers", "Axe"), [])


class ItemRulesTests(ReviewCase):
    """Question 2 (D): an item whose book prints its rules has them; the rest warn on every price row."""

    NONE_IN_THE_BOOK = ("Bow", "Long Bow", "Short Bow")  # the rulebook's bows have their profile and no rules
    UNWRITTEN = "Rules not written yet: check the book."

    @staticmethod
    def has_rules(item: dict[str, Any]) -> bool:
        return any(rule.get("rule") or rule.get("text") for rule in item["rules"])

    def test_every_item_has_its_rules_or_says_they_are_not_written(self) -> None:
        for item in self.items.values():
            if item["type"] == "Animal" or item["name"] in self.NONE_IN_THE_BOOK or self.has_rules(item):
                continue
            with self.subTest(item=item["name"]):
                self.assertTrue(item["availabilities"])
                self.assertTrue(all(self.UNWRITTEN in row["note"] for row in item["availabilities"]))

    def test_the_books_rules_are_in(self) -> None:
        for name, words in (
            ("Longsword", "+1 Attack and Strike First"),
            ("Electric Trident", "stunned on an injury roll of 2-4"),
            ("Beastwhip", "+1 to his roll for the Difficulty when he goads"),
            ("Medicine Chest", "D6 doses of Healing Herbs"),
            ("Skinkskin Boots", "Aquatic special rule"),
            ("Throat Guard", "special 6+ save against every injury roll a vampire causes"),
        ):
            with self.subTest(item=name):
                self.assertIn(words, " ".join(rule.get("text", "") for rule in self.items[name]["rules"]))

    def test_the_two_shields_are_shields(self) -> None:
        for name in ("Holy Shield", "Shield of Sigmar"):
            with self.subTest(item=name):
                self.assertEqual((self.items[name]["save_bonus"], self.items[name]["save_slot"]), (1, "shield"))

    def test_a_scythe_and_a_familiar_of_another_effect_stay_apart(self) -> None:
        # question 10: the Sylvania Scythe strikes at +1 Strength, the Khemri one with Cutting Edge; the Sorcerous
        # Society's familiar is a pet, the Town Cryer's a re-roll
        self.assertEqual(self.items["Scythe"]["strength"], "As user +1")
        self.assertIn(
            {"rule": "cutting-edge"}, [{"rule": rule.get("rule")} for rule in self.items["Scythe (Khemri)"]["rules"]]
        )
        self.assertIn("Familiar", self.items)
        self.assertIn("Dog, Cat, Raven or Viper", self.items["Familiar (Sorcerous Society)"]["rules"][0]["text"])
