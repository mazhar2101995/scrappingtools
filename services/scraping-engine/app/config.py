import os

API_INTERNAL_SECRET = os.getenv("API_INTERNAL_SECRET", "dev_internal_secret_key")
PLAYWRIGHT_HEADLESS = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() == "true"
MAX_CONTENT_LENGTH_BYTES = 10 * 1024 * 1024  # 10 MB limit
DEFAULT_TIMEOUT_SECONDS = 15

