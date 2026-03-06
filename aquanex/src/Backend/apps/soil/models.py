import uuid
from django.db import models
from apps.core.models import Workspace, FieldDevice, User


class SoilZone(models.Model):
    TEXTURE_CHOICES = [
        ('sandy', 'Sandy'),
        ('loam',  'Loam'),
        ('clay',  'Clay'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace    = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='soil_zones')
    name         = models.CharField(max_length=255)
    boundary     = models.JSONField(help_text='GeoJSON Polygon geometry')
    area_ha      = models.FloatField(default=0.0)
    soil_texture = models.CharField(max_length=10, choices=TEXTURE_CHOICES, default='loam')
    ec_threshold = models.FloatField(default=4.0, help_text='Alert threshold in dS/m')
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'soil_zones'

    def __str__(self):
        return f"{self.name} ({self.workspace_id})"


class SoilSensor(models.Model):
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    zone      = models.ForeignKey(SoilZone, on_delete=models.CASCADE, related_name='sensors')
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='soil_sensors')
    device    = models.ForeignKey(
        FieldDevice, on_delete=models.SET_NULL, null=True, blank=True, related_name='soil_sensors'
    )
    location  = models.JSONField(help_text='GeoJSON Point geometry')
    label     = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'soil_sensors'

    def __str__(self):
        return f"{self.label or self.id} @ {self.zone.name}"


class SoilECReading(models.Model):
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sensor    = models.ForeignKey(SoilSensor, on_delete=models.CASCADE, related_name='readings')
    zone      = models.ForeignKey(SoilZone, on_delete=models.CASCADE, related_name='readings')
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='ec_readings')
    ec_value  = models.FloatField(help_text='Electrical conductivity in dS/m')
    timestamp = models.DateTimeField()

    class Meta:
        db_table = 'soil_ec_readings'
        indexes = [
            models.Index(fields=['zone', 'timestamp']),
            models.Index(fields=['workspace', 'timestamp']),
        ]

    def __str__(self):
        return f"EC={self.ec_value} dS/m @ {self.timestamp.isoformat()}"


class MitigationAction(models.Model):
    ACTION_CHOICES = [
        ('leaching',  'Leaching'),
        ('gypsum',    'Gypsum Application'),
        ('drainage',  'Drainage Improvement'),
        ('other',     'Other'),
    ]
    STATUS_CHOICES = [
        ('pending',     'Pending'),
        ('approved',    'Approved'),
        ('in_progress', 'In Progress'),
        ('completed',   'Completed'),
        ('rejected',    'Rejected'),
    ]

    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    zone              = models.ForeignKey(SoilZone, on_delete=models.CASCADE, related_name='mitigations')
    workspace         = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='mitigations')
    action_type       = models.CharField(max_length=20, choices=ACTION_CHOICES)
    status            = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    parameters        = models.JSONField(default=dict, blank=True)
    ai_recommendation = models.JSONField(null=True, blank=True)
    triggered_ec      = models.FloatField(null=True, blank=True, help_text='EC value that triggered this action')
    approved_at       = models.DateTimeField(null=True, blank=True)
    approved_by       = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_mitigations'
    )
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'soil_mitigation_actions'

    def __str__(self):
        return f"{self.action_type} [{self.status}] zone={self.zone_id}"
