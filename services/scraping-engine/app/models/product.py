from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class ScrapeRequest(BaseModel):
    url: str
    brand_hint: Optional[str] = None
    use_browser: bool = False
    timeout_seconds: int = 15

class ExtractedProductData(BaseModel):
    success: bool = True
    source_url: str
    canonical_url: Optional[str] = None
    brand: str
    title: str
    model_number: Optional[str] = None
    mpn: Optional[str] = None
    ean: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = "USD"
    availability: Optional[str] = "in_stock"
    attributes: Dict[str, Any] = Field(default_factory=dict)
    compatible_models: List[str] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)
    content_hash: str
    source_language: str = "en"
    execution_duration_ms: int = 0
    extraction_strategy: str = "generic"
    extracted_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    error_message: Optional[str] = None

