"""Lad's Got Talent as one atomic call (decision 9, BUG-28, ROST-TWEAK-04).

POST /api/warbands/<id>/henchmen-groups/<group_id>/promote/ creates the hero (profile, XP, skills, specials, one
copy of each item) with one advance to take later and none taken now (William, 3 Nov 2026), dismisses the henchman
(and the group once nobody living is left) and logs. The group keeps its level-up for the rest of it to roll again:
the talent is recorded in its history, and can't come up again until that roll is spent (`talent_used`).
"""

from decimal import Decimal
from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.warbands.models import Henchman, HenchmenGroup, Hero, WarbandLog
from apps.warbands.units.services.promote import TALENT_USED

from .roster_support import HENCHMEN, HERO, RosterTestCase, cap_error, log_rows, make_unit, trade_rows, unit_url

STATS = {"movement": 4, "weapon_skill": 3, "ballistic_skill": 3, "strength": 3, "toughness": 3}
STATS |= {"wounds": 1, "initiative": 3, "attacks": 1, "leadership": 7}
PROMOTE_QUERY_BUDGET = (
    42  # whatever the roster size (test below); the response re-reads hero, group (its loadout kept) and summary
)


class PromoteTests(RosterTestCase):
    group: HenchmenGroup
    alpha: Henchman
    beta: Henchman

    def setUp(self) -> None:
        super().setUp()
        self.group = make_unit(
            HENCHMEN,
            self.warband,
            name="Zealots",
            unit_type="Warrior",
            race=self.race,
            price=25,
            xp=Decimal("7.5"),
            level_up=1,
            deeds="Held the bridge",
            armour_save=5,
            half_rate=True,
            members=("Alpha", "Beta"),
            **STATS,
        )
        self.alpha, self.beta = self.group.henchmen.order_by("id")
        Henchman.objects.filter(id=self.alpha.id).update(kills=2)
        for item, cost in ((self.sword, 10), (self.axe, None)):  # the loadout: a sword and an axe each
            self.group.henchmen_group_items.create(item=item, cost=cost)
        self.group.henchmen_group_skills.create(skill=self.skills[0])
        self.group.henchmen_group_specials.create(special=self.specials[0])
        self.group.henchmen_group_specials.create(special=self.wizard)

    def _promote(self, body: dict[str, Any], group: Any = None) -> Any:
        url = unit_url(HENCHMEN, self.warband.id, (group or self.group).id, "promote/")
        return self.client.post(url, body, format="json")

    def _body(self, **extra: Any) -> dict[str, Any]:
        return {"henchman_id": self.alpha.id, **extra}

    def test_the_hero_is_made_with_an_advance_to_take_and_the_group_keeps_its_level_up(self):
        response = self._promote(self._body())

        self.assertEqual(response.status_code, 201, response.data)
        body = response.json()
        hero = Hero.objects.get(id=body["hero"]["id"])
        expected = {"name": "Alpha", "unit_type": "Warrior", "race_id": self.race.id, "price": 0, "xp": Decimal("7.5")}
        expected |= {"level_up": 1, "deeds": "Held the bridge", "armour_save": 5, "half_rate": True}
        expected |= {"caster": "Wizard", "large": False, "kills": 0, "is_leader": True, **STATS}
        self.assertEqual({key: getattr(hero, key) for key in expected}, expected)
        self.assertEqual(hero.xp_high_water, Decimal("7.5"))
        self.assertEqual(
            list(hero.hero_items.order_by("id").values_list("item_id", "cost")),
            [(self.sword.id, 10), (self.axe.id, None)],
        )
        self.assertEqual(list(hero.hero_skills.values_list("skill_id", flat=True)), [self.skills[0].id])
        self.assertEqual(
            list(hero.hero_specials.order_by("id").values_list("special_id", flat=True)),
            [self.specials[0].id, self.wizard.id],
        )
        self.assertEqual(hero.level_up_history, [])  # his advance waits on his card

        self.group.refresh_from_db()
        self.assertEqual((self.group.level_up, [entry["code"] for entry in self.group.level_up_history]), (1, ["LGT"]))
        alpha = Henchman.objects.get(id=self.alpha.id)
        self.assertIsNotNone(alpha.dismissed_at)
        self.assertEqual(alpha.kills, 2)  # his kills stay with the group's records
        self.assertEqual(
            list(self.group.henchmen_group_items.values_list("item_id", flat=True)), [self.sword.id, self.axe.id]
        )
        self.assertEqual(trade_rows(self.warband), [])
        self.assertEqual(
            [(feature, entry_type) for feature, entry_type, _, _ in log_rows(self.warband)],
            [("personnel", "new_hero"), ("advance", "henchmen")],
        )
        group_log = WarbandLog.objects.get(warband=self.warband, entry_type="henchmen").payload
        self.assertEqual(
            group_log,
            {
                "group": "Zealots",
                "advance": {"id": "LGT", "label": "Lad's Got Talent"},
                "lads_got_talent": True,
                "henchman_id": self.alpha.id,
                "henchman_name": "Alpha",
                "hero_id": hero.id,
            },
        )
        base = f"/api/warbands/{self.warband.id}/"
        self.assertEqual(body["hero"], self.client.get(unit_url(HERO, self.warband.id, hero.id)).json())
        self.assertEqual(body["group"], self.client.get(unit_url(HENCHMEN, self.warband.id, self.group.id)).json())
        self.assertEqual(body["summary"], self.client.get(f"{base}summary/").json())
        self.assertEqual([member["name"] for member in body["group"]["henchmen"]], ["Beta"])

    def test_promoting_the_last_living_member_dismisses_the_group(self):
        Henchman.objects.filter(id=self.beta.id).update(dead=True)

        response = self._promote(self._body())

        self.assertEqual((response.status_code, response.json()["group"]), (201, None))
        self.group.refresh_from_db()
        self.assertIsNotNone(self.group.dismissed_at)
        self.assertEqual(log_rows(self.warband)[-1][:2], ("personnel", "remove_henchmen_group"))

    def test_an_unnamed_henchman_is_named_by_his_place(self):
        Henchman.objects.filter(id=self.beta.id).update(name="  ")
        response = self._promote({"henchman_id": self.beta.id})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.json()["hero"]["name"], "Henchman 2")

    def test_at_the_hero_cap_it_is_refused_unless_a_hero_is_dismissed_to_make_room(self):
        self.campaign_settings.max_heroes = 1
        self.campaign_settings.save()
        leader = make_unit(HERO, self.warband, name="Old leader", is_leader=True)

        refused = self._promote(self._body())

        self.assertEqual((refused.status_code, refused.json()), (400, cap_error("Warband already has 1 heroes")))
        self.assertEqual(Hero.objects.filter(warband=self.warband).count(), 1)
        self.group.refresh_from_db()
        self.assertEqual((self.group.level_up, self.group.henchmen_group_items.count()), (1, 2))
        self.assertIsNone(Henchman.objects.get(id=self.alpha.id).dismissed_at)
        self.assertEqual(log_rows(self.warband), [])

        made_room = self._promote(self._body(dismiss_hero_id=leader.id))

        self.assertEqual(made_room.status_code, 201, made_room.data)
        self.assertIsNotNone(Hero.objects.get(id=leader.id).dismissed_at)
        leaders = list(Hero.objects.filter(warband=self.warband, is_leader=True).values_list("id", flat=True))
        self.assertEqual(leaders, [made_room.json()["hero"]["id"]])

    def test_bad_requests_are_field_errors_and_change_nothing(self):
        other_group = make_unit(HENCHMEN, self.warband, members=("Stranger",))
        fallen = Henchman.objects.create(group=self.group, name="Fallen", dead=True)
        cases: list[tuple[dict[str, Any], str]] = [
            ({}, "henchman_id"),
            (self._body(henchman_id=fallen.id), "henchman_id"),
            (self._body(henchman_id=other_group.henchmen.get().id), "henchman_id"),
            (self._body(henchman_id="abc"), "henchman_id"),
            (self._body(dismiss_hero_id=make_unit(HERO, self.rival).id), "dismiss_hero_id"),
        ]
        for body, field in cases:
            with self.subTest(body=body):
                response = self._promote(body)
                self.assertEqual(response.status_code, 400)
                self.assertEqual((response.json()["code"], list(response.json()["fields"])), ("invalid", [field]))
        self.group.refresh_from_db()
        self.assertEqual((self.group.level_up, Hero.objects.filter(warband=self.warband).count()), (1, 0))
        self.assertEqual(log_rows(self.warband), [])

    def test_the_talent_comes_up_once_an_advance_until_the_group_rolls_it_again(self):
        self.assertEqual(self._promote(self._body()).status_code, 201)

        repeat = self._promote({"henchman_id": self.beta.id})
        rolled = self.client.post(
            unit_url(HENCHMEN, self.warband.id, self.group.id, "level-up/"),
            {"payload": {"advance": {"id": "I"}}},
            format="json",
        )
        spent = self._promote({"henchman_id": self.beta.id})

        expected = {"detail": TALENT_USED, "code": "talent_used", "fields": {}}
        self.assertEqual((repeat.status_code, repeat.json()), (400, expected))
        self.assertEqual((rolled.status_code, rolled.json()["level_up"]), (200, 0))  # the rest of the group's roll
        self.assertEqual(spent.json()["code"], "no_level_ups")
        self.assertEqual(Hero.objects.filter(warband=self.warband).count(), 1)
        HenchmenGroup.objects.filter(id=self.group.id).update(level_up=1)
        self.assertEqual(self._promote({"henchman_id": self.beta.id}).status_code, 201)  # a later advance may again

    def test_without_a_level_up_or_with_no_level_ups_it_is_refused(self):
        HenchmenGroup.objects.filter(id=self.group.id).update(level_up=0)
        self.assertEqual(self._promote(self._body()).json()["code"], "no_level_ups")
        HenchmenGroup.objects.filter(id=self.group.id).update(level_up=1, no_level_ups=True)
        self.assertEqual(self._promote(self._body()).json()["code"], "no_level_ups")
        self.assertEqual(Hero.objects.filter(warband=self.warband).count(), 0)

    def test_access(self):
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self._promote(self._body()).status_code, 403)
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self._promote(self._body()).status_code, 404)
        self.client.force_authenticate(user=self.admin)
        gone = make_unit(HENCHMEN, self.warband, dismissed_at="2026-01-01T00:00:00Z")
        self.assertEqual(self._promote(self._body(), group=gone).status_code, 404)
        self.assertEqual(self._promote(self._body()).status_code, 201)

    def test_queries_do_not_grow_with_the_roster(self):
        def promote_one() -> int:
            group = make_unit(HENCHMEN, self.warband, level_up=1, members=("A", "B"))
            group.henchmen_group_items.create(item=self.sword, cost=10)
            body = {"henchman_id": group.henchmen.order_by("id")[0].id}
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self._promote(body, group=group).status_code, 201)
            return len(captured)

        self.campaign_settings.max_heroes = 50
        self.campaign_settings.save()
        first = promote_one()
        for index in range(4):
            make_unit(HERO, self.warband, name=f"Extra {index}")
            make_unit(HENCHMEN, self.warband, members=("X", "Y", "Z"))
        self.assertEqual(promote_one(), first)
        # one request instead of the chain's three (create 14, level-up 12, group PATCH 17 or DELETE 7 queries)
        self.assertLessEqual(first, PROMOTE_QUERY_BUDGET)
