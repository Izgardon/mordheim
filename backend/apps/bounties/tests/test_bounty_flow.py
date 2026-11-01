"""Posting, claiming, answering and withdrawing a bounty (William, 2026-10-25 and 2026-10-28): soft, so gold moves only
when a claim is accepted by both sides, as ledger rows on both warbands; warnings, never refusals, for what the rules
leave to the players."""

from typing import Any

from django.utils import timezone

from apps.notifications.models import Notification
from apps.warbands.models import Hero, LedgerAction, Warband, WarbandTrade
from apps.warbands.services import ledger

from ..models import CLAIMED, CLOSED, DECLINED, OPEN, PAID, PENDING, WITHDRAWN, Bounty
from .bounty_support import BountyTestCase


class PostTests(BountyTestCase):
    def test_a_bounty_is_posted_on_another_warbands_hero_and_holds_no_gold(self):
        response = self.post_bounty(amount=40, note="For my brother")

        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertNotIn("warnings", body)
        self.assertEqual((body["status"], body["amount"], body["note"]), (OPEN, 40, "For my brother"))
        self.assertEqual(
            body["target"],
            {
                "hero_id": self.seer.id,
                "name": "Grey Seer",
                "is_leader": True,
                "gone": None,
                "warband_id": self.rival_warband.id,
                "warband_name": "Rats",
                "user_id": self.rival.id,
            },
        )
        self.assertEqual(
            body["posted_by"],
            {"warband_id": self.warband.id, "warband_name": "Monks", "user_id": self.player.id, "user_name": "Pia"},
        )
        self.assertEqual(body["claims"], [])
        self.assertEqual(self.gold(self.warband), 500)  # soft: nothing held
        self.bounty_events.assert_called_once_with(self.campaign.id, body, None)

    def test_it_warns_when_the_posters_open_bounties_come_to_more_than_he_holds_and_posts_anyway(self):
        self.posted(amount=300)

        response = self.post_bounty(hero=self.skrit, amount=250)

        self.assertEqual(response.status_code, 201)
        self.assertEqual([warning["code"] for warning in response.json()["warnings"]], ["gold_short"])
        self.assertIn("550 gc", response.json()["warnings"][0]["message"])
        self.assertEqual(Bounty.objects.filter(posted_by_warband=self.warband).count(), 2)

    def test_several_bounties_may_stand_on_one_hero(self):
        self.posted()
        self.posted(user=self.admin, amount=15)

        listed = self.get_as(self.rival, self.bounties_url()).json()["bounties"]

        self.assertEqual(
            [(row["amount"], row["target"]["name"]) for row in listed], [(15, "Grey Seer"), (40, "Grey Seer")]
        )

    def test_a_dead_hero_can_still_carry_a_bounty_with_a_warning(self):
        Hero.objects.filter(id=self.seer.id).update(dead=True)

        response = self.post_bounty()

        self.assertEqual(response.status_code, 201)
        self.assertEqual([warning["code"] for warning in response.json()["warnings"]], ["target_gone"])
        self.assertEqual(response.json()["target"]["gone"], "dead")

    def test_what_cant_be_posted(self):
        cases: list[tuple[Any, dict[str, Any], int, str]] = [
            (self.player, {"hero_id": self.abbess.id, "amount": 10}, 400, "own_hero"),
            (self.player, {"hero_id": 999999, "amount": 10}, 400, "not_found"),
            (self.player, {"hero_id": self.seer.id, "amount": 0}, 400, "invalid"),
            (self.player, {"hero_id": self.seer.id, "amount": "lots"}, 400, "invalid"),
            (self.player, {"hero_id": self.seer.id, "amount": 10, "note": "x" * 501}, 400, "invalid"),
        ]
        for user, body, status, code in cases:
            with self.subTest(body=body):
                response = self.post_as(user, self.bounties_url(), body)
                self.assertEqual((response.status_code, response.json()["code"]), (status, code))
        Warband.objects.filter(id=self.crows.id).delete()  # Ada without her warband
        response = self.post_as(self.admin, self.bounties_url(), {"hero_id": self.seer.id, "amount": 10})
        self.assertEqual((response.status_code, response.json()["code"]), (400, "no_warband"))
        self.assertFalse(Bounty.objects.exists())


