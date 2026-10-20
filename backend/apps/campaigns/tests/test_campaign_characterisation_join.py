"""Joining with the code (CAMP-TEST-09). The races are in `test_campaign_transactions.py` (BUG-49)."""

import re
from unittest import mock

from apps.campaigns.models import Campaign, CampaignSettings

from .campaign_support import CampaignTestCase, make_user


class JoinTests(CampaignTestCase):
    def test_a_join_answers_with_the_campaign_and_grants_edit_catalogue(self):
        newcomer = make_user("newcomer@example.com", "Nell")

        response = self.join(newcomer)

        self.assertEqual(response.status_code, 201)
        data = response.data
        self.assertEqual((data["id"], data["role"], data["player_count"]), (self.campaign.id, "player", 5))
        self.assertEqual(data["join_code"], self.campaign.join_code)
        self.assertEqual(self.membership(newcomer).role.slug, "player")
        self.assertEqual(self.codes(newcomer), ["edit_catalogue"])

    def test_the_code_is_trimmed_and_read_in_any_case(self):
        newcomer = make_user("newcomer@example.com", "Nell")

        response = self.join(newcomer, f"  {self.campaign.join_code.lower()} ")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(self.is_member(newcomer))

    def test_joining_twice_and_joining_a_full_campaign_are_refused(self):
        CampaignSettings.objects.filter(campaign=self.campaign).update(max_players=5)  # 4 members: one seat left

        again = self.join(self.player)
        last_seat = self.join(make_user("fifth@example.com", "Fifi"))
        full = self.join(make_user("sixth@example.com", "Sid"))

        self.assertEqual((again.status_code, again.data), (400, {"detail": "Already a member"}))
        self.assertEqual(last_seat.status_code, 201)
        self.assertEqual((full.status_code, full.data), (400, {"detail": "Campaign is full"}))
        self.assertEqual(self.join(self.rival).data, {"detail": "Already a member"})  # checked before the seats

    def test_a_duplicate_insert_behind_the_checks_is_still_already_a_member(self):
        # BUG-49: the unique constraint has the last word (it used to be an IntegrityError 500)
        with mock.patch("django.db.models.query.QuerySet.exists", return_value=False):
            again = self.join(self.player)

        self.assertEqual((again.status_code, again.data), (400, {"detail": "Already a member"}))

    def test_malformed_and_unknown_codes(self):
        newcomer = make_user("newcomer@example.com", "Nell")
        unknown = next(code for code in ("ZZZZZZ", "YYYYYY", "XXXXXX") if code not in self.all_codes())

        for code in ("ABC12", "ABCDEFG", ""):
            with self.subTest(code=code):
                response = self.join(newcomer, code) if code else self.post_as(newcomer, "/api/campaigns/join/")
                self.assertEqual((response.status_code, list(response.data)), (400, ["join_code"]))
        missing = self.join(newcomer, unknown)

        self.assertEqual((missing.status_code, missing.data), (404, {"detail": "Campaign not found"}))
        self.assertFalse(self.is_member(newcomer))

    def test_codes_are_six_capital_letters_or_digits(self):
        # The PATCH can't change a code (test_campaign_characterisation_settings); join-code/ makes a new one (below)
        for code in self.all_codes():
            with self.subTest(code=code):
                self.assertRegex(code, re.compile(r"\A[A-Z0-9]{6}\Z"))
        self.assertNotEqual(self.campaign.join_code, self.elsewhere.join_code)

    def all_codes(self) -> list[str]:
        return [self.campaign.join_code, self.elsewhere.join_code]


class NewJoinCodeTests(CampaignTestCase):
    """Decision 1, CAMP-NEW-01: owners and admins regenerate the code, which is how a removed player is kept out."""

    def regenerate(self, user):
        return self.post_as(user, self.url("join-code/"))

    def test_owners_and_admins_get_a_new_code_and_the_old_one_stops_working(self):
        old = self.campaign.join_code
        newcomer = make_user("newcomer@example.com", "Nell")

        response = self.regenerate(self.admin)

        self.assertEqual(response.status_code, 200)
        new = response.data["join_code"]
        self.assertRegex(new, re.compile(r"\A[A-Z0-9]{6}\Z"))
        self.assertNotEqual(new, old)
        self.assertEqual((response.data["id"], response.data["role"]), (self.campaign.id, "admin"))  # the campaign
        self.assertEqual(self.join(newcomer, old).status_code, 404)
        self.assertEqual(self.join(newcomer, new).status_code, 201)
        self.assertNotEqual(self.regenerate(self.owner).data["join_code"], new)

    def test_players_and_outsiders_cannot(self):
        self.assertEqual(self.regenerate(self.player).status_code, 403)
        self.assertEqual(self.regenerate(self.outsider).status_code, 404)
        self.assertEqual(Campaign.objects.get(id=self.campaign.id).join_code, self.campaign.join_code)


class JoinCodeVisibilityTests(CampaignTestCase):
    """BUG-143 (William, pass 4): every member sees the join code, in the campaigns list and in the campaign."""

    def test_every_member_reads_the_code_in_the_list_and_the_detail(self):
        for user in (self.owner, self.admin, self.player):
            with self.subTest(user=user.first_name):
                listed = {row["id"]: row for row in self.get_as(user, "/api/campaigns/").data}
                self.assertEqual(listed[self.campaign.id]["join_code"], self.campaign.join_code)
                self.assertEqual(self.get_as(user, self.url()).data["join_code"], self.campaign.join_code)
        self.assertNotIn(self.campaign.id, [row["id"] for row in self.get_as(self.outsider, "/api/campaigns/").data])
