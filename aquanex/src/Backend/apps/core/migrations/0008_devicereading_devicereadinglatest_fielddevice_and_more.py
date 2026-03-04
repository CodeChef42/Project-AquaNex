# Generated manually to record unmanaged model state without DB DDL.
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_workspace_layout_file_name_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name='Microcontroller',
                    fields=[
                        ('id', models.BigAutoField(primary_key=True, serialize=False)),
                        ('mcu_id', models.CharField(max_length=120)),
                        ('protocol', models.CharField(blank=True, max_length=30, null=True)),
                        ('firmware', models.CharField(blank=True, max_length=60, null=True)),
                        ('status', models.CharField(default='online', max_length=20)),
                        ('lat', models.FloatField(blank=True, null=True)),
                        ('lng', models.FloatField(blank=True, null=True)),
                        ('last_seen', models.DateTimeField(blank=True, null=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('gateway', models.ForeignKey(db_column='gateway_id', on_delete=django.db.models.deletion.CASCADE, related_name='microcontrollers', to='core.gateway')),
                        ('workspace', models.ForeignKey(db_column='workspace_id', on_delete=django.db.models.deletion.CASCADE, related_name='microcontrollers', to='core.workspace')),
                    ],
                    options={
                        'db_table': 'microcontrollers',
                        'managed': False,
                        'unique_together': {('workspace', 'gateway', 'mcu_id')},
                    },
                ),
                migrations.CreateModel(
                    name='FieldDevice',
                    fields=[
                        ('id', models.BigAutoField(primary_key=True, serialize=False)),
                        ('mcu_id', models.CharField(max_length=120)),
                        ('device_id', models.CharField(max_length=120)),
                        ('device_type', models.CharField(max_length=40)),
                        ('metric_key', models.CharField(blank=True, max_length=60, null=True)),
                        ('status', models.CharField(default='online', max_length=20)),
                        ('lat', models.FloatField(blank=True, null=True)),
                        ('lng', models.FloatField(blank=True, null=True)),
                        ('metadata', models.JSONField(blank=True, default=dict)),
                        ('last_seen', models.DateTimeField(blank=True, null=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('gateway', models.ForeignKey(db_column='gateway_id', on_delete=django.db.models.deletion.CASCADE, related_name='field_devices', to='core.gateway')),
                        ('workspace', models.ForeignKey(db_column='workspace_id', on_delete=django.db.models.deletion.CASCADE, related_name='field_devices', to='core.workspace')),
                    ],
                    options={
                        'db_table': 'field_devices',
                        'managed': False,
                        'unique_together': {('workspace', 'gateway', 'device_id')},
                    },
                ),
                migrations.CreateModel(
                    name='DeviceReadingLatest',
                    fields=[
                        ('id', models.BigAutoField(primary_key=True, serialize=False)),
                        ('mcu_id', models.CharField(max_length=120)),
                        ('device_id', models.CharField(max_length=120)),
                        ('ts', models.DateTimeField()),
                        ('lat', models.FloatField(blank=True, null=True)),
                        ('lng', models.FloatField(blank=True, null=True)),
                        ('readings', models.JSONField(blank=True, default=dict)),
                        ('gateway', models.ForeignKey(db_column='gateway_id', on_delete=django.db.models.deletion.CASCADE, related_name='device_readings_latest', to='core.gateway')),
                        ('workspace', models.ForeignKey(db_column='workspace_id', on_delete=django.db.models.deletion.CASCADE, related_name='device_readings_latest', to='core.workspace')),
                    ],
                    options={
                        'db_table': 'device_readings_latest',
                        'managed': False,
                        'unique_together': {('workspace', 'gateway', 'device_id')},
                    },
                ),
                migrations.CreateModel(
                    name='DeviceReading',
                    fields=[
                        ('id', models.BigAutoField(primary_key=True, serialize=False)),
                        ('mcu_id', models.CharField(max_length=120)),
                        ('device_id', models.CharField(max_length=120)),
                        ('ts', models.DateTimeField()),
                        ('lat', models.FloatField(blank=True, null=True)),
                        ('lng', models.FloatField(blank=True, null=True)),
                        ('readings', models.JSONField(blank=True, default=dict)),
                        ('gateway', models.ForeignKey(db_column='gateway_id', on_delete=django.db.models.deletion.CASCADE, related_name='device_readings', to='core.gateway')),
                        ('workspace', models.ForeignKey(db_column='workspace_id', on_delete=django.db.models.deletion.CASCADE, related_name='device_readings', to='core.workspace')),
                    ],
                    options={
                        'db_table': 'device_readings',
                        'managed': False,
                    },
                ),
            ],
        ),
    ]

