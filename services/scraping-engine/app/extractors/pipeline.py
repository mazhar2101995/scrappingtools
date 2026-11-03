import hashlib
import time
from typing import Optional
from bs4 import BeautifulSoup
import httpx

from app.models.product import ExtractedProductData
from app.extractors.jsonld import JsonLdExtractor
from app.extractors.opengraph import OpenGraphExtractor
from app.profiles.registry import TraxxasProfile, XrayProfile, BittydesignProfile, BaseBrandProfile
from app.normalizers.cleaner import clean_text, is_valid_ean13

PROFILES = [TraxxasProfile(), XrayProfile(), BittydesignProfile()]

class CascadeScrapingPipeline:
    """Executes the 4-tier cascade extraction pipeline."""

    @staticmethod
    def get_profile(url: str, brand_hint: Optional[str] = None) -> Optional[BaseBrandProfile]:
        if brand_hint:
            for p in PROFILES:
                if p.brand_name.lower() == brand_hint.lower():
                    return p
        for p in PROFILES:
            if p.matches_url(url):
                return p
        return None

    @classmethod
    async def extract_from_html(
        cls, html: str, url: str, brand_hint: Optional[str] = None, duration_ms: int = 0
    ) -> ExtractedProductData:
        soup = BeautifulSoup(html, "lxml")
        content_hash = hashlib.sha256(html.encode("utf-8")).hexdigest()

        # Tier 1: JSON-LD Schema.org
        jsonld_data = JsonLdExtractor.extract(soup)

        # Tier 2: OpenGraph & Meta
        og_data = OpenGraphExtractor.extract(soup)

        # Tier 3: Brand Profile
        profile = cls.get_profile(url, brand_hint)
        brand_data = profile.extract_custom(soup) if profile else {}

        # Merge with strict priority: Brand Profile > JSON-LD > OpenGraph > Generic Headings
        h1_tag = soup.find("h1")
        generic_title = clean_text(h1_tag.get_text()) if h1_tag else "Unknown Product"

        title = brand_data.get("title") or jsonld_data.get("title") or og_data.get("title") or generic_title
        brand = brand_data.get("brand") or jsonld_data.get("brand") or (brand_hint.capitalize() if brand_hint else "Generic")
        description = brand_data.get("description") or jsonld_data.get("description") or og_data.get("description")

        # Barcode validation
        raw_ean = brand_data.get("ean") or jsonld_data.get("ean")
        clean_ean = raw_ean if (raw_ean and is_valid_ean13(raw_ean)) else None

        # Images consolidation
        images = []
        for img_list in [brand_data.get("images", []), jsonld_data.get("images", []), og_data.get("images", [])]:
            for img in img_list:
                if img and img not in images:
                    images.append(img)

        # Attributes merge
        attributes = {}
        attributes.update(jsonld_data.get("attributes", {}))
        attributes.update(brand_data.get("attributes", {}))

        return ExtractedProductData(
            success=True,
            source_url=url,
            canonical_url=og_data.get("canonical_url") or url,
            brand=brand,
            title=title,
            model_number=brand_data.get("model_number") or jsonld_data.get("mpn"),
            mpn=brand_data.get("mpn") or jsonld_data.get("mpn"),
            ean=clean_ean,
            sku=brand_data.get("sku") or jsonld_data.get("sku"),
            description=description,
            price=jsonld_data.get("price"),
            currency=jsonld_data.get("currency", "USD"),
            availability=jsonld_data.get("availability", "in_stock"),
            attributes=attributes,
            compatible_models=brand_data.get("compatible_models", []),
            images=images,
            content_hash=content_hash,
            execution_duration_ms=duration_ms,
            extraction_strategy=profile.brand_name if profile else "cascade_generic",
        )

