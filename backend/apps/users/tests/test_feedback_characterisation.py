"""The feedback report today (pass 6; AUTH-UX-04, CAMP-NEW-08).

`POST auth/feedback-report/` (signed in) takes a type, a message of up to 2000 characters and optional campaign and
warband ids and names, which it copies into the email as sent. The email goes after commit to
FEEDBACK_REPORT_TO_EMAIL with the bare type as its subject; without a Resend key or a recipient the report answers
503. PR A makes the subject `[Mordheim] Bug from <name>: <first 60 characters>`. `test_feedback_report_api.py`
keeps the earlier tests (the view with the helper mocked, and the helper's payload).
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
    def test_the_subject_is_just_the_report_type(self):
        # Characterises current behaviour (AUTH-UX-04, pinned; flips in PR A: "[Mordheim] Bug from Pia: <first 60>")
        for report_type in ("Bug", "Feedback"):
            with self.subTest(report_type=report_type):
                response, email = self.send({"report_type": report_type, "message": "The ledger lost my crowns."})

                self.assertEqual((response.status_code, response.json()), (200, {"detail": "Feedback report sent."}))
                assert email is not None
                self.assertEqual((email["subject"], email["to"], email["from"]), (report_type, ["bugs@example.com"], "no-reply@example.com"))  # fmt: skip

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
    def test_the_campaign_and_warband_are_neither_checked_nor_bounded(self):
        # A campaign the reporter isn't in, a negative id and a 10,000-character name go into the email as sent;
        # only the message has a limit (2000)
        body = {"message": "x", "campaign_id": 999999, "campaign_name": "C" * 10000, "warband_id": -4, "warband_name": "W" * 5000}  # fmt: skip

        response, email = self.send(body)

        self.assertEqual(response.status_code, 200)
        assert email is not None
        for text in ("Campaign id: 999999", "C" * 10000, "Warband id: -4", "W" * 5000):
            self.assertIn(text, email["text"])

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
