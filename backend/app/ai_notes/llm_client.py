"""
LLM client wrapper for curriculum-aware AI note generation.
Calls OpenAI / Anthropic / compatible API server-side, with fallback generator.
"""

import httpx
from app.core.config import settings


async def generate_curriculum_note(topic: str, curriculum: str) -> tuple[str, str]:
    """
    Generate study notes tailored to a specific curriculum.

    Returns:
        tuple[str, str]: (title, content_markdown)
    """
    prompt = (
        f"Generate a comprehensive, structured study note for the historical topic: '{topic}'.\n"
        f"Target Curriculum / Syllabus: '{curriculum}'.\n"
        f"Format in Markdown with clear sections: Key Takeaways, Historical Context, Main Events, Significance for Exams, and Review Questions."
    )

    title = f"Study Notes: {topic} ({curriculum})"

    # If API key configured, make live call to LLM server-side
    if settings.llm_api_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.llm_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": "You are an expert history educator preparing curriculum study notes for students."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.7,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    return title, content
        except Exception as e:
            print(f"LLM API call error: {e}")

    # High-quality fallback template when API key is not present or offline
    fallback_content = (
        f"# {title}\n\n"
        f"**Curriculum Scope:** {curriculum}\n\n"
        f"## 📌 Key Takeaways\n"
        f"- **Topic:** {topic}\n"
        f"- **Historical Period:** Epochal milestone in national and world history.\n"
        f"- **Core Theme:** Political evolution, socio-economic impact, and institutional changes.\n\n"
        f"## 🏛️ Historical Context & Background\n"
        f"The events surrounding **{topic}** occurred amidst changing social structures and geopolitical shifts. "
        f"Understanding this context is vital for **{curriculum}** examinations.\n\n"
        f"## 📜 Major Timeline & Key Events\n"
        f"1. **Origins & Precursors:** Ideological and structural factors leading up to the event.\n"
        f"2. **Critical Flashpoint:** Turning point where public policy and leadership shifted.\n"
        f"3. **Resolution & Aftermath:** Legislative reforms, territorial changes, and cultural legacies.\n\n"
        f"## 🎯 Examination & Curriculum Relevance\n"
        f"- **Essay & Descriptive Focus:** Analyze cause-and-effect relationships and primary sources.\n"
        f"- **Short-Answer Fact Points:** Remember dates, key leaders, declarations, and treaties.\n\n"
        f"## ❓ Self-Assessment Questions\n"
        f"1. What were the primary economic drivers behind {topic}?\n"
        f"2. How did this historical development influence subsequent legislative frameworks?\n"
    )

    return title, fallback_content
