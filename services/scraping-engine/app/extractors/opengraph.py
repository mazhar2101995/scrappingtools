from typing import Any, Dict
from bs4 import BeautifulSoup
from app.normalizers.cleaner import clean_text

class OpenGraphExtractor:
    """Extracts OpenGraph, Twitter Cards, and standard HTML meta tags."""

    @staticmethod
    def extract(soup: BeautifulSoup) -> Dict[str, Any]:
        meta_tags: Dict[str, Any] = {}

        def get_meta(property_name: str, attr="property") -> str | None:
            tag = soup.find("meta", attrs={attr: property_name})
            return tag.get("content") if tag and tag.get("content") else None

        title = get_meta("og:title") or get_meta("twitter:title")
        description = get_meta("og:description") or get_meta("description", attr="name")
        image = get_meta("og:image") or get_meta("twitter:image")
        canonical = soup.find("link", rel="canonical")

        meta_tags["title"] = clean_text(title)
        meta_tags["description"] = clean_text(description)
        meta_tags["images"] = [image] if image else []
        meta_tags["canonical_url"] = canonical.get("href") if canonical and canonical.get("href") else None

        return meta_tags

