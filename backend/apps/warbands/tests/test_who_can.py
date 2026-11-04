"""Who can buy, hire and learn (the items rebuild): the price row each item offers a warband, through its type, the
types it counts as and their groups (`services/who_can.py`), and `GET warbands/<id>/who-can/`."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import CampaignType
from apps.hirelings.models import DramatisPersona, HiredSword
from apps.items.models import Item, ItemAvailability, ItemAvailabilityWarband
from apps.skills.models import Skill, SkillGroup, SkillGroupSkill, SkillGroupWarband
from apps.warbands.models import WarbandGroup, WarbandType

from .roster_support import RosterTestCase

STATS = {"movement": 4, "weapon_skill": 3, "ballistic_skill": 3, "strength": 3, "toughness": 3}
STATS |= {"wounds": 1, "initiative": 3, "attacks": 1, "leadership": 7}


class WhoCanTestCase(RosterTestCase):
    """The player's warband is Skaven of Clan Pestilens (in the groups Skaven and Evil) and counts as Lizardmen."""

    pestilens: WarbandType
    eshin: WarbandType
    lizardmen: WarbandType
    reiklanders: WarbandType
    skaven: WarbandGroup
    humans: WarbandGroup
    khemri: CampaignType

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.pestilens = WarbandType.objects.create(name="Skaven of Clan Pestilens", slug="pestilens")
        cls.eshin = WarbandType.objects.create(name="Skaven of Clan Eshin", slug="eshin")
        cls.lizardmen = WarbandType.objects.create(name="Lizardmen", slug="lizardmen")
        cls.reiklanders = WarbandType.objects.create(name="Reiklanders", slug="reiklanders")
        cls.skaven = WarbandGroup.objects.create(slug="skaven", name="Skaven", kind="race")
        cls.skaven.members.add(cls.pestilens, cls.eshin)
        cls.humans = WarbandGroup.objects.create(slug="humans", name="Humans", kind="race")
        cls.humans.members.add(cls.reiklanders)
        cls.khemri = CampaignType.objects.create(slug="khemri", name="Khemri", grade="1b")
        cls.warband.warband_type = cls.pestilens
        cls.warband.save(update_fields=["warband_type"])
        cls.warband.counts_as.add(cls.lizardmen)

    def item(self, name: str, *rows: dict[str, Any], **fields: Any) -> Item:
        """A book item (`campaign` for the campaign's own) with price rows, each `{cost, rarity, label, everyone,
        types, groups, not_types, not_groups}`."""
        item = Item.objects.create(name=name, type="Weapon", **fields)
        for row in rows:
            written = ItemAvailability.objects.create(
                item=item,
                cost=row.get("cost", 10),
                rarity=row.get("rarity"),
                label=row.get("label", ""),
                for_everyone=row.get("everyone", False),
            )
            self.lines(written, ItemAvailabilityWarband, "availability", row)
        return item

    def lines(self, owner: Any, model: Any, field: str, row: dict[str, Any]) -> None:
        for key, excluded, column in (
            ("types", False, "warband_type"),
            ("groups", False, "warband_group"),
            ("not_types", True, "warband_type"),
            ("not_groups", True, "warband_group"),
        ):
            for target in row.get(key, []):
                model.objects.create(**{field: owner, column: target, "excluded": excluded})

    def group(self, name: str, *skills: Skill, everyone: bool = False, **row: Any) -> SkillGroup:
        """A book skill group holding `skills`, open to everyone or to the lines `row` names (as `lines` reads)."""
        group = SkillGroup.objects.create(name=name, for_everyone=everyone)
        SkillGroupSkill.objects.bulk_create([SkillGroupSkill(group=group, skill=skill) for skill in skills])
        self.lines(group, SkillGroupWarband, "group", row)
        return group

    def who_can(self) -> dict[str, Any]:
        response = self.client.get(f"/api/warbands/{self.warband.id}/who-can/")
        self.assertEqual(response.status_code, 200, response.content)
        body: dict[str, Any] = response.json()
        return body

    def offers(self) -> dict[int, dict[str, Any]]:
        return {offer["item_id"]: offer for offer in self.who_can()["items"]}


