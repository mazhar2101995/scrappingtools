import time
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
import httpx

from app.config import API_INTERNAL_SECRET, DEFAULT_TIMEOUT_SECONDS
from app.models.product import ScrapeRequest, ExtractedProductData
from app.security.ssrf_guard import validate_safe_url, SSRFSecurityError
from app.extractors.pipeline import CascadeScrapingPipeline

app = FastAPI(
    title="AI Product Intelligence Scraping Engine",
    description="FastAPI service for cascade web scraping and brand profile extraction.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_internal_auth(x_internal_secret: Optional[str] = Header(None)):
    """Verifies internal secret for requests coming from NestJS / BullMQ."""
    if x_internal_secret and x_internal_secret != API_INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Invalid internal API secret")
    return True


@app.get("/health")
def health_check():
    return {
        "service": "scraping-engine",
        "status": "healthy",
        "version": "0.2.0",
        "profiles": ["Traxxas", "Xray", "Bittydesign"],
    }


@app.post("/api/v1/scrape", response_model=ExtractedProductData)
async def scrape_product(
    request: ScrapeRequest,
    authenticated: bool = Depends(verify_internal_auth)
):
    """
    Scrapes and extracts canonical product intelligence from a given URL
    using the 4-tier cascade extraction pipeline.
    """
    start_time = time.time()

    # 1. SSRF Safety Check
    try:
        validated_url = validate_safe_url(request.url)
    except SSRFSecurityError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # 2. Fetch HTML using httpx
    try:
        async with httpx.AsyncClient(timeout=request.timeout_seconds or DEFAULT_TIMEOUT_SECONDS, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            response = await client.get(validated_url, headers=headers)
            response.raise_for_status()
            html = response.text
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch target URL: {str(e)}")

    duration_ms = int((time.time() - start_time) * 1000)

    # 3. Execute Cascade Extraction Pipeline
    extracted_data = await CascadeScrapingPipeline.extract_from_html(
        html=html,
        url=str(response.url),
        brand_hint=request.brand_hint,
        duration_ms=duration_ms,
    )

    return extracted_data

