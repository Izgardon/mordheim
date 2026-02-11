from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.db.models import Q
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .emails import send_password_reset_email
from .serializers import (
    EmailTokenObtainPairSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)


def _get_user_by_email(email):
    user_model = get_user_model()
    return (
        user_model.objects.filter(
            Q(email__iexact=email) | Q(username__iexact=email), is_active=True
        )
        .only("id", "email")
        .first()
    )


def _get_user_from_uid(uid):
    user_model = get_user_model()
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
    except (TypeError, ValueError, OverflowError):
        return None
    return user_model.objects.filter(pk=user_id, is_active=True).first()


def _build_reset_url(uid, token):
    from django.conf import settings

    base = getattr(settings, "FRONTEND_RESET_URL", "")
    if not base:
        base = settings.FRONTEND_URL.rstrip("/") + settings.FRONTEND_RESET_PATH
    return f"{base}?uid={uid}&token={token}"


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            },
            status=201,
        )


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = _get_user_by_email(email)
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = PasswordResetTokenGenerator().make_token(user)
            reset_url = _build_reset_url(uid, token)
            send_password_reset_email(user.email or email, reset_url)

        return Response(
            {
                "detail": "If an account exists for that email, a reset link has been sent."
            }
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]

        user = _get_user_from_uid(uid)
        if not user or not PasswordResetTokenGenerator().check_token(user, token):
            return Response({"detail": "Invalid or expired token."}, status=400)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password has been reset."})
