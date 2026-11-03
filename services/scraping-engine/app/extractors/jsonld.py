import json
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup
from app.normalizers.cleaner import clean_text

class JsonLdExtractor:
    """Extracts structured Schema.org / Product data from JSON-LD script tags."""

    @staticmethod
    def extract(soup: BeautifulSoup) -> Dict[str, Any]:
        results: Dict[str, Any] = {}
        scripts = soup.find_all("script", type="application/ld+json")

        for script in scripts:
            if not script.string:
                continue
            try:
                data = json.loads(script.string)
                items = data if isinstance(data, list) else [data]

                for item in items:
                    # Check for Product or embedded Product in @graph
                    if isinstance(item, dict):
                        if item.get("@type") == "Product":
                            return JsonLdExtractor._parse_product_node(item)
                        elif "@graph" in item and isinstance(item["@graph"], list):
                            for node in item["@graph"]:
                                if isinstance(node, dict) and node.get("@type") == "Product":
                                    return JsonLdExtractor._parse_product_node(node)
            except Exception:
                continue

        return results

    @staticmethod
    def _parse_product_node(node: Dict[str, Any]) -> Dict[str, Any]:
        parsed: Dict[str, Any] = {}
        
        parsed["title"] = clean_text(node.get("name"))
        parsed["description"] = clean_text(node.get("description"))
        parsed["sku"] = clean_text(str(node.get("sku"))) if node.get("sku") else None
        parsed["mpn"] = clean_text(str(node.get("mpn"))) if node.get("mpn") else None
        
        # Barcode resolution
        ean = node.get("gtin13") or node.get("gtin") or node.get("ean")
        parsed["ean"] = clean_text(str(ean)) if ean else None

        # Brand extraction
        brand_node = node.get("brand")
        if isinstance(brand_node, dict):
            parsed["brand"] = clean_text(brand_node.get("name"))
        elif isinstance(brand_node, str):
            parsed["brand"] = clean_text(brand_node)

        # Image extraction
        images = node.get("image")
        if isinstance(images, list):
            parsed["images"] = [img for img in images if isinstance(img, str)]
        elif isinstance(images, str):
            parsed["images"] = [images]

        # Offer extraction (price & currency)
        offers = node.get("offers")
        if isinstance(offers, dict):
            parsed["price"] = float(offers.get("price")) if offers.get("price") else None
            parsed["currency"] = offers.get("priceCurrency") or "USD"
            parsed["availability"] = "in_stock" if "InStock" in str(offers.get("availability")) else "out_of_stock"
        elif isinstance(offers, list) and len(offers) > 0 and isinstance(offers[0], dict):
            parsed["price"] = float(offers[0].get("price")) if offers[0].get("price") else None
            parsed["currency"] = offers[0].get("priceCurrency") or "USD"

        return parsed

