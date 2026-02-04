from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, LoginView, UserProfileView, predict_breakage


urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile/', UserProfileView.as_view(), name='profile'),
    path('ml/predict-breakage/', predict_breakage, name='predict_breakage'),
]