class ClaimTests(BountyTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.bounty = self.posted(amount=40)

    def test_a_claim_names_the_unit_accepts_the_claimants_part_and_notifies_the_poster(self):
        response = self.claim(self.admin, self.bounty, {"unit": {"kind": "henchmen_group", "id": self.runners.id}})

        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["status"], CLAIMED)
        [claim] = body["claims"]
        self.assertEqual(
            {key: claim[key] for key in ("status", "warband_name", "user_name", "unit_name", "unit", "battle")},
            {
                "status": PENDING,
                "warband_name": "Crows",
                "user_name": "Ada",
                "unit_name": "Night Runners",
                "unit": {"kind": "henchmen_group", "id": self.runners.id, "name": "Night Runners"},
                "battle": None,
            },
        )
        self.assertEqual((claim["claimant_accepted"], claim["poster_accepted"]), (True, False))
        self.assertEqual([warning["code"] for warning in body["warnings"]], ["no_record"])  # stands all the same
        notice = Notification.objects.get(user=self.player, notification_type=Notification.TYPE_BOUNTY_CLAIM)
        self.assertEqual(notice.reference_id, str(claim["id"]))
        self.assertEqual(notice.payload["claimant_warband_name"], "Crows")
        self.assertEqual(self.user_event_types(), [(self.player.id, "bounty_claim")])
        self.assertEqual(self.user_events.call_args.args[2]["notification_id"], notice.id)
        self.assertIn(("bounty_claim", str(claim["id"]), self.campaign.id), self.listed_notifications(self.player))

    def test_who_cant_claim_and_what_a_claim_must_name(self):
        self.claimed(self.admin, self.bounty)
        cases: list[tuple[Any, dict[str, Any], int, str]] = [
            (self.player, {"unit": {"kind": "hero", "id": self.abbess.id}}, 400, "own_bounty"),
            (self.rival, {"unit": {"kind": "hero", "id": self.skrit.id}}, 400, "own_hero"),
            (self.admin, {"unit": {"kind": "hero", "id": self.kreech.id}}, 409, "claim_pending"),
            (self.owner, {"unit": {"kind": "hero", "id": self.kreech.id}}, 400, "invalid"),  # not his unit
            (self.owner, {"unit": {"kind": "dragon", "id": self.hawk.id}}, 400, "invalid"),
            (self.owner, {}, 400, "invalid"),
            (self.owner, {"unit": {"kind": "hero", "id": self.hawk.id}, "kill_id": 12345}, 400, "invalid"),
            (self.owner, {"unit": {"kind": "hero", "id": self.hawk.id}, "battle_id": 12345}, 400, "invalid"),
        ]
        for user, body, status, code in cases:
            with self.subTest(user=user.first_name, body=body):
                response = self.claim(user, self.bounty, body)
                self.assertEqual((response.status_code, response.json()["code"]), (status, code))

    def test_the_poster_accepts_and_the_gold_moves_as_ledger_rows_on_both_warbands(self):
        claim = self.claimed(self.admin, self.bounty)
        self.user_events.reset_mock()

        response = self.answer(self.player, claim, "accept")

        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual((body["status"], body["paid_claim_id"], body["claims"][0]["status"]), (PAID, claim.id, PAID))
        self.assertNotIn("warnings", body)
        self.assertEqual((self.gold(self.warband), self.gold(self.crows)), (460, 540))
        rows = WarbandTrade.objects.filter(action=LedgerAction.BOUNTY).order_by("price")
        self.assertEqual(
            [(row.warband_id, row.price, row.description, row.notes) for row in rows],
            [
                (self.warband.id, -40, "Bounty on Grey Seer paid to Crows", "Kreech took Grey Seer out"),
                (self.crows.id, 40, "Bounty on Grey Seer from Monks", "Kreech took Grey Seer out"),
            ],
        )
        self.assertEqual(ledger.gold_drift(), [])
        self.assertTrue(Notification.objects.get(reference_id=str(claim.id)).is_resolved)
        self.assertEqual(self.user_event_types(), [(self.admin.id, "bounty_claim_answered")])
        self.assertEqual(self.user_events.call_args.args[2]["status"], PAID)
        warbands = sorted(call.args[1] for call in self.warband_events.call_args_list)
        self.assertEqual(warbands, sorted([self.warband.id, self.crows.id]))
        self.assertEqual(self.get_as(self.player, self.bounties_url()).json()["bounties"], [])  # no longer open

    def test_accepting_again_pays_nothing_more(self):
        claim = self.claimed(self.admin, self.bounty)
        self.answer(self.player, claim, "accept")

        again = self.answer(self.player, claim, "accept")

        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()["status"], PAID)
        self.assertEqual(WarbandTrade.objects.filter(action=LedgerAction.BOUNTY).count(), 2)
        self.assertEqual(self.gold(self.crows), 540)

    def test_the_poster_pays_what_he_no_longer_holds_with_a_warning(self):
        ledger.record(self.warband, LedgerAction.ADJUSTMENT, -490, "Spent")
        claim = self.claimed(self.admin, self.bounty)

        response = self.answer(self.player, claim, "accept")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([warning["code"] for warning in response.json()["warnings"]], ["gold_short"])
        self.assertEqual(self.gold(self.warband), -30)

    def test_the_claimants_accept_alone_moves_nothing(self):
        claim = self.claimed(self.admin, self.bounty)

        response = self.answer(self.admin, claim, "accept")

        self.assertEqual((response.status_code, response.json()["status"]), (200, CLAIMED))
        self.assertEqual(self.gold(self.crows), 500)

    def test_only_the_two_parties_answer_a_claim(self):
        claim = self.claimed(self.admin, self.bounty)
        for user in (self.rival, self.owner):
            for verb in ("accept", "decline"):
                with self.subTest(user=user.first_name, verb=verb):
                    response = self.answer(user, claim, verb)
                    self.assertEqual((response.status_code, response.json()["code"]), (403, "not_a_party"))

    def test_the_poster_declines_and_the_bounty_is_open_again(self):
        claim = self.claimed(self.admin, self.bounty)
        self.user_events.reset_mock()

        response = self.answer(self.player, claim, "decline")

        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json()["status"], response.json()["claims"][0]["status"]), (OPEN, DECLINED))
        self.assertEqual(self.user_event_types(), [(self.admin.id, "bounty_claim_answered")])
        self.assertTrue(Notification.objects.get(reference_id=str(claim.id)).is_resolved)
        self.assertEqual(self.answer(self.player, claim, "accept").json()["code"], "claim_closed")
        self.claimed(self.admin, self.bounty)  # and he may claim again

    def test_the_claimant_takes_his_claim_back_and_the_posters_bell_drops_it(self):
        claim = self.claimed(self.admin, self.bounty)
        self.user_events.reset_mock()

        response = self.answer(self.admin, claim, "decline")

        self.assertEqual(response.json()["claims"][0]["status"], WITHDRAWN)
        self.assertEqual(self.user_event_types(), [(self.player.id, "bounty_claim_withdrawn")])
        self.assertEqual(self.listed_notifications(self.player), [])

    def test_competing_claims_close_when_one_is_paid(self):
        first = self.claimed(self.admin, self.bounty)
        second = self.claimed(self.owner, self.bounty, {"unit": {"kind": "hero", "id": self.hawk.id}})
        self.user_events.reset_mock()

        self.answer(self.player, second, "accept")

        first.refresh_from_db()
        self.assertEqual(first.status, CLOSED)
        self.assertEqual(self.gold(self.ravens), 540)
        self.assertEqual(self.gold(self.crows), 500)
        told = {call.args[0]: call.args[2]["status"] for call in self.user_events.call_args_list}
        self.assertEqual(told, {self.owner.id: PAID, self.admin.id: CLOSED})
        self.assertEqual(self.listed_notifications(self.player), [])


