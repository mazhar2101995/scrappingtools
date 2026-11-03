import re
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup
from app.normalizers.cleaner import clean_text

class BaseBrandProfile:
    """Base class for all brand-specific extraction profiles."""
    brand_name: str = "Generic"
    domains: List[str] = []
    requires_browser: bool = False

    def matches_url(self, url: str) -> bool:
        return any(domain in url.lower() for domain in self.domains)

    def extract_custom(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Override to implement brand-specific extraction rules."""
        return {}


class TraxxasProfile(BaseBrandProfile):
    """
    Traxxas Extraction Profile.
    Specialization: Compatible Model Extraction and Parts Numbering.
    """
    brand_name = "Traxxas"
    domains = ["traxxas.com"]

    def extract_custom(self, soup: BeautifulSoup) -> Dict[str, Any]:
        custom: Dict[str, Any] = {"brand": "Traxxas", "compatible_models": []}

        # 1. Traxxas Part/Model Number
        part_tag = soup.select_one(".field--name-field-part-number, .part-number, [data-part-number]")
        if part_tag:
            part_no = clean_text(part_tag.get_text())
            if part_no:
                # e.g., "Part #3350R" -> "3350R"
                clean_mpn = re.sub(r"(?i)part\s*#?:?", "", part_no).strip()
                custom["mpn"] = clean_mpn
                custom["model_number"] = clean_mpn
                custom["sku"] = clean_mpn

        # 2. Traxxas Compatible Models (Preserved Brand Requirement)
        compat_section = soup.select(".accessory-fits-model, .field--name-field-accessory-fits, .compatible-models li, .accessory-fits a")
        models = set()
        for item in compat_section:
            model_text = clean_text(item.get_text())
            if model_text and len(model_text) > 2:
                models.add(model_text)

        custom["compatible_models"] = sorted(list(models))
        return custom


class XrayProfile(BaseBrandProfile):
    """
    Xray Model Racing Cars Profile.
    Specialization: Technical Specifications Matrix.
    """
    brand_name = "Xray"
    domains = ["teamxray.com"]

    def extract_custom(self, soup: BeautifulSoup) -> Dict[str, Any]:
        custom: Dict[str, Any] = {"brand": "Xray", "attributes": {}}

        # 1. Technical specifications table
        spec_rows = soup.select(".tech-specs tr, .spec-table tr, .specs-table tr")
        specs: Dict[str, str] = {}
        for row in spec_rows:
            cols = row.select("td, th")
            if len(cols) >= 2:
                key = clean_text(cols[0].get_text()).lower().replace(" ", "_")
                val = clean_text(cols[1].get_text())
                if key and val:
                    specs[key] = val

        custom["attributes"] = specs

        # 2. Xray Part Number
        part_num = soup.select_one(".part-no, .item-code, #part_number")
        if part_num:
            custom["mpn"] = clean_text(part_num.get_text())
            custom["sku"] = custom["mpn"]

        return custom


class BittydesignProfile(BaseBrandProfile):
    """
    Bittydesign Profile.
    Specialization: Concise, factual descriptions and body specification attributes.
    """
    brand_name = "Bittydesign"
    domains = ["bittydesign.net"]

    def extract_custom(self, soup: BeautifulSoup) -> Dict[str, Any]:
        custom: Dict[str, Any] = {"brand": "Bittydesign", "attributes": {}}

        # 1. Description cleanup: Factual and concise (Preserved requirement)
        desc_tag = soup.select_one(".product-description, #tab-description, .rte")
        if desc_tag:
            raw_desc = clean_text(desc_tag.get_text())
            if raw_desc:
                # Extract factual sentences (strip marketing intros)
                sentences = [s.strip() for s in raw_desc.split(".") if len(s.strip()) > 10]
                concise_desc = ". ".join(sentences[:3]) + "."
                custom["description"] = concise_desc

        # 2. Specs: Polycarbonate thickness, Wheelbase, Width
        text_content = soup.get_text()
        specs: Dict[str, str] = {}

        thickness = re.search(r"(\d+(?:\.\d+)?)\s*mm(?:\s*thick)?(?:\s*lexan|\s*polycarbonate)?", text_content, re.IGNORECASE)
        if thickness and thickness.group(1):
            specs["thickness"] = f"{thickness.group(1)} mm"

        wheelbase = re.search(r"wheelbase\s*[:=]?\s*(\d+(?:\.\d+)?)\s*mm", text_content, re.IGNORECASE)
        if wheelbase:
            specs["wheelbase"] = f"{wheelbase.group(1)} mm"

        width = re.search(r"width\s*[:=]?\s*(\d+(?:\.\d+)?)\s*mm", text_content, re.IGNORECASE)
        if width:
            specs["width"] = f"{width.group(1)} mm"

        custom["attributes"] = specs
        return custom
