"""Same-session bounded lexical recall; dense mode requires local embeddings."""
import math
import re
import httpx


async def model_version():
    async with httpx.AsyncClient(timeout=3,trust_env=False) as client:
        response=await client.get('http://127.0.0.1:11434/api/tags')
        response.raise_for_status()
        version=next((model['digest'] for model in response.json()['models'] if model['name'].split(':')[0]=='nomic-embed-text'),None)
        if not version:
            raise ValueError('Installed embedding model unavailable')
        return version


async def embed(texts):
    async with httpx.AsyncClient(timeout=httpx.Timeout(30,connect=3),trust_env=False) as client:
        response=await client.post('http://127.0.0.1:11434/api/embed',json={'model':'nomic-embed-text','input':texts,'truncate':False,'keep_alive':'30s'})
        response.raise_for_status()
        vectors=response.json()['embeddings']
    if len(vectors)!=len(texts) or not vectors or not 32<=len(vectors[0])<=4096:
        raise ValueError('Embedding dimensions unavailable')
    if any(len(v)!=len(vectors[0]) or any(not math.isfinite(x) for x in v) for v in vectors):
        raise ValueError('Invalid embedding vector')
    return vectors


async def build_index(turns):
    from .service import excerpts
    records=[record for turn in turns[-24:] for record in excerpts(turn)][:48]
    try:
        version=await model_version()
        vectors=await embed([r['text'] for r in records])
        return {'mode':'dense','model':'nomic-embed-text','version':version,'dimension':len(vectors[0]),'records':records,'vectors':vectors}
    except (httpx.HTTPError,ValueError,KeyError,TypeError,StopIteration):
        return {'mode':'lexical','dense_unavailable':True}


async def retrieve(query,turns,index):
    from .service import excerpts
    valid={t.id for t in turns}
    records=[record for turn in turns[-24:] for record in excerpts(turn)][:48]
    words=set(re.findall(r'\w{3,}',query.lower()))
    scores=[len(words & set(re.findall(r'\w{3,}',r['text'].lower()))) for r in records]
    if index.get('mode')=='dense':
        try:
            if await model_version()!=index.get('version'): raise ValueError('Embedding model changed')
            q=(await embed([query]))[0]
            if len(q)!=index['dimension']: raise ValueError('Embedding model changed')
            records=[];scores=[]
            for record,vector in zip(index['records'],index['vectors']):
                if record['turn_id'] not in valid: continue
                cosine=sum(a*b for a,b in zip(q,vector))/(math.sqrt(sum(a*a for a in q))*math.sqrt(sum(b*b for b in vector)) or 1)
                records.append(record);scores.append(cosine+len(words & set(re.findall(r'\w{3,}',record['text'].lower())))*.1)
        except (httpx.HTTPError,ValueError,KeyError,TypeError,StopIteration):
            index.update(mode='lexical',dense_unavailable=True)
    return [record for score,record in sorted(zip(scores,records),key=lambda item:item[0],reverse=True)[:2] if score>0]