class WithdrawTests(BountyTestCase):
    def test_only_the_poster_withdraws_and_the_waiting_claims_close(self):
        bounty = self.posted()
        claim = self.claimed(self.admin, bounty)
        self.assertEqual(self.withdraw(self.rival, bounty).json()["code"], "not_poster")
        self.user_events.reset_mock()

        response = self.withdraw(self.player, bounty)

        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json()["status"], response.json()["claims"][0]["status"]), (WITHDRAWN, CLOSED))
        claim.refresh_from_db()
        self.assertIsNotNone(claim.answered_at)
        self.assertEqual(self.user_event_types(), [(self.admin.id, "bounty_claim_answered")])
        self.assertEqual(self.withdraw(self.player, bounty).json()["code"], "bounty_closed")
        self.assertEqual(
            self.claim(self.owner, bounty, {"unit": {"kind": "hero", "id": self.hawk.id}}).status_code, 409
        )
        self.assertEqual(self.listed_notifications(self.player), [])

    def test_a_paid_bounty_cant_be_withdrawn(self):
        bounty = self.posted()
        self.answer(self.player, self.claimed(self.admin, bounty), "accept")

        self.assertEqual(self.withdraw(self.player, bounty).status_code, 409)


class TargetGoneTests(BountyTestCase):
    def test_the_bounty_stays_open_when_the_hero_dies_leaves_or_is_removed(self):
        bounty = self.posted()
        for change, gone in (
            ({"dead": True}, "dead"),
            ({"dead": False, "dismissed_at": timezone.now()}, "dismissed"),
        ):
            Hero.objects.filter(id=self.seer.id).update(**change)
            with self.subTest(gone=gone):
                [row] = self.get_as(self.player, self.bounties_url()).json()["bounties"]
                self.assertEqual((row["status"], row["target"]["gone"]), (OPEN, gone))
        Hero.objects.filter(id=self.seer.id).delete()
        [row] = self.get_as(self.player, self.bounties_url()).json()["bounties"]
        self.assertEqual(
            (row["target"]["hero_id"], row["target"]["name"], row["target"]["gone"]), (None, "Grey Seer", "removed")
        )
        self.claimed(self.admin, bounty)  # still claimable
