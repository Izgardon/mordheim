"""Concurrency: two battle writes at once (pass 3, step 0; BATL-TEST-16, BUG-44, BUG-106, BUG-121).

Each test runs two real requests on two threads (two database connections), held at a deterministic point:
a `Rendezvous` patched in between a read and a write, or events that order one request's commit inside the
other's read-to-write gap. Every battle write locks the battle row first, so today two finalises serialise
(the second waits at the lock while the first holds the rendezvous, which gives up after its timeout).

A config save racing a kill keeps the kill (BUG-44, fixed in PR A: config merges into what is stored). Clear
racing Approve is an expected failure until its fix (BUG-121: the unlocked decline lands after the approval). If a
patched helper is renamed, move the hold point to the new read-to-write gap.
"""

import threading
import unittest
from collections.abc import Callable
from typing import Any
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.battles.views import combat, lifecycle, shared
from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole, PivotalMoment
from apps.core.testing import Rendezvous, run_concurrently
from apps.notifications.models import Notification
from apps.warbands.models import Hero, Warband
from apps.warbands.units import hooks

from .battle_support import draft, unit_result


def first_call_waits(rendezvous: Rendezvous, function: Callable[..., Any]) -> Callable[..., Any]:
    """`function`, waiting at the rendezvous on its first call only."""
    calls: list[int] = []

    def waiting(*args: Any, **kwargs: Any) -> Any:
        if not calls:
            calls.append(1)
            rendezvous.wait()
        return function(*args, **kwargs)

    return waiting


