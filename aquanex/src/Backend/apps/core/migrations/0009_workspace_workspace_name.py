from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_devicereading_devicereadinglatest_fielddevice_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='workspace',
            name='workspace_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
