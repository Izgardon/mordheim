from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers


class RegisterSerializer(serializers.ModelSerializer):
    name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField()

    class Meta:
        model = get_user_model()
        fields = ("id", "email", "password", "name")

    def validate_email(self, value):
        email = value.strip().lower()
        user_model = get_user_model()
        if user_model.objects.filter(username=email).exists():
            raise serializers.ValidationError("User already exists")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        name = validated_data.pop("name", "")
        email = validated_data.get("email", "")
        user_model = get_user_model()
        user = user_model(username=email, email=email, first_name=name)
        user.set_password(validated_data["password"])
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", allow_blank=True)

    class Meta:
        model = get_user_model()
        fields = ("id", "email", "name")
