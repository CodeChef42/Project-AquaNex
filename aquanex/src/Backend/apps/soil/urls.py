from django.urls import path
from .views import (
    SoilZoneListView,
    SoilZoneDetailView,
    SoilZoneAnalyzeView,
    SoilReadingIngestView,
    MitigationListView,
    MitigationUpdateView,
)

urlpatterns = [
    path('zones/',                  SoilZoneListView.as_view()),
    path('zones/<uuid:pk>/',        SoilZoneDetailView.as_view()),
    path('zones/<uuid:pk>/analyze/', SoilZoneAnalyzeView.as_view()),
    path('readings/',               SoilReadingIngestView.as_view()),
    path('mitigations/',            MitigationListView.as_view()),
    path('mitigations/<uuid:pk>/',  MitigationUpdateView.as_view()),
]
