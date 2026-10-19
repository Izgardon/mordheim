"""Battle setup characterised: create, accept, ready and start (pass 3, step 0).

See battle_support.py for the fixtures. The busy refusal is pinned for decision 1 (warn and allow) and the
creator-only start for decision 4 (any participant, after a confirm).
"""

from typing import Any

from django.utils import timezone

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.notifications.models import Notification
from apps.warbands.models import Hero, Warband

from .battle_support import BattleTestCase, status_changed

BATTLE_KEYS = [
    "id",
    "campaign_id",
    "created_by_user_id",
    "flow_type",
    "status",
    "scenario",
    "scenario_link",
    "winner_warband_ids_json",
    "created_at",
    "updated_at",
    "started_at",
    "ended_at",
    "post_processed_at",
    "channel",
    "state_version",
    "last_activity_at",
    "closes_at",
    "overdue",
    "results_pending",
    "results_confirmer_user_id",
]
PARTICIPANT_KEYS = [
    "id",
    "battle_id",
    "status",
    "last_seen_at",
    "selected_unit_keys_json",
    "unit_information_json",
    "custom_units_json",
    "battle_notes",
    "declared_result",
    "user",
    "warband",
    "invited_by_user_id",
    "invited_at",
    "responded_at",
    "joined_at",
    "ready_at",
    "canceled_at",
    "battle_joined_at",
    "finished_at",
    "confirmed_at",
    "skipped_postbattle",
    "declared_rating",
    "postbattle_json",
]


