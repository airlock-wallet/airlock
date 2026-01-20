import os
from slowapi import Limiter
from core.utils import get_real_ip

# Retrieve Redis URL from environment variables; default to localhost if not set
# Format: redis://:password@host:port/db_index
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Initialize the limiter using Redis as shared storage
# If inside a controller, you can use @limiter.limit("60/minute") to set rate limits for specific endpoints
limiter = Limiter(
    key_func=get_real_ip,
    default_limits=["60/minute"],
    storage_uri=REDIS_URL
)