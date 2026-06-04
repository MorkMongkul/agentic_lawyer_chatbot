# backend/app/core/auth.py
"""
Optional Clerk authentication.

The app supports anonymous use, so this dependency NEVER raises — it returns
the Clerk user_id when a valid session token is present, or None otherwise.

A Clerk session JWT is signed with RS256. We verify it against Clerk's public
JWKS, which is hosted at  {frontend_api}/.well-known/jwks.json.  The frontend
API host is encoded inside the publishable key, so the only config the backend
needs is CLERK_PUBLISHABLE_KEY.
"""
import base64
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from fastapi import Request

from app.core.config import get_settings

settings = get_settings()


def _frontend_api_from_pk(pk: str) -> str | None:
    """
    Decode the Clerk frontend API host from a publishable key.
    pk_test_<base64(host$)>  ->  e.g. 'relaxed-cat-12.clerk.accounts.dev'
    """
    try:
        encoded = pk.split("_", 2)[2]
        # base64 may need padding
        decoded = base64.b64decode(encoded + "==").decode("utf-8")
        return decoded.rstrip("$")
    except Exception:
        return None


@lru_cache
def _jwks_client() -> PyJWKClient | None:
    pk = getattr(settings, "clerk_publishable_key", "") or ""
    host = _frontend_api_from_pk(pk)
    if not host:
        return None
    return PyJWKClient(f"https://{host}/.well-known/jwks.json")


@lru_cache
def _issuer() -> str | None:
    pk = getattr(settings, "clerk_publishable_key", "") or ""
    host = _frontend_api_from_pk(pk)
    return f"https://{host}" if host else None


def _verify_token(token: str) -> str | None:
    """Verify a Clerk session JWT and return the user_id (sub), or None."""
    client = _jwks_client()
    issuer = _issuer()
    if client is None or issuer is None:
        return None
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"verify_aud": False},  # Clerk tokens use azp, not aud
        )
        return claims.get("sub")
    except Exception:
        return None


async def get_optional_user_id(request: Request) -> str | None:
    """
    FastAPI dependency. Reads the Authorization: Bearer <token> header,
    verifies it with Clerk, and returns the user_id — or None for anonymous.
    Never raises.
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    if not token:
        return None
    return _verify_token(token)
