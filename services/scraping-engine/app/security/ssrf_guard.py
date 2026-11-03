import ipaddress
import socket
from urllib.parse import urlparse

class SSRFSecurityError(ValueError):
    """Raised when a URL targets a private, loopback, or forbidden network address."""
    pass

def validate_safe_url(url: str) -> str:
    """
    Validates that a target URL is public and does not point to internal networks,
    localhost, private subnets (RFC 1918), or cloud metadata services.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise SSRFSecurityError(f"Unsupported URL scheme: {parsed.scheme}. Only HTTP/HTTPS are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFSecurityError("Invalid URL: missing hostname")

    # Disallow localhost by string
    if hostname.lower() in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        raise SSRFSecurityError("Access to localhost is strictly prohibited for security.")

    try:
        # Resolve hostname to IP address
        resolved_ips = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise SSRFSecurityError(f"DNS resolution failed for hostname '{hostname}': {e}")

    for addr in resolved_ips:
        ip_str = addr[4][0]
        ip_obj = ipaddress.ip_address(ip_str)

        # Check for private, loopback, link-local, multicast, or reserved IPs
        if (
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_link_local
            or ip_obj.is_multicast
            or ip_obj.is_reserved
        ):
            raise SSRFSecurityError(
                f"Security violation: Hostname '{hostname}' resolved to prohibited IP '{ip_str}'."
            )

    return url

