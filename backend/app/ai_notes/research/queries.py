"""Local query preparation: no transcript, attachment or account data inputs."""
import re

from .providers import ResearchUnavailable


def plan_query(question: str, root_topic: str | None = None, context_topics: list[str] | None = None) -> str:
    def clean(value):
        value = re.sub(r"https?://\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", " ", value)
        value = re.sub(r"\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\b", " ", value)
        return " ".join(value.split())[:240]

    question = clean(question)
    # Root is the user's original topic, never generated answer text.
    if root_topic and (len(question.split()) < 7 or re.search(r"\b(he|she|they|it|that|those|them)\b", question, re.I)):
        recent = " ".join(clean(topic)[:80] for topic in (context_topics or [])[-2:])
        question = f"{clean(root_topic)[:80]} {recent} {question}"
    if not question.strip():
        raise ResearchUnavailable("Please provide a historical question to research.")
    return question[:360]
