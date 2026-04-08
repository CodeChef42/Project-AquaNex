import asyncio
import httpx
import os

async def start_health_ping():
    url = os.getenv("RENDER_EXTERNAL_URL", "https://ml-service-ohlz.onrender.com") + "/health"
    await asyncio.sleep(60)
    while True:
        try:
            async with httpx.AsyncClient() as client:
                await client.get(url, timeout=10)
                print("Self-ping OK")
        except Exception as e:
            print(f"Self-ping failed: {e}")
        await asyncio.sleep(600)