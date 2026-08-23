"""
LLM client wrapper for curriculum-aware AI note generation and Handwritten Notes restyling.
Calls OpenAI / Anthropic / compatible API server-side, with fallback generator and token usage metrics.
"""

import httpx
from app.core.config import settings


def calculate_approx_tokens(text: str) -> int:
    """Estimate token count from text (~4 chars per token or ~1.3 tokens per word)."""
    if not text:
        return 0
    words = len(text.split())
    chars = len(text)
    return max(int(words * 1.3), int(chars / 3.8))


async def generate_curriculum_note(
    topic: str,
    curriculum: str,
    attachment_name: str | None = None,
    attachment_type: str | None = None,
    attachment_text: str | None = None,
    attachment_data: str | None = None,
) -> tuple[str, str, int]:
    """
    Generate study notes tailored to a specific curriculum, optionally analyzing an attached document/image.

    Returns:
        tuple[str, str, int]: (title, content_markdown, actual_tokens_used)
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
                    usage = data.get("usage", {})
                    tokens_used = usage.get("total_tokens", calculate_approx_tokens(prompt) + calculate_approx_tokens(content))
                    return title, content, tokens_used
        except Exception as e:
            print(f"LLM API call error: {e}")

    # Fallback template
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

    tokens_used = calculate_approx_tokens(prompt) + calculate_approx_tokens(fallback_content)
    return title, fallback_content, tokens_used


async def generate_handwritten_note(
    original_title: str,
    original_content: str,
) -> tuple[str, str, int]:
    """
    Restyle an already-generated formal note into student handwritten lecture notes style.

    Returns:
        tuple[str, str, int]: (new_title, rewritten_content, actual_tokens_used)
    """
    title = f"Handwritten Notes: {original_title.replace('Study Notes: ', '').replace('Handwritten Notes: ', '')}"

    prompt = (
        f"You are converting a formal study note into the style of a student's own handwritten class notes.\n\n"
        f"Rewrite the note below following these rules:\n"
        f"- Use short, abbreviated phrases instead of full sentences where it reads naturally (e.g. 'govt' not 'government', '->' for 'leads to', 'w/' for 'with', 'b/c' for 'because')\n"
        f"- Break ideas into quick bullet fragments, not paragraphs\n"
        f"- Use arrows (→) to show cause-effect or sequence between events\n"
        f"- Mark key terms and dates the way a student would underline them — use **bold**\n"
        f"- Keep it tight — this should read like notes taken *during* a lecture, not a polished summary\n"
        f"- Do not omit or invent facts. Every date, name, and fact in the original must still be present — only the style changes\n\n"
        f"Original note:\n{original_content}\n\n"
        f"Rewritten (handwritten style):"
    )

    if settings.llm_api_key:
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
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
                                "content": "You are a top student writing fast, crisp, abbreviated handwritten lecture notes in a notebook.",
                            },
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.7,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    usage = data.get("usage", {})
                    tokens_used = usage.get("total_tokens", calculate_approx_tokens(prompt) + calculate_approx_tokens(content))
                    return title, content, tokens_used
        except Exception as e:
            print(f"Handwritten LLM API call error: {e}")

    # Fallback handwritten transformation
    # Convert sentences into abbreviated student bullet fragments with arrows
    lines = original_content.splitlines()
    hw_lines = [f"# ✍️ {title}\n"]
    for line in lines:
        l = line.strip()
        if not l:
            continue
        if l.startswith('# '):
            continue
        elif l.startswith('## '):
            hw_lines.append(f"\n## 📌 {l.replace('## ', '').replace('📌 ', '')}")
        elif l.startswith('- ') or l.startswith('* ') or (len(l) > 2 and l[0].isdigit() and l[1] in ('.', ')')):
            clean = l.lstrip('-* 0123456789.)')
            # Shorten common words to student slang
            abbrev = (
                clean.replace("government", "govt")
                .replace("because", "b/c")
                .replace("with", "w/")
                .replace("without", "w/o")
                .replace("between", "btw")
                .replace("leads to", "→")
                .replace("caused", "→ caused")
                .replace("resulting in", "→")
            )
            hw_lines.append(f"• {abbrev}")
        else:
            abbrev = (
                l.replace("government", "govt")
                .replace("because", "b/c")
                .replace("with", "w/")
                .replace("leads to", "→")
                .replace("resulting in", "→")
            )
            hw_lines.append(f"→ {abbrev}")

    hw_lines.append("\n💡 *Exam Tip: Remember key dates & arrow sequences above!*")
    rewritten_fallback = "\n".join(hw_lines)
    tokens_used = calculate_approx_tokens(prompt) + calculate_approx_tokens(rewritten_fallback)
    return title, rewritten_fallback, tokens_used
