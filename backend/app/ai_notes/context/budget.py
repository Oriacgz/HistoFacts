"""Conservative UTF-8 byte upper bound, including chat framing and image reserve."""
import json
from fastapi import HTTPException
from app.core.config import settings


def count(messages):
    total = 64
    for message in messages:
        content = message.get('content','')
        if isinstance(content,list):
            total += sum(2048 if part.get('type') == 'image_url' else len(str(part.get('text','')).encode('utf-8')) for part in content)
        else:
            total += len(str(content).encode('utf-8'))
        total += 24
    return total


def limit(output=2048):
    return settings.notes_context_limit - max(output,2048) - 512


def enforce(messages, output=2048):
    usage = count(messages)
    if usage > limit(output):
        raise HTTPException(413,'This message or attachment exceeds the safe context budget. Shorten it or split it into separate questions.')
    return {'used':usage,'limit':limit(output),'runtime_limit':settings.notes_context_limit,
            'accounting':'conservative UTF-8 byte estimate','estimated':True}
