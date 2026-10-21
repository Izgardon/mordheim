from typing import Any

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

NAME_MAX_LENGTH = 40  # a display name (decision 2)
EMAIL_MAX_LENGTH = 150  # the email is also the username, a varchar(150) (BUG-84)
EMAIL_TAKEN = "User already exists"


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
        except IntegrityError:  # a simultaneous sign-up took the address after validate_email's check (BUG-84)
            raise serializers.ValidationError({"email": [EMAIL_TAKEN]}) from None
        return user


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", allow_blank=True)

    class Meta:
        model = get_user_model()
        fields = ("id", "email", "name")


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"
    email = serializers.EmailField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password")

        if not email or not password:
            raise serializers.ValidationError("Email and password are required")

        user = authenticate(username=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials")

        self.user = user
        refresh = self.get_token(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),  # type: ignore[attr-defined]
        }


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)  # checked against the user in the view


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