class PriceRowChoiceTests(WhoCanTestCase):
    def test_each_step_type_then_group_then_everyone_then_not_usually(self) -> None:
        mine = self.item("Weeping Blades", {"types": [self.pestilens]})
        group = self.item("Fighting Claws", {"groups": [self.skaven]})
        everyone = self.item("Short Sword", {"everyone": True})
        other = self.item("Halberd", {"types": [self.reiklanders]}, {"groups": [self.humans], "cost": 5})

        offers = self.offers()

        for item in (mine, group, everyone):
            with self.subTest(item=item.name):
                self.assertEqual((offers[item.id]["can_buy"], offers[item.id]["reason"]), (True, ""))
        first = other.availabilities.order_by("id").first()
        assert first is not None
        self.assertEqual(
            (offers[other.id]["can_buy"], offers[other.id]["availability_id"], offers[other.id]["options"]),
            (False, first.id, [first.id]),
        )
        self.assertEqual(offers[other.id]["reason"], "Not usually available to Skaven of Clan Pestilens.")

    def test_a_row_naming_the_type_beats_a_group_row_and_everyone(self) -> None:
        blowpipe = self.item(
            "Blowpipe",
            {"everyone": True, "cost": 1},
            {"groups": [self.skaven], "cost": 2},
            {"types": [self.pestilens, self.eshin, self.reiklanders], "rarity": 7, "cost": 25},
            {"types": [self.pestilens], "cost": 25},
        )
        rows = list(blowpipe.availabilities.order_by("id").values_list("id", flat=True))

        offer = self.offers()[blowpipe.id]

        # step 1 first, the row naming fewer warbands (the more specific) before the wider one; then the group's;
        # then everyone's
        self.assertEqual((offer["availability_id"], offer["options"]), (rows[3], [rows[3], rows[2], rows[1], rows[0]]))

    def test_a_type_it_counts_as_is_its_own_and_a_labelled_row_is_never_the_default(self) -> None:
        spear = self.item("Lizard Spear", {"types": [self.lizardmen]})
        pistol = self.item("Pistol", {"label": "Brace", "everyone": True, "cost": 30}, {"everyone": True, "cost": 15})
        brace, single = pistol.availabilities.order_by("id")

        offers = self.offers()

        self.assertTrue(offers[spear.id]["can_buy"])
        self.assertEqual((offers[pistol.id]["availability_id"], offers[pistol.id]["options"]), (single.id, [single.id, brace.id]))  # fmt: skip

    def test_an_exclusion_of_its_type_or_group_shuts_out_an_everyone_row(self) -> None:
        wardogs = self.item("Wardogs", {"everyone": True, "not_groups": [self.skaven]})
        lotus = self.item("Black Lotus", {"everyone": True, "not_types": [self.pestilens]})
        nobody = self.item("Fist", {"everyone": False})
        others = self.item("Tome of Magic", {"everyone": True, "not_groups": [self.humans]})

        offers = self.offers()

        self.assertEqual([offers[item.id]["can_buy"] for item in (wardogs, lotus, nobody)], [False, False, False])
        self.assertTrue(offers[others.id]["can_buy"])
        self.assertEqual(offers[wardogs.id]["reason"], "Not usually available to Skaven of Clan Pestilens.")

    def test_a_setting_not_ticked_is_not_usually_available_and_named_and_custom_items_always_show(self) -> None:
        scorpion = self.item("Scorpion Ring", {"everyone": True}, campaign_type=self.khemri)
        barred = self.item("Bota Bag", {"groups": [self.humans]}, campaign_type=self.khemri)
        house = self.item("House Ring", {"everyone": True}, campaign=self.campaign, campaign_type=None)
        empty = Item.objects.create(name="Nothing to buy", type="Weapon")

        offers = self.offers()

        self.assertEqual((offers[scorpion.id]["can_buy"], offers[scorpion.id]["reason"]), (False, "Khemri isn't in this campaign."))  # fmt: skip
        self.assertEqual(
            offers[barred.id]["reason"],
            "Not usually available to Skaven of Clan Pestilens. Khemri isn't in this campaign.",
        )
        self.assertTrue(offers[house.id]["can_buy"])
        self.assertNotIn(empty.id, offers)  # nothing to buy
        self.campaign.campaign_types.add(self.khemri)
        self.assertEqual(self.offers()[scorpion.id]["can_buy"], True)

    def test_a_warband_without_a_type_buys_only_what_is_for_everyone(self) -> None:
        self.warband.warband_type = None
        self.warband.save(update_fields=["warband_type"])
        self.warband.counts_as.clear()
        sword = self.item("Short Sword", {"everyone": True})
        claws = self.item("Fighting Claws", {"groups": [self.skaven]})

        offers = self.offers()

        self.assertEqual((offers[sword.id]["can_buy"], offers[claws.id]["can_buy"]), (True, False))
        self.assertEqual(offers[claws.id]["reason"], "Not usually available to this warband.")


