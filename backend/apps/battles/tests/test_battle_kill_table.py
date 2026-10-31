"""The battle_kill table (next step 9): one row per kill, written with its event, its constraints, and the data
migration that filled it from the kill events."""

from importlib import import_module
from typing import Any

from django.apps import apps as django_apps
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.battles.models import Battle, BattleEvent, BattleKill
from apps.warbands.models import Henchman, HenchmenGroup, Hero, Hireling

from .battle_support import BattleTestCase

fill_battle_kill = import_module("apps.battles.migrations.0006_fill_battle_kill").fill


class KillTableTestCase(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch", is_leader=True)
        self.group = HenchmenGroup.objects.create(warband=self.warband, name="Sisters", unit_type="Sister")
        self.sister = Henchman.objects.create(group=self.group, name="Ana")
        self.ogre = Hireling.objects.create(warband=self.warband, name="Gorg", unit_type="Ogre Bodyguard")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin", caster="Wizard")
        self.ended = Battle.objects.create(
            campaign=self.campaign, created_by_user=self.player, scenario="Bridge", status=Battle.STATUS_ENDED
        )

    def event(self, payload: dict[str, Any] | None = None, **fields: Any) -> BattleEvent:
        kind = BattleEvent.TYPE_UNIT_KILL_RECORDED
        return BattleEvent.objects.create(battle=self.ended, type=kind, payload_json=payload or {}, **fields)

    def row(self, **fields: Any) -> BattleKill:
        """A valid kill (the abbess takes out the rat in round 1), with `fields` changed."""
        columns: dict[str, Any] = {
            "battle": self.ended,
            "campaign": self.campaign,
            "event": self.event(),
            "round": 1,
            "phase": "fight",
            "killer_warband": self.warband,
            "killer_kind": "hero",
            "killer_hero": self.abbess,
            "victim_kind": "hero",
            "victim_warband": self.rival,
            "victim_hero": self.rat,
        }
        return BattleKill.objects.create(**(columns | fields))


class KillConstraintTests(KillTableTestCase):
    def test_each_kind_of_killer_and_victim_saves(self):
        self.row()
        self.row(killer_kind="henchman", killer_hero=None, killer_henchman=self.sister, killer_group=self.group)
        self.row(killer_kind="hireling", killer_hero=None, killer_hireling=self.ogre, how="other")
        self.row(victim_kind="temporary", victim_hero=None, victim_key="custom:dog", victim_name="War Dog")
        self.row(victim_kind="creature", victim_hero=None, victim_warband=None, victim_key="n1-2")
        self.row(victim_kind="someone_else", victim_hero=None, victim_warband=None, victim_name="Ogre")
        self.row(phase="after", round=None, victim_caster="Wizard")
        self.assertEqual(BattleKill.objects.count(), 7)

    def test_only_the_keys_matching_each_kind_may_be_set(self):
        cases: dict[str, dict[str, Any]] = {
            "killer_keys": {"killer_henchman": self.sister},  # a hero killer with a henchman's key
            "killer_keys ": {"killer_kind": "creature", "killer_hero": None},  # never a creature
            "killer_keys  ": {"killer_kind": "hireling"},  # a hired sword with a hero's key
            "victim_keys": {"victim_kind": "henchman", "victim_hireling": self.ogre},
            "victim_keys ": {"victim_kind": "temporary", "victim_key": "custom:dog"},  # a temporary victim isn't a row
            "victim_keys  ": {"victim_kind": "dragon", "victim_hero": None},
            "victim_warband": {"victim_kind": "creature", "victim_hero": None, "victim_key": "n1-1"},
            "victim_key": {"victim_kind": "temporary", "victim_hero": None},  # undo needs its key
            "victim_key ": {"victim_key": "hero:1"},  # a row's victim has none
            "battle_kill_phase": {"phase": "later"},
            "after_no_round": {"phase": "after"},  # logged after the fight: no round
            "battle_kill_how": {"how": "poison"},
            "victim_caster": {"victim_caster": "Shaman"},
        }
        for name, fields in cases.items():
            with self.subTest(constraint=name.strip()), self.assertRaises(IntegrityError), transaction.atomic():
                self.row(**fields)

    def test_a_kill_outlives_its_units(self):
        kill = self.row(killer_kind="henchman", killer_hero=None, killer_henchman=self.sister, killer_group=self.group)
        killer = self.row()
        self.group.delete()
        self.rat.delete()

        kill.refresh_from_db()
        killer.refresh_from_db()
        self.assertEqual((kill.killer_henchman_id, kill.killer_group_id, kill.victim_hero_id), (None, None, None))
        self.assertEqual((kill.killer_kind, kill.victim_kind, kill.killer_unit_key), ("henchman", "hero", None))
        self.assertEqual(killer.killer_unit_key, f"hero:{self.abbess.id}")

    def test_the_event_owns_its_kill(self):
        kill = self.row()
        kill.event.delete()
        self.assertFalse(BattleKill.objects.filter(id=kill.id).exists())


def unit(key: str, warband_id: int | None, name: str | None, type_name: str | None = None, **flags: Any) -> dict:
    kind, _, raw_id = key.partition(":")
    unit_id = int(raw_id) if raw_id.isdigit() else None
    return {"unit_key": key, "unit_type": kind, "unit_id": unit_id, "warband_id": warband_id, "name": name} | {
        "type_name": type_name,
        **flags,
    }


class KillDataMigrationTests(KillTableTestCase):
    """The data migration (0006) fills battle_kill from the kill and void events, so the data keeps its history."""

    def test_each_kill_event_becomes_its_row(self):
        abbess = unit(f"hero:{self.abbess.id}", self.warband.id, "Abbess", "Matriarch", is_leader=True)
        sister = unit(f"henchman:{self.sister.id}", self.warband.id, "Ana", "Sister")
        ogre = unit(f"hireling:{self.ogre.id}", self.warband.id, "Gorg", "Ogre Bodyguard")
        rat = unit(f"hero:{self.rat.id}", self.rival.id, "Rat", "Assassin", is_caster=True, caster_type="Wizard")
        dog = unit("custom:dog", self.rival.id, "War Dog", "Dog")
        hawk = unit("pet:hero:9", self.rival.id, "Hawk", "Pet")
        gone = unit("hero:999999", self.warband.id, "Gone", "Champion")
        zombie = {"unit_key": None, "unit_type": None, "warband_id": None, "name": "Zombie 2", "neutral_key": "n1-2"}
        typed = {"unit_key": None, "unit_type": None, "unit_id": None, "warband_id": None, "name": "Ogre"}
        when = timezone.now()
        events = {
            "hero": self.event({"killer": abbess, "victim": rat, "round": 2, "how": "magic", "victim_ooa": True}),
            "henchman": self.event({"killer": sister, "victim": zombie, "source": "battle", "earned_xp": False}),
            "hireling": self.event({"killer": ogre, "victim": dog, "source": "postbattle", "round": 3}),
            "typed": self.event({"killer": abbess, "victim": typed}, voided_at=when),
            "voided": self.event({"killer": abbess, "victim": hawk}),
            "gone": self.event({"killer": gone, "victim": typed}),
            "pet": self.event({"killer": hawk, "victim": abbess}),  # a pet never scores: skipped
            "nobody": self.event({"killer": unit("hero:1", 999999, "Ghost"), "victim": typed}),  # no warband: skipped
        }
        BattleEvent.objects.create(
            battle=self.ended, type="unit_kill_voided", payload_json={"voided_event_id": events["voided"].id}
        )

        fill_battle_kill(django_apps, None)
        fill_battle_kill(django_apps, None)  # again: nothing new

        kills = {kill.event_id: kill for kill in BattleKill.objects.all()}
        self.assertEqual(
            set(kills), {events[name].id for name in ("hero", "henchman", "hireling", "typed", "voided", "gone")}
        )
        hero = kills[events["hero"].id]
        self.assertEqual(
            (hero.killer_kind, hero.killer_hero_id, hero.killer_name, hero.killer_type, hero.killer_leader),
            ("hero", self.abbess.id, "Abbess", "Matriarch", True),
        )
        self.assertEqual((hero.round, hero.phase, hero.how, hero.earns_xp, hero.took_out_victim), (2, "fight", "magic", True, True))  # fmt: skip
        self.assertEqual(
            (hero.victim_kind, hero.victim_hero_id, hero.victim_warband_id, hero.victim_caster, hero.victim_name),
            ("hero", self.rat.id, self.rival.id, "Wizard", "Rat"),
        )
        self.assertEqual((hero.campaign_id, hero.created_at, hero.voided_at), (self.campaign.id, events["hero"].created_at, None))  # fmt: skip
        henchman = kills[events["henchman"].id]
        self.assertEqual(
            (henchman.killer_henchman_id, henchman.killer_group_id, henchman.earns_xp),
            (self.sister.id, self.group.id, False),
        )
        self.assertEqual(
            (henchman.victim_kind, henchman.victim_key, henchman.victim_warband_id, henchman.round),
            ("creature", "n1-2", None, None),
        )
        hireling = kills[events["hireling"].id]
        self.assertEqual((hireling.killer_hireling_id, hireling.phase, hireling.round), (self.ogre.id, "after", None))
        self.assertEqual(
            (hireling.victim_kind, hireling.victim_key, hireling.victim_warband_id, hireling.victim_type),
            ("temporary", "custom:dog", self.rival.id, "Dog"),
        )
        typed_kill = kills[events["typed"].id]
        self.assertEqual((typed_kill.victim_kind, typed_kill.victim_name, typed_kill.voided_at), ("someone_else", "Ogre", when))  # fmt: skip
        voided = kills[events["voided"].id]
        self.assertIsNotNone(voided.voided_at)  # named by a void event
        self.assertEqual((voided.victim_kind, voided.victim_key), ("temporary", "pet:hero:9"))
        gone_kill = kills[events["gone"].id]
        self.assertEqual(
            (gone_kill.killer_kind, gone_kill.killer_hero_id, gone_kill.killer_name), ("hero", None, "Gone")
        )


class KillWriteTests(BattleTestCase):
    """A kill writes its row in the fight and after it; undo voids it; the snapshot counts the live ones."""

    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"
        custom = {"key": "custom:dog", "name": "War Dog", "unit_type": "Dog", "stats": {}}
        self.battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        body = {"selected_unit_keys_json": [self.r, "custom:dog"], "custom_units_json": [custom]}
        self.ok(self.post_as(self.viewer, self.url(self.battle_id, "config"), body))

    def counts(self) -> dict[str, int]:
        state = self.ok(self.get_as(self.viewer, self.url(self.battle_id, "state"))).data
        mine = next(entry for entry in state["participants"] if entry["user"]["id"] == self.player.id)
        return {key: entry["kill_count"] for key, entry in mine["unit_information_json"].items()}

    def test_victims_of_every_kind_and_the_undo(self):
        neutral = {"name": "Zombies", "creature_type": "Zombie", "count": 2, "wounds": 1}
        self.ok(self.post_as(self.player, self.url(self.battle_id, "neutral-groups"), neutral), 201)
        dog = self.ok(self.kill(self.player, self.battle_id, self.a, "custom:dog", how="shooting"), 201).data
        zombie = self.ok(self.kill(self.player, self.battle_id, self.a, victim_neutral_key="n1-2", how="other"), 201)
        self.assertEqual(self.counts(), {self.a: 2})

        rows = BattleKill.objects.order_by("id")
        self.assertEqual(
            [(kill.victim_kind, kill.victim_key, kill.victim_warband_id, kill.how) for kill in rows],
            [("temporary", "custom:dog", self.rival.id, "shooting"), ("creature", "n1-2", None, "other")],
        )
        self.ok(
            self.post_as(self.player, f"{self.url(self.battle_id, 'events')}{zombie.data['events'][0]['id']}/void/")
        )

        self.assertIsNotNone(BattleKill.objects.get(event_id=zombie.data["events"][0]["id"]).voided_at)
        self.assertEqual(self.counts(), {self.a: 1})
        state = self.ok(self.get_as(self.viewer, self.url(self.battle_id, "state"))).data
        creature = state["battle"]["neutral_groups"][0]["creatures"][1]
        self.assertEqual(creature["status"], "standing")  # the undo stood it back up from its key
        self.assertTrue(BattleKill.objects.filter(event_id=dog["events"][0]["id"], voided_at__isnull=True).exists())

    def test_a_kill_after_the_fight_has_no_round(self):
        self.ok(self.finish_mine(self.player, self.battle_id, "won"))
        self.ok(self.kill(self.player, self.battle_id, self.a, victim_name="Ogre", source="postbattle"), 201)

        kill = BattleKill.objects.get()
        self.assertEqual((kill.phase, kill.round, kill.victim_kind), ("after", None, "someone_else"))
