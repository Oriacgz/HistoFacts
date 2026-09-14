"""
RFC 6238 Time-Based One-Time Password (TOTP) utilities, Fernet encryption at rest,
one-time recovery backup codes, and User-Agent device parsing.
"""

import base64
import hashlib
import hmac
import re
import secrets
import struct
import time
from cryptography.fernet import Fernet
from app.core.config import settings


# ── Fernet Encryption at Rest ───────────────────────────────────────────────────

def _get_fernet() -> Fernet:
    """Derive a deterministic 32-byte urlsafe base64 encryption key from settings.secret_key."""
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode("utf-8")).digest())
    return Fernet(derived_key)


def encrypt_totp_secret(secret: str) -> str:
    """Encrypt a TOTP secret string at rest."""
    f = _get_fernet()
    return f.encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt_totp_secret(encrypted_secret: str) -> str:
    """Decrypt an encrypted TOTP secret."""
    f = _get_fernet()
    return f.decrypt(encrypted_secret.encode("utf-8")).decode("utf-8")


# ── RFC 6238 TOTP Implementation ──────────────────────────────────────────────

def generate_totp_secret() -> str:
    """Generate a random 160-bit (20 bytes) Base32-encoded TOTP secret."""
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8").replace("=", "")


def get_totp_token(secret: str, interval: int = 30, for_time: float | None = None) -> str:
    """Generate a 6-digit TOTP code for the given timestamp."""
    if for_time is None:
        for_time = time.time()
    counter = int(for_time // interval)
    padding = "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(secret.upper() + padding)
    msg = struct.pack(">Q", counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[19] & 0x0F
    code = (struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """
    Verify a TOTP code against a secret with clock drift tolerance.
    Window of 1 checks current interval +/- 30 seconds.
    """
    cleaned_code = code.strip()
    curr_time = time.time()
    for step in range(-window, window + 1):
        if get_totp_token(secret, for_time=curr_time + step * 30) == cleaned_code:
            return True
    return False


def get_totp_uri(secret: str, username: str, issuer: str = "HistoFacts") -> str:
    """Generate the standard otpauth:// URI for QR code generation."""
    clean_username = username.strip()
    return f"otpauth://totp/{issuer}:{clean_username}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"


# ── One-Time Backup Codes ──────────────────────────────────────────────────────

def _normalize_backup_code(code: str) -> str:
    """Normalize backup code: uppercase and strip hyphens/spaces."""
    return re.sub(r"[^A-Za-z0-9]", "", code).upper()


def hash_backup_code(code: str) -> str:
    """Hash a normalized backup code with SHA-256 for secure storage."""
    normalized = _normalize_backup_code(code)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def generate_backup_codes(count: int = 10) -> tuple[list[str], list[str]]:
    """
    Generate one-time backup codes.
    Returns (plaintext_codes_formatted, hashed_codes).
    Plaintext codes are returned ONCE for the user to write down.
    """
    plain_codes = []
    hashed_codes = []
    for _ in range(count):
        raw = secrets.token_hex(4).upper()
        formatted = f"{raw[:4]}-{raw[4:]}"
        plain_codes.append(formatted)
        hashed_codes.append(hash_backup_code(raw))
    return plain_codes, hashed_codes


def consume_backup_code(code: str, hashed_codes: list[str]) -> tuple[bool, list[str]]:
    """
    Check if code matches any hashed backup code.
    If matched, removes the code from the list so each works exactly once.
    Returns (is_valid, updated_hashed_codes).
    """
    code_hash = hash_backup_code(code)
    if code_hash in hashed_codes:
        new_codes = [c for c in hashed_codes if c != code_hash]
        return True, new_codes
    return False, hashed_codes


# ── User-Agent Device Label Parser ─────────────────────────────────────────────

def parse_device_label(user_agent: str | None) -> str:
    """
    Parse User-Agent string into a friendly label like 'Chrome on Windows'.
    """
    if not user_agent or not user_agent.strip():
        return "Unknown Device"

    ua = user_agent.lower()

    # Detect OS
    if "windows" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os x" in ua:
        os_name = "macOS"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Unknown OS"

    # Detect Browser
    if "edg/" in ua or "edge/" in ua:
        browser = "Edge"
    elif "chrome" in ua and "edg" not in ua and "opr" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "opr" in ua or "opera" in ua:
        browser = "Opera"
    else:
        browser = "Browser"

    return f"{browser} on {os_name}"