class BattleCreateTests(BattleTestCase):
    def _open_battle(self, battle_status: str, participant_status: str) -> Battle:
        battle = Battle.objects.create(
            campaign=self.campaign, created_by_user=self.viewer, scenario="Old", status=battle_status
        )
        BattleParticipant.objects.create(battle=battle, user=self.viewer, warband=self.rival, status=participant_status)
        return battle

    def test_create_invites_everyone_and_answers_the_snapshot(self):
        body = {"participant_user_ids": [self.viewer.id], "scenario": " Bridge ", "participant_ratings": {}}
        response = self.ok(self.post_as(self.player, self.battles_url(), body), 201)

        data = response.data
        battle_id = data["battle"]["id"]
        self.assertEqual(list(data), ["battle", "participants", "events"])
        self.assertEqual(list(data["battle"]), BATTLE_KEYS)
        self.assertEqual(list(data["participants"][0]), PARTICIPANT_KEYS)
        self.assertEqual((data["battle"]["status"], data["battle"]["scenario"]), ("inviting", "Bridge"))
        self.assertEqual(data["battle"]["channel"], f"private-battle-{battle_id}")
        self.assertEqual(self.statuses(battle_id), ["accepted", "invited"])
        self.assertEqual([event["type"] for event in data["events"]], ["battle_created"])
        self.assertEqual(
            data["events"][0]["payload_json"],
            {"participant_user_ids": sorted([self.player.id, self.viewer.id]), "scenario": "Bridge"},
        )
        invite = Notification.objects.get(user=self.viewer, notification_type=Notification.TYPE_BATTLE_INVITE)
        self.assertEqual((invite.reference_id, invite.is_resolved), (str(battle_id), False))
        self.assertEqual(self.notified(), [(self.viewer.id, "battle_invite")])
        self.assertEqual(self.user_events.call_args.args[2]["notification_id"], invite.id)
        self.assertEqual(self.sent(), ["battle_created"])

    def test_create_warns_about_players_in_an_open_battle(self):
        # BUG-10, decision 1 (BATL-TWEAK-01, BATL-NEW-01): busy players were refused; now the battle is created and
        # the answer says who is busy where, the creator included
        for battle_status, participant_status in (
            (Battle.STATUS_INVITING, BattleParticipant.STATUS_INVITED),
            (Battle.STATUS_PREBATTLE, BattleParticipant.STATUS_READY),
            (Battle.STATUS_ACTIVE, BattleParticipant.STATUS_IN_BATTLE),
            (Battle.STATUS_POSTBATTLE, BattleParticipant.STATUS_FINISHED_BATTLE),
        ):
            with self.subTest(phase=battle_status):
                old = self._open_battle(battle_status, participant_status)
                body = {"participant_user_ids": [self.viewer.id], "scenario": "Bridge"}
                data = self.ok(self.post_as(self.player, self.battles_url(), body), 201).data
                self.assertEqual(
                    data["warnings"],
                    [
                        {
                            "code": "player_busy",
                            "message": f"viewe is already in an unfinished battle (#{old.id}, {battle_status}).",
                            "user_id": self.viewer.id,
                            "battle_id": old.id,
                            "battle_status": battle_status,
                            "last_activity_at": old.last_activity_at.isoformat(),
                        }
                    ],
                )
                Battle.objects.filter(scenario="Bridge").delete()
                old.delete()

        mine = self._open_battle(Battle.STATUS_POSTBATTLE, BattleParticipant.STATUS_FINISHED_BATTLE)
        data = self.ok(self.post_as(self.viewer, self.battles_url(), {"participant_user_ids": [self.player.id], "scenario": "Ford"}), 201).data  # fmt: skip
        self.assertEqual(
            data["warnings"][0]["message"], f"You already have an unfinished battle (#{mine.id}, postbattle)."
        )

    def test_finished_cancelled_and_reported_battles_do_not_make_a_player_busy(self):
        self._open_battle(Battle.STATUS_POSTBATTLE, BattleParticipant.STATUS_CONFIRMED_POSTBATTLE)
        self._open_battle(Battle.STATUS_PREBATTLE, BattleParticipant.STATUS_CANCELED_PREBATTLE)
        self._open_battle(Battle.STATUS_ENDED, BattleParticipant.STATUS_IN_BATTLE)
        reported = self._open_battle(Battle.STATUS_REPORTED_RESULT_PENDING, BattleParticipant.STATUS_INVITED)
        Battle.objects.filter(id=reported.id).update(flow_type=Battle.FLOW_TYPE_REPORTED_RESULT)

        self.create_battle()

    def test_create_validation(self):
        outsider_id, no_warband_id, viewer_id = self.outsider.id, self.campaign_owner.id, self.viewer.id
        cases: list[tuple[dict[str, Any], str]] = [
            ({"participant_user_ids": [viewer_id]}, "scenario is required"),
            ({"participant_user_ids": [viewer_id], "scenario": "  "}, "scenario is required"),
            ({"participant_user_ids": [viewer_id], "scenario": "x" * 121}, "scenario must be at most 120 characters"),
            ({"participant_user_ids": "all", "scenario": "B"}, "participant_user_ids must be a list"),
            ({"participant_user_ids": ["x"], "scenario": "B"}, "participant_user_ids must be integers"),
            ({"participant_user_ids": [outsider_id], "scenario": "B"}, "One or more participants are not in this campaign"),
            ({"participant_user_ids": [no_warband_id], "scenario": "B"}, "All participants need a warband"),
            ({"scenario": "B"}, "All participants need a warband"),  # no list: every member, warband or not
            ({"participant_user_ids": [viewer_id], "scenario": "B", "participant_ratings": []}, "participant_ratings must be an object"),
            ({"participant_user_ids": [viewer_id], "scenario": "B", "participant_ratings": {str(viewer_id): "x"}}, f"Invalid rating for user {viewer_id}"),
            ({"participant_user_ids": [viewer_id], "scenario": "B", "participant_ratings": {str(viewer_id): -1}}, f"Rating must be zero or greater for user {viewer_id}"),
        ]  # fmt: skip
        for body, detail in cases:
            with self.subTest(detail=detail, body=body):
                response = self.post_as(self.player, self.battles_url(), body)
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        self.assertEqual(self.post_as(self.outsider, self.battles_url(), {"scenario": "B"}).status_code, 404)
        self.assertFalse(Battle.objects.exists())

    def test_ratings_and_link_are_stored_per_participant(self):
        body = {
            "participant_user_ids": [self.viewer.id],
            "scenario": "Bridge",
            "scenario_link": " https://example.com/bridge ",
            "participant_ratings": {str(self.viewer.id): "150", str(self.player.id): ""},
        }
        battle_id = self.ok(self.post_as(self.player, self.battles_url(), body), 201).data["battle"]["id"]

        self.assertEqual(self.battle(battle_id).scenario_link, "https://example.com/bridge")
        ratings = BattleParticipant.objects.filter(battle_id=battle_id).order_by("id")
        self.assertEqual(list(ratings.values_list("declared_rating", flat=True)), [None, 150])


