from typing import Any

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .names import NAME_MAX_LENGTH
from .services.accounts import EmailTaken, create_account
from .services.sso_accounts import account_for_email, linked_provider_labels

EMAIL_MAX_LENGTH = 150  # the email is also the username, a varchar(150) (BUG-84)
EMAIL_TAKEN = "User already exists"
CURRENT_PASSWORD_WRONG = "That isn't your current password."
CONTEXT_NAME_MAX_LENGTH = 120  # Campaign.name and Warband.name


def joined_with_or(labels: list[str]) -> str:
    """ "Google", "Google or Discord", "Google, Discord or Apple"."""
    if len(labels) < 2:
        return "".join(labels)
    return f"{', '.join(labels[:-1])} or {labels[-1]}"


def email_taken_message(held: Any) -> str:
    """How registration refuses an address another active account already holds (William, 19 Nov 2026: one account
    per address).

    An account made through a provider has no password, and registration must never set one on it: typing an address
    into a form proves nothing, so letting it through would hand the account to anyone who knows the address. The
    refusal names the provider instead, which is the only thing that gets the person unstuck. That an address is
    taken is already disclosed by the old wording, so naming the provider gives nothing new away.
    """
    if held.has_usable_password():
        return EMAIL_TAKEN
    labels = linked_provider_labels(held)
    return f"You already have an account. Sign in with {joined_with_or(labels)}." if labels else EMAIL_TAKEN


def password_problems(password: str, user: Any) -> list[str]:
    """Every configured validator's complaint about `password` (none when it passes). Given the user, the similarity
    check compares it with their email and name too (AUTH-CQ-04 b)."""
    try:
        validate_password(password, user=user)
    except DjangoValidationError as error:
        return list(error.messages)
    return []


class RegisterSerializer(serializers.ModelSerializer):
    name = serializers.CharField(write_only=True, max_length=NAME_MAX_LENGTH)  # required and trimmed (decision 2)
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(max_length=EMAIL_MAX_LENGTH)

    class Meta:
        model = get_user_model()
        fields = ("id", "email", "password", "name")

    def validate_email(self, value):
        """The address must be free of every active account, not only of the usernames: an account made through a
        provider holds it in `email` under an opaque username, and used to sail past this check into a second
        account for the same person (William, 19 Nov 2026)."""
        email = value.strip().lower()
        held = account_for_email(email)
        if held is not None:
            raise serializers.ValidationError(email_taken_message(held))
        return email

    def validate(self, attrs):
        email = attrs["email"]
        account = get_user_model()(username=email, email=email, first_name=attrs["name"])
        problems = password_problems(attrs["password"], account)
        if problems:
            raise serializers.ValidationError({"password": problems})
        return attrs

    def create(self, validated_data):
        try:
            return create_account(validated_data["email"], validated_data["name"], validated_data["password"])
        except EmailTaken:  # a simultaneous sign-up took the address after validate_email's check (BUG-84)
            held = account_for_email(validated_data["email"])
            message = email_taken_message(held) if held is not None else EMAIL_TAKEN
            raise serializers.ValidationError({"email": [message]}) from None


class NameSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=NAME_MAX_LENGTH)  # required and trimmed, as at sign-up (decision 2)


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", allow_blank=True)

    class Meta:
        model = get_user_model()
        fields = ("id", "email", "name")


class LoginSerializer(serializers.Serializer):
    """An email and password; valid when they sign in an active user, given as `user`.

    The email is checked as an address (IMP-95 a): SimpleJWT's obtain serializer swapped the declared EmailField for a
    CharField, so anything at all was just "Invalid credentials"."""

    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        user = authenticate(self.context.get("request"), username=attrs["email"].lower(), password=attrs["password"])
        if user is None:
            raise serializers.ValidationError("Invalid credentials")
        return {"user": user}


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)  # checked against the user in the view


class CurrentPasswordSerializer(serializers.Serializer):
    """The signed-in user's (context `user`) current password, confirming an account change: a password change now,
    and deleting the account."""

    current_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        if not self.context["user"].check_password(value):
            raise serializers.ValidationError(CURRENT_PASSWORD_WRONG)
        return value


class PasswordChangeSerializer(CurrentPasswordSerializer):
    """The current password and a new one, checked against the user's email and name (AUTH-CQ-04 b)."""

    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        problems = password_problems(attrs["new_password"], self.context["user"])
        if problems:
            raise serializers.ValidationError({"new_password": problems})
        return attrs


def one_line(value: str) -> str:
    """`value` with every run of whitespace, newlines included, as one space, so it fills one line of the email."""
    return " ".join(value.split())


class FeedbackReportSerializer(serializers.Serializer):
    """The report, with the campaign and warband it was sent from: ids of 1 or more, and names no longer than a
    campaign's or a warband's (120), kept to one line (BUG-156)."""

    report_type = serializers.ChoiceField(choices=["Bug", "Feedback"])
    message = serializers.CharField(max_length=2000, allow_blank=True)
    campaign_id = serializers.IntegerField(required=False, min_value=1)
    campaign_name = serializers.CharField(required=False, allow_blank=True, max_length=CONTEXT_NAME_MAX_LENGTH)
    warband_id = serializers.IntegerField(required=False, min_value=1)
    warband_name = serializers.CharField(required=False, allow_blank=True, max_length=CONTEXT_NAME_MAX_LENGTH)

    def validate_campaign_name(self, value):
        return one_line(value)

    def validate_warband_name(self, value):
        return one_line(value)

    def validate_message(self, value):
        message = value.strip()
        if not message:
            raise serializers.ValidationError("Message is required.")
        return message
