import logging
import os
import signal
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

logger = logging.getLogger("aquanex.backendping")

# ─── Configuration ─────────────────────────────────────────────────────────────
# All values can be overridden via Render → Environment dashboard.

PING_URL      = os.environ.get(
    "BACKENDPING_URL",
    "https://project-aquanex-xtn5.onrender.com/api/health/"
)
PING_INTERVAL = int(os.environ.get("BACKENDPING_INTERVAL", 600))   # 10 min
PING_TIMEOUT  = int(os.environ.get("BACKENDPING_TIMEOUT",  15))    # seconds
MAX_FAILURES  = int(os.environ.get("BACKENDPING_MAX_FAILURES", 5))


# ─── Core request ──────────────────────────────────────────────────────────────

def _ping(url: str, timeout: int) -> tuple[bool, int, str]:
    """
    Send a single GET to `url`.
    Returns (success: bool, status_code: int, message: str).
    """
    try:
        req = urllib.request.Request(url, method="GET")
        req.add_header("User-Agent", "AquaNex-BackendPing/1.0")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return (200 <= resp.status < 300), resp.status, "OK"
    except urllib.error.HTTPError as e:
        return False, e.code, f"HTTP {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        return False, 0, f"URLError: {e.reason}"
    except TimeoutError:
        return False, 0, "Request timed out"
    except Exception as e:
        return False, 0, f"{type(e).__name__}: {e}"


# ─── Pinger ────────────────────────────────────────────────────────────────────

class BackendPinger:
    """
    Singleton daemon thread — pings the health endpoint on a fixed interval.

    Start once at Gunicorn boot (wsgi.py):

        from apps.core.backendping import BackendPinger
        BackendPinger.start()
    """

    _instance: "BackendPinger | None" = None
    _lock = threading.Lock()

    def __init__(self):
        self._stop  = threading.Event()
        self._thread: threading.Thread | None = None

        # Public stats
        self.total_pings       = 0
        self.total_successes   = 0
        self.consecutive_fails = 0
        self.last_ping_at: datetime | None = None
        self.last_status = "not started"

    # ── loop ───────────────────────────────────────────────────────────────────

    def _loop(self):
        logger.info(
            "[BackendPing] Started — url=%s  interval=%ss",
            PING_URL, PING_INTERVAL,
        )
        # Give Gunicorn/Django time to fully boot before the first ping
        if self._stop.wait(PING_INTERVAL):
            return  # stop was called during startup wait — exit cleanly

        while not self._stop.is_set():
            self.total_pings  += 1
            self.last_ping_at  = datetime.now(timezone.utc)

            ok, code, msg = _ping(PING_URL, PING_TIMEOUT)

            if ok:
                self.consecutive_fails  = 0
                self.total_successes   += 1
                self.last_status        = f"✓ {code}"
                logger.info(
                    "[BackendPing] ✓ ping #%d → %s [%d]",
                    self.total_pings, PING_URL, code,
                )
            else:
                self.consecutive_fails += 1
                self.last_status        = f"✗ {msg}"
                logger.warning(
                    "[BackendPing] ✗ ping #%d FAILED → %s | %s  (failures: %d/%d)",
                    self.total_pings, PING_URL, msg,
                    self.consecutive_fails, MAX_FAILURES,
                )
                if self.consecutive_fails >= MAX_FAILURES:
                    logger.error(
                        "[BackendPing] ⚠ %d consecutive failures — "
                        "service may be unreachable.",
                        MAX_FAILURES,
                    )

            self._stop.wait(PING_INTERVAL)

        logger.info("[BackendPing] Stopped.")

    # ── public API ─────────────────────────────────────────────────────────────

    @classmethod
    def start(cls) -> "BackendPinger":
        """
        Start the pinger. Singleton-safe — calling multiple times is harmless.
        """
        with cls._lock:
            if cls._instance is None:
                inst = cls()
                inst._stop.clear()
                inst._thread = threading.Thread(
                    target=inst._loop,
                    name="aquanex-backendping",
                    daemon=True,  # thread dies automatically when Gunicorn exits
                )
                inst._thread.start()
                cls._instance = inst
            return cls._instance

    @classmethod
    def stop(cls):
        """Gracefully stop the pinger thread."""
        with cls._lock:
            if cls._instance:
                cls._instance._stop.set()
                if cls._instance._thread:
                    cls._instance._thread.join(timeout=5)

    @classmethod
    def status(cls) -> dict:
        """Return a snapshot of pinger stats — useful for /api/health/ or admin."""
        i = cls._instance
        if not i:
            return {"running": False}
        return {
            "running":              i._thread.is_alive() if i._thread else False,
            "url":                  PING_URL,
            "interval_seconds":     PING_INTERVAL,
            "total_pings":          i.total_pings,
            "total_successes":      i.total_successes,
            "consecutive_failures": i.consecutive_fails,
            "last_ping_at":         i.last_ping_at.isoformat() if i.last_ping_at else None,
            "last_status":          i.last_status,
        }


# ─── Standalone / local test ───────────────────────────────────────────────────
# Run directly to test without Django:
#   BACKENDPING_URL=http://localhost:8000/api/health/ python backendping.py

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%H:%M:%S",
    )

    def _shutdown(sig, frame):
        print("\n[BackendPing] Shutting down…")
        BackendPinger.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    print(f"[BackendPing] Standalone test mode")
    print(f"  URL      → {PING_URL}")
    print(f"  Interval → {PING_INTERVAL}s  ({PING_INTERVAL // 60}m)")
    print(f"  Timeout  → {PING_TIMEOUT}s")
    print(f"  Ctrl+C to quit\n")

    BackendPinger.start()

    while True:
        time.sleep(60)
        s = BackendPinger.status()
        print(
            f"  [stats]  pings={s['total_pings']}  "
            f"ok={s['total_successes']}  "
            f"last={s['last_status']}"
        )