"""Google sign-in.

Google is an OpenID Connect provider, but nothing here reads its ID token: the flow asks its userinfo endpoint with
the access token it got server-side, over TLS, from the token endpoint. So no token minted in a browser is ever
trusted, and there is no signature, issuer or audience to check by hand.

`email_verified` is Google's own claim. A Workspace or Gmail address is verified; an address a user typed into a
consumer account may not be, and then we don't match it against an account.
"""

from collections.abc import Mapping
from typing import Any

from .base import Provider, SsoProfile, as_bool, clean_email

NAME_FIELDS = ("name", "given_name")


def read_profile(data: Mapping[str, Any]) -> SsoProfile:
    email = clean_email(data.get("email"))
    name = next((str(data.get(field) or "").strip() for field in NAME_FIELDS if data.get(field)), "")
    return SsoProfile(
        subject=str(data.get("sub") or "").strip(),
        email=email,
        email_verified=bool(email) and as_bool(data.get("email_verified")),
        name=name,
    )


PROVIDER = Provider(
    slug="google",
    label="Google",
    authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
    token_url="https://oauth2.googleapis.com/token",
    profile_url="https://openidconnect.googleapis.com/v1/userinfo",
    scope="openid email profile",
    client_id_setting="GOOGLE_OAUTH_CLIENT_ID",
    client_secret_setting="GOOGLE_OAUTH_CLIENT_SECRET",
    read_profile=read_profile,
    # No refresh token is wanted (we mint our own session), and the account chooser means a shared computer doesn't
    # sign the last player back in silently.
    authorize_extras={"access_type": "online", "prompt": "select_account"},
)
