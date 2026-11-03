import os
import sys
import pytest

# Ensure scraping-engine is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.extractors.pipeline import CascadeScrapingPipeline
from app.security.ssrf_guard import validate_safe_url, SSRFSecurityError
from app.normalizers.cleaner import is_valid_ean13

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")

def read_fixture(filename: str) -> str:
    with open(os.path.join(FIXTURES_DIR, filename), "r", encoding="utf-8") as f:
        return f.read()

# TEST 1: SSRF Guardrails
def test_ssrf_guard():
    # Public URLs must pass
    assert validate_safe_url("https://www.google.com") == "https://www.google.com"

    # Private IP and localhost must be blocked
    with pytest.raises(SSRFSecurityError):
        validate_safe_url("http://127.0.0.1:8000/secret")

    with pytest.raises(SSRFSecurityError):
        validate_safe_url("http://localhost:3000")

    with pytest.raises(SSRFSecurityError):
        validate_safe_url("ftp://example.com/test")

# TEST 2: Traxxas Profile & Compatible Models
@pytest.mark.asyncio
async def test_traxxas_extraction():
    html = read_fixture("traxxas_product.html")
    url = "https://traxxas.com/products/parts/3350R"

    result = await CascadeScrapingPipeline.extract_from_html(html, url, brand_hint="traxxas")

    assert result.success is True
    assert result.brand == "Traxxas"
    assert result.title == "Velineon VXL-3s Brushless Power System"
    assert result.mpn == "3350R"
    assert result.sku == "3350R"
    assert result.ean == "4006381333931"
    assert result.price == 179.95
    assert result.currency == "USD"
    assert len(result.images) >= 1
    # Compatible models verification
    assert "Slash 4X4 Ultimate" in result.compatible_models
    assert "Rustler 4X4 VXL" in result.compatible_models
    assert "Bandit VXL" in result.compatible_models

# TEST 3: Xray Profile & Technical Specifications Table
@pytest.mark.asyncio
async def test_xray_extraction():
    html = read_fixture("xray_product.html")
    url = "https://teamxray.com/xb4/specs"

    result = await CascadeScrapingPipeline.extract_from_html(html, url, brand_hint="xray")

    assert result.success is True
    assert result.brand == "Xray"
    assert result.mpn == "360012"
    assert "chassis_length" in result.attributes
    assert result.attributes["chassis_length"] == "380 mm"
    assert result.attributes["wheelbase"] == "282 mm"
    assert result.attributes["gear_ratio"] == "2.5:1"

# TEST 4: Bittydesign Profile & Concise Factual Description
@pytest.mark.asyncio
async def test_bittydesign_extraction():
    html = read_fixture("bittydesign_product.html")
    url = "https://bittydesign.net/products/seven20"

    result = await CascadeScrapingPipeline.extract_from_html(html, url, brand_hint="bittydesign")

    assert result.success is True
    assert result.brand == "Bittydesign"
    assert result.title == "Bittydesign Seven20 Clear Body"
    assert "thickness" in result.attributes
    assert result.attributes["thickness"] == "0.75 mm"
    assert result.attributes["wheelbase"] == "257 mm"
    assert result.attributes["width"] == "190 mm"
    assert len(result.description) < 300  # Factual and concise
