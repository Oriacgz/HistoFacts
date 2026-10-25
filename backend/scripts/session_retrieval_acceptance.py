"""Measured local embedding comparison using explicit synthetic session snippets."""
import asyncio
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.ai_notes.context.retrieval import build_index,retrieve


async def main():
    documents=[('ashoka','Ashoka supported Buddhism after the Kalinga war.'),
        ('rome','Julius Caesar crossed the Rubicon in 49 BCE.'),
        ('egypt','The pyramids at Giza were built during the Old Kingdom.'),
        ('india','The user corrected the independence year to 1947.')]
    queries=[('Who crossed the Rubicon?','rome'),('What year was independence corrected to?','india'),
        ('Which ruler adopted Buddhist principles after warfare?','ashoka'),
        ('Who entered the Italian river despite senate restrictions?','rome'),
        ('Which civilization erected monumental stone tombs near Cairo?','egypt')]
    turns=[SimpleNamespace(id=key,prompt='History',content=value) for key,value in documents]
    started=time.monotonic();index=await build_index(turns)
    report={'synthetic':True,'model':index.get('model'),'model_version':index.get('version'),
            'dimension':index.get('dimension'),'index_mode':index['mode'],'build_seconds':round(time.monotonic()-started,3),'cases':[]}
    for query,expected in queries:
        measured={}
        for name,registry in [('lexical',{'mode':'lexical'}),('candidate',index)]:
            before=time.monotonic();found=await retrieve(query,turns,registry)
            measured[name]={'ids':[r['turn_id'] for r in found],'hit_at_2':expected in [r['turn_id'] for r in found],
                'seconds':round(time.monotonic()-before,3)}
        report['cases'].append({'query':query,'expected':expected,**measured})
    report['cross_session_empty']=await retrieve('Rubicon',[],index)==[]
    report['lexical_hits']=sum(c['lexical']['hit_at_2'] for c in report['cases'])
    report['candidate_hits']=sum(c['candidate']['hit_at_2'] for c in report['cases'])
    report['scope']='Capability and small synthetic recall check; not a general accuracy benchmark. Dense remains opt-in.'
    output=Path('.local-artifacts/reports/session-retrieval-acceptance.json')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({key:value for key,value in report.items() if key!='cases'}))


if __name__=='__main__':
    asyncio.run(main())