class WhoCanHireAndLearnTests(WhoCanTestCase):
    def hireling(self, model: Any, name: str, **row: Any) -> Any:
        entry = model.objects.create(name=name, for_everyone=row.pop("everyone", False), **STATS)
        relation: Any = model._meta.get_field("warband_links")
        self.lines(entry, relation.related_model, relation.field.name, row)
        return entry

    def test_who_can_hire_reads_the_list_as_items_do(self) -> None:
        ratcatcher = self.hireling(HiredSword, "Ratcatcher", groups=[self.skaven])
        knight = self.hireling(HiredSword, "Knight", types=[self.reiklanders])
        slayer = self.hireling(HiredSword, "Troll Slayer", everyone=True, not_groups=[self.skaven])
        johann = self.hireling(DramatisPersona, "Johann", everyone=True, not_types=[self.reiklanders])
        tomb = self.hireling(HiredSword, "Tomb Robber", everyone=True)
        HiredSword.objects.filter(pk=tomb.pk).update(campaign_type=self.khemri)

        body = self.who_can()

        hired = {row["id"]: (row["can_hire"], row["reason"]) for row in body["hired_swords"]}
        not_usually = "Not usually available to Skaven of Clan Pestilens."
        self.assertEqual(
            [hired[entry.id] for entry in (ratcatcher, knight, slayer, tomb)],
            [(True, ""), (False, not_usually), (False, not_usually), (False, "Khemri isn't in this campaign.")],
        )
        self.assertEqual(body["dramatis_personae"], [{"id": johann.id, "can_hire": True, "reason": ""}])

    def test_the_groups_open_to_it_and_the_special_skills_its_types_may_learn(self) -> None:
        tail, leap, sprint, rally = (Skill.objects.create(name=name) for name in ("Tail", "Leap", "Sprint", "Rally"))
        skaven = self.group("Skaven", tail, groups=[self.skaven])
        lizards = self.group("Lizardmen", leap, types=[self.lizardmen])  # a type it counts as
        speed = self.group("Speed", sprint, everyone=True)  # for everyone: open, but not its special skills
        self.group("Reiklanders", rally, types=[self.reiklanders])
        shut = self.group("Shut", leap, everyone=True, not_groups=[self.skaven])

        body = self.who_can()

        # the core groups first (the roster's Combat, then Speed), then by name
        self.assertEqual(body["skill_group_ids"], [self.combat.id, speed.id, lizards.id, skaven.id])
        self.assertNotIn(shut.id, body["skill_group_ids"])
        self.assertEqual(body["special_skill_ids"], sorted([tail.id, leap.id]))

    def test_a_skill_in_several_of_its_groups_is_one_special_skill_as_the_campaigns_current_entry(self) -> None:
        infiltration = Skill.objects.create(name="Infiltration")
        self.group("Skaven", infiltration, groups=[self.skaven])
        self.group("Pestilens", infiltration, types=[self.pestilens])
        version = Skill.objects.create(name="Infiltration", campaign=self.campaign, replaces=infiltration)

        self.assertEqual(self.who_can()["special_skill_ids"], [version.id])


class WhoCanReadTests(WhoCanTestCase):
    def test_any_member_reads_it_in_a_fixed_number_of_queries(self) -> None:
        def count() -> int:
            with CaptureQueriesContext(connection) as captured:
                self.who_can()
            return len(captured)

        self.item("Short Sword", {"everyone": True, "not_groups": [self.humans]})
        HiredSword.objects.create(name="Ratcatcher", **STATS).warband_links.create(warband_group=self.skaven)
        DramatisPersona.objects.create(name="Johann", **STATS).warband_links.create(warband_group=self.skaven)
        self.group("Skaven", Skill.objects.create(name="Tail Fighting"), groups=[self.skaven])
        before = count()
        for index in range(3):
            self.item(f"Blade {index}", {"types": [self.pestilens]}, {"groups": [self.skaven]})
            HiredSword.objects.create(name=f"Sword {index}", **STATS).warband_links.create(warband_type=self.eshin)
            self.group(f"Tricks {index}", Skill.objects.create(name=f"Trick {index}"), groups=[self.skaven])

        self.assertEqual(count(), before)
        # the warband and the membership, its types, the items, their rows and the rows' lines, each hireling kind
        # and its lines, the skill groups, their lines and their skills
        self.assertEqual(before, 13)
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self.client.get(f"/api/warbands/{self.warband.id}/who-can/").status_code, 200)
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self.client.get(f"/api/warbands/{self.warband.id}/who-can/").status_code, 404)

    def test_the_groups_list_names_every_race_and_side(self) -> None:
        response = self.client.get("/api/warband-groups/")

        self.assertEqual(
            [(row["slug"], row["kind"]) for row in response.json()], [("humans", "race"), ("skaven", "race")]
        )
