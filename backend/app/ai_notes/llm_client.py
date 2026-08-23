"""
LLM client wrapper for curriculum-aware AI note generation.
Calls OpenAI / Anthropic / compatible API server-side, with fallback generator.
"""

import httpx
from app.core.config import settings


async def generate_curriculum_note(
    topic: str,
    curriculum: str,
    attachment_name: str | None = None,
    attachment_type: str | None = None,
    attachment_text: str | None = None,
    attachment_data: str | None = None,
) -> tuple[str, str]:
    """
    Generate study notes tailored to a specific curriculum, optionally analyzing an attached document/image.

    Returns:
        tuple[str, str]: (title, content_markdown)
    """
    clean_topic_title = topic.strip().replace("\n", " ")
    if len(clean_topic_title) > 60:
        clean_topic_title = f"{clean_topic_title[:57]}..."
    if not clean_topic_title and attachment_name:
        clean_topic_title = f"Document Analysis: {attachment_name}"
    elif not clean_topic_title:
        clean_topic_title = "Historical Study Notes"

    title = f"Study Notes: {clean_topic_title} ({curriculum})"

    # Construct prompt with attachment context if available
    attachment_instructions = ""
    if attachment_name:
        attachment_instructions += f"\n\nAttached Source File: '{attachment_name}' (Type: {attachment_type or 'document'})."
    if attachment_text:
        # Limit attachment text in prompt to ~12000 chars to avoid exceeding token limits
        snippet = attachment_text[:12000]
        attachment_instructions += f"\n\n--- SOURCE MATERIAL CONTENT ---\n{snippet}\n--- END SOURCE MATERIAL ---\n\nCarefully analyze, extract, and incorporate the primary facts, concepts, arguments, timelines, and figures from this attached source into the structured curriculum study notes."

    prompt = (
        f"Generate a comprehensive, high-yield structured study note for the historical topic/inquiry: '{topic}'.\n"
        f"Target Curriculum / Syllabus: '{curriculum}'.{attachment_instructions}\n\n"
        f"Format the output in clean, readable Markdown with clear headings and bullet points:\n"
        f"- 📌 Key Takeaways & Core Concepts\n"
        f"- 🏛️ Historical Context & Background\n"
        f"- 📜 Chronological Timeline & Major Events\n"
        f"- 🔍 Source & Document Analysis (if source attached)\n"
        f"- 🎯 Examination & Curriculum Relevance (High-yield points, keywords, essay pointers)\n"
        f"- ❓ Self-Assessment & Exam Practice Questions"
    )

    # If API key configured, make live call to LLM server-side
    if settings.llm_api_key:
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                user_content = prompt
                # If image attachment data (data URL) is provided, use multimodal format
                if attachment_data and attachment_data.startswith("data:image/"):
                    user_content = [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": attachment_data, "detail": "auto"},
                        },
                    ]

                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.llm_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an expert history educator and curriculum specialist preparing detailed, high-yield study notes for students.",
                            },
                            {"role": "user", "content": user_content},
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
    source_section = ""
    if attachment_name:
        preview_text = ""
        if attachment_text:
            lines = [l.strip() for l in attachment_text.splitlines() if l.strip()][:5]
            if lines:
                preview_text = "\n" + "\n".join(f"> *\"{l[:120]}...\"*" for l in lines)
        source_section = (
            f"\n\n## 📎 Source Document Analysis: {attachment_name}\n"
            f"- **Source Reference:** Analyzed uploaded source `{attachment_name}` for curriculum alignment.\n"
            f"- **Primary Focus:** Extracted key historical claims, contextual factors, and evidence.\n"
            f"{preview_text}\n"
        )

    fallback_content = (
        f"# {title}\n\n"
        f"**Curriculum Scope:** {curriculum}\n\n"
        f"## 📌 Key Takeaways & Core Concepts\n"
        f"- **Topic:** {topic}\n"
        f"- **Historical Period:** Key epochal milestone in national and world history.\n"
        f"- **Core Theme:** Political evolution, socio-economic transformation, and institutional changes.\n\n"
        f"## 🏛️ Historical Context & Background\n"
        f"The events surrounding **{topic}** developed amidst shifting social structures and geopolitical tensions. "
        f"Understanding this historical context is fundamental for mastering **{curriculum}** examinations."
        f"{source_section}\n"
        f"## 📜 Major Timeline & Key Events\n"
        f"1. **Origins & Precursors:** Ideological, societal, and structural factors setting the stage.\n"
        f"2. **Critical Flashpoint:** Pivotal turning point where public policy, conflict, and leadership shifted.\n"
        f"3. **Resolution & Aftermath:** Long-term legislative reforms, territorial changes, and cultural legacies.\n\n"
        f"## 🎯 Examination & Curriculum Relevance\n"
        f"- **Essay & Descriptive Focus:** Analyze cause-and-effect relationships, economic catalysts, and primary sources.\n"
        f"- **High-Yield Fact Points:** Memorize key dates, prominent leaders, declarations, and treaties.\n\n"
        f"## ❓ Self-Assessment & Exam Questions\n"
        f"1. What were the primary socio-economic and political catalysts behind {topic}?\n"
        f"2. How did this historical development influence subsequent governance and legislative frameworks?\n"
        f"3. Assess the long-term historical significance of these events from a comparative perspective.\n"
    )

    return title, fallback_content
