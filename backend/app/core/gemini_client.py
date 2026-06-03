from google import genai
from app.core.config import get_settings

settings = get_settings()

client = genai.Client(
    vertexai=True,
    project=settings.google_cloud_project,
    location=settings.google_cloud_location,
)