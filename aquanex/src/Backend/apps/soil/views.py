from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import SoilZone, SoilECReading, MitigationAction
from .serializers import (
    SoilZoneListSerializer,
    SoilZoneDetailSerializer,
    SoilECReadingSerializer,
    MitigationActionSerializer,
)


def _workspace_id(request):
    return request.user.workspaces.values_list('id', flat=True).first()


class SoilZoneListView(APIView):
    def get(self, request):
        ws_id = _workspace_id(request)
        zones = SoilZone.objects.filter(workspace_id=ws_id).order_by('name')
        return Response(SoilZoneListSerializer(zones, many=True).data)


class SoilZoneDetailView(APIView):
    def get(self, request, pk):
        ws_id = _workspace_id(request)
        zone = get_object_or_404(SoilZone, pk=pk, workspace_id=ws_id)
        return Response(SoilZoneDetailSerializer(zone).data)


class SoilReadingIngestView(APIView):
    def post(self, request):
        ws_id = _workspace_id(request)
        payload = request.data
        if isinstance(payload, dict):
            payload = [payload]

        created_ids = []
        zone_ids = set()

        for item in payload:
            item['workspace'] = str(ws_id)
            ser = SoilECReadingSerializer(data=item)
            if ser.is_valid():
                reading = ser.save()
                created_ids.append(str(reading.id))
                zone_ids.add(str(reading.zone_id))
            else:
                return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        # Trigger async threshold check per affected zone
        from .tasks import check_soil_threshold
        for zid in zone_ids:
            check_soil_threshold.delay(zid)

        return Response({'created': len(created_ids), 'ids': created_ids}, status=status.HTTP_201_CREATED)


class SoilZoneAnalyzeView(APIView):
    def post(self, request, pk):
        ws_id = _workspace_id(request)
        zone = get_object_or_404(SoilZone, pk=pk, workspace_id=ws_id)
        from .tasks import request_soil_analysis
        request_soil_analysis.delay(str(zone.id))
        return Response({'queued': True, 'zone_id': str(zone.id)})


class MitigationListView(APIView):
    def get(self, request):
        ws_id = _workspace_id(request)
        qs = MitigationAction.objects.filter(workspace_id=ws_id).order_by('-created_at')
        return Response(MitigationActionSerializer(qs, many=True).data)


class MitigationUpdateView(APIView):
    def patch(self, request, pk):
        ws_id = _workspace_id(request)
        action = get_object_or_404(MitigationAction, pk=pk, workspace_id=ws_id)
        ser = MitigationActionSerializer(action, data=request.data, partial=True)
        if ser.is_valid():
            new_status = request.data.get('status')
            if new_status == 'approved':
                ser.save(approved_at=timezone.now(), approved_by=request.user)
            else:
                ser.save()
            return Response(ser.data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
