"""Joining with the code (CAMP-TEST-09). The races are in `test_campaign_transactions.py` (BUG-49)."""

import re

from apps.campaigns.models import CampaignSettings

from .campaign_support import CampaignTestCase, make_user


class JoinTests(CampaignTestCase):
    def test_a_join_answers_with_the_campaign_and_grants_add_custom(self):
        newcomer = make_user("newcomer@example.com", "Nell")

        response = self.join(newcomer)

        self.assertEqual(response.status_code, 201)
        data = response.data
        self.assertEqual((data["id"], data["role"], data["player_count"]), (self.campaign.id, "player", 5))
        self.assertEqual(data["join_code"], self.campaign.join_code)
        self.assertEqual(self.membership(newcomer).role.slug, "player")
        self.assertEqual(self.codes(newcomer), ["add_custom"])

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
        # The PATCH can't change a code (test_campaign_characterisation_settings); CAMP-NEW-01 (PR C) adds "New code"
        for code in self.all_codes():
            with self.subTest(code=code):
                self.assertRegex(code, re.compile(r"\A[A-Z0-9]{6}\Z"))
        self.assertNotEqual(self.campaign.join_code, self.elsewhere.join_code)

    def all_codes(self) -> list[str]:
        return [self.campaign.join_code, self.elsewhere.join_code]
