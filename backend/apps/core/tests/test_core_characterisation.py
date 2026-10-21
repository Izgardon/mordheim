"""Core: health, keep-awake, revalidation and security headers (pass 6; AUTH-TEST-14, AUTH-PERF-04, PERF-07, PERF-13).

`health/` and `keep-awake/` run no authentication and no throttle (PR A; they inherited the JWT authentication, so a
token cost them the user query and a stale one got a 401), and keep-awake answers GET and HEAD with 204 (it answered
HEAD only). `ConditionalGetMiddleware` gives every GET a content ETag and answers a matching If-None-Match with an
empty 304 after the view has run; `ApiRevalidateMiddleware` marks API GETs `private, no-cache`.
`test_revalidation.py` keeps the catalogue list's 304 tests.
"""

import re

from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext

from apps.users.tests.auth_support import ME, AuthTestCase

HEALTH = "/api/health/"
KEEP_AWAKE = "/api/keep-awake/"


class ProbeTests(AuthTestCase):
    def test_health_answers_ok_with_no_queries_without_a_token(self):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(HEALTH)

        self.assertEqual((response.status_code, response.json(), len(queries)), (200, {"status": "ok"}, 0))

    def test_health_answers_ok_with_no_query_whatever_the_header(self):
        # AUTH-PERF-04, AUTH-TEST-14 (was pinned: a token cost the user query and a stale one was a 401; flipped in
        # PR A: no authentication)
        headers = {"a real token": f"Bearer {self.sign_in()['access']}", "a stale token": "Bearer garbage", "junk": "a b c"}  # fmt: skip
        for label, header in headers.items():
            for method in ("get", "head"):
                with self.subTest(header=label, method=method), CaptureQueriesContext(connection) as queries:
                    response = getattr(self.client, method)(HEALTH, HTTP_AUTHORIZATION=header)

                    self.assertEqual((response.status_code, len(queries)), (200, 0))

    def test_keep_awake_answers_get_and_head_with_204_whatever_the_header(self):
        # PERF-07, AUTH-PERF-06, AUTH-TEST-14 (was pinned: HEAD only, GET 405, a stale token 401; flipped in PR A)
        for header in (None, "Bearer garbage"):
            for method in ("get", "head"):
                with self.subTest(header=header, method=method), CaptureQueriesContext(connection) as queries:
                    extra = {"HTTP_AUTHORIZATION": header} if header else {}
                    response = getattr(self.client, method)(KEEP_AWAKE, **extra)

                    self.assertEqual((response.status_code, response.content, len(queries)), (204, b"", 0))
        self.assertEqual(self.client.post(KEEP_AWAKE).status_code, 405)


class RevalidationTests(AuthTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pia_client = self.bearer(self.sign_in()["access"])

    def test_api_gets_carry_a_content_etag_and_private_no_cache(self):
        response = self.pia_client.get(ME)

        self.assertRegex(response["ETag"], r'^"[0-9a-f]{32}"$')
        self.assertEqual({part.strip() for part in response["Cache-Control"].split(",")}, {"private", "no-cache"})

    def test_an_unchanged_answer_is_an_empty_304_after_the_view_has_run(self):
        # Characterises current behaviour (PERF-13 server half, pinned): the 304 saves the bytes, not the queries
        etag = self.pia_client.get(ME)["ETag"]

        with CaptureQueriesContext(connection) as queries:
            response = self.pia_client.get(ME, HTTP_IF_NONE_MATCH=etag)

        self.assertEqual((response.status_code, response.content, len(queries)), (304, b"", 1))
        self.assertEqual(response["ETag"], etag)

    def test_a_changed_answer_is_sent_in_full(self):
        etag = self.pia_client.get(ME)["ETag"]
        self.pia.first_name = "Pia the Bold"
        self.pia.save()

        response = self.pia_client.get(ME, HTTP_IF_NONE_MATCH=etag)

        self.assertEqual((response.status_code, response.json()["name"]), (200, "Pia the Bold"))

    def test_writes_heads_and_paths_outside_the_api_get_no_revalidation_headers(self):
        login = self.post("/api/auth/login/", {"email": "pia@example.com", "password": "wrong-password"})
        head = self.client.head(KEEP_AWAKE)
        outside = self.client.get("/not-the-api/")

        for label, response in (("POST", login), ("HEAD", head)):
            with self.subTest(request=label):
                self.assertFalse(response.has_header("ETag"))
                self.assertFalse(response.has_header("Cache-Control"))
        self.assertEqual(outside.status_code, 404)
        self.assertFalse(outside.has_header("Cache-Control"))


class SecurityHeaderTests(AuthTestCase):
    def test_every_answer_carries_djangos_security_headers_and_no_csp(self):
        # The CSP (report-only) lives in the SPA's vercel.json (SEC-15); the API sends none
        for label, response in (("health", self.client.get(HEALTH)), ("401", self.client.get(ME))):
            with self.subTest(response=label):
                self.assertEqual(response["X-Content-Type-Options"], "nosniff")
                self.assertEqual(response["Referrer-Policy"], "same-origin")
                self.assertEqual(response["Cross-Origin-Opener-Policy"], "same-origin")
                self.assertEqual(response["X-Frame-Options"], "DENY")
                self.assertFalse(response.has_header("Content-Security-Policy"))
                self.assertFalse(response.has_header("Strict-Transport-Security"))  # a plain-HTTP request

    @override_settings(SECURE_HSTS_SECONDS=60 * 60 * 24 * 30, SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"))  # fmt: skip
    def test_behind_renders_https_proxy_hsts_is_30_days_without_subdomains_or_preload(self):
        # The values settings.py sets with DEBUG off (test_settings_characterisation checks them in a fresh process)
        response = self.client.get(HEALTH, HTTP_X_FORWARDED_PROTO="https")

        self.assertEqual(response["Strict-Transport-Security"], "max-age=2592000")

    def test_the_browsable_api_is_served_to_a_browser(self):
        # Characterises current behaviour (INFRA-CQ-03, pinned; flips in PR A: production renders JSON only)
        response = self.client.get(HEALTH, HTTP_ACCEPT="text/html")

        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")
        self.assertTrue(re.search(rb"<title>.*Django REST framework", response.content, re.S))
