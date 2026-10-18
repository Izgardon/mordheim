"""Cross-origin requests: the frontend (Vercel) calls the API (Render) from another origin."""

from typing import Any

from django.test import TestCase, override_settings

APP = "https://app.example.com"


@override_settings(CORS_ALLOWED_ORIGINS=[APP])
class CorsPreflightTests(TestCase):
    def _preflight(self, origin: str) -> Any:
        return self.client.options(
            "/api/campaigns/1/trade-requests/00000000-0000-0000-0000-000000000000/lock/",
            HTTP_ORIGIN=origin,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization, content-type, x-pusher-socket-id",
        )

    def test_a_preflight_naming_the_pusher_socket_header_is_allowed(self):
        # ECON-PERF-02: trade writes send X-Pusher-Socket-Id; without it in the allowed headers the browser
        # would fail the preflight and every trade write with it
        response = self._preflight(APP)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Access-Control-Allow-Origin"], APP)
        allowed = {header.strip() for header in response["Access-Control-Allow-Headers"].lower().split(",")}
        self.assertTrue({"authorization", "content-type", "x-pusher-socket-id"} <= allowed)

    def test_another_origin_is_not_allowed(self):
        response = self._preflight("https://elsewhere.example.com")

        self.assertNotIn("Access-Control-Allow-Origin", response)
