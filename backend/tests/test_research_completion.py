import asyncio
import io
import json
from unittest.mock import AsyncMock

import pytest

from app.ai_notes.research import fetcher
from app.ai_notes.research.citations import validate_answer
from app.ai_notes.research.extraction import extract_document
from app.ai_notes.research.providers import FixtureProvider, SearchResult, ResearchUnavailable
from app.ai_notes.research.service import collect_sources, assess_claim_support

PASSAGE = "Ashoka supported Buddhism and promoted moral conduct called dhamma throughout his empire."


def sources():
    return [{"id":"S1","passages":[{"id":"S1P1","text":PASSAGE}]}]


def draft(text):
    return json.dumps({"paragraphs":[{"text":text,"evidence":[{"passage_id":"S1P1","quote":PASSAGE}]}]})


@pytest.mark.parametrize("text", ["Ashoka never supported Buddhism throughout his empire.",
                                  "Ashoka opposed Buddhism throughout his empire."])
def test_known_contradictory_claims_cannot_pass_structural_gate(text):
    with pytest.raises(ResearchUnavailable):
        validate_answer(draft(text),sources())


@pytest.mark.asyncio
async def test_semantic_assessment_fails_closed_and_reports_disagreement():
    async def unsupported(messages, **kwargs):
        assert kwargs["think"] is False
        assert len(json.dumps(messages).encode()) < 6200
        return json.dumps({"claims":[{"paragraph":1,"verdict":"insufficient"}],"source_disagreement":False}), 20
    with pytest.raises(ResearchUnavailable):
        await assess_claim_support(draft("Ashoka supported Buddhism."),sources(),unsupported)
    async def supported(messages, **kwargs):
        return json.dumps({"claims":[{"paragraph":1,"verdict":"supported"}],"source_disagreement":True}), 20
    result = await assess_claim_support(draft("Ashoka supported Buddhism."),sources(),supported)
    assert not result["source_disagreement"] and result["model_tokens"] == 20
    additional={**sources()[0],'id':'S2','passages':[{'id':'S2P1','text':'Another historical account.'}]}
    result=await assess_claim_support(draft('Ashoka supported Buddhism.'),sources()+[additional],supported)
    assert result['source_disagreement']


@pytest.mark.asyncio
async def test_destination_robots_rechecked_before_redirected_article(monkeypatch):
    requests = []
    async def connect(ip, port, **kwargs):
        reader = asyncio.StreamReader()
        host = kwargs.get("server_hostname")
        class Writer:
            def write(self, data):
                path = data.decode().split(" ")[1]
                requests.append((host,path))
                if path == "/entry":
                    reader.feed_data(b"HTTP/1.1 302 Found\r\nLocation: https://beta.example/article\r\n\r\n")
                else:
                    body = ("User-agent: *\nDisallow: /" if host == "beta.example" else "User-agent: *\nAllow: /").encode()
                    reader.feed_data(f"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {len(body)}\r\n\r\n".encode()+body)
                reader.feed_eof()
            async def drain(self): pass
            def close(self): pass
        return reader,Writer()
    monkeypatch.setattr(fetcher,"public_addresses",AsyncMock(return_value=["8.8.8.8"]))
    monkeypatch.setattr(asyncio,"open_connection",connect)
    with pytest.raises(ResearchUnavailable,match="No useful"):
        await collect_sources("Ashoka",FixtureProvider([SearchResult("https://alpha.example/entry","Ashoka")]),fetcher.fetch_page)
    assert ("beta.example","/robots.txt") in requests
    assert ("beta.example","/article") not in requests


def test_metadata_and_offsets_are_from_extracted_text():
    body = f'<title>Ashoka</title><meta name="author" content="Museum Historian"><meta property="article:published_time" content="2020-01-03T12:00:00Z"><meta property="og:site_name" content="Museum"><p>{PASSAGE}</p>'.encode()
    result = extract_document(fetcher.Page("https://museum.example/",body,"text/html"),"Ashoka")
    assert result["author"] == "Museum Historian" and result["published_at"] == "2020-01-03"
    assert result["institution"] == "Museum" and result["title"] == "Ashoka"
    passage = result["passages"][0]
    assert passage["end"] - passage["start"] == len(passage["text"])


@pytest.mark.asyncio
async def test_partial_sources_are_explicit_and_not_silently_discarded():
    async def fetch(url, *, check_policy=None, allow_pdf=False):
        if check_policy:
            await check_policy(url)
        if "unavailable" in url:
            raise ResearchUnavailable("Source unavailable")
        return fetcher.Page(url,b"User-agent: *\nAllow: /" if url.endswith("robots.txt") else PASSAGE.encode(),"text/plain")
    result = await collect_sources("Ashoka",FixtureProvider([
        SearchResult("https://museum.example/ashoka","Ashoka"),SearchResult("https://unavailable.example/","Ashoka")]),fetch)
    assert result[0]["limitations"]["failed_sources"] == 1


def text_pdf():
    from pypdf import PdfWriter
    from pypdf.generic import DictionaryObject,NameObject,DecodedStreamObject
    writer = PdfWriter()
    page = writer.add_blank_page(width=300,height=300)
    font = DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(f'BT /F1 12 Tf 10 100 Td ({PASSAGE}) Tj ET'.encode())
    page[NameObject('/Contents')] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.mark.asyncio
async def test_isolated_text_pdf_and_scanned_pdf_failure():
    from app.ai_notes.research.pdf import extract_pdf
    document = await extract_pdf(text_pdf())
    assert "Ashoka" in document["text"]
    from pypdf import PdfWriter
    writer = PdfWriter()
    writer.add_blank_page(width=100,height=100)
    blank = io.BytesIO()
    writer.write(blank)
    with pytest.raises(ResearchUnavailable):
        await extract_pdf(blank.getvalue())


@pytest.mark.asyncio
async def test_followup_resolves_recent_entity_and_redacts_identifiers():
    from app.ai_notes.research.service import resolve_search_question
    async def complete(messages, **options):
        assert 'private@example.com' not in messages[-1]['content']
        assert 'Chandragupta' in messages[-1]['content']
        return json.dumps({'query':'Chandragupta Maurya reign','needs_clarification':False}), 20
    query = await resolve_search_question('When did he rule?', 'Mauryan history',
        ['Chandragupta founded the empire. private@example.com'], complete)
    assert query == 'Chandragupta Maurya reign'


@pytest.mark.asyncio
async def test_ambiguous_followup_requires_clarification():
    from app.ai_notes.research.service import resolve_search_question
    async def complete(messages, **options):
        return json.dumps({'query':'','needs_clarification':True}), 10
    with pytest.raises(ResearchUnavailable, match='name the historical person'):
        await resolve_search_question('When did he rule?', 'History', ['Two rulers were discussed.'], complete)
