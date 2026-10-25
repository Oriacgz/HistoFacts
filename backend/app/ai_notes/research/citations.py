"""Deterministic registry/quote checks, not an automated truth guarantee."""
import json
import re

from .providers import ResearchUnavailable


def check_polarity(claim: str, evidence: str):
    """Conservative contradiction guard; semantic assessment runs separately."""
    negative = r"\b(?:not|never|neither|without|no|denied|refused)\b|n['’]t\b"
    if bool(re.search(negative, claim.lower())) != bool(re.search(negative, evidence.lower())):
        raise ResearchUnavailable("The answer changes the polarity of its evidence.")
    pairs = [(r"\b(?:supported|promoted|endorsed)\b", r"\b(?:opposed|prohibited|rejected)\b"),
             (r"\b(?:won|victorious)\b", r"\b(?:lost|defeated)\b")]
    for positive, inverse in pairs:
        if ((re.search(positive, claim.lower()) and re.search(inverse, evidence.lower()) and not re.search(positive, evidence.lower()))
                or (re.search(inverse, claim.lower()) and re.search(positive, evidence.lower()) and not re.search(inverse, evidence.lower()))):
            raise ResearchUnavailable("The answer contradicts its evidence.")


def validate_answer(raw: str, sources: list[dict]) -> str:
    passages = {passage["id"]: (source, passage["text"]) for source in sources for passage in source["passages"]}
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
    try:
        payload = json.loads(raw)
        sections = payload["paragraphs"]
        if not isinstance(sections, list) or not 1 <= len(sections) <= 6:
            raise ValueError()
        rendered, mappings = [], []
        for section in sections:
            text = section["text"]
            refs = section["evidence"]
            if not isinstance(text, str) or not 10 <= len(text) <= 1600 or not isinstance(refs, list) or not 1 <= len(refs) <= 3:
                raise ValueError()
            if re.search(r"https?://|\]\(|<|>|\[\d+\]", text):
                raise ValueError("Model links and HTML are not permitted")
            supported, markers = [], []
            for ref in refs:
                source, passage = passages[ref["passage_id"]]
                quote = ref["quote"]
                if not isinstance(quote, str) or len(quote) < 20 or len(quote) > 300 or quote not in passage:
                    raise ValueError("Quote is not an exact supporting excerpt")
                supported.append(passage)
                markers.append(f"[{source['id']}]")
            # Reject new numbers and obvious irrelevant citations before display.
            evidence = " ".join(supported).lower()
            check_polarity(text, evidence)
            if set(re.findall(r"\b\d+\b", text)) - set(re.findall(r"\b\d+\b", evidence)):
                raise ValueError("Unsupported numeric claim")
            if any(quote not in evidence for quote in re.findall(r'"([^"\n]{5,})"', text.lower())):
                raise ValueError("Unsupported quotation")
            terms = set(re.findall(r"\b[a-z]{5,}\b", text.lower()))
            if terms and len(terms.intersection(re.findall(r"\b[a-z]{5,}\b", evidence))) / len(terms) < .6:
                raise ValueError("Insufficient lexical support")
            rendered.append(f"{text} {' '.join(dict.fromkeys(markers))}")
            mappings.append({"paragraph": len(rendered), "evidence": refs})
        for source in sources:
            source["citations"] = [
                {"paragraph": mapping["paragraph"], **ref}
                for mapping in mappings for ref in mapping["evidence"]
                if ref["passage_id"].startswith(source["id"] + "P")
            ]
        return "\n\n".join(rendered)
    except (ValueError, TypeError, KeyError) as error:
        raise ResearchUnavailable("The answer did not pass source checks. Please retry or use ordinary Notes.") from error


def source_appendix(sources: list[dict]) -> str:
    # URLs and labels come solely from the server registry. Encode Markdown delimiters.
    lines = ["\n\n---\n\n### Sources", "Source checks verify references and excerpts; they do not guarantee historical accuracy."]
    for source in sources:
        title = re.sub(r"[\[\]<>\\*`\r\n]", "", source["title"])
        url = source["url"].replace("(", "%28").replace(")", "%29").replace(" ", "%20")
        lines.append(f"- [{source['id']}] [{title}]({url}) — retrieved {source['retrieved_at'][:10]}")
    return "\n".join(lines)
