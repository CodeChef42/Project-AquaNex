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
    LayoutModuleRecommendationView,
    ChangePasswordView,
    WorkspaceListView,
    WorkspaceInviteView,
    IncidentListView,
    IncidentResolveView,
    IncidentSeedView,
)

def health(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("health/", health),
    path("incidents/", IncidentListView.as_view(), name="incidents-list"),
    path("incidents/<str:pk>/resolve/", IncidentResolveView.as_view(), name="incident-resolve"),
    path("incidents/seed/", IncidentSeedView.as_view(), name="incident-seed"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/profile/", UserProfileView.as_view(), name="profile"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("ml/predict-breakage/", predict_breakage, name="predict_breakage"),
    path("onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("layout-module-recommendation/", LayoutModuleRecommendationView.as_view(), name="layout-module-recommendation"),
    path("workspace-invite/", WorkspaceInviteView.as_view(), name="workspace-invite"),
    path("workspaces/", WorkspaceListView.as_view(), name="workspaces"),
    path("gateway-discover/", GatewayDiscoverView.as_view(), name="gateway-discover"),
    path("gateway-register/", GatewayRegisterView.as_view(), name="gateway-register"),
    path("gateway-telemetry/", GatewayTelemetryIngestView.as_view(), name="gateway-telemetry"),
    path("layout-upload/", LayoutUploadView.as_view(), name="layout-upload"),
    path("layout-status/<str:task_id>/", LayoutTaskStatus.as_view(), name="layout-status"),
]
