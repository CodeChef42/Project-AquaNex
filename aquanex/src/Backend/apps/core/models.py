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
        extra_fields.setdefault('role', 'admin')
        return self.create_user(username, password, **extra_fields)


class User(AbstractBaseUser):
    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column='user_id')
    username = models.CharField(max_length=255, unique=True)
    full_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(max_length=255)
    role = models.CharField(max_length=50, blank=True, null=True)
    password = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    last_login = models.DateTimeField(blank=True, null=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['full_name', 'email', 'role']

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser

    class Meta:
        db_table = 'users'
        managed = True

    def __str__(self):
        return f"{self.username} - {self.role}"


class Customer(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer')
    name = models.CharField(max_length=100)
    address = models.TextField()
    phone = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers'

    def __str__(self):
        return self.name


class Technician(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='technician')
    name = models.CharField(max_length=100)
    specialization = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'technicians'

    def __str__(self):
        return self.name


class PipeSpecification(models.Model):
    material = models.CharField(max_length=100)
    pressure_class = models.CharField(max_length=50)
    depth = models.DecimalField(max_digits=10, decimal_places=2)
    nominal_dia = models.DecimalField(max_digits=10, decimal_places=2)
    pipe_category = models.CharField(max_length=100)
    water_capacity = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pipe_specs'

    def __str__(self):
        return f"{self.material} - {self.pipe_category}"


class Pipe(models.Model):
    pipe_specification = models.ForeignKey(PipeSpecification, on_delete=models.CASCADE)
    start_lng = models.DecimalField(max_digits=10, decimal_places=7)
    start_lat = models.DecimalField(max_digits=10, decimal_places=7)
    end_lng = models.DecimalField(max_digits=10, decimal_places=7)
    end_lat = models.DecimalField(max_digits=10, decimal_places=7)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pipes'

    def __str__(self):
        return f"Pipe {self.id}"


class FlowMeter(models.Model):
    pipe = models.ForeignKey(Pipe, on_delete=models.CASCADE)
    flow = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=100)
    lng = models.DecimalField(max_digits=10, decimal_places=7)
    lat = models.DecimalField(max_digits=10, decimal_places=7)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'flow_meters'

    def __str__(self):
        return f"FlowMeter {self.id} - {self.type}"


class PressureSensor(models.Model):
    pipe = models.ForeignKey(Pipe, on_delete=models.CASCADE)
    pressure = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=100)
    lng = models.DecimalField(max_digits=10, decimal_places=7)
    lat = models.DecimalField(max_digits=10, decimal_places=7)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pressure_sensors'

    def __str__(self):
        return f"PressureSensor {self.id} - {self.type}"


class Request(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    technician = models.ForeignKey(Technician, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'requests'

    def __str__(self):
        return f"{self.title} - {self.status}"


class Workspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workspaces')
    company_name = models.CharField(max_length=255)
    company_type = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    logo_url = models.TextField(blank=True, null=True)
    team_size = models.CharField(max_length=20, blank=True, null=True)
    modules = models.JSONField(default=list)
    gateway_id = models.CharField(max_length=100, blank=True, null=True)
    threshold_soil_moisture = models.JSONField(default=list)
    threshold_ph = models.JSONField(default=list)
    threshold_pressure = models.JSONField(default=list)
    notifications = models.JSONField(default=list)
    status = models.CharField(max_length=20, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspaces'

    def __str__(self):
        return self.company_name


class WorkspaceInvite(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='invites')
    email = models.EmailField()
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspace_invites'

    def __str__(self):
        return f"{self.email} - {self.workspace.company_name}"


class Gateway(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='gateways')
    status = models.CharField(max_length=20, default='offline')
    firmware = models.CharField(max_length=50, blank=True, null=True)
    signal_strength = models.IntegerField(blank=True, null=True)
    last_seen = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'gateways'

    def __str__(self):
        return self.id

from .models import Workspace, WorkspaceInvite, Gateway

class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = '__all__'
        read_only_fields = ['id', 'owner', 'created_at']

class WorkspaceInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceInvite
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class GatewaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Gateway
        fields = '__all__'
        read_only_fields = ['created_at']
