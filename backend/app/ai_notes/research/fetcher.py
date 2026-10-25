"""Small public-web HTTP/1.1 reader with DNS-pinned TLS and bounded bodies.

Connect to the validated IP, keeping the original hostname for TLS verification.
Redirects are independently resolved and checked. No proxy, cookie jar or secrets.
Compressed responses are rejected rather than risking decompression expansion.
"""
import asyncio
import ipaddress
import socket
import ssl
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

from .providers import ResearchUnavailable, canonical_url

MAX_BODY = 1_000_000


class SourceHTTPError(ResearchUnavailable):
    def __init__(self, status):
        super().__init__("Source is unavailable or restricts access.")
        self.status = status


@dataclass(frozen=True)
class Page:
    url: str
    body: bytes
    content_type: str


async def public_addresses(host: str, port: int) -> list[str]:
    try:
        rows = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError as error:
        raise ResearchUnavailable("Source could not be resolved.") from error
    addresses = list(dict.fromkeys(row[4][0] for row in rows))
    if not addresses:
        raise ResearchUnavailable("Source has no public destination.")
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global or ip.is_multicast or ip.is_reserved or getattr(ip, "ipv4_mapped", None) is not None:
            raise ResearchUnavailable("Private or reserved source destinations are blocked.")
    return addresses


async def _read_response(reader, allow_pdf=False):
    consumed = 0
    async def line():
        nonlocal consumed
        value = await reader.readline()
        consumed += len(value)
        if consumed > 32_768 or len(value) > 8192 or not value.endswith(b"\r\n"):
            raise ResearchUnavailable("Source headers exceed limits or are malformed.")
        return value[:-2]

    status = await line()
    try:
        protocol, code, *_ = status.decode("ascii").split(" ")
        code = int(code)
        if protocol not in {"HTTP/1.0", "HTTP/1.1"}:
            raise ValueError()
    except (ValueError, UnicodeError) as error:
        raise ResearchUnavailable("Invalid source response.") from error
    headers = {}
    while raw := await line():
        key, separator, value = raw.partition(b":")
        if not separator:
            raise ResearchUnavailable("Invalid source headers.")
        key, value = key.decode("ascii").lower(), value.decode("latin1").strip()
        if key in headers:
            raise ResearchUnavailable("Ambiguous source headers.")
        headers[key] = value
    if code in {301, 302, 303, 307, 308}:
        return code, headers, b""
    if code != 200:
        raise SourceHTTPError(code)
    if headers.get("content-encoding", "identity").lower() != "identity":
        raise ResearchUnavailable("Compressed sources are unsupported.")
    content_type = headers.get("content-type", "").lower()
    if not content_type.startswith(("text/html", "application/xhtml+xml", "text/plain")) and not (allow_pdf and content_type.startswith("application/pdf")):
        raise ResearchUnavailable("Only public text and HTML sources are supported initially.")
    body = bytearray()
    transfer = headers.get("transfer-encoding", "").lower()
    if transfer:
        if transfer != "chunked" or "content-length" in headers:
            raise ResearchUnavailable("Unsupported source transfer format.")
        while True:
            size_line = await reader.readline()
            if len(size_line) > 128 or not size_line.endswith(b"\r\n"):
                raise ResearchUnavailable("Invalid source chunk.")
            size = int(size_line.split(b";", 1)[0].strip(), 16)
            if size < 0 or len(body) + size > MAX_BODY:
                raise ResearchUnavailable("Source exceeds size limit.")
            if not size:
                break
            body.extend(await reader.readexactly(size))
            if await reader.readexactly(2) != b"\r\n":
                raise ResearchUnavailable("Invalid source chunk delimiter.")
    else:
        length = headers.get("content-length")
        if length is not None:
            size = int(length)
            if size < 0 or size > MAX_BODY:
                raise ResearchUnavailable("Source exceeds size limit.")
            body.extend(await reader.readexactly(size))
        else:
            while chunk := await reader.read(16_384):
                body.extend(chunk)
                if len(body) > MAX_BODY:
                    raise ResearchUnavailable("Source exceeds size limit.")
    return code, headers, bytes(body)


async def fetch_page(url: str, *, check_policy=None, allow_pdf=False) -> Page:
    try:
        async with asyncio.timeout(18):
            for _ in range(4):
                url = canonical_url(url)
                if not url or any(ord(char) < 33 or ord(char) == 127 for char in url):
                    raise ResearchUnavailable("Invalid source URL.")
                parts = urlsplit(url)
                port = parts.port or (443 if parts.scheme == "https" else 80)
                if (parts.scheme, port) not in {("https", 443), ("http", 80)}:
                    raise ResearchUnavailable("Unsupported source port.")
                addresses = await public_addresses(parts.hostname, port)
                if check_policy:
                    await check_policy(url)
                tls = ssl.create_default_context() if parts.scheme == "https" else None
                reader, writer = await asyncio.open_connection(
                    addresses[0], port, ssl=tls,
                    server_hostname=parts.hostname if tls else None, limit=32_769,
                )
                try:
                    target = parts.path or "/"
                    if parts.query:
                        target += "?" + parts.query
                    request = (f"GET {target} HTTP/1.1\r\nHost: {parts.netloc}\r\n"
                               "User-Agent: HistoFactsResearch/1.0\r\n"
                               "Accept: text/html, text/plain\r\nAccept-Encoding: identity\r\n"
                               "Connection: close\r\n\r\n")
                    writer.write(request.encode("ascii"))
                    await writer.drain()
                    code, headers, body = await _read_response(reader, allow_pdf=allow_pdf)
                finally:
                    writer.close()
                    # Closing the socket also aborts reads on cancellation.
                if code in {301, 302, 303, 307, 308}:
                    if not headers.get("location"):
                        raise ResearchUnavailable("Source redirect has no destination.")
                    url = urljoin(url, headers["location"])
                    continue
                return Page(url, body, headers.get("content-type", ""))
            raise ResearchUnavailable("Source has too many redirects.")
    except (OSError, TimeoutError, ValueError, UnicodeError, asyncio.IncompleteReadError) as error:
        raise ResearchUnavailable("Source could not be read within retrieval limits.") from error
