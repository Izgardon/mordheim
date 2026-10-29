from django.urls import path

from .views import (
    AccountDeletionView,
    FeedbackReportView,
    LoginView,
    MeView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    RegisterView,
    SignOutOthersView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("me/deletion/", AccountDeletionView.as_view(), name="account_deletion"),
    path("password/", PasswordChangeView.as_view(), name="password_change"),
    path("sign-out-others/", SignOutOthersView.as_view(), name="sign_out_others"),
    path("feedback-report/", FeedbackReportView.as_view(), name="feedback_report"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path(
        "password-reset-confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
]