class BattleJoinTests(BattleTestCase):
    def test_the_last_acceptance_opens_prebattle_for_everyone(self):
        manager_warband = Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows", faction="X")
        battle_id = self.create_battle([self.viewer, self.manager])

        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        self.assertEqual(self.battle(battle_id).status, "inviting")
        self.assertEqual(self.statuses(battle_id), ["accepted", "invited", "accepted"])  # player, manager, viewer

        self.ok(self.post_as(self.manager, self.url(battle_id, "join")))
        self.assertEqual(self.battle(battle_id).status, "prebattle")
        self.assertEqual(self.statuses(battle_id), ["joined_prebattle"] * 3)
        self.assertFalse(Notification.objects.filter(is_resolved=False).exists())
        opened = [user_id for user_id, event in self.notified() if event == "battle_prebattle_opened"]
        self.assertEqual(sorted(opened), sorted([self.player.id, self.viewer.id, self.manager.id]))
        self.assertEqual(self.event_types(battle_id), ["battle_created"])  # joins add no timeline event
        self.assertEqual(self.sent()[-1], "battle_state_updated")
        self.assertEqual(self.battle_events.call_args.args[2]["reason"], "participant_joined_or_updated")
        self.assertTrue(manager_warband.battle_participations.exists())

    def test_join_in_later_phases(self):
        battle_id = self.to_prebattle()
        BattleParticipant.objects.filter(battle_id=battle_id, user=self.viewer).update(
            status=BattleParticipant.STATUS_CANCELED_PREBATTLE
        )
        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        self.assertEqual(self.statuses(battle_id), ["joined_prebattle", "joined_prebattle"])  # a cancel is undone

        Battle.objects.filter(id=battle_id).update(status=Battle.STATUS_ACTIVE)
        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        self.assertEqual(self.statuses(battle_id), ["joined_prebattle", "in_battle"])
        event = BattleEvent.objects.filter(battle_id=battle_id).last()
        assert event is not None
        self.assertEqual(
            (event.type, event.payload_json),
            ("participant_joined_battle", {"participant_user_id": self.viewer.id, "participant_status": "in_battle"}),
        )

        Battle.objects.filter(id=battle_id).update(status=Battle.STATUS_POSTBATTLE)
        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        self.assertEqual(self.statuses(battle_id), ["joined_prebattle", "finished_battle"])

        for closed in (Battle.STATUS_ENDED, Battle.STATUS_CANCELED):
            with self.subTest(status=closed):
                Battle.objects.filter(id=battle_id).update(status=closed)
                response = self.post_as(self.viewer, self.url(battle_id, "join"))
                self.assertEqual(
                    (response.status_code, response.data), (400, status_changed("Battle is closed", closed))
                )

    def test_join_needs_a_participant_of_a_normal_battle(self):
        battle_id = self.create_battle()
        for user in (self.manager, self.outsider):
            with self.subTest(user=user.email):
                self.assertEqual(self.post_as(user, self.url(battle_id, "join")).status_code, 404)
        self.assertEqual(self.post_as(self.viewer, self.url(battle_id + 99, "join")).status_code, 404)
        Battle.objects.filter(id=battle_id).update(flow_type=Battle.FLOW_TYPE_REPORTED_RESULT)
        response = self.post_as(self.viewer, self.url(battle_id, "join"))
        self.assertEqual((response.status_code, response.data), (400, {"detail": "Reported results cannot be joined"}))


