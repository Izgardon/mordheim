"""Creatures recruited into henchmen from their Animal item (the bestiary rewrite step 4): `POST beasts/recruit/`.

Copies of a creature's item leave a unit's items or the stash and become members of a new henchmen group, or of a
group already recruited from the same beast. No gold moves and no ledger row is written (it was paid for as an item).
A new group takes the beast's profile, skills and specials, its name as the type, its gains-XP flag as level-ups, an
optional race, and its price from the copies' cost. A group over its size or a warband over its size warns.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.bestiary.models import BestiaryEntrySkill, BestiaryEntrySpecial
from apps.warbands.models import HenchmenGroup, HeroItem, WarbandItem

from .beast_support import DOG_PROFILE, beast, make_animal, wardogs, warhorse
from .roster_support import HENCHMEN, HERO, RosterTestCase, log_rows, make_unit, trade_rows

URL = "/api/warbands/{}/beasts/recruit/"


class RecruitTestCase(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dogs = wardogs()
        self.beast = beast(self.dogs)
        BestiaryEntrySkill.objects.create(bestiary_entry=self.beast, skill=self.skills[0])
        BestiaryEntrySpecial.objects.create(bestiary_entry=self.beast, special=self.specials[0])

    def stock(self, quantity: int, cost: int | None = 30) -> None:
        WarbandItem.objects.create(warband=self.warband, item=self.dogs, quantity=quantity, cost=cost)

    def recruit(self, quantity: int = 1, source: dict[str, Any] | None = None, target: Any = None) -> Any:
        body = {
            "source": source or {"type": "stash", "item_id": self.dogs.id},
            "quantity": quantity,
            "target": target if target is not None else {"new": {"name": "Kennel"}},
        }
        return self.client.post(URL.format(self.warband.id), body, format="json")


class RecruitNewGroupTests(RecruitTestCase):
    def test_creatures_from_the_stash_form_a_new_group_with_the_beasts_profile(self):
        self.stock(2)

        response = self.recruit(2)

        self.assertEqual(response.status_code, 201, response.data)
        group = response.data["group"]
        fields = ("name", "unit_type", "price", "race_id", "no_level_ups", "source_beast_id", "beast_kind", "max_size")
        self.assertEqual({key: group[key] for key in fields}, {"name": "Kennel", "unit_type": "Wardogs", "price": 30, "race_id": None, "no_level_ups": True, "source_beast_id": self.beast.id, "beast_kind": "creature", "max_size": 5})  # fmt: skip
        self.assertEqual({key: group[key] for key in DOG_PROFILE}, DOG_PROFILE)
        self.assertEqual(len(group["henchmen"]), 2)
        self.assertEqual([skill["id"] for skill in group["skills"]], [self.skills[0].id])
        self.assertEqual([special["id"] for special in group["specials"]], [self.specials[0].id])
        answer = (response.data["source"], response.data["stash_item"], response.data["removed_stash_item_id"])
        self.assertEqual(answer, (None, None, self.dogs.id))
        self.assertFalse(WarbandItem.objects.filter(warband=self.warband).exists())
        self.assertEqual((response.data["warnings"], response.data["summary"]["unit_count"]), ([], 2))

    def test_no_gold_moves_and_the_recruit_is_logged(self):
        self.stock(2)

        self.recruit(2)

        self.assertEqual(trade_rows(self.warband), [])
        logs = [(row[0], row[1]) for row in log_rows(self.warband)]
        self.assertEqual(logs, [("personnel", "new_henchmen_group"), ("items", "moved")])
        self.assertEqual(log_rows(self.warband)[1][2], {"item": "Wardogs", "quantity": 2, "source_type": "stash", "source_name": None, "target_type": "henchmen_group", "target_name": "Kennel"})  # fmt: skip

    def test_a_creature_that_gains_xp_levels_up_and_a_race_may_be_named(self):
        self.beast.gains_xp = True
        self.beast.save()
        self.stock(1)

        group = self.recruit(target={"new": {"race_id": self.race.id}}).data["group"]

        self.assertEqual((group["no_level_ups"], group["race_id"], group["name"]), (False, self.race.id, "Wardogs"))

    def test_another_campaigns_race_is_refused_and_nothing_is_taken(self):
        self.stock(1)

        response = self.recruit(target={"new": {"race_id": self.foreign_race.id}})

        self.assertEqual((response.status_code, response.data["code"]), (400, "invalid"), response.data)
        self.assertIn("target.new.race", response.data["fields"])
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 1)
        self.assertFalse(HenchmenGroup.objects.exists())

    def test_creatures_in_a_units_items_are_recruited_from_there(self):
        hero = make_unit(HERO, self.warband, name="Aldric")
        HeroItem.objects.create(hero=hero, item=self.sword, cost=10)
        HeroItem.objects.create(hero=hero, item=self.dogs, cost=27)

        response = self.recruit(source={"type": "hero", "id": hero.id, "item_id": self.dogs.id})

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["group"]["price"], 27)
        self.assertEqual([item["name"] for item in response.data["source"]["items"]], ["Sword"])
        self.assertEqual(response.data["stash_item"], None)

    def test_an_unknown_cost_takes_the_items_current_price(self):
        self.stock(1, cost=None)

        self.assertEqual(self.recruit().data["group"]["price"], 25)

    def test_too_many_warn_and_a_big_group_warns(self):
        self.stock(6)

        response = self.recruit(6)

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual([warning["code"] for warning in response.data["warnings"]], ["group_over_size"])

    def test_the_query_count_doesnt_grow_with_the_quantity(self):
        self.stock(10)
        counts = []
        for quantity in (1, 5):
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.recruit(quantity).status_code, 201)
            counts.append(len(captured))
        self.assertEqual(counts[0], counts[1])


class RecruitJoinTests(RecruitTestCase):
    def test_creatures_join_a_group_of_the_same_beast(self):
        group = make_unit(HENCHMEN, self.warband, name="Kennel", members=("Rex",), price=30, source_beast=self.beast)
        self.stock(2, cost=33)

        response = self.recruit(2, target={"group_id": group.id})

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["group"]["id"], len(response.data["group"]["henchmen"])), (group.id, 3))
        self.assertEqual(response.data["group"]["price"], 30)  # the group's price stays
        self.assertEqual([row[1] for row in log_rows(self.warband)], ["moved"])

    def test_a_group_of_another_beast_or_none_is_refused_and_nothing_is_taken(self):
        others = (
            make_unit(HENCHMEN, self.warband),
            make_unit(HENCHMEN, self.warband, source_beast=beast(make_animal("Hounds", "creature"))),
        )
        self.stock(1)
        for group in others:
            response = self.recruit(target={"group_id": group.id})
            self.assertEqual((response.status_code, response.data["code"]), (400, "not_the_same_beast"))
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 1)

    def test_a_group_off_the_roster_is_not_found(self):
        group = make_unit(HENCHMEN, self.warband, source_beast=self.beast, dead=True)
        self.stock(1)

        self.assertEqual(self.recruit(target={"group_id": group.id}).status_code, 404)


class RecruitRefusalTests(RecruitTestCase):
    def test_only_a_creature_is_recruited(self):
        horse = warhorse()
        for item in (horse, self.sword):
            WarbandItem.objects.create(warband=self.warband, item=item, quantity=1)
            response = self.recruit(source={"type": "stash", "item_id": item.id})
            self.assertEqual((response.status_code, response.data["code"]), (400, "not_a_creature"), item.name)

    def test_too_few_copies_are_refused(self):
        self.stock(1)

        response = self.recruit(2)

        self.assertEqual((response.status_code, response.data["code"]), (400, "not_enough"))
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 1)

    def test_malformed_bodies(self):
        self.stock(1)
        for body, field in (
            ({"source": {"type": "hero", "item_id": self.dogs.id}, "target": {"new": {}}}, "source.id"),
            ({"source": {"type": "stash", "item_id": self.dogs.id}, "target": {}}, "target"),
            ({"source": {"type": "stash", "item_id": self.dogs.id}, "target": {"new": {}, "group_id": 1}}, "target"),
            ({"source": {"type": "stash", "item_id": self.dogs.id}}, "target"),
        ):
            response = self.client.post(URL.format(self.warband.id), body, format="json")
            self.assertEqual((response.status_code, response.data["code"]), (400, "invalid"), body)
            self.assertIn(field, response.data["fields"])

    def test_a_unit_off_the_roster_or_an_unknown_item_is_not_found(self):
        dead = make_unit(HERO, self.warband, dead=True)
        HeroItem.objects.create(hero=dead, item=self.dogs)

        self.assertEqual(self.recruit(source={"type": "hero", "id": dead.id, "item_id": self.dogs.id}).status_code, 404)
        self.assertEqual(self.recruit(source={"type": "stash", "item_id": 999999}).status_code, 404)

    def test_who_may_recruit(self):
        self.stock(3)
        for user, status in ((self.viewer, 403), (self.outsider, 404), (self.manager, 201)):
            self.client.force_authenticate(user=user)
            self.assertEqual(self.recruit().status_code, status, user.email)
