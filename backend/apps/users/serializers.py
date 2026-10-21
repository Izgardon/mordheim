from typing import Any

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import UserAccount

NAME_MAX_LENGTH = 40  # a display name (decision 2)
EMAIL_MAX_LENGTH = 150  # the email is also the username, a varchar(150) (BUG-84)
EMAIL_TAKEN = "User already exists"
CURRENT_PASSWORD_WRONG = "That isn't your current password."


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
        email = value.strip().lower()
        user_model = get_user_model()
        if user_model.objects.filter(username=email).exists():
            raise serializers.ValidationError(EMAIL_TAKEN)
        return email

    def validate(self, attrs):
        email = attrs["email"]
        account = get_user_model()(username=email, email=email, first_name=attrs["name"])
        problems = password_problems(attrs["password"], account)
        if problems:
            raise serializers.ValidationError({"password": problems})
        return attrs

    def create(self, validated_data):
        name = validated_data.pop("name")
        email = validated_data.get("email", "")
        user_model = get_user_model()
        user = user_model(username=email, email=email, first_name=name)
        user.set_password(validated_data["password"])
        try:
            with transaction.atomic():
                user.save()
                UserAccount.objects.create(user=user)  # the session key the new pair carries (SEC-05)
        except IntegrityError:  # a simultaneous sign-up took the address after validate_email's check (BUG-84)
            raise serializers.ValidationError({"email": [EMAIL_TAKEN]}) from None
        return user


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


class PasswordChangeSerializer(serializers.Serializer):
    """The signed-in user's current password and a new one, checked against their email and name (AUTH-CQ-04 b)."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context["user"].check_password(value):
            raise serializers.ValidationError(CURRENT_PASSWORD_WRONG)
        return value

    def validate(self, attrs):
        problems = password_problems(attrs["new_password"], self.context["user"])
        if problems:
            raise serializers.ValidationError({"new_password": problems})
        return attrs


class FeedbackReportSerializer(serializers.Serializer):
    report_type = serializers.ChoiceField(choices=["Bug", "Feedback"])
    message = serializers.CharField(max_length=2000, allow_blank=True)
    campaign_id = serializers.IntegerField(required=False)
    campaign_name = serializers.CharField(required=False, allow_blank=True)
    warband_id = serializers.IntegerField(required=False)
    warband_name = serializers.CharField(required=False, allow_blank=True)

    def validate_message(self, value):
        message = value.strip()
        if not message:
            raise serializers.ValidationError("Message is required.")
        return message
