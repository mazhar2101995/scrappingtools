import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure scraping-engine is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "scraping-engine"
    assert data["status"] == "healthy"
    assert "Traxxas" in data["profiles"]
