"""Run actual local-model acceptance; fixtures and live web are explicitly distinct.

From backend: venv\Scripts\python.exe scripts/research_acceptance.py
Reports default to the Git-ignored .local-artifacts/reports/ directory.
Add --live only after configuring a free-tier provider key. No quality score is invented.
"""
import argparse
import asyncio
import json
from pathlib import Path
import sys
import time

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.ai_notes.research.service import research_answer
from app.ai_notes.research.providers import FixtureProvider,SearchResult
from app.ai_notes.research.fetcher import Page
from app.core.config import settings

EVIDENCE = "Ashoka was a ruler of the Mauryan Empire. After the Kalinga war, Ashoka supported Buddhism and promoted moral conduct called dhamma. His edicts were inscribed on rocks and pillars throughout his empire."


async def fixture_fetch(url, *, check_policy=None, allow_pdf=False):
    if check_policy:
        await check_policy(url)
    return Page(url,b"User-agent: *\nAllow: /" if url.endswith("robots.txt") else EVIDENCE.encode(),"text/plain")


async def run(args):
    if args.live and not settings.tavily_api_key:
        raise SystemExit("Live acceptance blocked: configure TAVILY_API_KEY locally first.")
    results=[]
    for think in ([False,True] if args.mode == 'both' else [args.mode == 'think']):
        started=time.monotonic()
        usage={}
        async def progress(value):
            usage.update(value.get('usage',{}))
        try:
            kwargs={} if args.live else {'provider':FixtureProvider([SearchResult('https://fixture.example/ashoka','Ashoka (fixed test evidence)')]),'fetch':fixture_fetch}
            content,sources,tokens=await research_answer('What did Ashoka promote after the Kalinga war?',think=think,progress=progress,**kwargs)
            result={'mode':'think' if think else 'standard','status':'completed_checks','answer':content,
                    'source_urls':[source['url'] for source in sources],'wallet_answer_tokens':tokens}
        except Exception as error:
            result={'mode':'think' if think else 'standard','status':'failed','error_type':type(error).__name__,'error':str(error)}
        result.update({'elapsed_seconds':round(time.monotonic()-started,3),'usage':usage})
        results.append(result)
        print(json.dumps({k:v for k,v in result.items() if k not in {'answer','source_urls'}}),flush=True)
        output=Path(args.output)
        output.parent.mkdir(parents=True,exist_ok=True)
        output.write_text(json.dumps({'live':args.live,'fixture_evidence':not args.live,
            'review_status':'Human review required; completed checks are not a truth/quality score.',
            'fixture_text':None if args.live else EVIDENCE,'cases':results},indent=2),encoding='utf-8')


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--live',action='store_true')
    parser.add_argument('--mode',choices=['standard','think','both'],default='both')
    parser.add_argument('--output',default='.local-artifacts/reports/research-acceptance.json')
    asyncio.run(run(parser.parse_args()))
