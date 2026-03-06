import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0009_workspace_workspace_name'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SoilZone',
            fields=[
                ('id',           models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('name',         models.CharField(max_length=255)),
                ('boundary',     models.JSONField(help_text='GeoJSON Polygon geometry')),
                ('area_ha',      models.FloatField(default=0.0)),
                ('soil_texture', models.CharField(
                    choices=[('sandy', 'Sandy'), ('loam', 'Loam'), ('clay', 'Clay')],
                    default='loam', max_length=10,
                )),
                ('ec_threshold', models.FloatField(default=4.0, help_text='Alert threshold in dS/m')),
                ('created_at',   models.DateTimeField(auto_now_add=True)),
                ('updated_at',   models.DateTimeField(auto_now=True)),
                ('workspace',    models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='soil_zones',
                    to='core.workspace',
                )),
            ],
            options={'db_table': 'soil_zones'},
        ),
        migrations.CreateModel(
            name='SoilSensor',
            fields=[
                ('id',         models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('location',   models.JSONField(help_text='GeoJSON Point geometry')),
                ('label',      models.CharField(blank=True, max_length=100)),
                ('is_active',  models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('device',     models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='soil_sensors',
                    to='core.fielddevice',
                )),
                ('workspace',  models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='soil_sensors',
                    to='core.workspace',
                )),
                ('zone',       models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sensors',
                    to='soil.soilzone',
                )),
            ],
            options={'db_table': 'soil_sensors'},
        ),
        migrations.CreateModel(
            name='SoilECReading',
            fields=[
                ('id',        models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('ec_value',  models.FloatField(help_text='Electrical conductivity in dS/m')),
                ('timestamp', models.DateTimeField()),
                ('sensor',    models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='readings',
                    to='soil.soilsensor',
                )),
                ('workspace', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ec_readings',
                    to='core.workspace',
                )),
                ('zone',      models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='readings',
                    to='soil.soilzone',
                )),
            ],
            options={'db_table': 'soil_ec_readings'},
        ),
        migrations.AddIndex(
            model_name='soilecreading',
            index=models.Index(fields=['zone', 'timestamp'], name='soil_ec_rea_zone_id_idx'),
        ),
        migrations.AddIndex(
            model_name='soilecreading',
            index=models.Index(fields=['workspace', 'timestamp'], name='soil_ec_rea_ws_ts_idx'),
        ),
        migrations.CreateModel(
            name='MitigationAction',
            fields=[
                ('id',                models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('action_type',       models.CharField(
                    choices=[
                        ('leaching',  'Leaching'),
                        ('gypsum',    'Gypsum Application'),
                        ('drainage',  'Drainage Improvement'),
                        ('other',     'Other'),
                    ],
                    max_length=20,
                )),
                ('status',            models.CharField(
                    choices=[
                        ('pending',     'Pending'),
                        ('approved',    'Approved'),
                        ('in_progress', 'In Progress'),
                        ('completed',   'Completed'),
                        ('rejected',    'Rejected'),
                    ],
                    default='pending', max_length=20,
                )),
                ('parameters',        models.JSONField(blank=True, default=dict)),
                ('ai_recommendation', models.JSONField(blank=True, null=True)),
                ('triggered_ec',      models.FloatField(blank=True, null=True, help_text='EC value that triggered this action')),
                ('approved_at',       models.DateTimeField(blank=True, null=True)),
                ('created_at',        models.DateTimeField(auto_now_add=True)),
                ('updated_at',        models.DateTimeField(auto_now=True)),
                ('approved_by',       models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='approved_mitigations',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('workspace',         models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='mitigations',
                    to='core.workspace',
                )),
                ('zone',              models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='mitigations',
                    to='soil.soilzone',
                )),
            ],
            options={'db_table': 'soil_mitigation_actions'},
        ),
    ]
