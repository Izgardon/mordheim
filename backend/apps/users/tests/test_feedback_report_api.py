from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APITestCase

from apps.users.emails import send_feedback_report_email


class FeedbackReportApiTests(APITestCase):
    client: APIClient

    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()
        self.user = self.user_model.objects.create_user(
            username="reporter@example.com",
            email="reporter@example.com",
            password="testpass123",
            first_name="Reporter",
        )
        self.client.force_authenticate(user=self.user)

    @patch("apps.users.views.send_feedback_report_email", return_value=True)
    def test_authenticated_user_can_submit_feedback_report(self, send_feedback_report_email_mock):
        response = self.client.post(
            "/api/auth/feedback-report/",
            {
                "report_type": "Bug",
                "message": " Found a bug in post-battle rewards. ",
                "campaign_id": 7,
                "campaign_name": "Shadows Over Mordheim",
                "warband_id": 12,
                "warband_name": "Iron Vultures",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["detail"], "Feedback report sent.")
        send_feedback_report_email_mock.assert_called_once_with(
            user=self.user,
            report_type="Bug",
            message="Found a bug in post-battle rewards.",
            campaign_id=7,
            campaign_name="Shadows Over Mordheim",
            warband_id=12,
            warband_name="Iron Vultures",
        )

    def test_feedback_report_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            "/api/auth/feedback-report/",
            {"report_type": "Bug", "message": "Found a bug."},
            format="json",
        )

        self.assertEqual(response.status_code, 401)

    @patch("apps.users.views.send_feedback_report_email")
    def test_feedback_report_rejects_blank_message(self, send_feedback_report_email_mock):
        response = self.client.post(
            "/api/auth/feedback-report/",
            {"report_type": "Bug", "message": "   "},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"][0], "Message is required.")
        send_feedback_report_email_mock.assert_not_called()

    @patch("apps.users.views.send_feedback_report_email")
    def test_feedback_report_rejects_message_over_2000_characters(self, send_feedback_report_email_mock):
        response = self.client.post(
            "/api/auth/feedback-report/",
            {"report_type": "Bug", "message": "x" * 2001},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["message"][0],
            "Ensure this field has no more than 2000 characters.",
        )
        send_feedback_report_email_mock.assert_not_called()

    @patch("apps.users.views.send_feedback_report_email", return_value=False)
    def test_feedback_report_returns_error_when_email_cannot_be_sent(self, send_feedback_report_email_mock):
        response = self.client.post(
            "/api/auth/feedback-report/",
            {"report_type": "Feedback", "message": "The feedback endpoint is misconfigured."},
            format="json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["detail"], "Unable to send feedback report right now.")
        send_feedback_report_email_mock.assert_called_once()


class FeedbackReportEmailHelperTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="helper@example.com",
            email="helper@example.com",
            password="testpass123",
            first_name="Helper",
        )

    @override_settings(
        RESEND_API_KEY="resend-key",
        DEFAULT_FROM_EMAIL="no-reply@example.com",
        FEEDBACK_REPORT_TO_EMAIL="bugs@example.com",
    )
    @patch("apps.users.emails.requests.post")
    def test_feedback_report_email_helper_uses_configured_recipient_and_context(self, requests_post_mock):
        requests_post_mock.return_value = Mock(status_code=202, text="accepted")

        # The email is sent after commit, off the request thread.
        with self.captureOnCommitCallbacks(execute=True):
            sent = send_feedback_report_email(
                user=self.user,
                report_type="Bug",
                message="The campaign roster page crashes.",
                campaign_id=4,
                campaign_name="Campaign Four",
                warband_id=9,
                warband_name="Black Hounds",
            )

        self.assertTrue(sent)
        requests_post_mock.assert_called_once()
        request_kwargs = requests_post_mock.call_args.kwargs
        self.assertEqual(request_kwargs["json"]["to"], ["bugs@example.com"])
        self.assertEqual(
            request_kwargs["json"]["subject"], "[Mordheim] Bug from Helper: The campaign roster page crashes."
        )
        self.assertIn("Type: Bug", request_kwargs["json"]["text"])
        self.assertIn(f"User id: {self.user.pk}", request_kwargs["json"]["text"])
        self.assertIn("User name: Helper", request_kwargs["json"]["text"])
        self.assertIn("User email: helper@example.com", request_kwargs["json"]["text"])
        self.assertIn("Campaign id: 4", request_kwargs["json"]["text"])
        self.assertIn("Campaign name: Campaign Four", request_kwargs["json"]["text"])
        self.assertIn("Warband id: 9", request_kwargs["json"]["text"])
        self.assertIn("Warband name: Black Hounds", request_kwargs["json"]["text"])
        self.assertIn("The campaign roster page crashes.", request_kwargs["json"]["text"])
