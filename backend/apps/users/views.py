from typing import Any

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.core.throttling import (
    ACCOUNT_THROTTLE_CLASSES,
    FEEDBACK_REPORT_THROTTLE_CLASSES,
    LOGIN_THROTTLE_CLASSES,
    PASSWORD_RESET_CONFIRM_THROTTLE_CLASSES,
    PASSWORD_RESET_REQUEST_THROTTLE_CLASSES,
    REFRESH_THROTTLE_CLASSES,
    REGISTER_THROTTLE_CLASSES,
)

from .emails import (
    RESET_EMAIL_UNAVAILABLE,
    password_reset_email_available,
    send_feedback_report_email,
    send_password_reset_email,
)
from .serializers import (
    FeedbackReportSerializer,
    LoginSerializer,
    NameSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
    password_problems,
)
from .services.accounts import (
    change_password,
    rename,
    reset_link_for,
    set_new_password,
    sign_in,
    sign_out_others,
    user_for_reset_link,
)
from .services.tokens import SessionTokenRefreshSerializer, issue_tokens

RESET_SENT = "If an account exists for that email, a reset link has been sent."
RESET_LINK_INVALID = "Invalid or expired token."


def signed_in(user: Any, tokens: dict[str, str], http_status: int = 200) -> Response:
    """A pair for this device beside the user as `/me` answers it: sign-up, sign-in, a password change and signing out
    everywhere else all answer this, so the app needn't ask `/me` (PERF-50)."""
    return Response({**tokens, "user": UserSerializer(user).data}, status=http_status)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = REGISTER_THROTTLE_CLASSES

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return signed_in(user, issue_tokens(user), http_status=201)


class LoginView(APIView):
    authentication_classes = ()  # a stale bearer header never stops a sign-in
    permission_classes = [permissions.AllowAny]
    throttle_classes = LOGIN_THROTTLE_CLASSES

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return signed_in(user, sign_in(user))


class RefreshView(TokenRefreshView):
    serializer_class = SessionTokenRefreshSerializer  # type: ignore[assignment]
    throttle_classes = REFRESH_THROTTLE_CLASSES


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        """Change the display name (AUTH-NEW-02); `name` is the only field taken."""
        serializer = NameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rename(request.user, serializer.validated_data["name"])
        return Response(UserSerializer(request.user).data)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = PASSWORD_RESET_REQUEST_THROTTLE_CLASSES

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not password_reset_email_available():  # the same answer for every address, before any lookup (BUG-56)
            body = {"detail": RESET_EMAIL_UNAVAILABLE, "code": "email_unavailable", "fields": {}}
            return Response(body, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        link = reset_link_for(serializer.validated_data["email"])
        if link is not None:
            to_email, reset_url = link
            send_password_reset_email(to_email, reset_url)
        return Response({"detail": RESET_SENT})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = PASSWORD_RESET_CONFIRM_THROTTLE_CLASSES

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = user_for_reset_link(data["uid"], data["token"])
        if user is None:
            return Response({"detail": RESET_LINK_INVALID}, status=400)
        problems = password_problems(data["new_password"], user)  # once the link is good: checked against the user
        if problems:
            return Response({"new_password": problems}, status=400)

        set_new_password(user, data["new_password"])  # ends every session too (SEC-05)
        return Response({"detail": "Password has been reset."})


class PasswordChangeView(APIView):
    """`POST auth/password/`: the current and a new password; other devices are signed out, and this one gets a fresh
    pair (AUTH-NEW-03, decisions 1 and 4)."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = ACCOUNT_THROTTLE_CLASSES

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)
        return signed_in(request.user, change_password(request.user, serializer.validated_data["new_password"]))


class SignOutOthersView(APIView):
    """`POST auth/sign-out-others/`: every other device is signed out; this one gets a fresh pair (AUTH-NEW-04)."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = ACCOUNT_THROTTLE_CLASSES

    def post(self, request):
        return signed_in(request.user, sign_out_others(request.user))


class FeedbackReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = FEEDBACK_REPORT_THROTTLE_CLASSES

    def post(self, request):
        serializer = FeedbackReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        sent = send_feedback_report_email(user=request.user, **serializer.validated_data)
        if not sent:
            return Response(
                {"detail": "Unable to send feedback report right now."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"detail": "Feedback report sent."})
