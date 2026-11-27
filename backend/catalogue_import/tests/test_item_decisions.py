"""William's answers of 27 Nov 2026 to the items audit's decisions, as the committed `out/` holds them."""

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
