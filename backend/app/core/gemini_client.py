import os
from google import genai
from app.core.config import get_settings

settings = get_settings()

# Set the env var so genai.Client() picks it up automatically
# This is the official pattern — no api_key argument needed
os.environ["GEMINI_API_KEY"] = settings.gemini_api_key

client = genai.Client()