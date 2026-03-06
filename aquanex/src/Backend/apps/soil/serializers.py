from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from django.db.models import Avg
from django.db.models.functions import TruncDay
from .models import SoilZone, SoilSensor, SoilECReading, MitigationAction


class SoilZoneListSerializer(serializers.ModelSerializer):
    latest_ec    = serializers.SerializerMethodField()
    sensor_count = serializers.SerializerMethodField()

    class Meta:
        model  = SoilZone
        fields = [
            'id', 'name', 'boundary', 'area_ha', 'soil_texture',
            'ec_threshold', 'latest_ec', 'sensor_count', 'created_at',
        ]

    def get_latest_ec(self, obj):
        reading = obj.readings.order_by('-timestamp').first()
        return reading.ec_value if reading else None

    def get_sensor_count(self, obj):
        return obj.sensors.filter(is_active=True).count()


class SoilZoneDetailSerializer(serializers.ModelSerializer):
    latest_ec    = serializers.SerializerMethodField()
    sensor_count = serializers.SerializerMethodField()
    trend_data   = serializers.SerializerMethodField()

    class Meta:
        model  = SoilZone
        fields = [
            'id', 'name', 'boundary', 'area_ha', 'soil_texture',
            'ec_threshold', 'latest_ec', 'sensor_count', 'trend_data',
            'created_at', 'updated_at',
        ]

    def get_latest_ec(self, obj):
        reading = obj.readings.order_by('-timestamp').first()
        return reading.ec_value if reading else None

    def get_sensor_count(self, obj):
        return obj.sensors.filter(is_active=True).count()

    def get_trend_data(self, obj):
        cutoff = timezone.now() - timedelta(days=90)
        qs = (
            obj.readings
            .filter(timestamp__gte=cutoff)
            .annotate(day=TruncDay('timestamp'))
            .values('day')
            .annotate(ec_avg=Avg('ec_value'))
            .order_by('day')
        )
        return [
            {'date': entry['day'].date().isoformat(), 'ec_avg': round(entry['ec_avg'], 3)}
            for entry in qs
        ]


class SoilSensorSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SoilSensor
        fields = ['id', 'zone', 'workspace', 'device', 'location', 'label', 'is_active']


class SoilECReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SoilECReading
        fields = ['id', 'sensor', 'zone', 'workspace', 'ec_value', 'timestamp']
        read_only_fields = ['id']

    def validate(self, attrs):
        sensor = attrs.get('sensor')
        zone   = attrs.get('zone')
        if sensor and zone and str(sensor.zone_id) != str(zone.id):
            raise serializers.ValidationError('Sensor does not belong to the specified zone.')
        return attrs


class MitigationActionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MitigationAction
        fields = [
            'id', 'zone', 'workspace', 'action_type', 'status',
            'parameters', 'ai_recommendation', 'triggered_ec',
            'approved_at', 'approved_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'ai_recommendation']
