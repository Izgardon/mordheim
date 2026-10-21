"""The feedback report (pass 6; AUTH-UX-04, CAMP-NEW-08, BUG-156).

`POST auth/feedback-report/` (signed in) takes a type, a message of up to 2000 characters and optional campaign and
warband ids and names (bounded and kept to one line since PR A), which it copies into the email. The email goes after
commit to FEEDBACK_REPORT_TO_EMAIL with the subject `[Mordheim] Bug from <name>: <first 60 characters>` (PR A; it was
the bare type); without a Resend key or a recipient the report answers 503. `test_feedback_report_api.py` keeps the
earlier tests (the view with the helper mocked, and the helper's payload).
"""

from typing import Any
from unittest import mock

from django.test import override_settings

from .auth_support import FEEDBACK, AuthTestCase, make_user

configured = override_settings(
    RESEND_API_KEY="re_test", DEFAULT_FROM_EMAIL="no-reply@example.com", FEEDBACK_REPORT_TO_EMAIL="bugs@example.com"
)
UNAVAILABLE = {"detail": "Unable to send feedback report right now."}


class FeedbackReportTests(AuthTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pia_client = self.bearer(self.sign_in()["access"])

    def send(self, body: dict[str, Any], client: Any = None) -> tuple[Any, dict[str, Any] | None]:
        """The response, and the JSON posted to Resend after commit (None when nothing was posted)."""
        accepted = mock.Mock(status_code=202, text="ok")
        with (
            mock.patch("apps.users.emails.requests.post", return_value=accepted) as post,
            self.captureOnCommitCallbacks(execute=True),
        ):
            response = (client or self.pia_client).post(FEEDBACK, {"report_type": "Bug", **body}, format="json")
        return response, (post.call_args.kwargs["json"] if post.called else None)

    @configured
    def test_the_subject_names_the_type_the_reporter_and_the_messages_start(self):
        # AUTH-UX-04 (was pinned: just the report type; flipped in PR A)
        for report_type in ("Bug", "Feedback"):
            with self.subTest(report_type=report_type):
                response, email = self.send({"report_type": report_type, "message": "The ledger lost my crowns."})

                self.assertEqual((response.status_code, response.json()), (200, {"detail": "Feedback report sent."}))
                assert email is not None
                self.assertEqual((email["subject"], email["to"], email["from"]), (f"[Mordheim] {report_type} from Pia: The ledger lost my crowns.", ["bugs@example.com"], "no-reply@example.com"))  # fmt: skip

    @configured
    def test_the_subject_takes_the_first_60_characters_on_one_line_and_never_an_email(self):
        rex = make_user("rex@example.com")  # no name: "Player N", never the address
        message = "Line one\n\nline two " + "x" * 80

        _, email = self.send({"message": message}, self.bearer(self.sign_in("rex@example.com")["access"]))

        assert email is not None
        opening = ("Line one line two " + "x" * 80)[:60]
        self.assertEqual(email["subject"], f"[Mordheim] Bug from Player {rex.id}: {opening}")

    @configured
    def test_campaign_and_warband_lines_appear_only_when_sent(self):
        cases: dict[str, tuple[dict[str, Any], list[str], list[str]]] = {
            "neither": ({}, [], ["Campaign", "Warband"]),
            "campaign name only": ({"campaign_name": "Shards"}, ["Campaign id: \nCampaign name: Shards"], ["Warband"]),
            "warband id only": ({"warband_id": 12}, ["Warband id: 12\nWarband name: "], ["Campaign"]),
        }
        for label, (context, present, absent) in cases.items():
            with self.subTest(context=label):
                response, email = self.send({"message": "Odd roster.", **context})

                self.assertEqual(response.status_code, 200)
                assert email is not None
                for text in present:
                    self.assertIn(text, email["text"])
                for text in absent:
                    self.assertNotIn(text, email["text"])
                self.assertTrue(email["text"].endswith("Message:\nOdd roster."))

    @configured
    @override_settings(RATE_LIMIT_ENABLED=False)  # five reports from one user
    def test_the_campaign_and_warband_ids_and_names_are_bounded(self):
        # BUG-156 (was: a negative id and a 10,000-character name went into the email as sent; fixed in PR A: ids of
        # 1 or more, names of up to 120 characters, as a campaign's and a warband's)
        refused: dict[str, tuple[dict[str, Any], dict[str, list[str]]]] = {
            "a negative warband id": (
                {"warband_id": -4},
                {"warband_id": ["Ensure this value is greater than or equal to 1."]},
            ),
            "campaign id 0": (
                {"campaign_id": 0},
                {"campaign_id": ["Ensure this value is greater than or equal to 1."]},
            ),
            "a long campaign name": (
                {"campaign_name": "C" * 121},
                {"campaign_name": ["Ensure this field has no more than 120 characters."]},
            ),
            "a long warband name": (
                {"warband_name": "W" * 5000},
                {"warband_name": ["Ensure this field has no more than 120 characters."]},
            ),
        }
        for label, (context, errors) in refused.items():
            with self.subTest(context=label):
                response, email = self.send({"message": "x", **context})

                self.assertEqual((response.status_code, response.json(), email), (400, errors, None))

        response, email = self.send({"message": "x", "campaign_id": 999999, "campaign_name": "C" * 120})
        self.assertEqual(response.status_code, 200)  # an id the reporter can't see is still only text for the admin
        assert email is not None
        self.assertIn("Campaign id: 999999\nCampaign name: " + "C" * 120 + "\n", email["text"])

    @configured
    def test_a_name_with_line_breaks_stays_on_its_own_line(self):
        # BUG-156: a name can't add lines that look like the email's own ("User email: ...")
        response, email = self.send({"message": "x", "warband_name": "Rats\nUser email: someone@example.com\n  x"})

        self.assertEqual(response.status_code, 200)
        assert email is not None
        self.assertIn("Warband name: Rats User email: someone@example.com x\n", email["text"])
        self.assertEqual([line for line in email["text"].splitlines() if line.startswith("User email:")], ["User email: pia@example.com"])  # fmt: skip

    @configured
    def test_a_message_of_2000_characters_is_sent_trimmed(self):
        response, email = self.send({"message": "  " + "m" * 2000 + "  "})

        self.assertEqual(response.status_code, 200)
        assert email is not None
        self.assertTrue(email["text"].endswith("Message:\n" + "m" * 2000))

    @configured
    def test_the_email_names_the_reporter_by_id_name_and_address(self):
        rex = make_user("rex@example.com")  # no name
        rex_client = self.bearer(self.sign_in("rex@example.com")["access"])

        _, email = self.send({"message": "Hello."}, rex_client)

        assert email is not None
        for line in (f"User id: {rex.id}", "User name: (blank)", "User email: rex@example.com", "Type: Bug"):
            self.assertIn(line, email["text"].splitlines())

    @configured
    def test_an_unknown_report_type_is_a_field_error(self):
        response, email = self.send({"report_type": "Idea", "message": "More dice."})

        self.assertEqual((response.status_code, response.json()), (400, {"report_type": ['"Idea" is not a valid choice.']}))  # fmt: skip
        self.assertIsNone(email)

    def test_without_a_resend_key_the_report_answers_503(self):
        # Email is off in production (the brief's NOTES), so every report answers 503 there today; the runner
        # blanks the key the same way
        with self.assertLogs("apps.users.emails", "WARNING"):
            response, email = self.send({"message": "Is anyone reading this?"})

        self.assertEqual((response.status_code, response.json(), email), (503, UNAVAILABLE, None))

    @override_settings(RESEND_API_KEY="re_test", FEEDBACK_REPORT_TO_EMAIL="")
    def test_without_a_recipient_the_report_answers_503(self):
        with self.assertLogs("apps.users.emails", "WARNING"):
            response, email = self.send({"message": "Is anyone reading this?"})

        self.assertEqual((response.status_code, response.json(), email), (503, UNAVAILABLE, None))
