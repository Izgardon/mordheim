"""The emails' design E HTML (next step 8), rendered here rather than sent: light only, inline styles, every value
escaped."""

from types import SimpleNamespace

from django.test import SimpleTestCase, override_settings

from apps.users.emails import feedback_html, password_reset_html

URL = "https://m.example.com/reset-password#uid=MQ&token=abc-123"


class EmailHtmlTests(SimpleTestCase):
    @override_settings(PASSWORD_RESET_TIMEOUT=3600)
    def test_the_reset_email_has_the_link_as_a_button_and_in_full_and_says_how_long_it_works(self):
        html = password_reset_html(URL)

        self.assertEqual(html.count('href="https://m.example.com/reset-password#uid=MQ&amp;token=abc-123"'), 2)
        self.assertIn("Set a new password", html)
        self.assertIn("The link works for 1 hour.", html)
        self.assertIn("background-color:#b4532a", html)  # the light accent, square: no border-radius anywhere
        self.assertNotIn("border-radius", html)
        self.assertNotIn("<style", html)

    def test_the_feedback_report_escapes_what_the_player_wrote(self):
        user = SimpleNamespace(pk=7, id=7, first_name="Pia", email="pia@example.com", username="pia@example.com")

        html = feedback_html(
            user=user,
            report_type="Bug",
            message="<script>alert(1)</script>\nSecond line",
            campaign_id=3,
            campaign_name="Shards & <b>Ashes</b>",
        )

        self.assertIn("Bug from Pia", html)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", html)
        self.assertNotIn("<script>", html)
        self.assertIn("Shards &amp; &lt;b&gt;Ashes&lt;/b&gt; (id 3)", html)
        self.assertIn("pia@example.com", html)
        self.assertNotIn("Warband", html)
