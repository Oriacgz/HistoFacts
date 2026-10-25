"""
File storage utility — single validation + storage path for the entire application.

validate_image_content: inspects raw bytes (magic-number check), never trusts
    the client-supplied Content-Type header.
store_file: writes bytes to the local uploads directory, returns the URL path.
delete_stored_file: removes an existing file by its URL path (no-op if missing).
"""

import os
import uuid
import logging
from pathlib import Path
from fastapi import HTTPException

logger = logging.getLogger("histofacts.file_storage")

# Root of persisted uploads, relative to the backend working directory.
UPLOADS_ROOT = Path("uploads")
UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)

# Image magic-byte signatures: (offset, bytes_to_match)
_IMAGE_SIGNATURES: list[tuple[int, bytes]] = [
    (0, b"\xff\xd8\xff"),           # JPEG
    (0, b"\x89PNG\r\n\x1a\n"),      # PNG
    (0, b"GIF87a"),                  # GIF87
    (0, b"GIF89a"),                  # GIF89
    (0, b"RIFF"),                    # WEBP prefix (confirmed below)
    (8, b"WEBP"),                    # WEBP suffix
]

# WEBP requires both the RIFF header and "WEBP" at offset 8.
_WEBP_PREFIX = b"RIFF"
_WEBP_MAGIC = b"WEBP"


def _is_image(raw: bytes) -> bool:
    is_jpeg = raw[:3] == b"\xff\xd8\xff"
    is_png = raw[:8] == b"\x89PNG\r\n\x1a\n"
    is_gif = raw[:6] in (b"GIF87a", b"GIF89a")
    is_webp = raw[:4] == _WEBP_PREFIX and raw[8:12] == _WEBP_MAGIC
    return is_jpeg or is_png or is_gif or is_webp


def _is_video(raw: bytes) -> bool:
    is_mp4_mov = raw[4:8] == b"ftyp"                       # MP4 and QuickTime containers
    is_webm = raw[:4] == b"\x1a\x45\xdf\xa3"               # EBML header (WebM/MKV)
    is_avi = raw[:4] == b"RIFF" and raw[8:12] == b"AVI "   # checked after WEBP (both RIFF)
    return is_mp4_mov or is_webm or is_avi


def classify_media_content(raw: bytes) -> str:
    """
    Classify *raw* bytes by content inspection — never the client-declared MIME type.
    Returns "image", "video", or "unknown". One classifier for every upload path.
    """
    if len(raw) < 12:
        return "unknown"
    if _is_image(raw):
        return "image"
    if _is_video(raw):
        return "video"
    return "unknown"


def media_extension(raw: bytes) -> str:
    """Return the file extension matching the inspected content, for store_file()."""
    if raw[:3] == b"\xff\xd8\xff":
        return "jpg"
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if raw[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if raw[:4] == _WEBP_PREFIX and raw[8:12] == _WEBP_MAGIC:
        return "webp"
    if raw[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    if raw[4:8] == b"ftyp":
        return "mp4"
    return "bin"


def validate_image_content(raw: bytes) -> None:
    """
    Raise HTTP 415 if *raw* is not a supported image format.
    Detection is by magic-byte inspection, not by the client-declared MIME type.
    Supported: JPEG, PNG, GIF, WEBP.
    """
    if not _is_image(raw):
        raise HTTPException(status_code=415, detail="Unsupported file type — must be JPEG, PNG, GIF, or WEBP")


def store_file(data: bytes, prefix: str = "uploads", extension: str = "webp") -> str:
    """
    Write *data* to the uploads directory and return the URL path.

    Args:
        data:      Raw file bytes.
        prefix:    Directory prefix under UPLOADS_ROOT (e.g. "avatars/user-id").
        extension: File extension without the dot (default "webp").

    Returns:
        URL path string, e.g. "/uploads/avatars/user-abc/filename.webp".
    """
    dest_dir = UPLOADS_ROOT / prefix
    dest_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}.{extension}"
    dest_path = dest_dir / filename
    dest_path.write_bytes(data)

    # Normalise to forward-slash URL path
    url_path = "/" + str(dest_path).replace("\\", "/")
    return url_path


def delete_stored_file(url_path: str) -> None:
    """
    Delete the file identified by *url_path* (as returned by store_file).
    Silently no-ops if the file does not exist.
    """
    if not url_path:
        return
    # Strip leading "/"
    relative = url_path.lstrip("/")
    file_path = Path(relative)
    try:
        file_path.unlink(missing_ok=True)
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not delete stored file %s: %s", url_path, exc)
