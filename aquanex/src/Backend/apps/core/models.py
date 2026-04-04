from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models
import uuid

class UserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('Username is required')
        email = extra_fields.get('email')
        if email:
            email = self.normalize_email(email)
            extra_fields['email'] = email
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, password, **extra_fields)

class User(AbstractBaseUser):
    user_id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column='user_id')
    username     = models.CharField(max_length=255, unique=True)
    full_name    = models.CharField(max_length=255, blank=True, null=True)
    email        = models.EmailField(max_length=255)
    secret_key_hash = models.CharField(max_length=255, blank=True, null=True)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    last_login   = models.DateTimeField(blank=True, null=True)
    date_joined  = models.DateTimeField(auto_now_add=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = ['full_name', 'email']

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser

    class Meta:
        db_table = 'users'
        managed  = True

    def __str__(self):
        return self.username

class Customer(models.Model):
    user       = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer')
    name       = models.CharField(max_length=100)
    address    = models.TextField()
    phone      = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers'

    def __str__(self):
        return self.name

class Technician(models.Model):
    user           = models.OneToOneField(User, on_delete=models.CASCADE, related_name='technician')
    name           = models.CharField(max_length=100)
    specialization = models.CharField(max_length=100)
    phone          = models.CharField(max_length=20)
    is_available   = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'technicians'

    def __str__(self):
        return self.name

class PipeSpecification(models.Model):
    material       = models.CharField(max_length=100)
    pressure_class = models.CharField(max_length=50)
    depth          = models.DecimalField(max_digits=10, decimal_places=2)
    nominal_dia    = models.DecimalField(max_digits=10, decimal_places=2)
    pipe_category  = models.CharField(max_length=100)
    water_capacity = models.DecimalField(max_digits=10, decimal_places=2)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pipe_specs'

    def __str__(self):
        return f"{self.material} - {self.pipe_category}"

class Pipe(models.Model):
    pipe_specification = models.ForeignKey(PipeSpecification, on_delete=models.CASCADE)
    start_lng          = models.DecimalField(max_digits=10, decimal_places=7)
    start_lat          = models.DecimalField(max_digits=10, decimal_places=7)
    end_lng            = models.DecimalField(max_digits=10, decimal_places=7)
    end_lat            = models.DecimalField(max_digits=10, decimal_places=7)
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pipes'

    def __str__(self):
        return f"Pipe {self.id}"

class FlowMeter(models.Model):
    pipe       = models.ForeignKey(Pipe, on_delete=models.CASCADE)
    flow       = models.DecimalField(max_digits=10, decimal_places=2)
    type       = models.CharField(max_length=100)
    lng        = models.DecimalField(max_digits=10, decimal_places=7)
    lat        = models.DecimalField(max_digits=10, decimal_places=7)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'flow_meters'

    def __str__(self):
        return f"FlowMeter {self.id} - {self.type}"

class PressureSensor(models.Model):
    pipe       = models.ForeignKey(Pipe, on_delete=models.CASCADE)
    pressure   = models.DecimalField(max_digits=10, decimal_places=2)
    type       = models.CharField(max_length=100)
    lng        = models.DecimalField(max_digits=10, decimal_places=7)
    lat        = models.DecimalField(max_digits=10, decimal_places=7)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pressure_sensors'

    def __str__(self):
        return f"PressureSensor {self.id} - {self.type}"

class Request(models.Model):
    STATUS_CHOICES = [
        ('pending',     'Pending'),
        ('assigned',    'Assigned'),
        ('in_progress', 'In Progress'),
        ('completed',   'Completed'),
        ('cancelled',   'Cancelled'),
    ]

    customer    = models.ForeignKey(Customer, on_delete=models.CASCADE)
    technician  = models.ForeignKey(Technician, on_delete=models.SET_NULL, null=True, blank=True)
    title       = models.CharField(max_length=200)
    description = models.TextField()
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'requests'

    def __str__(self):
        return f"{self.title} - {self.status}"

class Workspace(models.Model):
    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner                   = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workspaces', db_column='owner_id')
    workspace_name          = models.CharField(max_length=255, blank=True, null=True)
    company_name            = models.CharField(max_length=255)
    company_type            = models.CharField(max_length=100, blank=True, null=True)
    location                = models.CharField(max_length=255, blank=True, null=True)
    logo_url                = models.TextField(blank=True, null=True)
    team_size               = models.CharField(max_length=20, blank=True, null=True)
    modules                 = models.JSONField(default=list, blank=True)
    gateway_id              = models.CharField(max_length=100, blank=True, null=True)
    devices                 = models.JSONField(default=list, blank=True)
    invite_emails           = models.JSONField(default=list, blank=True)
    threshold_soil_moisture = models.JSONField(default=list, blank=True)
    threshold_ph            = models.JSONField(default=list, blank=True)
    threshold_pressure      = models.JSONField(default=list, blank=True)
    notifications           = models.JSONField(default=list, blank=True)
    demand_forecasting_plants = models.JSONField(default=list, blank=True)
    demand_forecasting_systems = models.JSONField(default=list, blank=True)
    
    # ✅ LAYOUT MAPPING FIELDS (NEW)
    layout_polygon          = models.JSONField(default=list, blank=True)  # [[lng,lat], [lng,lat], ...]
    layout_area_m2          = models.FloatField(default=0, blank=True, null=True)
    layout_notes            = models.TextField(blank=True, null=True)
    layout_file_name        = models.CharField(max_length=255, blank=True, null=True)
    layout_status           = models.CharField(
        max_length=20,
        choices=[
            ('idle', 'Idle'),
            ('processing', 'Processing'),
            ('ready', 'Ready'),
            ('failed', 'Failed')
        ],
        default='idle'
    )
    layout_job_error        = models.TextField(blank=True, null=True)
    
    status                  = models.CharField(max_length=20, default='active')
    created_at              = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspaces'

    def __str__(self):
        return self.company_name

class WorkspaceInvite(models.Model):
    workspace  = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='invites')
    email      = models.EmailField()
    status     = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspace_invites'

    def __str__(self):
        return f"{self.email} - {self.workspace.company_name}"

