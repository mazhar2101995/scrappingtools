import re
from typing import Optional

def is_valid_ean13(ean: str) -> bool:
    """Validates an EAN-13 barcode using the standard Modulo-10 checksum algorithm."""
    clean = re.sub(r"[^0-9]", "", ean)
    if len(clean) != 13:
        return False

    total = sum(int(clean[i]) if i % 2 == 0 else int(clean[i]) * 3 for i in range(12))
    checksum = (10 - (total % 10)) % 10
    return checksum == int(clean[12])

def clean_text(text: Optional[str]) -> Optional[str]:
    """Strips excessive whitespace, tabs, and newlines."""
    if not text:
        return None
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned if cleaned else None
