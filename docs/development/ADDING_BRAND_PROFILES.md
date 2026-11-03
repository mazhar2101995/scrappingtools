# Brand Profile Developer Guide: How to Add a New Brand

## AI Product Intelligence Scraping Engine

This guide explains how to add extraction rules for a new brand to the scraping engine in minutes, without modifying any core parsing or crawler code.

---

## 1. The Brand Profile Architecture

Brand extraction profiles reside in [`services/scraping-engine/app/profiles/registry.py`](file:///d:/xampp82/htdocs/Project/saas-tools/services/scraping-engine/app/profiles/registry.py).

Every profile inherits from `BaseBrandProfile`:

```python
class BaseBrandProfile:
    brand_name: str = "Generic"
    domains: List[str] = []
    requires_browser: bool = False

    def matches_url(self, url: str) -> bool:
        return any(domain in url.lower() for domain in self.domains)

    def extract_custom(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Override to implement brand-specific extraction rules."""
        return {}
```

The system automatically handles:
1. **SSRF Guard & Safety**: Blocks private/loopback IPs.
2. **JSON-LD Schema.org parsing**: Runs automatically for EAN, prices, and standardized specs.
3. **OpenGraph & Meta tag extraction**: Runs automatically for canonical URLs and fallback titles.
4. **Modulo-10 barcode validation**: Validates EAN-13 barcodes.

Your brand profile only needs to extract brand-specific data (e.g. part numbers, technical specification matrices, compatibility lists).

---

## 2. Step-by-Step Example: Adding a New Brand Profile

Let's add a new brand: **Arrma RC** (`arrma-rc.com`).

### Step 1: Open `app/profiles/registry.py` and define the class:

```python
class ArrmaProfile(BaseBrandProfile):
    brand_name = "Arrma"
    domains = ["arrma-rc.com"]
    requires_browser = False

    def extract_custom(self, soup: BeautifulSoup) -> Dict[str, Any]:
        custom: Dict[str, Any] = {"brand": "Arrma", "attributes": {}}

        # 1. Extract Arrma Part Number (e.g. ARA8608V5)
        part_tag = soup.select_one(".product-part-number, .sku")
        if part_tag:
            custom["mpn"] = clean_text(part_tag.get_text())
            custom["sku"] = custom["mpn"]

        # 2. Extract Power Specs Table
        for row in soup.select(".specs-table tr"):
            cols = row.select("td, th")
            if len(cols) >= 2:
                key = clean_text(cols[0].get_text()).lower().replace(" ", "_")
                val = clean_text(cols[1].get_text())
                if key and val:
                    custom["attributes"][key] = val

        return custom
```

### Step 2: Register the new profile:

In `app/extractors/pipeline.py`:
```python
PROFILES = [
    TraxxasProfile(),
    XrayProfile(),
    BittydesignProfile(),
    ArrmaProfile(), # <- Added here
]
```

### Step 3: Add an HTML test fixture & test:
1. Save a sample product HTML page in `services/scraping-engine/tests/fixtures/arrma_product.html`.
2. Add a test function in `services/scraping-engine/tests/test_extractors.py`:
```python
@pytest.mark.asyncio
async def test_arrma_extraction():
    html = read_fixture("arrma_product.html")
    result = await CascadeScrapingPipeline.extract_from_html(html, "https://www.arrma-rc.com/p/ARA8608V5", "arrma")
    assert result.brand == "Arrma"
    assert result.mpn == "ARA8608V5"
```
3. Run the test:
```powershell
.\.venv\Scripts\python.exe -m pytest services/scraping-engine/tests
```

That's it! The core pipeline will automatically use your new profile whenever a matching domain or brand hint is requested.

