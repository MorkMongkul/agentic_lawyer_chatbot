# backend/app/api/routes/documents.py
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.core.config import get_settings

settings = get_settings()
router   = APIRouter(tags=["documents"])

# Only allow serving known PDF filenames — security guard
ALLOWED_FILES = {"cambodian_labor_laws.pdf"}

@router.get("/documents/{filename}")
async def serve_pdf(filename: str):
    """Serve a PDF file for the inline viewer."""

    # Security: only serve whitelisted filenames
    if filename not in ALLOWED_FILES:
        raise HTTPException(status_code=404, detail="File not found")

    path = os.path.join(settings.data_dir, filename)

    if not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=f"{filename} not found on server"
        )

    return FileResponse(
        path,
        media_type="application/pdf",
        headers={
            # Allow PDF.js in the browser to load it
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
        }
    )