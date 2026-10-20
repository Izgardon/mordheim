"""Dismissed units and henchmen are kept as records (decisions 3 and 4, ROST-TWEAK-02/03).

Dismissing sets `dismissed_at` instead of deleting rows. Every roster, battle, cap and trade then ignores
the unit, as it ignored a deleted one, while its kills keep counting in kill history and top killers.
"""

from typing import Any

from apps.battles.models import Battle, BattleParticipant
from apps.battles.services.rosters import battle_rosters_payload
from apps.trades.services.errors import TradeError
from apps.trades.services.offers import build_offer
from apps.warbands.models import Henchman, Hero

from .roster_support import HENCHMEN, HERO, HIRED_SWORD, KINDS, Kind, RosterTestCase, make_unit, unit_url


class DismissedUnitTests(RosterTestCase):
    def _dismiss(self, kind: Kind, unit: Any) -> None:
        response = self.client.delete(unit_url(kind, self.warband.id, unit.id))
        self.assertEqual(response.status_code, 204)

    def test_a_dismissed_unit_leaves_every_roster_read(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                kept, gone = make_unit(kind, self.warband, name="Kept"), make_unit(kind, self.warband, name="Gone")
                self._dismiss(kind, gone)

                for suffix in ("", "detail/"):
                    listed = self.client.get(unit_url(kind, self.warband.id, suffix=suffix)).json()
                    self.assertEqual([row["id"] for row in listed], [kept.id])
                self.assertEqual(self.client.get(unit_url(kind, self.warband.id, gone.id)).status_code, 404)
                sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()
                collection = {HERO.key: "heroes", HENCHMEN.key: "henchmen_groups", HIRED_SWORD.key: "hired_swords"}
                self.assertNotIn(gone.id, [row["id"] for row in sheet[collection[kind.key]]])
                self.assertNotIn(gone.id, [row["id"] for row in sheet["summary"][collection[kind.key]]])
                kind.model.objects.filter(id=kept.id).delete()

    def test_a_dismissed_unit_cannot_be_changed_dismissed_again_or_levelled(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1)
                self._dismiss(kind, unit)
                body = {"payload": {"advance": {"id": "WS"}}}

                self.assertEqual(self.client.delete(unit_url(kind, self.warband.id, unit.id)).status_code, 404)
                patched = self.client.patch(unit_url(kind, self.warband.id, unit.id), {"name": "X"}, format="json")
                self.assertEqual(patched.status_code, 404)
                levelled = self.client.post(unit_url(kind, self.warband.id, unit.id, "level-up/"), body, format="json")
                self.assertEqual(levelled.status_code, 404)
                self.assertEqual(kind.model.objects.get(id=unit.id).level_up, 1)

    def test_a_dismissed_unit_keeps_its_kill_history(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                if kind is HENCHMEN:
                    unit = make_unit(kind, self.warband, members=())
                    Henchman.objects.create(group=unit, name="Killer", kills=3)
                else:
                    unit = make_unit(kind, self.warband, kills=3)
                self._dismiss(kind, unit)

                history = self.client.get(unit_url(kind, self.warband.id, unit.id, "kill-history/"))
                self.assertEqual((history.status_code, history.json()["total_kills"]), (200, 3))

    def test_dismissed_units_and_members_still_count_in_top_killers(self):
        hero = make_unit(HERO, self.warband, name="Gone hero", kills=4)
        sword = make_unit(HIRED_SWORD, self.warband, name="Gone sword", kills=3)
        group = make_unit(HENCHMEN, self.warband, members=())
        Henchman.objects.create(group=group, name="Gone group member", kills=2)
        kept = make_unit(HENCHMEN, self.warband, members=())
        Henchman.objects.create(group=kept, name="Stays", kills=0)
        left_out = Henchman.objects.create(group=kept, name="Left out", kills=1)
        for kind, unit in ((HERO, hero), (HIRED_SWORD, sword), (HENCHMEN, group)):
            self._dismiss(kind, unit)
        stays = kept.henchmen.get(name="Stays")
        self.client.patch(unit_url(HENCHMEN, self.warband.id, kept.id), {"henchmen": [{"id": stays.id}]}, format="json")
        self.assertIsNotNone(Henchman.objects.get(id=left_out.id).dismissed_at)

        top = self.client.get(f"/api/campaigns/{self.campaign.id}/top-killers/").json()["top_killers"]

        names = [(row["unit_name"], row["kills"]) for row in top]
        self.assertEqual(names, [("Gone hero", 4), ("Gone sword", 3), ("Gone group member", 2), ("Left out", 1)])

    def test_dismissing_the_leader_crowns_the_next_living_hero(self):
        leader = make_unit(HERO, self.warband, is_leader=True)
        heir = make_unit(HERO, self.warband)

        self._dismiss(HERO, leader)

        self.assertEqual(list(Hero.objects.filter(is_leader=True).values_list("id", flat=True)), [heir.id])

    def test_dismissed_units_do_not_count_towards_the_caps(self):
        self.campaign_settings.max_heroes = 1
        self.campaign_settings.max_hired_swords = 1
        self.campaign_settings.save()
        for kind in (HERO, HIRED_SWORD):
            with self.subTest(kind=kind.key):
                self._dismiss(kind, make_unit(kind, self.warband))
                payload = {"name": "Replacement", "unit_type": "Trooper"}
                self.assertEqual(
                    self.client.post(unit_url(kind, self.warband.id), payload, format="json").status_code, 201
                )

    def test_a_dismissed_member_or_group_is_not_on_the_summary_or_rating(self):
        group = make_unit(HENCHMEN, self.warband, members=("Alpha", "Beta"))
        alpha = group.henchmen.get(name="Alpha")
        gone = make_unit(HENCHMEN, self.warband, members=("Gamma",))
        self.client.patch(
            unit_url(HENCHMEN, self.warband.id, group.id), {"henchmen": [{"id": alpha.id}]}, format="json"
        )
        self._dismiss(HENCHMEN, gone)

        summary = self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()

        self.assertEqual([row["id"] for row in summary["henchmen_groups"]], [group.id])
        self.assertEqual(summary["rating"], 5)  # one living member at 5 + 0 XP

    def test_battles_and_trades_ignore_dismissed_units(self):
        hero, gone_hero = make_unit(HERO, self.warband, name="Kept"), make_unit(HERO, self.warband, name="Gone")
        group = make_unit(HENCHMEN, self.warband, members=("Alpha", "Beta"))
        alpha = group.henchmen.get(name="Alpha")
        gone_group = make_unit(HENCHMEN, self.warband, members=("Gamma",))
        gone_sword = make_unit(HIRED_SWORD, self.warband)
        self._dismiss(HERO, gone_hero)
        self._dismiss(HENCHMEN, gone_group)
        self._dismiss(HIRED_SWORD, gone_sword)
        self.client.patch(
            unit_url(HENCHMEN, self.warband.id, group.id), {"henchmen": [{"id": alpha.id}]}, format="json"
        )
        battle = Battle.objects.create(campaign=self.campaign, created_by_user=self.player, scenario="Bridge")
        BattleParticipant.objects.create(battle=battle, user=self.player, warband=self.warband)

        roster = battle_rosters_payload(battle.id)[str(self.player.id)]

        self.assertEqual([entry["id"] for entry in roster["heroes"]], [hero.id])
        self.assertEqual(roster["hiredSwords"], [])
        self.assertEqual([entry["id"] for entry in roster["henchmenGroups"]], [group.id])
        self.assertEqual([member["id"] for member in roster["henchmenGroups"][0]["members"]], [alpha.id])
        with self.assertRaisesMessage(TradeError, "Trader not found."):
            build_offer({"trader_id": gone_hero.id}, self.warband.id)
