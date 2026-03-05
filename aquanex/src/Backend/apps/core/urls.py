from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from django.http import JsonResponse
from .views import (
    GatewayDiscoverView,
    GatewayRegisterView,
    GatewayTelemetryIngestView,
    LayoutUploadView, 
    LayoutTaskStatus,  # NEW
    RegisterView, 
    LoginView, 
    UserProfileView, 
    predict_breakage, 
    OnboardingView,
    WorkspaceListView,
)

def health(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("health/", health),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/profile/", UserProfileView.as_view(), name="profile"),
    path("ml/predict-breakage/", predict_breakage, name="predict_breakage"),
    path("onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("workspaces/", WorkspaceListView.as_view(), name="workspaces"),
    path("gateway-discover/", GatewayDiscoverView.as_view(), name="gateway-discover"),
    path("gateway-register/", GatewayRegisterView.as_view(), name="gateway-register"),
    path("gateway-telemetry/", GatewayTelemetryIngestView.as_view(), name="gateway-telemetry"),
    path("layout-upload/", LayoutUploadView.as_view(), name="layout-upload"),
    path("layout-status/<str:task_id>/", LayoutTaskStatus.as_view(), name="layout-status"),
]