class Gateway(models.Model):
    id              = models.CharField(max_length=100, primary_key=True)
    workspace       = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='gateways')
    status          = models.CharField(max_length=20, default='offline')
    firmware        = models.CharField(max_length=50, blank=True, null=True)
    signal_strength = models.IntegerField(blank=True, null=True)
    last_seen       = models.DateTimeField(blank=True, null=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'gateways'

    def __str__(self):
        return self.id


class Incident(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("recovering", "Recovering"),
        ("resolved", "Resolved"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="incidents")
    gateway_id = models.CharField(max_length=100, db_index=True)
    incident_type = models.CharField(max_length=60, db_index=True)
    severity = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open", db_index=True)
    detected_at = models.DateTimeField()
    last_seen_at = models.DateTimeField()
    resolved_at = models.DateTimeField(blank=True, null=True)
    fingerprint = models.CharField(max_length=220, db_index=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "incidents"
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "gateway_id", "incident_type"],
                condition=models.Q(status="open"),
                name="uniq_open_incident_per_type",
            )
        ]

    def __str__(self):
        return f"{self.gateway_id}:{self.incident_type}:{self.status}"


class Microcontroller(models.Model):
    id = models.BigAutoField(primary_key=True)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, db_column='workspace_id', related_name='microcontrollers')
    gateway = models.ForeignKey(Gateway, on_delete=models.CASCADE, db_column='gateway_id', related_name='microcontrollers')
    mcu_id = models.CharField(max_length=120)
    protocol = models.CharField(max_length=30, blank=True, null=True)
    firmware = models.CharField(max_length=60, blank=True, null=True)
    status = models.CharField(max_length=20, default='online')
    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)
    last_seen = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'microcontrollers'
        managed = False
        unique_together = (('workspace', 'gateway', 'mcu_id'),)

    def __str__(self):
        return f"{self.gateway_id}:{self.mcu_id}"


class FieldDevice(models.Model):
    id = models.BigAutoField(primary_key=True)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, db_column='workspace_id', related_name='field_devices')
    gateway = models.ForeignKey(Gateway, on_delete=models.CASCADE, db_column='gateway_id', related_name='field_devices')
    mcu_id = models.CharField(max_length=120)
    device_id = models.CharField(max_length=120)
    device_type = models.CharField(max_length=40)
    metric_key = models.CharField(max_length=60, blank=True, null=True)
    status = models.CharField(max_length=20, default='online')
    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    last_seen = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'field_devices'
        managed = False
        unique_together = (('workspace', 'gateway', 'device_id'),)

    def __str__(self):
        return f"{self.gateway_id}:{self.device_id}"


class DeviceReadingLatest(models.Model):
    id = models.BigAutoField(primary_key=True)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, db_column='workspace_id', related_name='device_readings_latest')
    gateway = models.ForeignKey(Gateway, on_delete=models.CASCADE, db_column='gateway_id', related_name='device_readings_latest')
    mcu_id = models.CharField(max_length=120)
    device_id = models.CharField(max_length=120)
    ts = models.DateTimeField()
    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)
    readings = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'device_readings_latest'
        managed = False
        unique_together = (('workspace', 'gateway', 'device_id'),)

    def __str__(self):
        return f"latest:{self.gateway_id}:{self.device_id}"


class DeviceReading(models.Model):
    id = models.BigAutoField(primary_key=True)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, db_column='workspace_id', related_name='device_readings')
    gateway = models.ForeignKey(Gateway, on_delete=models.CASCADE, db_column='gateway_id', related_name='device_readings')
    mcu_id = models.CharField(max_length=120)
    device_id = models.CharField(max_length=120)
    ts = models.DateTimeField()
    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)
    readings = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'device_readings'
        managed = False

    def __str__(self):
        return f"{self.gateway_id}:{self.device_id}@{self.ts.isoformat() if self.ts else 'n/a'}"
