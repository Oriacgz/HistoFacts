"""Non-executing HTML extraction using Python's standard HTML parser."""
import hashlib
import re
from html.parser import HTMLParser
from datetime import date
from urllib.parse import urlsplit
from urllib.parse import urljoin
from .providers import canonical_url

from .fetcher import Page


class ReadableHTML(HTMLParser):
    OMIT = {"script", "style", "nav", "footer", "header", "noscript", "svg", "form"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = []
        self.parts = []
        self.metadata = {}
        self.in_title = False
        self.title = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "meta":
            key = (attrs.get("name") or attrs.get("property") or "").lower()
            if key in {"author", "article:author", "article:published_time", "article:modified_time", "date", "datepublished", "datemodified", "og:site_name"}:
                self.metadata[key] = (attrs.get("content") or "")[:300]
        if tag == "link" and "canonical" in (attrs.get("rel") or "").lower().split():
            self.metadata["canonical"] = (attrs.get("href") or "")[:2000]
        if tag in self.OMIT:
            self.skip.append(tag)
        if not self.skip and tag in {"p", "div", "section", "article", "br", "li", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if self.skip and self.skip[-1] == tag:
            self.skip.pop()
        if not self.skip and tag in {"p", "div", "li"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if not self.skip:
            self.parts.append(data)


def extract_document(page: Page, question: str) -> dict:
    charset = re.search(r"charset=[\"']?([\w-]+)", page.content_type, re.I)
    try:
        text = page.body.decode(charset.group(1) if charset else "utf-8", errors="replace")
    except LookupError:
        text = page.body.decode("utf-8", errors="replace")
    metadata, title = {}, None
    if "html" in page.content_type:
        parser = ReadableHTML()
        parser.feed(text)
        text = "".join(parser.parts)
        metadata, title = parser.metadata, " ".join("".join(parser.title).split())[:300] or None
    # Offsets refer to this deterministic extracted/normalized text, not remote HTML bytes.
    text = "\n".join(" ".join(part.split()) for part in text.splitlines())
    chunks = []
    for match in re.finditer(r"[^\n]+", text):
        for start in range(match.start(), match.end(), 500):
            end = min(start + 500, match.end())
            if end - start >= 60:
                chunks.append({"text": text[start:end], "start": start, "end": end})
    terms = set(re.findall(r"\w{4,}", question.lower()))
    scored = [(len(terms.intersection(re.findall(r"\w{4,}", part["text"].lower()))), index, part) for index, part in enumerate(chunks)]
    chosen = sorted(scored, key=lambda row: (-row[0], row[1]))[:3]
    def publication_date(*keys):
        for key in keys:
            try:
                return date.fromisoformat(metadata.get(key, "")[:10]).isoformat()
            except ValueError:
                pass
        return None
    return {"passages": [part for score, _, part in chosen if score > 0],
            "content_hash": hashlib.sha256(text.encode()).hexdigest(), "title": title,
            "author": metadata.get("author") or metadata.get("article:author"),
            "declared_canonical_url": canonical_url(urljoin(page.url,metadata.get("canonical",page.url))),
            "institution": metadata.get("og:site_name") or urlsplit(page.url).hostname,
            "published_at": publication_date("article:published_time", "datepublished", "date"),
            "updated_at": publication_date("article:modified_time", "datemodified"), "offset_basis": "normalized_extracted_text"}


def extract_passages(page: Page, question: str) -> tuple[list[str], str]:
    document = extract_document(page, question)
    return [part["text"] for part in document["passages"]], document["content_hash"]