class BattleReadyAndStartTests(BattleTestCase):
    def ready(self, user, battle_id, value):
        return self.post_as(user, self.url(battle_id, "ready"), {"ready": value})

    def test_ready_and_unready(self):
        battle_id = self.to_prebattle()

        self.ok(self.ready(self.viewer, battle_id, True))
        self.assertEqual(self.statuses(battle_id), ["joined_prebattle", "ready"])
        self.assertIsNotNone(self.participant(battle_id, self.viewer).ready_at)
        self.assertEqual(self.battle_events.call_args.args[2]["reason"], "participant_ready_changed")

        self.ok(self.ready(self.viewer, battle_id, "no"))
        self.assertEqual(self.statuses(battle_id), ["joined_prebattle", "joined_prebattle"])
        sent_before = len(self.sent())
        self.ok(self.ready(self.viewer, battle_id, False))  # already unready: nothing changes or is sent
        self.assertEqual(len(self.sent()), sent_before)

        for value in ("maybe", 1, None):
            with self.subTest(ready=value):
                response = self.ready(self.viewer, battle_id, value)
                self.assertEqual(
                    (response.status_code, response.data), (400, {"detail": "ready must be true or false"})
                )
        response = self.post_as(self.viewer, self.url(battle_id, "ready"), {})
        self.assertEqual((response.status_code, response.data), (400, {"detail": "ready is required"}))

    def test_ready_outside_prebattle(self):
        battle_id = self.create_battle()
        cases: list[tuple[str, str]] = [
            (Battle.STATUS_INVITING, "Waiting for all participants to accept invitation"),
            (Battle.STATUS_ACTIVE, "Battle is no longer in prebattle"),
            (Battle.STATUS_ENDED, "Battle is no longer in prebattle"),
            (Battle.STATUS_CANCELED, "Battle is canceled"),
        ]
        for battle_status, detail in cases:
            with self.subTest(status=battle_status):
                Battle.objects.filter(id=battle_id).update(status=battle_status)
                response = self.ready(self.viewer, battle_id, True)
                self.assertEqual((response.status_code, response.data), (400, status_changed(detail, battle_status)))

    def test_any_participant_starts_once_everyone_is_ready(self):
        # Decision 4: any participant still in starts (the page asks him to confirm); only the creator could
        battle_id = self.create_battle()
        response = self.post_as(self.player, self.url(battle_id, "start"))
        detail = "Waiting for all participants to accept invitation"
        self.assertEqual((response.status_code, response.data), (400, status_changed(detail, "inviting")))

        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        self.ok(self.ready(self.viewer, battle_id, True))
        response = self.post_as(self.player, self.url(battle_id, "start"))
        detail = "All participants must be ready before starting"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))

        self.ok(self.ready(self.player, battle_id, True))
        data = self.ok(self.post_as(self.viewer, self.url(battle_id, "start"))).data
        self.assertEqual(data["battle"]["status"], "active")
        self.assertIsNotNone(data["battle"]["started_at"])
        self.assertEqual(self.statuses(battle_id), ["in_battle", "in_battle"])
        self.assertEqual([event["type"] for event in data["events"]], ["battle_started"])
        started = sorted(data["events"][0]["payload_json"]["participant_user_ids"])
        self.assertEqual(started, sorted([self.player.id, self.viewer.id]))

        response = self.post_as(self.player, self.url(battle_id, "start"))
        self.assertEqual(
            (response.status_code, response.data), (400, status_changed("Battle already started", "active"))
        )
        Battle.objects.filter(id=battle_id).update(status=Battle.STATUS_CANCELED)
        response = self.post_as(self.player, self.url(battle_id, "start"))
        self.assertEqual((response.status_code, response.data), (400, status_changed("Battle is canceled", "canceled")))


class BattleReadAccessTests(BattleTestCase):
    def test_state_and_rosters_are_for_participants_only(self):
        battle_id = self.create_battle()
        for action in ("state", "rosters"):
            for user in (self.manager, self.campaign_owner, self.outsider):
                with self.subTest(action=action, user=user.email):
                    self.assertEqual(self.get_as(user, self.url(battle_id, action)).status_code, 404)
        response = self.get_as(self.viewer, f"{self.url(battle_id, 'state')}?sinceEventId=x")
        self.assertEqual((response.status_code, response.data), (400, {"detail": "Invalid sinceEventId"}))
        response = self.get_as(self.viewer, f"{self.url(battle_id, 'state')}?sinceEventId=-5")
        self.assertEqual([event["type"] for event in response.data["events"]], ["battle_created"])

    def test_rosters_are_live_until_the_battle_starts_then_the_snapshot(self):
        # BUG-73, PERF-38: start/ stores each roster; a unit killed or dismissed on the sheet mid-battle stays in it
        hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        battle_id = self.to_prebattle()
        url = self.url(battle_id, "rosters")

        rosters = self.ok(self.get_as(self.viewer, url)).data
        self.assertEqual(sorted(rosters), sorted([str(self.player.id), str(self.viewer.id)]))
        self.assertEqual(list(rosters[str(self.player.id)]), ["heroes", "hiredSwords", "henchmenGroups"])
        late = Hero.objects.create(warband=self.warband, name="Late", unit_type="Novice")  # prebattle: live
        heroes = self.ok(self.get_as(self.viewer, url)).data[str(self.player.id)]["heroes"]
        self.assertEqual([entry["key"] for entry in heroes], [f"hero:{hero.id}", f"hero:{late.id}"])

        for user in (self.player, self.viewer):
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))
        self.ok(self.post_as(self.player, self.url(battle_id, "start")))
        Hero.objects.filter(id=hero.id).update(dead=True)
        Hero.objects.filter(id=late.id).update(dismissed_at=timezone.now())

        heroes = self.ok(self.get_as(self.viewer, url)).data[str(self.player.id)]["heroes"]
        self.assertEqual([entry["key"] for entry in heroes], [f"hero:{hero.id}", f"hero:{late.id}"])
        snapshot = self.participant(battle_id, self.player).roster_json
        assert snapshot is not None
        self.assertEqual(snapshot["heroes"], heroes)
