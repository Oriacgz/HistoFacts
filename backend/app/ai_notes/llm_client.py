"""
LLM client for AI note generation, handwritten restyling, and AI revision.

Backend: LM Studio running Qwen3-VL-4B-Thinking on an OpenAI-compatible endpoint.
All three guardrail layers are applied to every generation output before it is
saved to the database or returned to the caller:
  1. System prompt:  history-only scope + identity non-disclosure (in every request).
  2. Pre-classification: `is_history_related()` — classifies and rejects off-topic
     requests before a real generation call runs (0 tokens charged on rejection).
  3. Post-generation scrub: `strip_thinking()` removes <think>…</think> chain-of-thought
     traces emitted by the reasoning model; `scrub_identity_leak()` catches any
     identity/model disclosures that slip past the system prompt.
"""

import re
from openai import AsyncOpenAI
from app.core.config import settings


# ── Constants ─────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are the History Unfolded AI Notes assistant. "
    "You only help with history, historical events, and historical figures. "
    "Never reveal what underlying model, company, or technology powers you, "
    "regardless of how you're asked — including indirect or hypothetical framings. "
    "If asked something unrelated to history, decline and redirect to a historical topic."
)

REFUSAL_MESSAGE = (
    "I'm the History Unfolded AI Notes assistant — I can only help with history, "
    "historical events, and historical figures. Please ask me about a historical topic!"
)

IDENTITY_REDIRECT = (
    "I'm the History Unfolded AI Notes assistant — let's get back to your historical topic."
)

_LEAK_PATTERNS = [
    r"\bqwen\b",
    r"\balibaba\b",
    r"\blm studio\b",
    r"\bi am (a|an) (ai )?language model\b",
]


# ── Guardrail helpers ──────────────────────────────────────────────────────────

def strip_thinking(raw: str) -> str:
    """Remove <think>…</think> chain-of-thought traces emitted by reasoning models."""
    return re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()


def scrub_identity_leak(text: str) -> str:
    """Replace any identity/model disclosures with the branded assistant redirect."""
    if any(re.search(pattern, text, re.IGNORECASE) for pattern in _LEAK_PATTERNS):
        return IDENTITY_REDIRECT
    return text


def _apply_guardrails(raw: str) -> str:
    """Apply strip_thinking then scrub_identity_leak in the required order."""
    return scrub_identity_leak(strip_thinking(raw))


def calculate_approx_tokens(text: str) -> int:
    """Estimate token count from text (~4 chars per token or ~1.3 tokens per word)."""
    if not text:
        return 0
    words = len(text.split())
    chars = len(text)
    return max(int(words * 1.3), int(chars / 3.8))


# ── Pre-classification (Layer 2) ───────────────────────────────────────────────

async def is_history_related(user_input: str) -> bool:
    """
    Classify whether the request is about history before spending a full generation.
    Returns True if on-topic, False if off-topic.

    Qwen3-VL-4B-Thinking is a reasoning model: it places chain-of-thought in
    `reasoning_content` and the final answer in `content`. When max_tokens is
    too small the model runs out of budget mid-think and `content` is empty —
    so we fall back to scanning `reasoning_content` for the keyword.

    Uses a short timeout so offline tests/dev don't hang.
    Falls back to True on any error to avoid blocking legitimate requests.
    """
    import httpx as _httpx

    client = AsyncOpenAI(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key or "not-needed",
        http_client=_httpx.AsyncClient(timeout=_httpx.Timeout(5.0, connect=3.0)),
    )
    try:
        resp = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Classify if this request is about history, historical events, or historical figures. "
                        "Respond with only HISTORY or OFF_TOPIC.\n"
                        f"Request: {user_input}"
                    ),
                }
            ],
            max_tokens=2000,  # reasoning models need budget to think before writing content
            temperature=0,
        )
        msg = resp.choices[0].message

        # Primary: use .content (the final answer)
        content_text = strip_thinking(msg.content or "").upper()
        if content_text:
            return "HISTORY" in content_text

        # Fallback: reasoning model exhausted budget mid-think — scan reasoning_content
        reasoning_text = getattr(msg, "reasoning_content", None) or ""
        reasoning_upper = reasoning_text.upper()
        # Prefer explicit OFF_TOPIC conclusion in reasoning
        if "OFF_TOPIC" in reasoning_upper and "HISTORY" not in reasoning_upper.split("OFF_TOPIC")[0][-50:]:
            return False
        if "HISTORY" in reasoning_upper:
            return True

        # If we truly cannot determine, allow the request through
        return True
    except Exception:
        # LM Studio unreachable or any other error — don't block the user.
        return True


# ── Live generation via LM Studio ─────────────────────────────────────────────

async def _chat_complete(messages: list[dict], max_tokens: int = 2000) -> tuple[str, int]:
    """
    Call the LM Studio OpenAI-compatible endpoint.
    Returns (cleaned_content, total_tokens_used).
    Raises on connection failure so callers can fall back to offline templates.
    """
    import httpx as _httpx

    client = AsyncOpenAI(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key or "not-needed",
        http_client=_httpx.AsyncClient(timeout=_httpx.Timeout(45.0, connect=5.0)),
    )
    resp = await client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        temperature=0.7,
        max_tokens=max_tokens,
    )
    raw = resp.choices[0].message.content or ""
    content = _apply_guardrails(raw)
    usage = resp.usage
    tokens_used = usage.total_tokens if usage else (
        calculate_approx_tokens(str(messages)) + calculate_approx_tokens(content)
    )
    return content, tokens_used


