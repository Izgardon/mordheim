"""What a bounty reads from the record and leaves on it: the claim's suggestions (the claimant's kills and
out-of-actions of the target since the bounty was posted), the battle's "Bounty claimed" moment, the bell, who may
reach it, and the fixed query budgets of its reads."""

from datetime import UTC, datetime
from typing import Any

from django.utils import timezone

from apps.battles.models import Battle, BattleKill
from apps.campaigns.models import Campaign, PivotalMoment
from apps.campaigns.pivotal_moments import regenerate_pivotal_moments
from apps.core.testing import count_get_queries

from ..models import Bounty
from .bounty_support import BountyTestCase


class CandidateTests(BountyTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.bounty = self.posted()

    def candidates(self) -> dict[str, Any]:
        response = self.get_as(self.admin, self.bounties_url(f"{self.bounty.id}/candidates/"))
        self.assertEqual(response.status_code, 200, response.content)
        found: dict[str, Any] = response.json()
        return found

    def test_his_kills_and_out_of_actions_of_the_target_since_it_was_posted_are_suggested(self):
        street = self.battle(self.crows, self.rival_warband)
        shot = self.kill(street, self.kreech, self.seer)
        self.kill(street, self.kreech, self.seer, voided=True)  # undone: not on record
        self.kill(street, self.kreech, self.skrit)  # another hero
        earlier = self.kill(self.battle(self.crows, self.rival_warband), self.kreech, self.seer)
        BattleKill.objects.filter(id=earlier.id).update(created_at=datetime(2020, 1, 1, tzinfo=UTC))
        self.kill(self.battle(self.ravens, self.rival_warband), self.hawk, self.seer)  # another warband's
        ford = self.battle(self.crows, self.rival_warband, ooa=self.seer)  # out of action, no kill of his
        self.battle(self.ravens, self.rival_warband, ooa=self.seer)  # not against him

        found = self.candidates()

        self.assertEqual(
            [(row["kind"], row["kill_id"], row["battle"]["id"], row["text"]) for row in found["candidates"]],
            [
                ("kill", shot.id, street.id, "Kreech took Grey Seer out of action"),
                ("out_of_action", None, ford.id, "Grey Seer went out of action in Street Fight, with no kill recorded"),
            ],
        )
        self.assertEqual(found["candidates"][0]["unit"], {"kind": "hero", "id": self.kreech.id, "name": "Kreech"})
        self.assertEqual(
            [(row["kind"], row["name"]) for row in found["units"]],
            [("hero", "Kreech"), ("henchmen_group", "Night Runners")],
        )
        self.assertIn(street.id, [row["id"] for row in found["battles"]])

    def test_a_kill_alone_names_its_killer_and_its_battle(self):
        street = self.battle(self.crows, self.rival_warband)
        shot = self.kill(street, self.kreech, self.seer)

        response = self.claim(self.admin, self.bounty, {"kill_id": shot.id})

        self.assertEqual(response.status_code, 201, response.content)
        self.assertNotIn("warnings", response.json())
        claim = response.json()["claims"][0]
        self.assertEqual((claim["kill_id"], claim["unit_name"], claim["battle"]["id"]), (shot.id, "Kreech", street.id))
        self.assertEqual(claim["unit"], {"kind": "hero", "id": self.kreech.id, "name": "Kreech"})

    def test_an_out_of_action_on_record_needs_no_warning(self):
        ford = self.battle(self.crows, self.rival_warband, ooa=self.seer)

        body = {"unit": {"kind": "henchmen_group", "id": self.runners.id}, "battle_id": ford.id}
        response = self.claim(self.admin, self.bounty, body)

        self.assertEqual(response.status_code, 201)
        self.assertNotIn("warnings", response.json())
        self.assertEqual(response.json()["claims"][0]["battle"]["scenario"], "Street Fight")


class MomentTests(BountyTestCase):
    def test_a_paid_claim_tied_to_a_battle_shows_in_its_moments_and_regenerating_keeps_it(self):
        bounty = self.posted()
        street = self.battle(self.crows, self.rival_warband)
        shot = self.kill(street, self.kreech, self.seer)
        self.answer(self.player, self.claimed(self.admin, bounty, {"kill_id": shot.id}), "accept")

        regenerate_pivotal_moments(street)
        history = self.get_as(self.player, self.url("battle-history/")).json()

        [row] = [entry for entry in history if entry["id"] == street.id]
        bounty_moments = [moment for moment in row["moments"] if moment["kind"] == "bounty_claimed"]
        self.assertEqual(
            [
                (moment["tag"], moment["headline"], moment["detail"], moment["warband_name"])
                for moment in bounty_moments
            ],
            [("Round 2", "Bounty claimed", "Kreech collected the 40 gc bounty Monks put on Grey Seer.", "Crows")],
        )
        self.assertEqual(bounty_moments[0]["unit"], {"kind": "hero", "id": self.kreech.id, "name": "Kreech"})
        self.assertTrue(any(moment["kind"] != "bounty_claimed" for moment in row["moments"]))  # the fight's own too

    def test_a_claim_with_no_battle_leaves_no_moment(self):
        bounty = self.posted()
        self.answer(self.player, self.claimed(self.admin, bounty), "accept")

        self.assertFalse(PivotalMoment.objects.exists())


class ChronicleTests(BountyTestCase):
    def test_bounties_posted_and_claimed_are_chronicled_and_filtered(self):
        paid = self.posted(amount=40)
        street = self.battle(self.crows, self.rival_warband)
        self.answer(
            self.player,
            self.claimed(self.admin, paid, {"kill_id": self.kill(street, self.kreech, self.seer).id}),
            "accept",
        )
        self.withdraw(self.player, self.posted(hero=self.skrit, amount=10))

        entries = self.get_as(self.player, self.url("chronicle/?kind=bounty")).json()

        self.assertEqual(
            sorted((entry["kind"], entry["text"], entry["meta"]) for entry in entries),
            [
                ("bounty_claimed", "Kreech of Crows collected the 40 gc bounty on Grey Seer", "Crows · Street Fight"),
                ("bounty_posted", "Monks put a 10 gc bounty on Skrit (Rats)", "Posted by Pia · withdrawn"),
                ("bounty_posted", "Monks put a 40 gc bounty on Grey Seer (Rats)", "Posted by Pia"),
            ],
        )
        everything = {entry["kind"] for entry in self.get_as(self.player, self.url("chronicle/")).json()}
        self.assertTrue({"bounty_posted", "bounty_claimed", "kill"} <= everything)
        self.assertEqual(self.get_as(self.player, self.url("chronicle/?kind=kill")).json()[0]["kind"], "kill")


class BellTests(BountyTestCase):
    def test_clear_all_keeps_a_claim_waiting_for_an_answer(self):
        claim = self.claimed(self.admin, self.posted())

        cleared = self.post_as(self.player, "/api/notifications/clear-all/").json()

        self.assertEqual((cleared["cleared"], cleared["kept"]), (0, 1))
        self.assertEqual(self.listed_notifications(self.player), [("bounty_claim", str(claim.id), self.campaign.id)])


class AccessTests(BountyTestCase):
    def test_members_only_and_an_archived_campaign_takes_no_writes(self):
        bounty = self.posted()
        for path in ("", "targets/", f"{bounty.id}/candidates/"):
            with self.subTest(path=path):
                self.assertEqual(self.get_as(self.outsider, self.bounties_url(path)).status_code, 404)
                self.assertEqual(self.get_as(None, self.bounties_url(path)).status_code, 401)
        self.assertEqual(self.post_bounty(user=self.outsider).status_code, 404)
        Campaign.objects.filter(id=self.campaign.id).update(archived_at=timezone.now())
        self.assertEqual(self.get_as(self.player, self.bounties_url()).status_code, 200)
        archived = self.post_bounty()
        self.assertEqual((archived.status_code, archived.json()["code"]), (403, "campaign_archived"))
        self.assertEqual(self.withdraw(self.player, bounty).status_code, 403)

    def test_a_bounty_of_another_campaign_is_not_found(self):
        bounty = self.posted()
        Bounty.objects.filter(id=bounty.id).update(campaign=self.elsewhere)

        self.assertEqual(self.withdraw(self.player, bounty).status_code, 404)
        self.assertEqual(self.get_as(self.admin, self.bounties_url(f"{bounty.id}/candidates/")).status_code, 404)

    def test_the_targets_are_every_other_warbands_heroes_on_its_roster(self):
        from apps.warbands.models import Hero

        Hero.objects.create(warband=self.rival_warband, name="Gone", unit_type="Rat", dead=True)

        targets = self.get_as(self.player, self.bounties_url("targets/")).json()

        self.assertEqual(
            [(row["warband_name"], [hero["name"] for hero in row["heroes"]]) for row in targets],
            [("Crows", ["Kreech"]), ("Rats", ["Grey Seer", "Skrit"]), ("Ravens", ["Hawk"])],
        )
        mine = self.get_as(self.player, self.bounties_url()).json()["my_warband"]
        self.assertEqual(mine, {"id": self.warband.id, "name": "Monks", "gold": 500})
        self.assertIsNone(self.get_as(self.outsider, self.url("bounties/", self.elsewhere)).json()["my_warband"])


class BudgetTests(BountyTestCase):
    """The list reads in a fixed number of queries whatever the bounties and claims (access, bounties, their claims,
    the reader's warband); the targets and the claim dialog's read are fixed too."""

    LIST_BUDGET = 4
    TARGETS_BUDGET = 3
    CANDIDATES_BUDGET = 10

    def count(self, suffix: str) -> int:
        self.client.force_authenticate(user=self.player)
        return count_get_queries(self.client, self.bounties_url(suffix))

    def test_the_list_doesnt_grow_with_bounties_or_claims(self):
        first = self.posted()
        self.claimed(self.admin, first)
        few = self.count("")
        for hero in (self.skrit, self.kreech, self.hawk):
            bounty = self.posted(hero=hero, amount=5)
            if hero != self.kreech:
                self.claimed(self.admin, bounty)
        self.claimed(self.owner, first, {"unit": {"kind": "hero", "id": self.hawk.id}})

        many = self.count("")

        self.assertEqual(few, many)
        self.assertLessEqual(many, self.LIST_BUDGET)

    def test_the_targets_and_candidates_stay_within_their_budgets(self):
        bounty = self.posted()
        self.kill(self.battle(self.crows, self.rival_warband), self.kreech, self.seer)
        self.assertLessEqual(self.count("targets/"), self.TARGETS_BUDGET)
        self.client.force_authenticate(user=self.admin)
        candidates = count_get_queries(self.client, self.bounties_url(f"{bounty.id}/candidates/"))
        self.assertLessEqual(candidates, self.CANDIDATES_BUDGET)
        self.assertTrue(Battle.objects.exists())
