from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_incident_incident_uniq_open_incident_per_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="workspace",
            name="demand_forecasting_plants",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="workspace",
            name="demand_forecasting_systems",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
