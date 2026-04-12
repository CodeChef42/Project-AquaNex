from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import update_workspace_layout  # add to existing imports line
from django.http import JsonResponse
from .views import (
    GatewayDiscoverView,
    GatewayRegisterView,
    GatewayTelemetryIngestView,
    LayoutUploadView,
    LayoutTaskStatus,  #NEW
    RegisterView,
    CheckAvailabilityView,
    LoginView,
    UserProfileView,
    predict_breakage,
    google_auth,
    OnboardingView, 
    LayoutModuleRecommendationView,
    ChangePasswordView,
    WorkspaceListView,
    WorkspaceDeleteView,
    WorkspaceInviteView,
    AcceptInviteView,
    IncidentListView,
    IncidentDetailView,
    IncidentResolveView,
    IncidentSeedView,
    PipelineListCreateView,
    PipelineResourcePlanView,
    WeatherCurrentView,
    WeatherForecastView,
    WeatherGeocodeView,
    update_workspace_layout,
    IncidentIngestView,
)

def health(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("health/", health),
    path("incidents/ingest/", IncidentIngestView.as_view()),
    path("incidents/", IncidentListView.as_view(), name="incidents-list"),
    path("incidents/<str:pk>/", IncidentDetailView.as_view(), name="incident-detail"),
    path("incidents/<str:pk>/resolve/", IncidentResolveView.as_view(), name="incident-resolve"),
    path("incidents/seed/", IncidentSeedView.as_view(), name="incident-seed"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/check-availability/", CheckAvailabilityView.as_view(), name="check-availability"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/google/", google_auth, name="google_auth"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/profile/", UserProfileView.as_view(), name="profile"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("ml/predict-breakage/", predict_breakage, name="predict_breakage"),
    path("onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("layout-module-recommendation/", LayoutModuleRecommendationView.as_view(), name="layout-module-recommendation"),
    path("workspace-invite/", WorkspaceInviteView.as_view(), name="workspace-invite"),
    path("accept-invite/<str:token>/", AcceptInviteView.as_view(), name="accept-invite"),
    path("workspaces/", WorkspaceListView.as_view(), name="workspaces"),
    path("onboarding/<str:pk>/delete/", WorkspaceDeleteView.as_view(), name="workspace-delete"),
    path("gateway-discover/", GatewayDiscoverView.as_view(), name="gateway-discover"),
    path("gateway-register/", GatewayRegisterView.as_view(), name="gateway-register"),
    path("gateway-telemetry/", GatewayTelemetryIngestView.as_view(), name="gateway-telemetry"),
    path("layout-upload/", LayoutUploadView.as_view(), name="layout-upload"),
    path("layout-status/<str:task_id>/", LayoutTaskStatus.as_view(), name="layout-status"),
    path("workspace/layout/", update_workspace_layout, name="update-workspace-layout"),
    path("pipelines/", PipelineListCreateView.as_view(), name="pipelines-list-create"),
    path("pipelines/resources-plan/", PipelineResourcePlanView.as_view(), name="pipelines-resources-plan"),
    path("weather/current/", WeatherCurrentView.as_view(), name="weather-current"),
    path("weather/forecast/", WeatherForecastView.as_view(), name="weather-forecast"),
    path("weather/geocode/", WeatherGeocodeView.as_view(), name="weather-geocode"),
    
]