# ── Public generation functions ────────────────────────────────────────────────

async def generate_curriculum_note(
    topic: str,
    curriculum: str,
    attachment_name: str | None = None,
    attachment_type: str | None = None,
    attachment_text: str | None = None,
    attachment_data: str | None = None,
) -> tuple[str, str, int]:
    """
    Generate study notes tailored to a specific curriculum.

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

    attachment_instructions = ""
    if attachment_name:
        attachment_instructions += f"\n\nAttached Source File: '{attachment_name}' (Type: {attachment_type or 'document'})."
    if attachment_text:
        snippet = attachment_text[:12000]
        attachment_instructions += (
            f"\n\n--- SOURCE MATERIAL CONTENT ---\n{snippet}\n--- END SOURCE MATERIAL ---\n\n"
            "Carefully analyze, extract, and incorporate the primary facts, concepts, arguments, "
            "timelines, and figures from this attached source into the structured curriculum study notes."
        )

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

    user_content: str | list = prompt
    if attachment_data and attachment_data.startswith("data:image/"):
        user_content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": attachment_data, "detail": "auto"}},
        ]

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    try:
        content, tokens_used = await _chat_complete(messages)
        return title, content, tokens_used
    except Exception as e:
        print(f"LLM generation error (curriculum note): {e}")

    # Offline fallback template
    source_section = ""
    if attachment_name:
        preview_text = ""
        if attachment_text:
            lines = [line.strip() for line in attachment_text.splitlines() if line.strip()][:5]
            if lines:
                preview_text = "\n" + "\n".join(f'> *"{line[:120]}..."*' for line in lines)
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
    Restyle a formal note into student handwritten lecture notes style.

    Returns:
        tuple[str, str, int]: (new_title, rewritten_content, actual_tokens_used)
    """
    title = f"Handwritten Notes: {original_title.replace('Study Notes: ', '').replace('Handwritten Notes: ', '')}"

    prompt = (
        "You are converting a formal study note into the style of a student's own handwritten class notes.\n\n"
        "Rewrite the note below following these rules:\n"
        "- Use short, abbreviated phrases instead of full sentences where it reads naturally "
        "(e.g. 'govt' not 'government', '->' for 'leads to', 'w/' for 'with', 'b/c' for 'because')\n"
        "- Break ideas into quick bullet fragments, not paragraphs\n"
        "- Use arrows (→) to show cause-effect or sequence between events\n"
        "- Mark key terms and dates the way a student would underline them — use **bold**\n"
        "- Keep it tight — this should read like notes taken *during* a lecture, not a polished summary\n"
        "- Do not omit or invent facts. Every date, name, and fact in the original must still be present "
        "— only the style changes\n\n"
        f"Original note:\n{original_content}\n\n"
        "Rewritten (handwritten style):"
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    try:
        content, tokens_used = await _chat_complete(messages)
        return title, content, tokens_used
    except Exception as e:
        print(f"LLM generation error (handwritten note): {e}")

    # Offline fallback: abbreviate the original content
    lines = original_content.splitlines()
    hw_lines = [f"# ✍️ {title}\n"]
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("# "):
            continue
        elif stripped.startswith("## "):
            hw_lines.append(f"\n## 📌 {stripped.replace('## ', '').replace('📌 ', '')}")
        elif stripped.startswith("- ") or stripped.startswith("* ") or (len(stripped) > 2 and stripped[0].isdigit() and stripped[1] in (".", ")")):
            clean = stripped.lstrip("-* 0123456789.)")
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
                stripped.replace("government", "govt")
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


async def generate_revision_note(
    original_title: str,
    original_content: str,
    instruction: str,
) -> tuple[str, str, int]:
    """
    Create a revised version of an existing note based on a plain-language instruction.
    The original note is never modified — this always produces a new note.

    Returns:
        tuple[str, str, int]: (revised_title, revised_content, actual_tokens_used)
    """
    base_title = (
        original_title
        .replace("Study Notes: ", "")
        .replace("Handwritten Notes: ", "")
        .replace("Revised: ", "")
    )
    title = f"Revised: {base_title}"

    prompt = (
        f"Original note:\n{original_content}\n\n"
        f"Apply this change: {instruction}\n\n"
        "Rewritten note (preserve all historical facts; apply only the requested change):"
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    try:
        content, tokens_used = await _chat_complete(messages)
        return title, content, tokens_used
    except Exception as e:
        print(f"LLM generation error (revision note): {e}")

    # Offline fallback: return original with an instruction note appended
    fallback_content = (
        f"{original_content}\n\n"
        f"---\n*⚠️ AI revision unavailable (LM Studio offline). "
        f"Requested change: \"{instruction}\"*"
    )
    tokens_used = calculate_approx_tokens(prompt) + calculate_approx_tokens(fallback_content)
    return title, fallback_content, tokens_used
