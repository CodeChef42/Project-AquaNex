import uuid
from django.db import migrations, models


def populate_tokens(apps, schema_editor):
    WorkspaceInvite = apps.get_model('core', 'WorkspaceInvite')
    for invite in WorkspaceInvite.objects.all():
        invite.token = uuid.uuid4()
        invite.save(update_fields=['token'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_alter_incident_status_alter_user_password'),
    ]

    operations = [
        # Add token as nullable first so existing rows don't violate NOT NULL
        migrations.AddField(
            model_name='workspaceinvite',
            name='token',
            field=models.UUIDField(default=uuid.uuid4, null=True),
        ),
        # Fill unique UUIDs for any existing rows
        migrations.RunPython(populate_tokens, migrations.RunPython.noop),
        # Now enforce uniqueness and remove null
        migrations.AlterField(
            model_name='workspaceinvite',
            name='token',
            field=models.UUIDField(default=uuid.uuid4, unique=True),
        ),
        migrations.AddField(
            model_name='workspaceinvite',
            name='expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