@override_settings(RATE_LIMIT_ENABLED=False)
class BattleConcurrencyTests(TransactionTestCase):
    def setUp(self) -> None:
        role = CampaignRole.objects.get_or_create(slug="player", defaults={"name": "Player"})[0]
        self.campaign = Campaign.objects.create(name="Shards", join_code="RACE03")
        users = [
            get_user_model().objects.create_user(username=email, email=email, password=None, first_name=email[:5])
            for email in ("player@example.com", "viewer@example.com")
        ]
        self.player, self.viewer = users
        warbands = []
        for user, name in zip(users, ("Monks", "Rats"), strict=True):
            CampaignMembership.objects.create(campaign=self.campaign, user=user, role=role)
            warbands.append(Warband.objects.create(campaign=self.campaign, user=user, name=name, faction="Any"))
        self.warband, self.rival = warbands
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch", is_leader=True)
        self.novice = Hero.objects.create(warband=self.warband, name="Novice", unit_type="Novice")
        self.sister = Hero.objects.create(warband=self.warband, name="Sister", unit_type="Sister")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin", is_leader=True)
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"

    def battle(self, status: str, participant_status: str) -> Battle:
        battle = Battle.objects.create(
            campaign=self.campaign,
            created_by_user=self.player,
            scenario="Bridge",
            status=status,
            winner_warband_ids_json=[self.warband.id],
        )
        for user, warband, key in ((self.player, self.warband, self.a), (self.viewer, self.rival, self.r)):
            BattleParticipant.objects.create(
                battle=battle, user=user, warband=warband, status=participant_status, selected_unit_keys_json=[key]
            )
        return battle

    def request(self, user: Any, method: str, url: str, body: dict[str, Any] | None = None) -> Callable[[], int]:
        def call() -> int:
            client = APIClient(raise_request_exception=False)  # a crash or deadlock answers 500 like production
            client.force_authenticate(user=user)
            return int(getattr(client, method)(url, body or {}, format="json").status_code)

        return call

    def battle_url(self, battle: Battle, action: str) -> str:
        return f"/api/campaigns/{self.campaign.id}/battles/{battle.id}/{action}/"

    def test_two_players_finalising_at_once_end_the_battle_once(self):
        # BATL-TEST-16: both confirmed, one battle_ended, pivotal moments and the trading reset once. The rendezvous
        # sits before the "has everyone finished?" check, where two unlocked finalises would each miss the other.
        battle = self.battle(Battle.STATUS_POSTBATTLE, BattleParticipant.STATUS_FINISHED_BATTLE)
        Hero.objects.update(trading_action=False)
        rendezvous = Rendezvous()
        real_check = combat._all_started_participants_confirmed
        real_reset = shared._reset_trading_actions_for_battle_participants
        url = self.battle_url(battle, "finalize-postbattle")
        sides = ((self.player, self.a), (self.viewer, self.r))

        with (
            mock.patch.object(combat, "_all_started_participants_confirmed", side_effect=rendezvous.before(real_check)),
            mock.patch.object(shared, "_reset_trading_actions_for_battle_participants", wraps=real_reset) as resets,
        ):
            statuses = run_concurrently(
                *(
                    self.request(user, "post", url, {"postbattle_json": draft({key: unit_result(key)})})
                    for user, key in sides
                )
            )

        self.assertEqual(statuses, [200, 200])
        battle.refresh_from_db()
        self.assertEqual(battle.status, Battle.STATUS_ENDED)
        participants = BattleParticipant.objects.filter(battle=battle).order_by("id")
        self.assertEqual(list(participants.values_list("status", flat=True)), ["confirmed_postbattle"] * 2)
        self.assertEqual(BattleEvent.objects.filter(battle=battle, type="battle_ended").count(), 1)
        moments = PivotalMoment.objects.filter(battle=battle).values_list("warband_id", "kind")
        self.assertEqual(list(moments), [(self.warband.id, "untouched_triumph")])
        self.assertEqual(resets.call_count, 1)
        self.assertEqual(list(Hero.objects.values_list("trading_action", flat=True).distinct()), [True])

    def test_finalise_and_a_leader_patch_on_the_same_warband_both_succeed(self):
        # BUG-106: finalise locks the warband row itself (since PERF-37 the participant join no longer does) before
        # it touches a hero, the same order as the hero PATCH (warband, then heroes): one waits for the other,
        # nothing deadlocks, and exactly one living leader is left.
        battle = self.battle(Battle.STATUS_POSTBATTLE, BattleParticipant.STATUS_FINISHED_BATTLE)
        rendezvous = Rendezvous()
        real_validate = combat._validate_postbattle_json_for_participant
        finalise = {"postbattle_json": draft({self.a: unit_result(self.a, dead=True)})}

        with (
            mock.patch.object(
                combat, "_validate_postbattle_json_for_participant", side_effect=rendezvous.before(real_validate)
            ),
            mock.patch.object(hooks, "lock_warband", side_effect=rendezvous.before(hooks.lock_warband)),
        ):
            statuses = run_concurrently(
                self.request(self.player, "post", self.battle_url(battle, "finalize-postbattle"), finalise),
                self.request(
                    self.player,
                    "patch",
                    f"/api/warbands/{self.warband.id}/heroes/{self.sister.id}/",
                    {"is_leader": True},
                ),
            )

        self.assertEqual(statuses, [200, 200])
        self.abbess.refresh_from_db()
        self.assertEqual((self.abbess.dead, self.abbess.is_leader), (True, False))
        leaders = Hero.objects.filter(warband=self.warband, is_leader=True)
        self.assertEqual([(hero.dead, hero.dismissed_at) for hero in leaders], [(False, None)])

    def test_a_config_save_racing_a_kill_keeps_the_kill(self):
        # BUG-44: the kill commits while the config save, built before it, waits for the battle lock; the save then
        # merges its wound into what is stored and keeps the kill (it wrote back the stale kill_count 0 before).
        battle = self.battle(Battle.STATUS_ACTIVE, BattleParticipant.STATUS_IN_BATTLE)
        rendezvous = Rendezvous()
        real_payload = combat._build_battle_unit_event_payload
        real_load = lifecycle._get_user_battle_participant
        stale = {"unit_information_json": {self.a: {"current_wounds": 1, "kill_count": 0}}}

        with (
            mock.patch.object(
                combat, "_build_battle_unit_event_payload", side_effect=first_call_waits(rendezvous, real_payload)
            ),
            mock.patch.object(lifecycle, "_get_user_battle_participant", side_effect=rendezvous.before(real_load)),
        ):
            statuses = run_concurrently(
                self.request(
                    self.player,
                    "post",
                    self.battle_url(battle, "unit-kill"),
                    {"killer_unit_key": self.a, "victim_unit_key": self.r},
                ),
                self.request(self.player, "post", self.battle_url(battle, "config"), stale),
            )

        self.assertEqual(statuses, [201, 200])
        info = BattleParticipant.objects.get(battle=battle, user=self.player).unit_information_json[self.a]
        self.assertEqual((info["kill_count"], info["current_wounds"]), (1, 1))

    @unittest.expectedFailure
    def test_clearing_a_result_request_while_approving_it_leaves_a_consistent_battle(self):
        # BUG-121 (expected failure until PR A). Clear reads the pending result unlocked; the same player's Approve
        # commits in between (wins and losses added, battle ended); Clear then declines and cancels the battle.
        battle = self.battle(Battle.STATUS_REPORTED_RESULT_PENDING, BattleParticipant.STATUS_REPORTED_RESULT_PENDING)
        Battle.objects.filter(id=battle.id).update(flow_type=Battle.FLOW_TYPE_REPORTED_RESULT)
        BattleParticipant.objects.filter(battle=battle, user=self.player).update(
            status=BattleParticipant.STATUS_REPORTED_RESULT_APPROVED
        )
        notification = Notification.objects.create(
            user=self.viewer,
            campaign_id=self.campaign.id,
            notification_type=Notification.TYPE_BATTLE_RESULT_REQUEST,
            reference_id=str(battle.id),
            payload={},
        )
        clear_has_read, approved = threading.Event(), threading.Event()
        role = threading.local()
        real_save = BattleParticipant.save

        def save(participant: BattleParticipant, *args: Any, **kwargs: Any) -> None:
            if getattr(role, "name", None) == "clear":  # Clear's first write: its reads are done
                clear_has_read.set()
                approved.wait(timeout=2)
            real_save(participant, *args, **kwargs)

        def clear() -> int:
            role.name = "clear"
            return self.request(self.viewer, "post", f"/api/notifications/{notification.id}/clear/")()

        def approve() -> int:
            clear_has_read.wait(timeout=2)
            try:
                return self.request(self.viewer, "post", self.battle_url(battle, "approve-result"))()
            finally:
                approved.set()

        with mock.patch.object(BattleParticipant, "save", autospec=True, side_effect=save):
            run_concurrently(clear, approve)

        battle.refresh_from_db()
        wins, losses = Warband.objects.get(id=self.warband.id).wins, Warband.objects.get(id=self.rival.id).losses
        self.assertIn(
            (battle.status, wins, losses), [("ended", 1, 1), ("canceled", None, None)]
        )  # today canceled, 1, 1
