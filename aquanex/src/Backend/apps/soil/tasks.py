import os
import logging
import requests
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


def _soil_analyze_url():
    raw = os.environ.get('ML_SERVICE_URL', 'http://localhost:8001').strip()
    base = raw.rstrip('/')
    return f'{base}/soil/analyze'


@shared_task(
    bind=True,
    autoretry_for=(requests.exceptions.RequestException,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={'max_retries': 3},
)
def check_soil_threshold(self, zone_id: str):
    """After each reading batch, check if recent avg EC exceeds threshold.
    If so, create a pending MitigationAction and trigger AI analysis."""
    from .models import SoilZone, SoilECReading, MitigationAction

    try:
        zone = SoilZone.objects.get(id=zone_id)
    except SoilZone.DoesNotExist:
        logger.warning('check_soil_threshold: zone %s not found', zone_id)
        return

    cutoff = timezone.now() - timedelta(hours=1)
    readings = SoilECReading.objects.filter(zone=zone, timestamp__gte=cutoff)

    if not readings.exists():
        return

    avg_ec = sum(r.ec_value for r in readings) / readings.count()

    if avg_ec <= zone.ec_threshold:
        logger.info(
            'Zone %s EC=%.2f is within threshold %.2f — no action needed',
            zone_id, avg_ec, zone.ec_threshold,
        )
        return

    # Avoid duplicate pending actions
    existing = MitigationAction.objects.filter(zone=zone, status='pending').exists()
    if existing:
        logger.info('Zone %s already has a pending mitigation action', zone_id)
        return

    action = MitigationAction.objects.create(
        zone=zone,
        workspace=zone.workspace,
        action_type='leaching',
        status='pending',
        triggered_ec=round(avg_ec, 3),
        parameters={'avg_ec_1h': round(avg_ec, 3), 'threshold': zone.ec_threshold},
    )
    logger.info(
        'MitigationAction %s created for zone %s (EC=%.2f > %.2f)',
        action.id, zone_id, avg_ec, zone.ec_threshold,
    )

    # Kick off AI analysis to populate ai_recommendation
    request_soil_analysis.delay(zone_id)


@shared_task(
    bind=True,
    autoretry_for=(requests.exceptions.RequestException,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={'max_retries': 3},
)
def request_soil_analysis(self, zone_id: str):
    """POST last 30 days of readings to /soil/analyze.
    Store the returned recommendation in the latest pending MitigationAction."""
    from .models import SoilZone, SoilECReading, MitigationAction
    from django.db.models import Avg
    from django.db.models.functions import TruncDay

    try:
        zone = SoilZone.objects.get(id=zone_id)
    except SoilZone.DoesNotExist:
        logger.warning('request_soil_analysis: zone %s not found', zone_id)
        return

    cutoff_30d = timezone.now() - timedelta(days=30)
    cutoff_90d = timezone.now() - timedelta(days=90)

    # Recent readings for IDW input
    recent_readings = list(
        SoilECReading.objects
        .filter(zone=zone, timestamp__gte=cutoff_30d)
        .select_related('sensor')
        .values('sensor__location', 'sensor_id', 'ec_value')[:200]
    )

    # 90-day daily trend for rate-of-salinization
    history = list(
        SoilECReading.objects
        .filter(zone=zone, timestamp__gte=cutoff_90d)
        .annotate(day=TruncDay('timestamp'))
        .values('day')
        .annotate(ec_avg=Avg('ec_value'))
        .order_by('day')
        .values_list('day', 'ec_avg')
    )

    readings_payload = []
    for r in recent_readings:
        loc = r['sensor__location'] or {}
        coords = loc.get('coordinates', [0, 0])
        readings_payload.append({
            'sensor_id': str(r['sensor_id']),
            'location': {'lat': coords[1], 'lng': coords[0]},
            'ec_value': r['ec_value'],
        })

    history_payload = [
        {'date': day.date().isoformat(), 'ec_avg': round(ec_avg, 3)}
        for day, ec_avg in history
    ]

    # Latest reading for ec_water proxy
    latest = SoilECReading.objects.filter(zone=zone).order_by('-timestamp').first()
    ec_water = round(latest.ec_value * 0.2, 3) if latest else 1.5

    payload = {
        'zone_id': zone_id,
        'area_ha': zone.area_ha,
        'soil_texture': zone.soil_texture,
        'ec_threshold': zone.ec_threshold,
        'ec_water': ec_water,
        'readings': readings_payload,
        'history': history_payload,
    }

    timeout = float(os.environ.get('ML_SERVICE_TIMEOUT_SEC', '5'))
    url = _soil_analyze_url()

    response = requests.post(url, json=payload, timeout=timeout)
    response.raise_for_status()
    result = response.json()

    # Store in the most recent pending/approved MitigationAction for this zone
    action = (
        MitigationAction.objects
        .filter(zone=zone, status__in=['pending', 'approved'])
        .order_by('-created_at')
        .first()
    )
    if action:
        action.ai_recommendation = result
        action.save(update_fields=['ai_recommendation', 'updated_at'])
        logger.info(
            'AI recommendation stored in MitigationAction %s for zone %s alert=%s',
            action.id, zone_id, result.get('alert_level'),
        )
    else:
        logger.info(
            'request_soil_analysis: no pending action for zone %s; result=%s',
            zone_id, result,
        )

    return result
