"""Two sign-ups for one email at once (pass 6; BUG-84, AUTH-TEST-04).

`TransactionTestCase`: each request commits as it would in production, and the two requests run on two threads,
each with its own connection. They are held at `RegisterSerializer.create`, after `validate_email` has checked that
nobody has the address and before the insert, so both checks pass before either writes: the race, every time.
"""

import unittest
from typing import Any
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient

from apps.core.testing import Rendezvous, run_concurrently
from apps.users.serializers import RegisterSerializer

from .auth_support import PASSWORD, REGISTER, quiet_request_errors


@override_settings(RATE_LIMIT_ENABLED=False)
class RegisterRaceTests(TransactionTestCase):
    def setUp(self) -> None:
        cache.clear()
        quiet_request_errors(self)
        rendezvous = Rendezvous()
        patcher = mock.patch.object(
            RegisterSerializer, "create", autospec=True, side_effect=rendezvous.before(RegisterSerializer.create)
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def sign_up(self, name: str) -> Any:
        """A sign-up for `rex@example.com` with its own client, to run on another thread."""
        client = APIClient()
        client.raise_request_exception = False  # a crash answers 500, as in production
        body = {"email": "rex@example.com", "password": PASSWORD, "name": name}
        return lambda: client.post(REGISTER, body, format="json")

    @unittest.expectedFailure
    def test_the_second_of_two_simultaneous_sign_ups_is_told_the_email_is_taken(self):
        """Fails today: both pass validate_email, and the second insert hits username's unique constraint (500)."""
        # BUG-84, AUTH-TEST-04 (flips in PR A: create turns the IntegrityError into "User already exists")
        results = run_concurrently(self.sign_up("Rex"), self.sign_up("Rex again"))

        self.assertEqual(sorted(response.status_code for response in results), [201, 400])
        self.assertIn({"email": ["User already exists"]}, [response.json() for response in results])
        self.assertEqual(get_user_model().objects.filter(username="rex@example.com").count(), 1)
